'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardBody } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { CategoryServicePicker, ServiceOption } from '@/components/CategoryServicePicker';
import { SessionCard } from '@/components/SessionCard';
import { ClientHistoryModal } from '@/components/ClientHistoryModal';
import { Toast } from '@/components/Toast';
import { ReceiptModal } from '@/components/ReceiptModal';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useRealtime } from '@/hooks/useRealtime';
import { useNotification } from '@/hooks/useNotification';
import { SessionService } from '@/lib/services/sessionService';
import { SessionRepository } from '@/lib/repositories/sessionRepository';
import { ClientRepository } from '@/lib/repositories/clientRepository';
import { ServiceRepository } from '@/lib/repositories/serviceRepository';
import { StaffRepository } from '@/lib/repositories/staffRepository';
import { ProductRepository } from '@/lib/repositories/productRepository';
import { batchUpdate, firebaseConstraints } from '@/lib/firebase/db';
import { fmtBs, unitLabel, toDate } from '@/lib/utils/helpers';
import type { Session } from '@/types/models';
import ES from '@/config/text.es';

interface MaterialEntry {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  pricePerUnit: number; // selling price per unit
  totalPrice: number; // pricePerUnit * quantity
}

interface PaymentEntry {
  amount: number;
  method: string;
  payerNote: string;
  amountGiven: number; // for cash change calculation
}

