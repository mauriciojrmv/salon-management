'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardBody } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { ClientHistoryModal } from '@/components/ClientHistoryModal';
import { Toast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useRealtime } from '@/hooks/useRealtime';
import { useNotification } from '@/hooks/useNotification';
import { SessionService } from '@/lib/services/sessionService';
import { SessionRepository } from '@/lib/repositories/sessionRepository';
import { ClientRepository } from '@/lib/repositories/clientRepository';
import { ProductRepository } from '@/lib/repositories/productRepository';
import { StaffRepository } from '@/lib/repositories/staffRepository';
import { ServiceRepository } from '@/lib/repositories/serviceRepository';
import { batchUpdate, firebaseConstraints } from '@/lib/firebase/db';
import type { Session, SessionServiceItem } from '@/types/models';
import { toDate, fmtBs, getBoliviaDate } from '@/lib/utils/helpers';
import ES from '@/config/text.es';

interface MaterialEntry {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  totalPrice: number;
}

export default function MyWorkPage() {
  const { user, userData } = useAuth();
  const { notifications, removeNotification, success, error } = useNotification();
  const [loading, setLoading] = useState(false);

  // Create trabajo modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [clientId, setClientId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [isQuickClientOpen, setIsQuickClientOpen] = useState(false);
  const [quickClient, setQuickClient] = useState({ firstName: '', lastName: '', phone: '' });

  // Material modal state
  const [materialModal, setMaterialModal] = useState<{
    sessionId: string;
    serviceId: string;
    serviceName: string;
  } | null>(null);
  const [materials, setMaterials] = useState<MaterialEntry[]>([]);

  // Client history modal
  const [historyClientId, setHistoryClientId] = useState<string | null>(null);

  const staffId = user?.uid || '';

  const today = useMemo(() => getBoliviaDate(), []);
  const sessionConstraints = useMemo(() => [
    firebaseConstraints.where('salonId', '==', userData?.salonId || ''),
    firebaseConstraints.where('date', '==', today),
  ], [userData?.salonId, today]);
  const { data: sessions } = useRealtime<Session>('sessions', sessionConstraints, !!userData?.salonId);

  const { data: clients, refetch: refetchClients } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ClientRepository.getSalonClients(userData.salonId);
  }, [userData?.salonId]);

  const { data: products } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ProductRepository.getSalonProducts(userData.salonId);
  }, [userData?.salonId]);

  const { data: staffList } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return StaffRepository.getSalonStaff(userData.salonId);
  }, [userData?.salonId]);

  const { data: salonServices } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ServiceRepository.getSalonServices(userData.salonId);
  }, [userData?.salonId]);

  const getClientName = (id: string) => {
    if (!id) return ES.staff.walkInClient;
    const c = clients?.find((x) => x.id === id);
    return c ? `${c.firstName} ${c.lastName}` : '-';
  };

  const getStaffName = (id: string) => {
    const s = staffList?.find((x) => x.id === id);
    return s ? `${s.firstName} ${s.lastName}` : id;
  };

  const clientOptions = [
    { value: '__walkin__', label: ES.staff.walkInClient, secondary: 'Sin datos de cliente' },
    ...(clients || []).map((c) => ({
      value: c.id,
      label: `${c.firstName} ${c.lastName}`,
      secondary: c.phone,
    })),
  ];

  const handleCreateTrabajo = async () => {
    if (!clientId || !userData?.salonId) {
      error(ES.messages.fillRequiredFields);
      return;
    }
    setLoading(true);
    try {
      const resolvedClientId = clientId === '__walkin__' ? '' : clientId;
      const sessionId = await SessionService.createSession({
        clientId: resolvedClientId,
        date: today,
        startTime: new Date(),
        salonId: userData.salonId,
      });
      // If a service was selected, add it and auto-assign to the creator
      if (selectedServiceId) {
        const svc = salonServices?.find((s) => s.id === selectedServiceId);
        if (svc) {
          await SessionService.addServiceToSession({
            sessionId,
            serviceId: svc.id,
            serviceName: svc.name,
            price: svc.price,
            staffIds: [staffId],
            materials: [],
          });
        }
      }
      success(ES.sessions.sessionCreated);
      setIsCreateModalOpen(false);
      setClientId('');
      setSelectedServiceId('');
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

  const allSessions = sessions || [];
  const activeSessions = allSessions.filter((s) => s.status === 'active');

  const myActiveServices: { session: Session; service: SessionServiceItem }[] = [];
  activeSessions.forEach((session) => {
    (session.services || []).forEach((svc) => {
      if (svc.assignedStaff?.includes(staffId) && svc.status !== 'completed') {
        myActiveServices.push({ session, service: svc });
      }
    });
  });

  const availableServices: { session: Session; service: SessionServiceItem }[] = [];
  activeSessions.forEach((session) => {
    (session.services || []).forEach((svc) => {
      if ((!svc.assignedStaff || svc.assignedStaff.length === 0) && svc.status !== 'completed') {
        availableServices.push({ session, service: svc });
      }
    });
  });

  const myCompletedServices: { session: Session; service: SessionServiceItem }[] = [];
  allSessions.forEach((session) => {
    (session.services || []).forEach((svc) => {
      if (svc.assignedStaff?.includes(staffId) && svc.status === 'completed') {
        myCompletedServices.push({ session, service: svc });
      }
    });
  });

  const handleSelfAssign = async (session: Session, service: SessionServiceItem) => {
    setLoading(true);
    try {
      const updatedServices = (session.services || []).map((svc) => {
        if (svc.id === service.id) {
          return { ...svc, assignedStaff: [...(svc.assignedStaff || []), staffId] };
        }
        return svc;
      });
      await SessionRepository.updateSession(session.id, { services: updatedServices });
      success(ES.sessions.serviceAdded);
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleAdvanceStatus = async (session: Session, service: SessionServiceItem) => {
    if (service.status === 'completed') return;
    const nextStatus = service.status === 'pending' ? 'in_progress' : 'completed';
    setLoading(true);
    try {
      const updatedServices = (session.services || []).map((svc) => {
        if (svc.id === service.id) {
          return {
            ...svc,
            status: nextStatus,
            ...(nextStatus === 'completed' ? { endTime: new Date() } : {}),
          };
        }
        return svc;
      });
      await SessionRepository.updateSession(session.id, { services: updatedServices });
      success(ES.staff.serviceStatusUpdated);
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  const productOptions = (products || []).map((p) => ({
    value: p.id,
    label: p.name,
    secondary: `${ES.sessions.materialSellPrice}: Bs. ${p.price}/${p.unit || 'ud'} · Stock: ${p.currentStock}`,
  }));

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

  const handleSaveMaterials = async () => {
    if (!materialModal) return;
    const validMaterials = materials.filter((m) => m.productId && m.quantity > 0);
    if (validMaterials.length === 0) {
      error(ES.messages.fillRequiredFields);
      return;
    }
    setLoading(true);
    try {
      const session = await SessionService.getSession(materialModal.sessionId);
      if (!session) throw new Error('Session not found');

      const updatedServices = (session.services || []).map((svc) => {
        if (svc.id === materialModal.serviceId) {
          const newMats = validMaterials.map((m) => ({
            productId: m.productId,
            productName: m.productName,
            quantity: m.quantity,
            unit: m.unit,
            cost: m.totalPrice,
            usedAt: new Date(),
          }));
          return { ...svc, materialsUsed: [...(svc.materialsUsed || []), ...newMats] };
        }
        return svc;
      });

      const sessionMats = validMaterials.map((m) => ({
        productId: m.productId,
        productName: m.productName,
        quantity: m.quantity,
        unit: m.unit,
        cost: m.totalPrice,
        usedAt: new Date(),
      }));
      const allMaterials = [...(session.materialsUsed || []), ...sessionMats];
      const servicePrices = (session.services || []).reduce((sum, s) => sum + s.price, 0);
      const materialSellPrices = allMaterials.reduce((sum, m) => sum + m.cost, 0);

      await SessionRepository.updateSession(materialModal.sessionId, {
        services: updatedServices,
        materialsUsed: allMaterials,
        totalAmount: servicePrices + materialSellPrices,
      });

      const stockUpdates = await Promise.all(
        validMaterials.map(async (m) => {
          const product = await ProductRepository.getProduct(m.productId);
          if (!product) throw new Error(`Product not found: ${m.productName}`);
          const newStock = product.currentStock - m.quantity;
          if (newStock < 0) throw new Error(`Stock insuficiente: ${m.productName}`);
          return { collection: 'products', docId: m.productId, data: { currentStock: newStock } as Record<string, unknown> };
        })
      );
      await batchUpdate(stockUpdates);

      success(ES.staff.materialAdded);
      setMaterialModal(null);
      setMaterials([]);
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'pending') return { label: ES.staff.statusPending, cls: 'bg-yellow-100 text-yellow-700' };
    if (status === 'in_progress') return { label: ES.staff.statusInProgress, cls: 'bg-blue-100 text-blue-700' };
    return { label: ES.staff.statusCompleted, cls: 'bg-green-100 text-green-700' };
  };

  return (
    <div className="space-y-6 p-4 max-w-lg mx-auto">
      <Toast notifications={notifications} onDismiss={removeNotification} />
      <div className="pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{ES.staff.myWork}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {userData?.firstName} · {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <Button size="lg" className="py-3 px-4 text-sm" onClick={() => setIsCreateModalOpen(true)}>
            {ES.staff.newWork}
          </Button>
        </div>
      </div>

      {/* === MY ACTIVE SERVICES === */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">{ES.staff.myActiveServices}</h2>
        {myActiveServices.length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-center text-gray-500 py-6 text-sm">{ES.staff.noMyWork}</p>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-3">
            {myActiveServices.map(({ session, service }) => {
              const badge = statusBadge(service.status);
              return (
                <Card key={`${session.id}-${service.id}`}>
                  <CardBody>
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-900 text-base">{service.serviceName}</p>
                          <p className="text-sm text-gray-500">
                            {getClientName(session.clientId)} · {toDate(service.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-lg font-bold text-gray-900">{fmtBs(service.price)}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
                        </div>
                      </div>

                      {service.materialsUsed?.length > 0 && (
                        <div className="bg-gray-50 rounded-lg p-2">
                          {service.materialsUsed.map((mat, i) => (
                            <p key={i} className="text-xs text-gray-500">
                              {mat.productName}: {mat.quantity} {mat.unit}
                            </p>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          size="lg"
                          variant="primary"
                          className="flex-1 py-3 text-sm"
                          onClick={() => handleAdvanceStatus(session, service)}
                          loading={loading}
                        >
                          {service.status === 'pending' ? ES.staff.advancePending : ES.staff.advanceInProgress}
                        </Button>
                        <Button
                          size="lg"
                          variant="secondary"
                          className="py-3 px-3 text-sm"
                          onClick={() => {
                            setMaterialModal({ sessionId: session.id, serviceId: service.id, serviceName: service.serviceName });
                            setMaterials([]);
                          }}
                        >
                          {ES.staff.addMyMaterial}
                        </Button>
                        <Button
                          size="lg"
                          variant="ghost"
                          className="py-3 px-3"
                          onClick={() => setHistoryClientId(session.clientId)}
                        >
                          {ES.sessions.viewClientHistory}
                        </Button>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* === AVAILABLE (UNASSIGNED) SERVICES === */}
      {availableServices.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">{ES.staff.availableWorks}</h2>
          <div className="space-y-3">
            {availableServices.map(({ session, service }) => (
              <Card key={`avail-${session.id}-${service.id}`} className="border-dashed border-2 border-gray-300">
                <CardBody>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">{service.serviceName}</p>
                      <p className="text-sm text-gray-500">
                        {getClientName(session.clientId)} · {toDate(service.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <Button
                      size="lg"
                      variant="primary"
                      className="py-3 px-5 text-base"
                      onClick={() => handleSelfAssign(session, service)}
                      loading={loading}
                    >
                      {ES.staff.selfAssign}
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* === COMPLETED TODAY === */}
      {myCompletedServices.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-700 mb-3">{ES.staff.myCompletedToday}</h2>
          <div className="space-y-2">
            {myCompletedServices.map(({ session, service }) => (
              <Card key={`done-${session.id}-${service.id}`} className="opacity-60">
                <CardBody>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{service.serviceName}</p>
                      <p className="text-xs text-gray-500">{getClientName(session.clientId)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-700">{fmtBs(service.price)}</p>
                      <span className="text-xs text-green-600">{ES.sessions.completed}</span>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* === MATERIAL MODAL === */}
      <Modal
        isOpen={!!materialModal}
        onClose={() => { setMaterialModal(null); setMaterials([]); }}
        title={`${ES.sessions.materialsUsed} — ${materialModal?.serviceName || ''}`}
        size="lg"
      >
        <div className="space-y-4 pb-16 sm:pb-0">
          {materials.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-2">{ES.sessions.noMaterials}</p>
          ) : (
            <div className="space-y-3">
              {materials.map((mat, idx) => (
                <div key={idx} className="border border-gray-200 rounded-xl p-3 space-y-2">
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
                    {mat.unit && <span className="text-sm text-gray-500 pb-3">{mat.unit}</span>}
                    <div className="text-right pb-3">
                      <p className="text-xs text-gray-500">{fmtBs(mat.pricePerUnit)}/{mat.unit}</p>
                      <p className="text-sm font-semibold">{fmtBs(mat.totalPrice)}</p>
                    </div>
                    <button type="button" onClick={() => handleRemoveMaterial(idx)} className="text-red-500 hover:text-red-700 text-sm pb-3 font-medium">
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleAddMaterialRow}
            className="w-full py-3.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-blue-600 font-medium hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            {ES.sessions.addMaterial}
          </button>

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1 py-3" onClick={() => { setMaterialModal(null); setMaterials([]); }}>
              {ES.actions.cancel}
            </Button>
            <Button className="flex-1 py-3" onClick={handleSaveMaterials} loading={loading}>
              {ES.actions.save}
            </Button>
          </div>
        </div>
      </Modal>

      {/* === CREATE TRABAJO MODAL === */}
      <Modal isOpen={isCreateModalOpen} onClose={() => { setIsCreateModalOpen(false); setClientId(''); setSelectedServiceId(''); }} title={ES.staff.createWork}>
        <div className="space-y-4">
          <SearchableSelect
            label={ES.sessions.selectClient}
            options={clientOptions}
            value={clientId}
            onChange={setClientId}
            placeholder={ES.actions.search}
            required
          />
          <button type="button" onClick={() => setIsQuickClientOpen(true)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            {ES.clients.addQuick}
          </button>
          <SearchableSelect
            label={`${ES.staff.selectService} (opcional)`}
            options={(() => {
              const myStaff = staffList?.find((s) => s.id === staffId);
              const myServiceIds = (myStaff as typeof myStaff & { serviceIds?: string[] })?.serviceIds;
              const filtered = (salonServices || []).filter((s) => {
                if (!s.isActive) return false;
                if (myServiceIds && myServiceIds.length > 0) return myServiceIds.includes(s.id);
                return true;
              });
              return filtered.map((s) => ({
                value: s.id,
                label: s.name,
                secondary: `Bs. ${s.price}`,
              }));
            })()}
            value={selectedServiceId}
            onChange={setSelectedServiceId}
            placeholder={ES.actions.search}
          />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1 py-3" onClick={() => { setIsCreateModalOpen(false); setClientId(''); setSelectedServiceId(''); }}>
              {ES.actions.cancel}
            </Button>
            <Button className="flex-1 py-3" onClick={handleCreateTrabajo} loading={loading}>
              {ES.staff.createWork}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Quick Client Modal */}
      <Modal isOpen={isQuickClientOpen} onClose={() => setIsQuickClientOpen(false)} title={ES.clients.quickAddTitle}>
        <div className="space-y-4">
          <Input label={ES.clients.name} value={quickClient.firstName} onChange={(e) => setQuickClient({ ...quickClient, firstName: e.target.value })} required />
          <Input label={ES.clients.lastName} value={quickClient.lastName} onChange={(e) => setQuickClient({ ...quickClient, lastName: e.target.value })} />
          <Input label={ES.clients.phoneOptional} type="tel" value={quickClient.phone} onChange={(e) => setQuickClient({ ...quickClient, phone: e.target.value })} />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1 py-3" onClick={() => setIsQuickClientOpen(false)}>
              {ES.actions.cancel}
            </Button>
            <Button className="flex-1 py-3" onClick={handleQuickCreateClient} loading={loading}>
              {ES.actions.save}
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
    </div>
  );
}
