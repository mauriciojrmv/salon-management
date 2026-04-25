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
import { LoyaltyRepository } from '@/lib/repositories/loyaltyRepository';
import type { LoyaltyReward } from '@/types/models';
import { batchUpdate, firebaseConstraints } from '@/lib/firebase/db';
import { fmtBs, unitLabel, toDate, getBoliviaDate } from '@/lib/utils/helpers';
import type { Session, SessionRetailItem } from '@/types/models';
import ES from '@/config/text.es';

interface MaterialEntry {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  pricePerUnit: number; // buy cost per unit
  totalPrice: number; // pricePerUnit * quantity (buy cost total)
  maxStock: number; // available stock for validation
  imprecise: boolean;
  defaultUsage: number;
  manualOverride: boolean;
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
  const [clientId, setClientId] = useState('__walkin__');
  const [loading, setLoading] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [historyClientId, setHistoryClientId] = useState<string | null>(null);
  const [cancelSessionId, setCancelSessionId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [reopenSessionId, setReopenSessionId] = useState<string | null>(null);
  const [noteSessionId, setNoteSessionId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [assignClientSessionId, setAssignClientSessionId] = useState<string | null>(null);
  const [assignClientSelection, setAssignClientSelection] = useState<string>('');
  const [receiptSession, setReceiptSession] = useState<Session | null>(null);
  const [suggestedServices, setSuggestedServices] = useState<{ serviceId: string; serviceName: string; count: number }[]>([]);

  // Retail product modal
  const [isRetailModalOpen, setIsRetailModalOpen] = useState(false);
  const [retailSessionId, setRetailSessionId] = useState<string | null>(null);
  const [retailCart, setRetailCart] = useState<{ productId: string; productName: string; quantity: number; unitPrice: number; maxStock: number }[]>([]);
  const [retailSearch, setRetailSearch] = useState('');

  // Edit materials on existing service
  const [editMaterialModal, setEditMaterialModal] = useState<{ sessionId: string; serviceId: string; serviceName: string } | null>(null);
  const [editMaterials, setEditMaterials] = useState<MaterialEntry[]>([]);

  // Edit staff on existing service
  const [editStaffModal, setEditStaffModal] = useState<{ sessionId: string; serviceId: string; serviceName: string } | null>(null);
  const [editStaffId, setEditStaffId] = useState('');

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
  const today = useMemo(() => getBoliviaDate(), []);
  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
  }, []);
  const [selectedDate, setSelectedDate] = useState(() => getBoliviaDate());
  const isToday = selectedDate === today;
  const sessionConstraints = useMemo(() => [
    firebaseConstraints.where('salonId', '==', userData?.salonId || ''),
    firebaseConstraints.where('date', '==', selectedDate),
  ], [userData?.salonId, selectedDate]);
  const { data: sessions } = useRealtime<Session>('sessions', sessionConstraints, !!userData?.salonId, [userData?.salonId, selectedDate]);

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