export default function SessionsPage() {
  const { userData } = useAuth();
  const { notifications, removeNotification, success, error } = useNotification();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddServiceModalOpen, setIsAddServiceModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isQuickClientOpen, setIsQuickClientOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyClientId, setHistoryClientId] = useState<string | null>(null);
  const [cancelSessionId, setCancelSessionId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [reopenSessionId, setReopenSessionId] = useState<string | null>(null);
  const [noteSessionId, setNoteSessionId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [receiptSession, setReceiptSession] = useState<Session | null>(null);
  const [suggestedServices, setSuggestedServices] = useState<{ serviceId: string; serviceName: string; count: number }[]>([]);

  // Quick client form
  const [quickClient, setQuickClient] = useState({ firstName: '', lastName: '', phone: '' });

  // Add service form — editable price + materials
  const [serviceForm, setServiceForm] = useState({
    serviceId: '',
    staffId: '',
    price: 0,
  });
  const [materials, setMaterials] = useState<MaterialEntry[]>([]);

  // Payment form — supports multiple split payments + per-service selection
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>([]);
  const [sessionRemainingForPayment, setSessionRemainingForPayment] = useState(0);
  const [selectedPaymentServiceIds, setSelectedPaymentServiceIds] = useState<string[]>([]);
  const [paymentSessionRef, setPaymentSessionRef] = useState<Session | null>(null);
  const [showAdvancedPayment, setShowAdvancedPayment] = useState(false);

  // Data — real-time sessions (syncs across admin/staff/manager instantly)
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const sessionConstraints = useMemo(() => [
    firebaseConstraints.where('salonId', '==', userData?.salonId || ''),
    firebaseConstraints.where('date', '==', today),
  ], [userData?.salonId, today]);
  const { data: sessions } = useRealtime<Session>('sessions', sessionConstraints, !!userData?.salonId);

  const { data: clients, refetch: refetchClients } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ClientRepository.getSalonClients(userData.salonId);
  }, [userData?.salonId]);

  const { data: services } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ServiceRepository.getSalonServices(userData.salonId);
  }, [userData?.salonId]);

  const { data: staffList } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return StaffRepository.getSalonStaff(userData.salonId);
  }, [userData?.salonId]);

  const { data: products } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ProductRepository.getSalonProducts(userData.salonId);
  }, [userData?.salonId]);

  // Dropdown options
  const clientOptions = (clients || []).map((c) => ({
    value: c.id,
    label: `${c.firstName} ${c.lastName}`,
    secondary: c.phone,
  }));

  const categoryLabels: Record<string, string> = {
    haircut: ES.services.haircut, coloring: ES.services.coloring,
    styling: ES.services.styling, nails: ES.services.nails,
    waxing: ES.services.waxing, skincare: ES.services.skincare,
    massage: ES.services.massage, other: ES.services.other,
  };

  const serviceOptions: ServiceOption[] = (services || []).map((s) => ({
    value: s.id,
    label: s.name,
    secondary: `${fmtBs(s.price)} · ${s.duration}min`,
    category: s.category,
    categoryLabel: categoryLabels[s.category] || s.category,
  }));

  // Filter staff by selected service — show only staff that perform this service
  // If staff has no serviceIds set (legacy data), show them anyway
  const filteredStaff = (staffList || []).filter((s) => {
    if (!serviceForm.serviceId) return true;
    const staffServiceIds = (s as unknown as { serviceIds?: string[] }).serviceIds;
    if (!staffServiceIds || staffServiceIds.length === 0) return true;
    return staffServiceIds.includes(serviceForm.serviceId);
  });

  // Determine which staff are currently busy (assigned to an active session service)
  const busyStaffIds = new Set<string>();
  (sessions || []).filter((s) => s.status === 'active').forEach((session) => {
    (session.services || []).forEach((svc) => {
      if (svc.status !== 'completed') {
        (svc.assignedStaff || []).forEach((id) => busyStaffIds.add(id));
      }
    });
  });

  const staffOptions = filteredStaff.map((s) => ({
    value: s.id,
    label: `${s.firstName} ${s.lastName}`,
    secondary: busyStaffIds.has(s.id) ? ES.staff.busy : undefined,
  }));

  const productOptions = (products || []).map((p) => ({
    value: p.id,
    label: p.name,
    secondary: `${ES.sessions.materialSellPrice}: ${fmtBs(p.price)}/${unitLabel(p.unit)} · Stock: ${p.currentStock}${p.currentStock <= p.minStock ? ' ⚠' : ''}`,
  }));

  // Low-stock products for alert banner
  const lowStockProducts = (products || []).filter((p) => p.currentStock <= p.minStock);

  // Name resolvers
  const getClientName = (id: string) => {
    const c = clients?.find((x) => x.id === id);
    return c ? `${c.firstName} ${c.lastName}` : '-';
  };

  const getStaffName = (id: string) => {
    const s = staffList?.find((x) => x.id === id);
    return s ? `${s.firstName} ${s.lastName}` : id;
  };

  // When service is selected, auto-fill price
  const handleServiceSelect = (serviceId: string) => {
    const svc = services?.find((s) => s.id === serviceId);
    setServiceForm({
      ...serviceForm,
      serviceId,
      price: svc?.price || 0,
    });
  };

  // Material helpers
  const handleAddMaterialRow = () => {
    setMaterials([...materials, { productId: '', productName: '', quantity: 1, unit: '', pricePerUnit: 0, totalPrice: 0 }]);
  };

  const handleMaterialProductSelect = (index: number, productId: string) => {
    const product = products?.find((p) => p.id === productId);
    if (!product) return;
    const updated = [...materials];
    updated[index] = {
      ...updated[index],
      productId,
      productName: product.name,
      unit: product.unit || 'ud',
      pricePerUnit: product.price,
      totalPrice: product.price * updated[index].quantity,
    };
    setMaterials(updated);
  };

  const handleMaterialQuantityChange = (index: number, qty: number) => {
    const updated = [...materials];
    updated[index] = {
      ...updated[index],
      quantity: qty,
      totalPrice: updated[index].pricePerUnit * qty,
    };
    setMaterials(updated);
  };

  const handleRemoveMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index));
  };

  const totalMaterialsCost = materials.reduce((sum, m) => sum + m.totalPrice, 0);
  // Handlers
  const handleCreateSession = async () => {
    if (!clientId || !userData?.salonId) {
      error(ES.messages.fillRequiredFields);
      return;
    }
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await SessionService.createSession({
        clientId,
        date: today,
        startTime: new Date(),
        salonId: userData.salonId,
      });
      success(ES.sessions.sessionCreated);
      setIsCreateModalOpen(false);
      setClientId('');

    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleAddService = async () => {
    if (!activeSessionId || !serviceForm.serviceId) {
      error(ES.messages.fillRequiredFields);
      return;
    }
    const svc = services?.find((s) => s.id === serviceForm.serviceId);
    if (!svc) return;

    // Filter out incomplete material rows
    const validMaterials = materials.filter((m) => m.productId && m.quantity > 0);

    setLoading(true);
    try {
      await SessionService.addServiceToSession({
        sessionId: activeSessionId,
        serviceId: svc.id,
        serviceName: svc.name,
        price: serviceForm.price,
        staffIds: serviceForm.staffId ? [serviceForm.staffId] : [],
        materials: validMaterials.map((m) => ({
          productId: m.productId,
          productName: m.productName,
          quantity: m.quantity,
          unit: m.unit,
          cost: m.totalPrice,
        })),
      });

      // Deduct stock atomically for all materials
      if (validMaterials.length > 0) {
        const stockUpdates = await Promise.all(
          validMaterials.map(async (m) => {
            const product = await ProductRepository.getProduct(m.productId);
            if (!product) throw new Error(`Product not found: ${m.productName}`);
            const newStock = product.currentStock - m.quantity;
            if (newStock < 0) throw new Error(`Insufficient stock for ${m.productName}`);
            return { collection: 'products', docId: m.productId, data: { currentStock: newStock } as Record<string, unknown> };
          })
        );
        await batchUpdate(stockUpdates);
      }

      success(ES.sessions.serviceAdded);
      setIsAddServiceModalOpen(false);
      setServiceForm({ serviceId: '', staffId: '', price: 0 });
      setMaterials([]);

    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessPayment = async () => {
    if (!activeSessionId) return;
    const validEntries = paymentEntries.filter((e) => e.amount > 0);
    if (validEntries.length === 0) {
      error(ES.messages.fillRequiredFields);
      return;
    }
    setLoading(true);
    try {
      // Process each payment entry sequentially
      for (const entry of validEntries) {
        await SessionService.processPayment({
          sessionId: activeSessionId,
          amount: entry.amount,
          method: entry.method,
          serviceIds: selectedPaymentServiceIds.length > 0 ? selectedPaymentServiceIds : undefined,
        });
      }
      success(ES.payments.paymentProcessed);
      setIsPaymentModalOpen(false);
      setPaymentEntries([]);

    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSession = async (sessionId: string) => {
    try {
      await SessionService.closeSession(sessionId);
      success(ES.sessions.sessionClosed);

    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    }
  };

  const handleCancelSession = async () => {
    if (!cancelSessionId || !cancelReason.trim()) {
      error(ES.sessions.cancelReasonRequired);
      return;
    }
    setLoading(true);
    try {
      await SessionService.cancelSession(cancelSessionId, cancelReason.trim());
      success(ES.sessions.sessionCancelled);
      setCancelSessionId(null);
      setCancelReason('');
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveService = async (sessionId: string, serviceItemId: string) => {
    try {
      await SessionService.removeServiceFromSession(sessionId, serviceItemId);
      success(ES.sessions.serviceRemoved);
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    }
  };

  const handleUpdateServiceStatus = async (sessionId: string, serviceItemId: string, newStatus: 'pending' | 'in_progress' | 'completed') => {
    try {
      await SessionService.updateServiceStatus(sessionId, serviceItemId, newStatus);
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    }
  };

  const handleReopenSession = async (sessionId: string) => {
    try {
      await SessionService.reopenSession(sessionId);
      success(ES.sessions.sessionReopened);
      setReopenSessionId(null);
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    }
  };

  const handleSaveNote = async () => {
    if (!noteSessionId || !noteText.trim()) return;
    setLoading(true);
    try {
      await SessionService.addSessionNote(noteSessionId, noteText.trim());
      success(ES.sessions.noteSaved);
      setNoteSessionId(null);
      setNoteText('');
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickCreateClient = async () => {
    if (!quickClient.firstName || !userData?.salonId) {
      error(ES.messages.fillRequiredFields);
      return;
    }
    setLoading(true);
    try {
      const newClientId = await ClientRepository.createClient(userData.salonId, {
        firstName: quickClient.firstName,
        lastName: quickClient.lastName,
        phone: quickClient.phone || '',
      });
      success(ES.clients.clientCreated);
      setQuickClient({ firstName: '', lastName: '', phone: '' });
      setIsQuickClientOpen(false);
      setClientId(newClientId);
      refetchClients();
    } catch (err) {
      const msg = err instanceof Error && err.message === 'PHONE_EXISTS'
        ? ES.clients.phoneExists
        : err instanceof Error ? err.message : ES.messages.operationFailed;
      error(msg);
    } finally {
      setLoading(false);
    }
  };

  const userRole = userData?.role || 'staff';
  const canCancel = userRole === 'admin' || userRole === 'manager';
  const activeSessions = sessions?.filter((s) => s.status === 'active') || [];
  const completedSessions = (sessions?.filter((s) => s.status === 'completed') || [])
    .sort((a, b) => toDate(b.endTime ?? b.startTime).getTime() - toDate(a.endTime ?? a.startTime).getTime());
  const cancelledSessions = sessions?.filter((s) => s.status === 'cancelled') || [];

  return (
    <div className="space-y-6 p-6">
      <Toast notifications={notifications} onDismiss={removeNotification} />

      {/* Low-stock alert banner */}
      {lowStockProducts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 flex items-center gap-2 text-sm">
          <span className="text-yellow-600">&#9888;</span>
          <span className="text-yellow-800 font-medium">{ES.stockAlert.lowStock}:</span>
          <span className="text-yellow-700">
            {lowStockProducts.slice(0, 3).map((p) => `${p.name} (${p.currentStock})`).join(', ')}
            {lowStockProducts.length > 3 && ` +${lowStockProducts.length - 3}`}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{ES.sessions.title}</h1>
        <Button onClick={() => setIsCreateModalOpen(true)} size="lg">
          {ES.sessions.new}
        </Button>
      </div>

      {/* Active Sessions */}
      {activeSessions.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-center py-8">
              <p className="text-gray-500 text-lg mb-2">{ES.sessions.noActiveSessions}</p>
              <p className="text-gray-400 text-sm">{ES.sessions.noActiveSessionsCta}</p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {activeSessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              clientName={getClientName(session.clientId)}
              getStaffName={getStaffName}
              onAddService={async () => {
                setActiveSessionId(session.id);
                setServiceForm({ serviceId: '', staffId: '', price: 0 });
                setMaterials([]);
                setSuggestedServices([]);
                setIsAddServiceModalOpen(true);
                // Load frequent services for this client
                if (userData?.salonId && session.clientId) {
                  try {
                    const history = await SessionRepository.getUserSessions(userData.salonId, session.clientId);
                    const freq: Record<string, { serviceName: string; count: number }> = {};
                    history.forEach((s) => (s.services || []).forEach((svc) => {
                      if (!freq[svc.serviceId]) freq[svc.serviceId] = { serviceName: svc.serviceName, count: 0 };
                      freq[svc.serviceId].count++;
                    }));
                    const sorted = Object.entries(freq)
                      .map(([serviceId, v]) => ({ serviceId, ...v }))
                      .sort((a, b) => b.count - a.count)
                      .slice(0, 3);
                    setSuggestedServices(sorted);
                  } catch { /* ignore */ }
                }
              }}
              onProcessPayment={() => {
                setActiveSessionId(session.id);
                setPaymentSessionRef(session);
                // Default: all services selected
                const allSvcIds = (session.services || []).map((s) => s.id);
                setSelectedPaymentServiceIds(allSvcIds);
                const paid = (session.payments || []).reduce((sum, p) => sum + p.amount, 0);
                const remaining = session.totalAmount - paid;
                setSessionRemainingForPayment(remaining);
                setPaymentEntries([{ amount: remaining, method: 'cash', payerNote: '', amountGiven: 0 }]);
                setShowAdvancedPayment(false);
                setIsPaymentModalOpen(true);
              }}
              onCloseSession={() => handleCloseSession(session.id)}
              onViewClientHistory={() => setHistoryClientId(session.clientId)}
              onCancelSession={() => {
                setCancelSessionId(session.id);
                setCancelReason('');
              }}
              onRemoveService={(serviceItemId) => handleRemoveService(session.id, serviceItemId)}
              onUpdateServiceStatus={(serviceItemId, newStatus) => handleUpdateServiceStatus(session.id, serviceItemId, newStatus)}
              canCancel={canCancel}
              loading={loading}
            />
          ))}
        </div>
      )}

      {/* Completed Sessions */}
      {completedSessions.length > 0 && (
        <>
          <h2 className="text-xl font-semibold text-gray-700 pt-4">{ES.sessions.completed}</h2>
          <div className="space-y-3">
            {completedSessions.map((session) => {
              const sessionServices = session.services || [];
              const sessionPayments = session.payments || [];
              const paidAmount = sessionPayments.filter((p) => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);
              const remaining = session.totalAmount - paidAmount;

              return (
                <Card key={session.id} className="opacity-85">
                  <CardBody>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{getClientName(session.clientId)}</p>
                        <p className="text-sm text-gray-500">
                          {sessionServices.length} {ES.sessions.services.toLowerCase()} · {fmtBs(session.totalAmount)}
                          {remaining > 0 && <span className="text-red-500 ml-1">({ES.payments.remaining}: {fmtBs(remaining)})</span>}
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium shrink-0">
                        {ES.sessions.completed}
                      </span>
                    </div>

                    {/* Services summary */}
                    {sessionServices.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {sessionServices.map((svc) => (
                          <div key={svc.id} className="flex justify-between text-sm text-gray-600">
                            <span>{svc.serviceName}</span>
                            <span>{fmtBs(svc.price)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Notes */}
                    {session.notes && (
                      <p className="text-xs text-gray-400 mt-2 italic">{session.notes}</p>
                    )}

                    {/* Edit actions (admin/manager only) */}
                    {canCancel && (
                      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                        <Button size="sm" variant="secondary" onClick={async () => {
                          setActiveSessionId(session.id);
                          setServiceForm({ serviceId: '', staffId: '', price: 0 });
                          setMaterials([]);
                          setSuggestedServices([]);
                          setIsAddServiceModalOpen(true);
                          if (userData?.salonId && session.clientId) {
                            try {
                              const history = await SessionRepository.getUserSessions(userData.salonId, session.clientId);
                              const freq: Record<string, { serviceName: string; count: number }> = {};
                              history.forEach((s) => (s.services || []).forEach((svc) => {
                                if (!freq[svc.serviceId]) freq[svc.serviceId] = { serviceName: svc.serviceName, count: 0 };
                                freq[svc.serviceId].count++;
                              }));
                              const sorted = Object.entries(freq)
                                .map(([serviceId, v]) => ({ serviceId, ...v }))
                                .sort((a, b) => b.count - a.count)
                                .slice(0, 3);
                              setSuggestedServices(sorted);
                            } catch { /* ignore */ }
                          }
                        }}>
                          {ES.sessions.addService}
                        </Button>
                        {remaining > 0 && (
                          <Button size="sm" variant="primary" onClick={() => {
                            setActiveSessionId(session.id);
                            setPaymentSessionRef(session);
                            const allSvcIds = sessionServices.map((s) => s.id);
                            setSelectedPaymentServiceIds(allSvcIds);
                            setSessionRemainingForPayment(remaining);
                            setPaymentEntries([{ amount: remaining, method: 'cash', payerNote: '', amountGiven: 0 }]);
                            setShowAdvancedPayment(false);
                setIsPaymentModalOpen(true);
                          }}>
                            {ES.payments.processPayment}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => {
                          setNoteSessionId(session.id);
                          setNoteText('');
                        }}>
                          {ES.sessions.addNote}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setReopenSessionId(session.id)}>
                          {ES.sessions.reopenSession}
                        </Button>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Button size="sm" variant="ghost" onClick={() => setReceiptSession(session)}>
                        {ES.receipt.viewReceipt}
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Cancelled Sessions */}
      {cancelledSessions.length > 0 && (
        <>
          <h2 className="text-xl font-semibold text-gray-400 pt-4">{ES.sessions.cancelledSessions}</h2>
          <div className="space-y-3">
            {cancelledSessions.map((session) => (
              <Card key={session.id} className="opacity-50">
                <CardBody>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-500 line-through">{getClientName(session.clientId)}</p>
                      <p className="text-sm text-gray-400">
                        {(session.services || []).length} {ES.sessions.services.toLowerCase()} · {fmtBs(session.totalAmount)}
                      </p>
                      {session.notes && (
                        <p className="text-xs text-red-400 mt-1">{session.notes}</p>
                      )}
                    </div>
                    <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-xs font-medium">
                      {ES.sessions.cancelled}
                    </span>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ==================== MODALS ==================== */}

      {/* Reopen Session Confirm Modal */}
      <Modal isOpen={!!reopenSessionId} onClose={() => setReopenSessionId(null)} title={ES.sessions.reopenSession}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{ES.sessions.confirmReopen}</p>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setReopenSessionId(null)}>
              {ES.actions.cancel}
            </Button>
            <Button onClick={() => reopenSessionId && handleReopenSession(reopenSessionId)}>
              {ES.sessions.reopenSession}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancel Session Modal — requires reason */}
      <Modal isOpen={!!cancelSessionId} onClose={() => setCancelSessionId(null)} title={ES.sessions.cancelSession}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{ES.sessions.confirmCancel}</p>
          <Input
            label={ES.sessions.cancelReason}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder={ES.sessions.cancelReasonPlaceholder}
            required
          />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCancelSessionId(null)}>
              {ES.actions.cancel}
            </Button>
            <Button variant="danger" onClick={handleCancelSession} loading={loading}>
              {ES.sessions.cancelSession}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Note Modal */}
      <Modal isOpen={!!noteSessionId} onClose={() => setNoteSessionId(null)} title={ES.sessions.addNote}>
        <div className="space-y-4">
          <Input
            label={ES.sessions.noteLabel}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder={ES.sessions.notePlaceholder}
            required
          />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setNoteSessionId(null)}>
              {ES.actions.cancel}
            </Button>
            <Button onClick={handleSaveNote} loading={loading}>
              {ES.actions.save}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create Session Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title={ES.sessions.create}>
        <div className="space-y-4">
          <SearchableSelect
            label={ES.sessions.selectClient}
            options={clientOptions}
            value={clientId}
            onChange={setClientId}
            placeholder={ES.actions.search}
            required
          />
          <button
            type="button"
            onClick={() => setIsQuickClientOpen(true)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            {ES.clients.addQuick}
          </button>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
              {ES.actions.cancel}
            </Button>
            <Button onClick={handleCreateSession} loading={loading}>
              {ES.sessions.create}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Quick Client Modal */}
      <Modal isOpen={isQuickClientOpen} onClose={() => setIsQuickClientOpen(false)} title={ES.clients.quickAddTitle}>
        <div className="space-y-4">
          <Input
            label={ES.clients.name}
            value={quickClient.firstName}
            onChange={(e) => setQuickClient({ ...quickClient, firstName: e.target.value })}
            required
          />
          <Input
            label={ES.clients.lastName}
            value={quickClient.lastName}
            onChange={(e) => setQuickClient({ ...quickClient, lastName: e.target.value })}
          />
          <Input
            label={ES.clients.phoneOptional}
            type="tel"
            value={quickClient.phone}
            onChange={(e) => setQuickClient({ ...quickClient, phone: e.target.value })}
          />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsQuickClientOpen(false)}>
              {ES.actions.cancel}
            </Button>
            <Button onClick={handleQuickCreateClient} loading={loading}>
              {ES.actions.save}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Service Modal — with editable price + materials */}
      <Modal isOpen={isAddServiceModalOpen} onClose={() => setIsAddServiceModalOpen(false)} title={ES.sessions.addService} size="lg">
        <div className="space-y-4">
          {/* Suggested services based on client history */}
          {suggestedServices.length > 0 && !serviceForm.serviceId && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-600 mb-2">{ES.frequentClient.usualServices}</p>
              <div className="flex flex-wrap gap-2">
                {suggestedServices.map((sug) => (
                  <button
                    key={sug.serviceId}
                    type="button"
                    onClick={() => handleServiceSelect(sug.serviceId)}
                    className="px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    {sug.serviceName} <span className="text-xs text-blue-400">({sug.count}x)</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-blue-400 mt-1">{ES.frequentClient.basedOnHistory}</p>
            </div>
          )}

          {/* 1. Select service — mobile-friendly category picker */}
          <CategoryServicePicker
            label={ES.sessions.selectService}
            options={serviceOptions}
            value={serviceForm.serviceId}
            onChange={handleServiceSelect}
            required
          />

          {/* 2. Editable price — auto-filled from service, changeable */}
          {serviceForm.serviceId && (
            <Input
              label={ES.sessions.customPrice}
              type="number"
              value={serviceForm.price}
              onChange={(e) => setServiceForm({ ...serviceForm, price: parseFloat(e.target.value) || 0 })}
              required
            />
          )}

          {/* 3. Select staff */}
          <SearchableSelect
            label={ES.sessions.selectStaff}
            options={staffOptions}
            value={serviceForm.staffId}
            onChange={(v) => setServiceForm({ ...serviceForm, staffId: v })}
            placeholder={ES.actions.search}
          />

          {/* 4. Materials — progressive disclosure */}
          {serviceForm.serviceId && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  {ES.sessions.materialsUsed}
                </label>
                <button
                  type="button"
                  onClick={handleAddMaterialRow}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  {ES.sessions.addMaterial}
                </button>
              </div>

              {materials.length === 0 ? (
                <p className="text-xs text-gray-400">{ES.sessions.noMaterials}</p>
              ) : (
                <div className="space-y-3">
                  {materials.map((mat, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2">
                      <SearchableSelect
                        label=""
                        options={productOptions}
                        value={mat.productId}
                        onChange={(v) => handleMaterialProductSelect(idx, v)}
                        placeholder={ES.material.product}
                      />
                      <div className="flex gap-3 items-end">
                        <div className="flex-1">
                          <Input
                            label={ES.sessions.quantity}
                            type="number"
                            step="0.01"
                            min="0"
                            value={mat.quantity}
                            onChange={(e) => handleMaterialQuantityChange(idx, parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        {mat.unit && (
                          <span className="text-sm text-gray-500 pb-3">{mat.unit}</span>
                        )}
                        <div className="text-right pb-3">
                          <p className="text-xs text-gray-400">{fmtBs(mat.pricePerUnit)}/{mat.unit}</p>
                          <p className="text-sm font-semibold">{fmtBs(mat.totalPrice)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMaterial(idx)}
                          className="text-red-500 hover:text-red-700 text-xs pb-3"
                        >
                          {ES.sessions.removeMaterial}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 5. Summary — service price + materials = total to charge client */}
          {serviceForm.serviceId && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">{ES.sessions.servicesSubtotal}</span>
                <span className="font-semibold">{fmtBs(serviceForm.price)}</span>
              </div>
              {totalMaterialsCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">{ES.sessions.materialsSubtotal}</span>
                  <span className="text-gray-900 font-semibold">+{fmtBs(totalMaterialsCost)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                <span className="text-gray-900 font-semibold">{ES.payments.total}</span>
                <span className="text-gray-900 font-bold">{fmtBs(serviceForm.price + totalMaterialsCost)}</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsAddServiceModalOpen(false)}>
              {ES.actions.cancel}
            </Button>
            <Button onClick={handleAddService} loading={loading}>
              {ES.sessions.addService}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Payment Modal — simple default: big total → tap method → confirm. Advanced: split + per-service */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title={ES.payments.processPayment} size="lg">
        <div className="space-y-4">

          {/* Advanced toggle */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowAdvancedPayment(!showAdvancedPayment)}
              className="text-xs text-blue-600 font-medium flex items-center gap-1 py-1 px-2 rounded hover:bg-blue-50"
            >
              {showAdvancedPayment ? '▲' : '▼'} {ES.payments.advancedOptions}
            </button>
          </div>

          {/* ADVANCED: Per-service selection — pick which services to pay for */}
          {showAdvancedPayment && paymentSessionRef && (paymentSessionRef.services || []).length > 1 && (
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{ES.payments.selectServices}</p>
                <button
                  type="button"
                  onClick={() => {
                    const allIds = (paymentSessionRef.services || []).map((s) => s.id);
                    const allSelected = selectedPaymentServiceIds.length === allIds.length;
                    const newIds = allSelected ? [] : allIds;
                    setSelectedPaymentServiceIds(newIds);
                    // Recalculate amount
                    const selectedTotal = allSelected ? 0 : paymentSessionRef.totalAmount;
                    const paid = (paymentSessionRef.payments || []).reduce((sum, p) => sum + p.amount, 0);
                    const remaining = Math.max(0, selectedTotal - paid);
                    setSessionRemainingForPayment(remaining);
                    setPaymentEntries([{ amount: remaining, method: paymentEntries[0]?.method || 'cash', payerNote: '', amountGiven: 0 }]);
                  }}
                  className="text-xs text-blue-600 font-medium"
                >
                  {selectedPaymentServiceIds.length === (paymentSessionRef.services || []).length ? ES.actions.cancel : ES.payments.allServices}
                </button>
              </div>
              <div className="space-y-1">
                {(paymentSessionRef.services || []).map((svc) => {
                  const isChecked = selectedPaymentServiceIds.includes(svc.id);
                  // Calculate already-paid amount for this service from prior payments that covered it
                  const alreadyPaidForService = (paymentSessionRef.payments || [])
                    .filter((p) => p.status === 'completed' && p.serviceIds?.includes(svc.id))
                    .reduce((sum, p) => {
                      // Split payment evenly across the services it covers
                      const coveredCount = (p.serviceIds || []).length;
                      return sum + (coveredCount > 0 ? p.amount / coveredCount : 0);
                    }, 0);
                  const svcMaterialCost = (svc.materialsUsed || []).reduce((sum, m) => sum + m.cost, 0);
                  const svcTotal = svc.price + svcMaterialCost;
                  const svcRemaining = Math.max(0, svcTotal - alreadyPaidForService);

                  return (
                    <label key={svc.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${isChecked ? 'bg-blue-50' : 'hover:bg-gray-100'}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          const newIds = isChecked
                            ? selectedPaymentServiceIds.filter((id) => id !== svc.id)
                            : [...selectedPaymentServiceIds, svc.id];
                          setSelectedPaymentServiceIds(newIds);
                          // Recalculate selected total
                          const allSvcs = paymentSessionRef.services || [];
                          const selectedSvcs = allSvcs.filter((s) => newIds.includes(s.id));
                          const selectedSvcTotal = selectedSvcs.reduce((sum, s) => {
                            const matCost = (s.materialsUsed || []).reduce((ms, m) => ms + m.cost, 0);
                            return sum + s.price + matCost;
                          }, 0);
                          const paid = (paymentSessionRef.payments || []).reduce((sum, p) => sum + p.amount, 0);
                          const remaining = Math.max(0, selectedSvcTotal - paid);
                          setSessionRemainingForPayment(remaining);
                          setPaymentEntries([{ amount: remaining, method: paymentEntries[0]?.method || 'cash', payerNote: '', amountGiven: 0 }]);
                        }}
                        className="rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{svc.serviceName}</p>
                      </div>
                      <span className="text-sm font-semibold text-gray-700">{fmtBs(svcRemaining > 0 ? svcRemaining : svcTotal)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Client credit balance — if they have one */}
          {(() => {
            const clientForPayment = paymentSessionRef ? clients?.find((c) => c.id === paymentSessionRef.clientId) : null;
            const creditBal = (clientForPayment as { creditBalance?: number } | null)?.creditBalance || 0;
            if (creditBal <= 0) return null;
            const applyAmount = Math.min(creditBal, sessionRemainingForPayment);
            return (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-600 font-medium">{ES.payments.creditBalance}</p>
                  <p className="text-lg font-bold text-green-800">{fmtBs(creditBal)}</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (!paymentSessionRef || !activeSessionId) return;
                    setLoading(true);
                    try {
                      await ClientRepository.deductCredit(paymentSessionRef.clientId, applyAmount);
                      await SessionService.processPayment({
                        sessionId: activeSessionId,
                        amount: applyAmount,
                        method: 'credit',
                        serviceIds: selectedPaymentServiceIds.length > 0 ? selectedPaymentServiceIds : undefined,
                      });
                      success(ES.payments.creditApplied);
                      setSessionRemainingForPayment(Math.max(0, sessionRemainingForPayment - applyAmount));
                      setPaymentEntries([{ amount: Math.max(0, sessionRemainingForPayment - applyAmount), method: 'cash', payerNote: '', amountGiven: 0 }]);
                      refetchClients();
                    } catch (err) {
                      error(err instanceof Error ? err.message : ES.messages.operationFailed);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700 transition-colors"
                >
                  {ES.payments.applyCredit} {fmtBs(applyAmount)}
                </button>
              </div>
            );
          })()}

          {/* END advanced: per-service */}

          {/* Big total display */}
          <div className="text-center py-3">
            <p className="text-sm text-gray-500 mb-1">{ES.payments.remaining}</p>
            <p className="text-4xl font-bold text-gray-900">{fmtBs(sessionRemainingForPayment)}</p>
          </div>

          {/* Payment entries */}
          {paymentEntries.map((entry, idx) => {
            const change = entry.method === 'cash' && entry.amountGiven > entry.amount
              ? entry.amountGiven - entry.amount
              : 0;
            const methodLabels: Record<string, string> = {
              cash: `💵 ${ES.payments.cash}`,
              card: `💳 ${ES.payments.card}`,
              qr_code: `📱 ${ES.payments.qrCode}`,
              transfer: `🏦 ${ES.payments.transfer}`,
            };

            return (
              <div key={idx} className={`rounded-xl p-4 space-y-3 ${paymentEntries.length > 1 ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
                {/* Split header with remove */}
                {paymentEntries.length > 1 && (
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                      <Input
                        label=""
                        value={entry.payerNote}
                        onChange={(e) => {
                          const updated = [...paymentEntries];
                          updated[idx] = { ...updated[idx], payerNote: e.target.value };
                          setPaymentEntries(updated);
                        }}
                        placeholder={ES.payments.payerNotePlaceholder}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setPaymentEntries(paymentEntries.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-600 p-2"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Amount — large, tappable */}
                <div className="text-center">
                  <label className="block text-xs text-gray-500 mb-1">{ES.payments.amount}</label>
                  <input
                    type="number"
                    value={entry.amount || ''}
                    onChange={(e) => {
                      const updated = [...paymentEntries];
                      updated[idx] = { ...updated[idx], amount: parseFloat(e.target.value) || 0 };
                      setPaymentEntries(updated);
                    }}
                    className="w-full text-center text-2xl font-bold border-b-2 border-gray-300 focus:border-blue-500 bg-transparent outline-none py-2"
                  />
                </div>

                {/* Payment method — large icon buttons */}
                <div className="grid grid-cols-4 gap-2">
                  {(['cash', 'card', 'qr_code', 'transfer'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        const updated = [...paymentEntries];
                        updated[idx] = { ...updated[idx], method: m, amountGiven: 0 };
                        setPaymentEntries(updated);
                      }}
                      className={`flex flex-col items-center py-3 px-2 rounded-xl border-2 text-xs font-medium transition-all ${
                        entry.method === m
                          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-xl mb-1">{m === 'cash' ? '💵' : m === 'card' ? '💳' : m === 'qr_code' ? '📱' : '🏦'}</span>
                      <span>{m === 'cash' ? ES.payments.cash : m === 'card' ? ES.payments.card : m === 'qr_code' ? ES.payments.qrCode : ES.payments.transfer}</span>
                    </button>
                  ))}
                </div>

                {/* Cash change calculator — yellow panel */}
                {entry.method === 'cash' && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <label className="block text-xs text-yellow-700 mb-1">{ES.payments.amountGiven}</label>
                    <input
                      type="number"
                      value={entry.amountGiven || ''}
                      onChange={(e) => {
                        const updated = [...paymentEntries];
                        updated[idx] = { ...updated[idx], amountGiven: parseFloat(e.target.value) || 0 };
                        setPaymentEntries(updated);
                      }}
                      className="w-full text-center text-xl font-bold border-b-2 border-yellow-300 focus:border-yellow-500 bg-transparent outline-none py-1 mb-2"
                      placeholder="0.00"
                    />
                    {entry.amountGiven > 0 && (
                      <div className="text-center pt-1">
                        <span className="text-sm text-yellow-700">{ES.payments.change}</span>
                        <p className={`text-3xl font-black ${change > 0 ? 'text-yellow-800' : 'text-gray-400'}`}>
                          {fmtBs(change)}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* ADVANCED: Split/Add person button */}
          {showAdvancedPayment && (
            <button
              type="button"
              onClick={() => {
                const usedAmount = paymentEntries.reduce((sum, e) => sum + e.amount, 0);
                const leftover = Math.max(0, sessionRemainingForPayment - usedAmount);
                setPaymentEntries([...paymentEntries, { amount: leftover, method: 'cash', payerNote: '', amountGiven: 0 }]);
              }}
              className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-base text-blue-600 font-semibold hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              👥 {ES.payments.splitPayment}
            </button>
          )}

          {/* Summary bar when split */}
          {paymentEntries.length > 1 && (
            <div className="bg-gray-100 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{ES.payments.paymentSummary}</p>
              {paymentEntries.map((entry, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {entry.payerNote || `Persona ${idx + 1}`} — {
                      entry.method === 'cash' ? ES.payments.cash :
                      entry.method === 'card' ? ES.payments.card :
                      entry.method === 'qr_code' ? ES.payments.qrCode :
                      ES.payments.transfer
                    }
                  </span>
                  <span className="font-semibold">{fmtBs(entry.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-gray-300 pt-2 mt-1">
                <span className="font-bold text-gray-900">{ES.payments.total}</span>
                <span className="font-black text-gray-900">
                  {fmtBs(paymentEntries.reduce((sum, e) => sum + e.amount, 0))}
                </span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setIsPaymentModalOpen(false)} size="lg" className="flex-1">
              {ES.actions.cancel}
            </Button>
            <Button onClick={handleProcessPayment} loading={loading} size="lg" className="flex-1">
              ✓ {ES.payments.confirmPayments}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Client History Modal */}
      <ClientHistoryModal
        isOpen={!!historyClientId}
        onClose={() => setHistoryClientId(null)}
        clientId={historyClientId || ''}
        clientName={historyClientId ? getClientName(historyClientId) : ''}
        salonId={userData?.salonId || ''}
        getStaffName={getStaffName}
      />

      {/* FAB — mobile only, always-visible "+ Nuevo Trabajo" when scrolled */}
      <button
        type="button"
        onClick={() => setIsCreateModalOpen(true)}
        className="md:hidden fixed bottom-6 right-6 z-40 w-14 h-14 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full shadow-lg flex items-center justify-center text-3xl leading-none transition-colors"
        aria-label={ES.sessions.new}
      >
        +
      </button>

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={!!receiptSession}
        onClose={() => setReceiptSession(null)}
        session={receiptSession}
        clientName={receiptSession ? getClientName(receiptSession.clientId) : ''}
        getStaffName={getStaffName}
        salonName={ES.app.name}
        clientPhone={receiptSession ? clients?.find((c) => c.id === receiptSession.clientId)?.phone : undefined}
      />
    </div>
  );
}