  const { data: products, refetch: refetchProducts } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ProductRepository.getSalonProducts(userData.salonId);
  }, [userData?.salonId]);

  const { data: loyaltyRewards } = useAsync(async () => {
    if (!userData?.salonId) return [] as LoyaltyReward[];
    return LoyaltyRepository.getSalonRewards(userData.salonId);
  }, [userData?.salonId]);

  // Dropdown options — walk-in sentinel first
  const clientOptions = [
    { value: '__walkin__', label: ES.staff.walkInClient, secondary: '' },
    ...(clients || []).map((c) => ({
      value: c.id,
      label: `${c.firstName} ${c.lastName}`,
      secondary: c.phone,
    })),
  ];

  // Covers every ServiceCategory — a missing entry falls through to the raw
  // English key (e.g. "treatment") which is what was bleeding into the UI.
  const categoryLabels: Record<string, string> = {
    haircut: ES.services.haircut,
    coloring: ES.services.coloring,
    styling: ES.services.styling,
    treatment: ES.services.treatment,
    nails: ES.services.nails,
    waxing: ES.services.waxing,
    skincare: ES.services.skincare,
    makeup: ES.services.makeup,
    eyebrows: ES.services.eyebrows,
    eyelashes: ES.services.eyelashes,
    massage: ES.services.massage,
    spa: ES.services.spa,
    other: ES.services.other,
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
    secondary: `${ES.sessions.materialSellPrice}: ${fmtBs(p.cost)}/${unitLabel(p.unit)} · Stock: ${p.currentStock}${p.currentStock <= p.minStock ? ' ⚠' : ''}`,
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
    setMaterials([...materials, { productId: '', productName: '', quantity: 1, unit: '', pricePerUnit: 0, totalPrice: 0, maxStock: 0, imprecise: false, defaultUsage: 0, manualOverride: false }]);
  };

  const handleMaterialProductSelect = (index: number, productId: string) => {
    const product = products?.find((p) => p.id === productId);
    if (!product) return;
    const updated = [...materials];
    const qty = Math.min(updated[index].quantity, product.currentStock);
    updated[index] = {
      ...updated[index],
      productId,
      productName: product.name,
      unit: product.unit || 'ud',
      pricePerUnit: product.cost,
      maxStock: product.currentStock,
      quantity: qty,
      totalPrice: product.cost * qty,
      imprecise: product.imprecise === true,
      defaultUsage: product.defaultUsage || 0,
      manualOverride: false,
    };
    setMaterials(updated);
  };

  // Imprecise: each tap adds defaultUsage to running total. Cap at maxStock.
  const handleMarkUsage = (index: number) => {
    const updated = [...materials];
    const cur = updated[index];
    const next = Math.min(cur.quantity + cur.defaultUsage, cur.maxStock || Infinity);
    updated[index] = { ...cur, quantity: next, totalPrice: cur.pricePerUnit * next };
    setMaterials(updated);
  };

  const handleResetUsage = (index: number) => {
    const updated = [...materials];
    updated[index] = { ...updated[index], quantity: 0, totalPrice: 0 };
    setMaterials(updated);
  };

  const toggleManualOverride = (index: number, manual: boolean) => {
    const updated = [...materials];
    updated[index] = { ...updated[index], manualOverride: manual };
    setMaterials(updated);
  };

  const handleMaterialQuantityChange = (index: number, qty: number) => {
    const updated = [...materials];
    const capped = Math.min(Math.max(0, qty), updated[index].maxStock || Infinity);
    updated[index] = {
      ...updated[index],
      quantity: capped,
      totalPrice: updated[index].pricePerUnit * capped,
    };
    setMaterials(updated);
  };

  const handleRemoveMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index));
  };

  const totalMaterialsCost = materials.reduce((sum, m) => sum + m.totalPrice, 0);

  // Edit materials on existing service
  const openEditMaterials = (sessionId: string, serviceId: string, serviceName: string) => {
    const session = sessions?.find((s) => s.id === sessionId);
    const svc = session?.services?.find((s) => s.id === serviceId);
    const existing: MaterialEntry[] = (svc?.materialsUsed || []).map((m) => {
      const product = products?.find((p) => p.id === m.productId);
      return {
      productId: m.productId,
      productName: m.productName,
      quantity: m.quantity,
      unit: m.unit || 'ud',
      pricePerUnit: m.cost / (m.quantity || 1),
      totalPrice: m.cost,
      maxStock: (product?.currentStock || 0) + m.quantity, // available = current + already deducted
      imprecise: product?.imprecise === true,
      defaultUsage: product?.defaultUsage || 0,
      manualOverride: !product?.imprecise || (product?.defaultUsage ? (m.quantity % product.defaultUsage !== 0) : false),
    };
    });
    setEditMaterials(existing);
    setEditMaterialModal({ sessionId, serviceId, serviceName });
  };

  const handleSaveEditMaterials = async () => {
    if (!editMaterialModal) return;
    setLoading(true);
    try {
      const session = await SessionRepository.getSession(editMaterialModal.sessionId);
      if (!session) throw new Error('Session not found');

      const oldSvc = session.services?.find((s) => s.id === editMaterialModal.serviceId);
      const oldMats = oldSvc?.materialsUsed || [];
      const newMats = editMaterials.filter((m) => m.productId && m.quantity > 0);

      // Validate stock BEFORE saving — account for restoring old stock first
      for (const nm of newMats) {
        const product = await ProductRepository.getProduct(nm.productId);
        if (!product) throw new Error(`Producto no encontrado: ${nm.productName}`);
        // Restored amount from old materials for this same product
        const restoredQty = oldMats.filter((om) => om.productId === nm.productId).reduce((sum, om) => sum + om.quantity, 0);
        const availableStock = product.currentStock + restoredQty;
        if (nm.quantity > availableStock) {
          throw new Error(`Stock insuficiente para ${nm.productName} (disponible: ${availableStock})`);
        }
      }

      const updatedServices = (session.services || []).map((svc) => {
        if (svc.id !== editMaterialModal.serviceId) return svc;
        return {
          ...svc,
          materialsUsed: newMats.map((m) => ({
            productId: m.productId,
            productName: m.productName,
            quantity: m.quantity,
            unit: m.unit,
            cost: m.totalPrice,
          })),
        };
      });

      // Rebuild session-level materialsUsed from all services
      const allMaterials = updatedServices.flatMap((svc) => svc.materialsUsed || []);

      await SessionRepository.updateSession(editMaterialModal.sessionId, {
        services: updatedServices,
        materialsUsed: allMaterials,
      });

      // Restore old stock, then deduct new stock
      for (const om of oldMats) {
        await ProductRepository.restockProduct(om.productId, om.quantity);
      }
      for (const nm of newMats) {
        await ProductRepository.updateStock(nm.productId, nm.quantity);
      }
      refetchProducts(); // refresh local product stock cache

      success(ES.actions.success);
      setEditMaterialModal(null);
      setEditMaterials([]);
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  // Edit staff on existing service
  const handleEditPrice = async (sessionId: string, serviceItemId: string, newPrice: number) => {
    try {
      const session = await SessionRepository.getSession(sessionId);
      if (!session) return;
      const updatedServices = (session.services || []).map((svc) =>
        svc.id === serviceItemId ? { ...svc, price: newPrice } : svc
      );
      const servicePrices = updatedServices.reduce((sum, s) => sum + s.price, 0);
      const retailTotal = (session.retailItems || []).reduce((sum, r) => sum + r.total, 0);
      await SessionRepository.updateSession(sessionId, { services: updatedServices, totalAmount: servicePrices + retailTotal });
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    }
  };

  const openEditStaff = (sessionId: string, serviceId: string, serviceName: string, currentStaff: string[]) => {
    setEditStaffId(currentStaff[0] || '');
    setEditStaffModal({ sessionId, serviceId, serviceName });
  };

  const handleSaveEditStaff = async () => {
    if (!editStaffModal) return;
    setLoading(true);
    try {
      const session = await SessionRepository.getSession(editStaffModal.sessionId);
      if (!session) throw new Error('Session not found');

      const updatedServices = (session.services || []).map((svc) => {
        if (svc.id !== editStaffModal.serviceId) return svc;
        return { ...svc, assignedStaff: editStaffId ? [editStaffId] : [] };
      });

      await SessionRepository.updateSession(editStaffModal.sessionId, { services: updatedServices });
      success(ES.actions.success);
      setEditStaffModal(null);
      setEditStaffId('');
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  // Handlers
  const handleCreateSession = async () => {
    if (!clientId || !userData?.salonId) {
      error(ES.messages.fillRequiredFields);
      return;
    }
    setLoading(true);
    try {
      const resolvedClientId = clientId === '__walkin__' ? '' : clientId;
      await SessionService.createSession({
        clientId: resolvedClientId,
        date: getBoliviaDate(),
        startTime: new Date(),
        salonId: userData.salonId,
      });
      success(ES.sessions.sessionCreated);
      setIsCreateModalOpen(false);
      setClientId('__walkin__');

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
      // Validate stock BEFORE saving — prevent partial saves
      let stockUpdates: { collection: string; docId: string; data: Record<string, unknown> }[] = [];
      if (validMaterials.length > 0) {
        stockUpdates = await Promise.all(
          validMaterials.map(async (m) => {
            const product = await ProductRepository.getProduct(m.productId);
            if (!product) throw new Error(`Producto no encontrado: ${m.productName}`);
            const newStock = product.currentStock - m.quantity;
            if (newStock < 0) throw new Error(`Stock insuficiente para ${m.productName} (disponible: ${product.currentStock})`);
            return { collection: 'products', docId: m.productId, data: { currentStock: newStock } as Record<string, unknown> };
          })
        );
      }

      // Stock validated — now save service and deduct stock
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

      if (stockUpdates.length > 0) {
        await batchUpdate(stockUpdates);
        refetchProducts(); // refresh local product stock cache
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
    const rawEntries = paymentEntries.filter((e) => e.amount > 0);
    if (rawEntries.length === 0) {
      error(ES.messages.fillRequiredFields);
      return;
    }
    // For single-entry cash: cap recorded amount at remaining (excess is change, not overpayment)
    const validEntries = rawEntries.map((e) =>
      rawEntries.length === 1 && e.method === 'cash' && e.amount > sessionRemainingForPayment
        ? { ...e, amount: sessionRemainingForPayment }
        : e
    );
    // Block overpayment only — partial payments are allowed and remain as pending balance
    const entriesTotal = validEntries.reduce((sum, e) => sum + e.amount, 0);
    if (entriesTotal - sessionRemainingForPayment > 0.01) {
      error(`${ES.payments.exceedsBalance}: ${fmtBs(entriesTotal - sessionRemainingForPayment)}`);
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
    setLoadingSessionId(sessionId);
    try {
      await SessionService.closeSession(sessionId);
      success(ES.sessions.sessionClosed);

    } catch (err) {
      const msg = err instanceof Error ? err.message : ES.messages.operationFailed;
      if (msg.startsWith('SESSION_UNPAID_BALANCE:')) {
        const bal = msg.split(':')[1];
        error(`${ES.sessions.cannotCloseWithBalance} Bs. ${bal}`);
      } else {
        error(msg);
      }
    } finally {
      setLoadingSessionId(null);
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
    setLoadingSessionId(sessionId);
    try {
      await SessionService.removeServiceFromSession(sessionId, serviceItemId);
      success(ES.sessions.serviceRemoved);
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setLoadingSessionId(null);
    }
  };

  const handleUpdateServiceStatus = async (sessionId: string, serviceItemId: string, newStatus: 'pending' | 'in_progress' | 'completed') => {
    setLoadingSessionId(sessionId);
    try {
      await SessionService.updateServiceStatus(sessionId, serviceItemId, newStatus);
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setLoadingSessionId(null);
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

  const handleAssignClient = async () => {
    if (!assignClientSessionId || !assignClientSelection) {
      error(ES.messages.fillRequiredFields);
      return;
    }
    setLoading(true);
    try {
      await SessionService.assignClient(assignClientSessionId, assignClientSelection);
      success(ES.sessions.clientAssigned);
      setAssignClientSessionId(null);
      setAssignClientSelection('');
    } catch (err) {
      const msg = err instanceof Error && err.message === 'SESSION_ALREADY_HAS_CLIENT'
        ? ES.sessions.cannotSwapClient
        : err instanceof Error ? err.message : ES.messages.operationFailed;
      error(msg);
    } finally {
      setLoading(false);
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

  // Retail product handlers
  const handleAddRetailToCart = (productId: string) => {
    const product = products?.find((p) => p.id === productId);
    if (!product || product.currentStock <= 0) return;
    const existing = retailCart.find((r) => r.productId === productId);
    if (existing) {
      if (existing.quantity >= product.currentStock) return;
      setRetailCart(retailCart.map((r) =>
        r.productId === productId ? { ...r, quantity: r.quantity + 1 } : r
      ));
    } else {
      setRetailCart([...retailCart, {
        productId,
        productName: product.name,
        quantity: 1,
        unitPrice: product.price,
        maxStock: product.currentStock,
      }]);
    }
  };

  const handleRetailQuantityChange = (productId: string, qty: number) => {
    if (qty <= 0) {
      setRetailCart(retailCart.filter((r) => r.productId !== productId));
      return;
    }
    setRetailCart(retailCart.map((r) =>
      r.productId === productId ? { ...r, quantity: Math.min(qty, r.maxStock) } : r
    ));
  };

  const handleSaveRetailItems = async () => {
    if (!retailSessionId || retailCart.length === 0) return;
    setLoading(true);
    try {
      const session = await SessionRepository.getSession(retailSessionId);
      if (!session) throw new Error('Session not found');

      // Build new retail items
      const newItems: SessionRetailItem[] = retailCart.map((item) => ({
        id: `retail_${Date.now()}_${item.productId}`,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.unitPrice * item.quantity,
      }));

      const existingRetail = session.retailItems || [];
      const updatedRetail = [...existingRetail, ...newItems];

      // Recalculate total: services + retail
      const servicePrices = (session.services || []).reduce((sum, s) => sum + s.price, 0);
      const retailTotal = updatedRetail.reduce((sum, r) => sum + r.total, 0);

      await SessionRepository.updateSession(retailSessionId, {
        retailItems: updatedRetail,
        totalAmount: servicePrices + retailTotal,
      });

      // Deduct stock for each product
      for (const item of retailCart) {
        await ProductRepository.updateStock(item.productId, item.quantity);
      }
      refetchProducts();

      success(ES.sessions.retailItemAdded);
      setIsRetailModalOpen(false);
      setRetailCart([]);
      setRetailSearch('');
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRetailItem = async (sessionId: string, itemId: string) => {
    setLoadingSessionId(sessionId);
    try {
      const session = await SessionRepository.getSession(sessionId);
      if (!session) throw new Error('Session not found');

      const itemToRemove = (session.retailItems || []).find((r) => r.id === itemId);
      if (!itemToRemove) throw new Error('Item not found');

      const updatedRetail = (session.retailItems || []).filter((r) => r.id !== itemId);
      const servicePrices = (session.services || []).reduce((sum, s) => sum + s.price, 0);
      const retailTotal = updatedRetail.reduce((sum, r) => sum + r.total, 0);

      await SessionRepository.updateSession(sessionId, {
        retailItems: updatedRetail,
        totalAmount: servicePrices + retailTotal,
      });

      // Restore stock
      await ProductRepository.restockProduct(itemToRemove.productId, itemToRemove.quantity);
      refetchProducts();

      success(ES.sessions.removeRetailItem);
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setLoadingSessionId(null);
    }
  };

  // Retail products for sale — only unit/service_cost type with selling price, exclude measurable (those are materials)
  const retailProducts = (products || []).filter((p) => p.isActive && p.price > 0);
  const filteredRetailProducts = retailProducts.filter((p) => {
    if (!retailSearch) return true;
    return p.name.toLowerCase().includes(retailSearch.toLowerCase());
  });

  const userRole = userData?.role || 'staff';
  const canCancel = userRole === 'admin'; // only admin can void/cancel (Anular) sessions
  const canEditCompleted = userRole === 'admin' || userRole === 'manager'; // admin + manager can add service/reopen/notes on completed
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

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">{ES.sessions.title}</h1>
          <Button onClick={() => setIsCreateModalOpen(true)} size="lg">
            {ES.sessions.new}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedDate(today)}
            className={`px-4 py-2.5 text-sm border rounded-lg font-medium whitespace-nowrap transition-colors ${
              isToday
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
            }`}
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => setSelectedDate(yesterday)}
            className={`px-4 py-2.5 text-sm border rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedDate === yesterday
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
            }`}
          >
            Ayer
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
          />
          {!isToday && (
            <span className="text-sm text-amber-600 font-medium">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-BO', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      </div>

      {/* Active Sessions */}
      {activeSessions.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-center py-8">
              <p className="text-gray-500 text-lg mb-2">{ES.sessions.noActiveSessions}</p>
              <p className="text-gray-500 text-sm">{ES.sessions.noActiveSessionsCta}</p>
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
                const paid = (session.payments || []).filter((p) => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);
                const totalFromServices = (session.services || []).reduce((sum, s) => sum + s.price, 0);
                const retailItemsTotal = (session.retailItems || []).reduce((sum, r) => sum + r.total, 0);
                const remaining = Math.max(0, totalFromServices + retailItemsTotal - paid);
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
              onAssignClient={() => {
                setAssignClientSessionId(session.id);
                setAssignClientSelection('');
              }}
              onRemoveService={(serviceItemId) => handleRemoveService(session.id, serviceItemId)}
              onUpdateServiceStatus={(serviceItemId, newStatus) => handleUpdateServiceStatus(session.id, serviceItemId, newStatus)}
              onEditMaterials={(serviceItemId, serviceName) => openEditMaterials(session.id, serviceItemId, serviceName)}
              onEditStaff={(serviceItemId, serviceName, currentStaff) => openEditStaff(session.id, serviceItemId, serviceName, currentStaff)}
              onEditPrice={(serviceItemId, newPrice) => handleEditPrice(session.id, serviceItemId, newPrice)}
              onAddRetailProduct={() => {
                setRetailSessionId(session.id);
                setRetailCart([]);
                setRetailSearch('');
                setIsRetailModalOpen(true);
              }}
              onRemoveRetailItem={(itemId) => handleRemoveRetailItem(session.id, itemId)}
              canCancel={canCancel}
              loading={(loading && activeSessionId === session.id) || loadingSessionId === session.id}
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
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-gray-900">{getClientName(session.clientId)}</p>
                          {canEditCompleted && !session.clientId && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAssignClientSessionId(session.id);
                                setAssignClientSelection('');
                              }}
                              className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg min-w-[32px] min-h-[32px] flex items-center justify-center text-sm"
                              title={ES.sessions.assignClient}
                            >
                              ✎
                            </button>
                          )}
                        </div>
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
                            <div>
                              <span>{svc.serviceName}</span>
                              {svc.assignedStaff?.length > 0 && (
                                <p className="text-xs text-gray-500">{svc.assignedStaff.map((id) => getStaffName(id)).join(', ')}</p>
                              )}
                            </div>
                            <span>{fmtBs(svc.price)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Retail items summary */}
                    {(session.retailItems || []).length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-semibold text-purple-600">{ES.sessions.retailItems}</p>
                        {(session.retailItems || []).map((item) => (
                          <div key={item.id} className="flex justify-between text-sm text-gray-600">
                            <span>{item.productName} ×{item.quantity}</span>
                            <span>{fmtBs(item.total)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Notes */}
                    {session.notes && (
                      <p className="text-xs text-gray-500 mt-2 italic">{session.notes}</p>
                    )}

                    {/* Edit actions (admin + manager) */}
                    {canEditCompleted && (
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
                        {canCancel && (
                          <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => {
                            setCancelSessionId(session.id);
                            setCancelReason('');
                          }}>
                            {ES.sessions.cancelSession}
                          </Button>
                        )}
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
          <h2 className="text-xl font-semibold text-gray-500 pt-4">{ES.sessions.cancelledSessions}</h2>
          <div className="space-y-3">
            {cancelledSessions.map((session) => (
              <Card key={session.id} className="opacity-50">
                <CardBody>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-500 line-through">{getClientName(session.clientId)}</p>
                      <p className="text-sm text-gray-500">
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
            maxLength={200}
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
            maxLength={200}
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

      {/* Assign Client Modal — walk-in → registered client */}
      <Modal
        isOpen={!!assignClientSessionId}
        onClose={() => { setAssignClientSessionId(null); setAssignClientSelection(''); }}
        title={ES.sessions.assignClientTitle}
      >
        <div className="space-y-4">
          <SearchableSelect
            label={ES.sessions.selectClient}
            options={(clients || []).map((c) => ({
              value: c.id,
              label: `${c.firstName} ${c.lastName}`,
              secondary: c.phone,
            }))}
            value={assignClientSelection}
            onChange={setAssignClientSelection}
            placeholder={ES.actions.search}
            required
          />
          <p className="text-xs text-gray-500">
            {ES.sessions.assignClient} — {ES.clients.addQuick.toLowerCase()} desde la página de Clientes.
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1 py-3 min-h-[44px]" onClick={() => { setAssignClientSessionId(null); setAssignClientSelection(''); }}>
              {ES.actions.cancel}
            </Button>
            <Button className="flex-1 py-3 min-h-[44px]" onClick={handleAssignClient} loading={loading}>
              {ES.actions.save}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create Session Modal — quick-client form inlined */}
      <Modal isOpen={isCreateModalOpen} onClose={() => { setIsCreateModalOpen(false); setIsQuickClientOpen(false); }} title={ES.sessions.create}>
        <div className="space-y-4 pb-16 sm:pb-0">
          {!isQuickClientOpen ? (
            <>
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
                onClick={() => { setIsQuickClientOpen(true); setQuickClient({ firstName: '', lastName: '', phone: '' }); }}
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
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700">{ES.clients.quickAddTitle}</p>
              <Input
                label={ES.clients.name}
                value={quickClient.firstName}
                onChange={(e) => setQuickClient({ ...quickClient, firstName: e.target.value })}
                required
                maxLength={30}
              />
              <Input
                label={ES.clients.lastName}
                value={quickClient.lastName}
                onChange={(e) => setQuickClient({ ...quickClient, lastName: e.target.value })}
                maxLength={30}
              />
              <Input
                label={ES.clients.phoneOptional}
                type="tel"
                value={quickClient.phone}
                onChange={(e) => setQuickClient({ ...quickClient, phone: e.target.value })}
                maxLength={10}
              />
              <div className="flex gap-2 pt-2">
                <Button variant="secondary" onClick={() => setIsQuickClientOpen(false)}>
                  {ES.actions.back}
                </Button>
                <Button onClick={handleQuickCreateClient} loading={loading}>
                  {ES.actions.save}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Add Service Modal — with editable price + materials */}
      <Modal
        isOpen={isAddServiceModalOpen}
        onClose={() => setIsAddServiceModalOpen(false)}
        title={ES.sessions.addService}
        size="lg"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setIsAddServiceModalOpen(false)}>
              {ES.actions.cancel}
            </Button>
            <Button className="flex-1" onClick={handleAddService} loading={loading}>
              {ES.sessions.addService}
            </Button>
          </div>
        }
      >
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
              min={0}
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
                <p className="text-xs text-gray-500">{ES.sessions.noMaterials}</p>
              ) : (
                <div className="space-y-3">
                  {materials.map((mat, idx) => {
                    // Filter out products already selected in other rows
                    const usedIds = materials.filter((_, i) => i !== idx).map((m) => m.productId).filter(Boolean);
                    const filteredOptions = productOptions.filter((o) => !usedIds.includes(o.value));
                    return (
                    <div key={idx} className="border border-gray-200 rounded-xl p-3 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <SearchableSelect
                            label=""
                            options={filteredOptions}
                            value={mat.productId}
                            onChange={(v) => handleMaterialProductSelect(idx, v)}
                            placeholder={ES.material.product}
                          />
                        </div>
                        <button type="button" onClick={() => handleRemoveMaterial(idx)} className="text-red-400 hover:text-red-600 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-50 shrink-0 mt-1">
                          ✕
                        </button>
                      </div>

                      {mat.productId && (
                        <>
                          <div className="flex items-center justify-between text-xs text-gray-400">
                            <span>Stock: {mat.maxStock} {mat.unit}</span>
                            <span>{fmtBs(mat.pricePerUnit)}/{mat.unit}</span>
                          </div>

                          {mat.imprecise && !mat.manualOverride && mat.defaultUsage > 0 ? (
                            <div className="space-y-2">
                              <button
                                type="button"
                                onClick={() => handleMarkUsage(idx)}
                                disabled={mat.quantity + mat.defaultUsage > mat.maxStock}
                                className="w-full py-4 min-h-[56px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-lg flex flex-col items-center justify-center transition-colors"
                              >
                                <span>{ES.inventory.markUsage}</span>
                                <span className="text-xs font-normal opacity-90 mt-0.5">{ES.inventory.markUsageDetail(mat.defaultUsage, mat.unit)}</span>
                              </button>
                              {mat.quantity > 0 && (
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-700">
                                    {Math.round(mat.quantity / mat.defaultUsage)} {Math.round(mat.quantity / mat.defaultUsage) === 1 ? 'uso' : 'usos'} · {mat.quantity} {mat.unit}
                                  </span>
                                  <button type="button" onClick={() => handleResetUsage(idx)} className="text-red-500 hover:text-red-700 underline">Reiniciar</button>
                                </div>
                              )}
                              <button type="button" onClick={() => toggleManualOverride(idx, true)} className="w-full text-xs text-gray-500 hover:text-gray-700 underline py-1">
                                {ES.inventory.adjustManually}
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center justify-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => handleMaterialQuantityChange(idx, mat.quantity - (mat.unit === 'ml' || mat.unit === 'g' ? 10 : 0.25))}
                                  disabled={mat.quantity <= 0}
                                  className="w-12 h-12 rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-30 text-xl font-bold text-gray-700 flex items-center justify-center transition-colors"
                                >
                                  −
                                </button>
                                <div className="text-center min-w-[80px]">
                                  <input
                                    type="number"
                                    value={mat.quantity}
                                    onChange={(e) => handleMaterialQuantityChange(idx, parseFloat(e.target.value) || 0)}
                                    step="0.01"
                                    min="0"
                                    max={mat.maxStock}
                                    className="w-20 text-center text-2xl font-bold text-gray-900 border-b-2 border-gray-300 focus:border-blue-500 outline-none bg-transparent"
                                  />
                                  <p className="text-xs text-gray-400 mt-0.5">{mat.unit}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleMaterialQuantityChange(idx, mat.quantity + (mat.unit === 'ml' || mat.unit === 'g' ? 10 : 0.25))}
                                  disabled={mat.quantity >= mat.maxStock}
                                  className="w-12 h-12 rounded-xl bg-blue-100 hover:bg-blue-200 disabled:opacity-30 text-xl font-bold text-blue-700 flex items-center justify-center transition-colors"
                                >
                                  +
                                </button>
                              </div>
                              {mat.imprecise && mat.defaultUsage > 0 && (
                                <button type="button" onClick={() => toggleManualOverride(idx, false)} className="w-full text-xs text-blue-600 hover:text-blue-800 underline py-1">
                                  {ES.inventory.backToPreset}
                                </button>
                              )}
                            </>
                          )}

                          <p className="text-center text-sm font-semibold text-gray-700">{fmtBs(mat.totalPrice)}</p>
                        </>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 5. Summary — client pays service price only; materials tracked internally */}
          {serviceForm.serviceId && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between border-gray-200">
                <span className="text-gray-900 font-semibold">{ES.payments.total} {ES.sessions.client.toLowerCase()}</span>
                <span className="text-gray-900 font-bold">{fmtBs(serviceForm.price)}</span>
              </div>
              {totalMaterialsCost > 0 && (
                <p className="text-xs text-gray-500 pt-1">{ES.sessions.materialsInternal}: {fmtBs(totalMaterialsCost)}</p>
              )}
            </div>
          )}

        </div>
      </Modal>

      {/* Payment Modal — simple default: big total → tap method → confirm. Advanced: split + per-service */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={ES.payments.processPayment}
        size="lg"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setIsPaymentModalOpen(false)} size="lg" className="flex-1">
              {ES.actions.cancel}
            </Button>
            <Button onClick={handleProcessPayment} loading={loading} size="lg" className="flex-1">
              {ES.payments.confirmPayments}
            </Button>
          </div>
        }
      >
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
                    const totalFromServices = (paymentSessionRef.services || []).reduce((sum, s) => sum + s.price, 0);  // ← NUEVA LÍNEA
                    const selectedTotal = allSelected ? 0 : totalFromServices;  // ← LÍNEA MODIFICADA
                    const paid = (paymentSessionRef.payments || []).filter((p) => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);
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
                  const svcTotal = svc.price;
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
                          const selectedSvcTotal = selectedSvcs.reduce((sum, s) => sum + s.price, 0);  // ← LÍNEA MODIFICADA
                          const paid = (paymentSessionRef.payments || []).filter((p) => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);
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
                      const newRemaining = Math.max(0, sessionRemainingForPayment - applyAmount);
                      success(ES.payments.creditApplied);
                      refetchClients();
                      if (newRemaining <= 0) {
                        // Saldo covered full amount — close modal
                        setIsPaymentModalOpen(false);
                        setPaymentEntries([]);
                      } else {
                        setSessionRemainingForPayment(newRemaining);
                        setPaymentEntries([{ amount: newRemaining, method: 'cash', payerNote: '', amountGiven: 0 }]);
                      }
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

          {/* Loyalty rewards — inline apply */}
          {(() => {
            const clientForLoyalty = paymentSessionRef ? clients?.find((c) => c.id === paymentSessionRef.clientId) : null;
            const pts = clientForLoyalty?.loyaltyPoints || 0;
            if (!clientForLoyalty || pts <= 0) return null;
            const affordable = (loyaltyRewards || []).filter((r) => r.pointsCost <= pts);
            return (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-amber-600 font-medium">{ES.loyalty.points}</p>
                  <p className="text-lg font-bold text-amber-700">{pts} pts</p>
                </div>
                {affordable.length === 0 ? (
                  <p className="text-xs text-amber-600">{ES.loyalty.noAffordableRewards}</p>
                ) : (
                  <div className="space-y-1.5">
                    {affordable.map((reward) => {
                      const discountAmount = reward.type === 'discount'
                        ? Math.min(sessionRemainingForPayment, Math.round(sessionRemainingForPayment * reward.value) / 100)
                        : Math.min(sessionRemainingForPayment, reward.value);
                      return (
                        <div key={reward.id} className="flex items-center justify-between bg-white rounded-lg p-2 border border-amber-200">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900 truncate">{reward.name}</p>
                            <p className="text-xs text-gray-500">{reward.pointsCost} pts · {reward.type === 'discount' ? `${reward.value}%` : fmtBs(reward.value)}</p>
                          </div>
                          <button
                            type="button"
                            disabled={loading || discountAmount <= 0}
                            onClick={async () => {
                              if (!paymentSessionRef || !activeSessionId || !userData?.salonId) return;
                              setLoading(true);
                              try {
                                await ClientRepository.updateClient(clientForLoyalty.id, {
                                  loyaltyPoints: pts - reward.pointsCost,
                                });
                                await LoyaltyRepository.addTransaction({
                                  salonId: userData.salonId,
                                  clientId: clientForLoyalty.id,
                                  type: 'redeemed',
                                  points: reward.pointsCost,
                                  description: reward.name,
                                  sessionId: activeSessionId,
                                  rewardId: reward.id,
                                });
                                await SessionService.processPayment({
                                  sessionId: activeSessionId,
                                  amount: discountAmount,
                                  method: 'credit',
                                  serviceIds: selectedPaymentServiceIds.length > 0 ? selectedPaymentServiceIds : undefined,
                                });
                                const newRemaining = Math.max(0, sessionRemainingForPayment - discountAmount);
                                success(ES.loyalty.rewardApplied);
                                refetchClients();
                                if (newRemaining <= 0) {
                                  setIsPaymentModalOpen(false);
                                  setPaymentEntries([]);
                                } else {
                                  setSessionRemainingForPayment(newRemaining);
                                  setPaymentEntries([{ amount: newRemaining, method: 'cash', payerNote: '', amountGiven: 0 }]);
                                }
                              } catch (err) {
                                error(err instanceof Error ? err.message : ES.messages.operationFailed);
                              } finally {
                                setLoading(false);
                              }
                            }}
                            className="ml-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 disabled:bg-gray-300 shrink-0"
                          >
                            {ES.loyalty.applyReward}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Big total display */}
          <div className="text-center py-3">
            <p className="text-sm text-gray-500 mb-1">{ES.payments.remaining}</p>
            <p className="text-4xl font-bold text-gray-900">{fmtBs(sessionRemainingForPayment)}</p>
          </div>

          {/* Payment entries */}
          {paymentEntries.map((entry, idx) => {
            const isSingleCash = paymentEntries.length === 1 && entry.method === 'cash';
            const singleCashChange = isSingleCash ? entry.amount - sessionRemainingForPayment : 0;
            const change = entry.method === 'cash' ? entry.amountGiven - entry.amount : 0;
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
                        maxLength={50}
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
                  <label className="block text-xs text-gray-500 mb-1">
                    {isSingleCash ? ES.payments.amountGiven : ES.payments.amount}
                  </label>
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
                  {isSingleCash && entry.amount > 0 && singleCashChange !== 0 && (
                    <div className="mt-2">
                      <span className="text-xs text-gray-500">
                        {singleCashChange > 0 ? ES.payments.change : 'Falta'}
                      </span>
                      <p className={`text-2xl font-bold ${singleCashChange > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                        {fmtBs(Math.abs(singleCashChange))}
                      </p>
                    </div>
                  )}
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

                {/* Cash change calculator — yellow panel (split mode only; single-cash uses inline display above) */}
                {entry.method === 'cash' && !isSingleCash && (
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
                        <span className="text-sm text-yellow-700">
                          {change >= 0 ? ES.payments.change : 'Falta'}
                        </span>
                        <p className={`text-3xl font-black ${change > 0 ? 'text-yellow-800' : change < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                          {fmtBs(Math.abs(change))}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* ADVANCED: Split/Add person button — auto-splits total evenly */}
          {showAdvancedPayment && (
            <button
              type="button"
              onClick={() => {
                const newCount = paymentEntries.length + 1;
                const perPerson = Math.floor((sessionRemainingForPayment / newCount) * 100) / 100;
                const lastAmount = Math.round((sessionRemainingForPayment - perPerson * (newCount - 1)) * 100) / 100;
                const updated = [
                  ...paymentEntries.map((e, i) => ({ ...e, amount: i < paymentEntries.length - 1 ? perPerson : perPerson })),
                  { amount: lastAmount, method: 'cash', payerNote: '', amountGiven: 0 },
                ].map((e, i) => ({ ...e, amount: i < newCount - 1 ? perPerson : lastAmount }));
                setPaymentEntries(updated);
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

      {/* Retail Product Modal — sell products within session */}
      <Modal
        isOpen={isRetailModalOpen}
        onClose={() => { setIsRetailModalOpen(false); setRetailCart([]); setRetailSearch(''); }}
        title={ES.sessions.addRetailProduct}
        size="lg"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => { setIsRetailModalOpen(false); setRetailCart([]); setRetailSearch(''); }}>
              {ES.actions.cancel}
            </Button>
            <Button className="flex-1" onClick={handleSaveRetailItems} loading={loading} disabled={retailCart.length === 0}>
              {ES.actions.confirm} ({retailCart.length})
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pb-16 sm:pb-0">
          {/* Search */}
          <Input
            label=""
            type="text"
            value={retailSearch}
            onChange={(e) => setRetailSearch(e.target.value)}
            placeholder={ES.app.searchPlaceholder}
          />

          {/* Cart summary — if items added */}
          {retailCart.length > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">{ES.sessions.retailItems}</p>
              {retailCart.map((item) => (
                <div key={item.productId} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRetailQuantityChange(item.productId, item.quantity - 1)}
                      className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 text-lg font-bold text-gray-700 flex items-center justify-center"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => handleRetailQuantityChange(item.productId, item.quantity + 1)}
                      disabled={item.quantity >= item.maxStock}
                      className="w-9 h-9 rounded-lg bg-blue-100 hover:bg-blue-200 disabled:opacity-30 text-lg font-bold text-blue-700 flex items-center justify-center"
                    >
                      +
                    </button>
                    <span className="text-sm font-bold text-gray-900 w-20 text-right">{fmtBs(item.unitPrice * item.quantity)}</span>
                  </div>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-purple-200">
                <span className="text-sm font-bold text-gray-900">{ES.payments.total}</span>
                <span className="text-sm font-black text-gray-900">{fmtBs(retailCart.reduce((sum, r) => sum + r.unitPrice * r.quantity, 0))}</span>
              </div>
            </div>
          )}

          {/* Product grid — tap to add */}
          <div className="grid grid-cols-2 gap-2">
            {filteredRetailProducts.map((product) => {
              const inCart = retailCart.find((r) => r.productId === product.id);
              const outOfStock = product.currentStock <= 0;
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => !outOfStock && handleAddRetailToCart(product.id)}
                  disabled={outOfStock}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    inCart
                      ? 'border-purple-400 bg-purple-50'
                      : outOfStock
                      ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                      : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                  <p className="text-sm font-bold text-purple-700 mt-1">{fmtBs(product.price)}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-xs ${outOfStock ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                      {outOfStock ? 'Agotado' : `Stock: ${product.currentStock}`}
                    </span>
                    {inCart && (
                      <span className="bg-purple-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {inCart.quantity}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {filteredRetailProducts.length === 0 && (
            <p className="text-center text-sm text-gray-500 py-4">{ES.app.noResults}</p>
          )}
        </div>
      </Modal>

      {/* Edit Materials Modal */}
      <Modal
        isOpen={!!editMaterialModal}
        onClose={() => { setEditMaterialModal(null); setEditMaterials([]); }}
        title={`${ES.sessions.materialsUsed} — ${editMaterialModal?.serviceName || ''}`}
        size="lg"
      >
        <div className="space-y-4 pb-16 sm:pb-0">
          {editMaterials.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">{ES.sessions.noMaterials}</p>
          ) : (
            <div className="space-y-3">
              {editMaterials.map((mat, idx) => {
                const usedIds = editMaterials.filter((_, i) => i !== idx).map((m) => m.productId).filter(Boolean);
                const editProductOptions = (products || [])
                  .filter((p) => !usedIds.includes(p.id))
                  .map((p) => ({ value: p.id, label: p.name, secondary: `${fmtBs(p.cost)} / ${p.unit || 'ud'}` }));
                return (
                <div key={idx} className="border border-gray-200 rounded-xl p-3 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <SearchableSelect
                        label=""
                        options={editProductOptions}
                        value={mat.productId}
                        onChange={(v) => {
                          const product = products?.find((p) => p.id === v);
                          if (!product) return;
                          const updated = [...editMaterials];
                          const oldMat = editMaterials[idx];
                          const availStock = product.currentStock + (oldMat.productId === v ? oldMat.quantity : 0);
                          const qty = Math.min(updated[idx].quantity, availStock);
                          updated[idx] = {
                            ...updated[idx],
                            productId: v,
                            productName: product.name,
                            unit: product.unit || 'ud',
                            pricePerUnit: product.cost,
                            maxStock: availStock,
                            quantity: qty,
                            totalPrice: product.cost * qty,
                            imprecise: product.imprecise === true,
                            defaultUsage: product.defaultUsage || 0,
                            manualOverride: false,
                          };
                          setEditMaterials(updated);
                        }}
                        placeholder={ES.material.product}
                      />
                    </div>
                    <button type="button" onClick={() => setEditMaterials(editMaterials.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-50 shrink-0 mt-1">
                      ✕
                    </button>
                  </div>

                  {mat.productId && (
                    <>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>Stock: {mat.maxStock} {mat.unit}</span>
                        <span>{fmtBs(mat.pricePerUnit)}/{mat.unit}</span>
                      </div>

                      {mat.imprecise && !mat.manualOverride && mat.defaultUsage > 0 ? (
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => {
                              const next = Math.min(mat.quantity + mat.defaultUsage, mat.maxStock || Infinity);
                              const updated = [...editMaterials];
                              updated[idx] = { ...updated[idx], quantity: next, totalPrice: mat.pricePerUnit * next };
                              setEditMaterials(updated);
                            }}
                            disabled={mat.quantity + mat.defaultUsage > mat.maxStock}
                            className="w-full py-4 min-h-[56px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-lg flex flex-col items-center justify-center transition-colors"
                          >
                            <span>{ES.inventory.markUsage}</span>
                            <span className="text-xs font-normal opacity-90 mt-0.5">{ES.inventory.markUsageDetail(mat.defaultUsage, mat.unit)}</span>
                          </button>
                          {mat.quantity > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-700">
                                {Math.round(mat.quantity / mat.defaultUsage)} {Math.round(mat.quantity / mat.defaultUsage) === 1 ? 'uso' : 'usos'} · {mat.quantity} {mat.unit}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...editMaterials];
                                  updated[idx] = { ...updated[idx], quantity: 0, totalPrice: 0 };
                                  setEditMaterials(updated);
                                }}
                                className="text-red-500 hover:text-red-700 underline"
                              >
                                Reiniciar
                              </button>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...editMaterials];
                              updated[idx] = { ...updated[idx], manualOverride: true };
                              setEditMaterials(updated);
                            }}
                            className="w-full text-xs text-gray-500 hover:text-gray-700 underline py-1"
                          >
                            {ES.inventory.adjustManually}
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                const step = mat.unit === 'ml' || mat.unit === 'g' ? 10 : 0.5;
                                const qty = Math.max(0, mat.quantity - step);
                                const updated = [...editMaterials];
                                updated[idx] = { ...updated[idx], quantity: qty, totalPrice: mat.pricePerUnit * qty };
                                setEditMaterials(updated);
                              }}
                              disabled={mat.quantity <= 0}
                              className="w-12 h-12 rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-30 text-xl font-bold text-gray-700 flex items-center justify-center transition-colors"
                            >
                              −
                            </button>
                            <div className="text-center min-w-[80px]">
                              <input
                                type="number"
                                value={mat.quantity}
                                onChange={(e) => {
                                  const raw = parseFloat(e.target.value) || 0;
                                  const qty = Math.min(Math.max(0, raw), mat.maxStock || Infinity);
                                  const updated = [...editMaterials];
                                  updated[idx] = { ...updated[idx], quantity: qty, totalPrice: mat.pricePerUnit * qty };
                                  setEditMaterials(updated);
                                }}
                                step="0.01"
                                min="0"
                                max={mat.maxStock}
                                className="w-20 text-center text-2xl font-bold text-gray-900 border-b-2 border-gray-300 focus:border-blue-500 outline-none bg-transparent"
                              />
                              <p className="text-xs text-gray-400 mt-0.5">{mat.unit}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const step = mat.unit === 'ml' || mat.unit === 'g' ? 10 : 0.5;
                                const qty = Math.min(mat.quantity + step, mat.maxStock);
                                const updated = [...editMaterials];
                                updated[idx] = { ...updated[idx], quantity: qty, totalPrice: mat.pricePerUnit * qty };
                                setEditMaterials(updated);
                              }}
                              disabled={mat.quantity >= mat.maxStock}
                              className="w-12 h-12 rounded-xl bg-blue-100 hover:bg-blue-200 disabled:opacity-30 text-xl font-bold text-blue-700 flex items-center justify-center transition-colors"
                            >
                              +
                            </button>
                          </div>
                          {mat.imprecise && mat.defaultUsage > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...editMaterials];
                                updated[idx] = { ...updated[idx], manualOverride: false };
                                setEditMaterials(updated);
                              }}
                              className="w-full text-xs text-blue-600 hover:text-blue-800 underline py-1"
                            >
                              {ES.inventory.backToPreset}
                            </button>
                          )}
                        </>
                      )}

                      <p className="text-center text-sm font-semibold text-gray-700">{fmtBs(mat.totalPrice)}</p>
                    </>
                  )}
                </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => setEditMaterials([...editMaterials, { productId: '', productName: '', quantity: 1, unit: '', pricePerUnit: 0, totalPrice: 0, maxStock: 0, imprecise: false, defaultUsage: 0, manualOverride: false }])}
            className="w-full py-3.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-blue-600 font-medium hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            {ES.sessions.addMaterial}
          </button>

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1 py-3" onClick={() => { setEditMaterialModal(null); setEditMaterials([]); }}>
              {ES.actions.cancel}
            </Button>
            <Button className="flex-1 py-3" onClick={handleSaveEditMaterials} loading={loading}>
              {ES.actions.save}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Staff Modal */}
      <Modal
        isOpen={!!editStaffModal}
        onClose={() => { setEditStaffModal(null); setEditStaffId(''); }}
        title={`${ES.sessions.assignStaff} — ${editStaffModal?.serviceName || ''}`}
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => { setEditStaffModal(null); setEditStaffId(''); }}>
              {ES.actions.cancel}
            </Button>
            <Button className="flex-1" onClick={handleSaveEditStaff} loading={loading}>
              {ES.actions.save}
            </Button>
          </div>
        }
      >
        <SearchableSelect
          label={ES.sessions.selectStaff}
          options={(staffList || []).map((s) => ({
            value: s.id,
            label: `${s.firstName} ${s.lastName}`,
            secondary: busyStaffIds.has(s.id) ? ES.staff.busy : undefined,
          }))}
          value={editStaffId}
          onChange={setEditStaffId}
          placeholder={ES.actions.search}
        />
      </Modal>

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
