'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardBody } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
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
import { WaitingListService } from '@/lib/services/waitingListService';
import type { WaitingListEntry } from '@/types/models';
import { AppointmentService } from '@/lib/services/appointmentService';
import { useRouter } from 'next/navigation';
import type { Appointment } from '@/types/models';
import { firebaseConstraints } from '@/lib/firebase/db';
import type { Session, SessionServiceItem } from '@/types/models';
import { toDate, fmtBs, fmtDate, getBoliviaDate, getBoliviaDateOffset } from '@/lib/utils/helpers';
import { canDoService, canDoAny, hasConfiguredSkills } from '@/lib/utils/staffSkills';
import { getClientBusyState, canTakeClient } from '@/lib/utils/clientBusy';
import { haptic } from '@/lib/utils/haptics';
import ES from '@/config/text.es';

interface MaterialEntry {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  totalPrice: number;
  maxStock: number;
}

export default function MyWorkPage() {
  const { user, userData } = useAuth();
  const { notifications, removeNotification, success, error } = useNotification();
  const [loading, setLoading] = useState(false);

  // Create trabajo modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [clientId, setClientId] = useState('__walkin__');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [isQuickClientOpen, setIsQuickClientOpen] = useState(false);
  const [quickClient, setQuickClient] = useState({ firstName: '', lastName: '', phone: '' });

  // Inline price edit state
  const [editingPrice, setEditingPrice] = useState<{ sessionId: string; serviceId: string } | null>(null);
  const [editPriceValue, setEditPriceValue] = useState('');

  // Material modal state
  const [materialModal, setMaterialModal] = useState<{
    sessionId: string;
    serviceId: string;
    serviceName: string;
  } | null>(null);
  const [materials, setMaterials] = useState<MaterialEntry[]>([]);

  // Duplicate-session confirmation (client already has active session when creating new)
  const [duplicateConfirm, setDuplicateConfirm] = useState<{ existingSession: Session; serviceId: string } | null>(null);

  const staffId = user?.uid || '';

  const today = useMemo(() => getBoliviaDate(), []);
  const yesterday = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
  }, []);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const isToday = selectedDate === today;
  const sessionConstraints = useMemo(() => [
    firebaseConstraints.where('salonId', '==', userData?.salonId || ''),
    firebaseConstraints.where('date', '==', selectedDate),
  ], [userData?.salonId, selectedDate]);
  const { data: sessions } = useRealtime<Session>('sessions', sessionConstraints, !!userData?.salonId, [userData?.salonId, selectedDate]);

  const waitingListConstraints = useMemo(() => [
    firebaseConstraints.where('salonId', '==', userData?.salonId || ''),
    firebaseConstraints.where('date', '==', today),
  ], [userData?.salonId, today]);
  const { data: waitingEntries } = useRealtime<WaitingListEntry>(
    'waitingList',
    waitingListConstraints,
    !!userData?.salonId && isToday,
    [userData?.salonId, today, isToday],
  );

  const { data: clients, refetch: refetchClients } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ClientRepository.getSalonClients(userData.salonId);
  }, [userData?.salonId]);

  const { data: products, refetch: refetchProducts } = useAsync(async () => {
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

  // Today's appointments assigned to this worker — used for "ready to start" prompt
  const { data: myTodayAppointments } = useAsync(async () => {
    if (!userData?.salonId || !staffId) return [] as Appointment[];
    return AppointmentService.getStaffAppointments(userData.salonId, staffId, today);
  }, [userData?.salonId, staffId, today]);

  const router = useRouter();

  // Appointments whose start time is within the next 30 min and not yet completed/cancelled
  const readyAppointments = React.useMemo(() => {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return (myTodayAppointments || []).filter((a) => {
      if (a.status === 'completed' || a.status === 'cancelled' || a.status === 'no_show') return false;
      const [h, m] = a.startTime.split(':').map(Number);
      const startMin = h * 60 + m;
      return startMin - nowMin <= 30; // within 30 min from now or already started
    });
  }, [myTodayAppointments]);

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

  const addServiceToExistingSession = async (sessionId: string, serviceId: string) => {
    const svc = salonServices?.find((s) => s.id === serviceId);
    if (!svc) throw new Error('Service not found');
    await SessionService.addServiceToSession({
      sessionId,
      serviceId: svc.id,
      serviceName: svc.name,
      price: svc.price,
      staffIds: [staffId],
      materials: [],
    });
  };

  const handleCreateTrabajo = async () => {
    if (!clientId || !userData?.salonId) {
      error(ES.messages.fillRequiredFields);
      return;
    }
    if (!selectedServiceId) {
      error(ES.staff.selectServiceRequired);
      return;
    }
    const resolvedClientId = clientId === '__walkin__' ? '' : clientId;

    // Duplicate check: if client already has an active session today, prompt user
    if (resolvedClientId) {
      const existingActive = (sessions || []).find(
        (s) => s.status === 'active' && s.clientId === resolvedClientId
      );
      if (existingActive) {
        setDuplicateConfirm({ existingSession: existingActive, serviceId: selectedServiceId });
        return;
      }
    }

    await performCreateSession(resolvedClientId, selectedServiceId);
  };

  const performCreateSession = async (resolvedClientId: string, serviceId: string) => {
    if (!userData?.salonId) return;
    setLoading(true);
    try {
      const sessionId = await SessionService.createSession({
        clientId: resolvedClientId,
        date: today,
        startTime: new Date(),
        salonId: userData.salonId,
      });
      await addServiceToExistingSession(sessionId, serviceId);
      success(ES.sessions.sessionCreated);
      setIsCreateModalOpen(false);
      setClientId('__walkin__');
      setSelectedServiceId('');
      setDuplicateConfirm(null);
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAddToExisting = async () => {
    if (!duplicateConfirm) return;
    setLoading(true);
    try {
      await addServiceToExistingSession(duplicateConfirm.existingSession.id, duplicateConfirm.serviceId);
      success(ES.staff.serviceAddedToSession);
      setIsCreateModalOpen(false);
      setClientId('__walkin__');
      setSelectedServiceId('');
      setDuplicateConfirm(null);
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

  const myStaffRecord = useMemo(
    () => (staffList || []).find((s) => s.id === staffId) as ({ serviceIds?: string[] } | undefined),
    [staffList, staffId],
  );
  const skillsConfigured = hasConfiguredSkills(myStaffRecord);

  // Entry shows in my queue if any service is preferred-for-me, OR if I can do
  // at least one of its services. Workers without configured skills see everything
  // (backward compat — banner nudges admin to configure).
  const entryMatchesMe = (e: WaitingListEntry): boolean => {
    if (e.preferredStaffId && e.preferredStaffId === staffId) return true;
    return (e.servicePreferences || []).some((p) => p.preferredStaffId === staffId);
  };
  const entrySkillMatch = (e: WaitingListEntry): boolean => {
    return canDoAny(myStaffRecord, e.serviceIds || []);
  };

  const myWaitingList = (waitingEntries || [])
    .filter((e) => e.status === 'waiting')
    .filter((e) => entryMatchesMe(e) || entrySkillMatch(e))
    .map((e) => ({ ...e, arrivalTime: toDate(e.arrivalTime) }))
    .sort((a, b) => {
      const aMine = entryMatchesMe(a) ? 0 : 1;
      const bMine = entryMatchesMe(b) ? 0 : 1;
      if (aMine !== bMine) return aMine - bMine;
      return (a.order || 0) - (b.order || 0);
    });

  const handleTakeFromQueue = async (entryId: string) => {
    if (!staffId) return;
    // Block take if the client has an in_progress service under another
    // worker — parallel attention would fight over the same person. Paused
    // is fine; that's explicitly what pause enables.
    const entry = (waitingEntries || []).find((e) => e.id === entryId);
    if (entry && entry.clientId) {
      const busy = getClientBusyState(entry.clientId, activeSessions, getStaffName);
      if (!canTakeClient(busy)) {
        error(ES.cola.takeBlocked);
        return;
      }
    }
    haptic.medium();
    setLoading(true);
    try {
      await WaitingListService.take({ entryId, takenByStaffId: staffId });
      haptic.success();
      success(ES.cola.taken);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error && e.message === 'ENTRY_ALREADY_TAKEN'
        ? ES.cola.alreadyTaken
        : ES.messages.operationFailed;
      error(msg);
    } finally {
      setLoading(false);
    }
  };

  const myActiveServices: { session: Session; service: SessionServiceItem }[] = [];
  const myPausedServices: { session: Session; service: SessionServiceItem }[] = [];
  activeSessions.forEach((session) => {
    (session.services || []).forEach((svc) => {
      if (!svc.assignedStaff?.includes(staffId) || svc.status === 'completed') return;
      if (svc.status === 'paused') {
        myPausedServices.push({ session, service: svc });
      } else {
        myActiveServices.push({ session, service: svc });
      }
    });
  });

  const availableServices: { session: Session; service: SessionServiceItem }[] = [];
  activeSessions.forEach((session) => {
    (session.services || []).forEach((svc) => {
      if ((!svc.assignedStaff || svc.assignedStaff.length === 0) && svc.status !== 'completed') {
        if (!canDoService(myStaffRecord, svc.serviceId)) return;
        availableServices.push({ session, service: svc });
      }
    });
  });

  const myCompletedServices: { session: Session; service: SessionServiceItem }[] = [];
  allSessions.forEach((session) => {
    if (session.status === 'cancelled') return;
    (session.services || []).forEach((svc) => {
      if (svc.assignedStaff?.includes(staffId) && svc.status === 'completed') {
        myCompletedServices.push({ session, service: svc });
      }
    });
  });

  // "Siguiente" — the single next action, chosen by priority:
  //   1. A service I'm actively doing (finish what's started)
  //   2. A queue entry preferred for me (client asked for me specifically)
  //   3. A service I paused (I owe this client)
  //   4. A queue entry I can do but wasn't asked for me (open queue)
  //   5. An unassigned active service I can do (help the team)
  //   6. Nothing — idle state
  type NextAction =
    | { kind: 'active'; session: Session; service: SessionServiceItem }
    | { kind: 'queue-preferred'; entry: WaitingListEntry & { arrivalTime: Date } }
    | { kind: 'paused'; session: Session; service: SessionServiceItem }
    | { kind: 'queue-open'; entry: WaitingListEntry & { arrivalTime: Date } }
    | { kind: 'unassigned'; session: Session; service: SessionServiceItem }
    | { kind: 'idle' };

  const nextAction: NextAction = useMemo(() => {
    if (!isToday) return { kind: 'idle' };
    if (myActiveServices.length > 0) {
      const oldest = [...myActiveServices].sort((a, b) =>
        toDate(a.service.startTime).getTime() - toDate(b.service.startTime).getTime(),
      )[0];
      return { kind: 'active', session: oldest.session, service: oldest.service };
    }
    const preferred = myWaitingList.find((e) => entryMatchesMe(e));
    if (preferred) return { kind: 'queue-preferred', entry: preferred };
    if (myPausedServices.length > 0) {
      const oldest = [...myPausedServices].sort((a, b) => {
        const aT = a.service.pausedAt ? toDate(a.service.pausedAt).getTime() : 0;
        const bT = b.service.pausedAt ? toDate(b.service.pausedAt).getTime() : 0;
        return aT - bT;
      })[0];
      return { kind: 'paused', session: oldest.session, service: oldest.service };
    }
    const openQueue = myWaitingList.find((e) => !entryMatchesMe(e));
    if (openQueue) return { kind: 'queue-open', entry: openQueue };
    if (availableServices.length > 0) {
      return { kind: 'unassigned', session: availableServices[0].session, service: availableServices[0].service };
    }
    return { kind: 'idle' };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isToday, myActiveServices, myPausedServices, myWaitingList, availableServices]);

  const [showCompleted, setShowCompleted] = useState(false);

  const handleSelfAssign = async (session: Session, service: SessionServiceItem) => {
    haptic.medium();
    setLoading(true);
    try {
      const updatedServices = (session.services || []).map((svc) => {
        if (svc.id === service.id) {
          return { ...svc, assignedStaff: [...(svc.assignedStaff || []), staffId] };
        }
        return svc;
      });
      await SessionRepository.updateSession(session.id, { services: updatedServices });
      haptic.success();
      success(ES.sessions.serviceAdded);
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  // Release a service back to the team — clears assignedStaff on that one
  // service. Only available when status is 'pending' or 'paused' (can't release
  // something you're actively doing).
  const handleReleaseService = async (session: Session, service: SessionServiceItem) => {
    if (service.status === 'in_progress' || service.status === 'completed') return;
    haptic.warning();
    setLoading(true);
    try {
      const updatedServices = (session.services || []).map((svc) => {
        if (svc.id !== service.id) return svc;
        return { ...svc, assignedStaff: [] };
      });
      await SessionRepository.updateSession(session.id, { services: updatedServices });
      success(ES.staff.released);
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  const handlePauseResume = async (session: Session, service: SessionServiceItem) => {
    if (service.status !== 'in_progress' && service.status !== 'paused') return;
    const nextStatus: SessionServiceItem['status'] =
      service.status === 'in_progress' ? 'paused' : 'in_progress';
    haptic.light();
    setLoading(true);
    try {
      const updatedServices = (session.services || []).map((svc) => {
        if (svc.id !== service.id) return svc;
        const patch: Partial<SessionServiceItem> = { status: nextStatus };
        if (nextStatus === 'paused') patch.pausedAt = new Date();
        return { ...svc, ...patch };
      });
      await SessionRepository.updateSession(session.id, { services: updatedServices });
      success(ES.servicePause.statusUpdated);
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleAdvanceStatus = async (session: Session, service: SessionServiceItem) => {
    if (service.status === 'completed') return;
    // Paused must resume first — call pause/resume instead
    if (service.status === 'paused') {
      await handlePauseResume(session, service);
      return;
    }
    const nextStatus = service.status === 'pending' ? 'in_progress' : 'completed';
    if (nextStatus === 'completed') haptic.success();
    else haptic.medium();
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
    secondary: `${ES.sessions.materialSellPrice}: ${fmtBs(p.cost)}/${p.unit || 'ud'} · Stock: ${p.currentStock}`,
  }));

  const handleAddMaterialRow = () => {
    setMaterials([...materials, { productId: '', productName: '', quantity: 1, unit: '', pricePerUnit: 0, totalPrice: 0, maxStock: 0 }]);
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
    };
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

  const openMaterialModal = (session: Session, service: SessionServiceItem) => {
    const existing: MaterialEntry[] = (service.materialsUsed || []).map((m) => {
      const product = products?.find((p) => p.id === m.productId);
      return {
        productId: m.productId,
        productName: m.productName,
        quantity: m.quantity,
        unit: m.unit || 'ud',
        pricePerUnit: m.cost / (m.quantity || 1),
        totalPrice: m.cost,
        maxStock: (product?.currentStock || 0) + m.quantity,
      };
    });
    setMaterials(existing);
    setMaterialModal({ sessionId: session.id, serviceId: service.id, serviceName: service.serviceName });
  };

  const handleSaveMaterials = async () => {
    if (!materialModal) return;
    const newMats = materials.filter((m) => m.productId && m.quantity > 0);
    setLoading(true);
    try {
      const session = await SessionService.getSession(materialModal.sessionId);
      if (!session) throw new Error('Session not found');

      const oldSvc = session.services?.find((s) => s.id === materialModal.serviceId);
      const oldMats = oldSvc?.materialsUsed || [];

      // Validate stock — account for restoring old materials first
      for (const nm of newMats) {
        const product = await ProductRepository.getProduct(nm.productId);
        if (!product) throw new Error(`Producto no encontrado: ${nm.productName}`);
        const restoredQty = oldMats
          .filter((om) => om.productId === nm.productId)
          .reduce((sum, om) => sum + om.quantity, 0);
        const availableStock = product.currentStock + restoredQty;
        if (nm.quantity > availableStock) {
          throw new Error(`Stock insuficiente para ${nm.productName} (disponible: ${availableStock})`);
        }
      }

      const updatedServices = (session.services || []).map((svc) => {
        if (svc.id !== materialModal.serviceId) return svc;
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

      const allMaterials = updatedServices.flatMap((svc) => svc.materialsUsed || []);
      const servicePrices = updatedServices.reduce((sum, s) => sum + s.price, 0);

      await SessionRepository.updateSession(materialModal.sessionId, {
        services: updatedServices,
        materialsUsed: allMaterials,
        totalAmount: servicePrices,
      });

      // Restore old stock, then deduct new stock
      for (const om of oldMats) {
        await ProductRepository.restockProduct(om.productId, om.quantity);
      }
      for (const nm of newMats) {
        await ProductRepository.updateStock(nm.productId, nm.quantity);
      }
      refetchProducts(); // refresh local product stock cache

      success(ES.staff.materialAdded);
      setMaterialModal(null);
      setMaterials([]);
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePrice = async (sessionId: string, serviceId: string) => {
    const newPrice = parseFloat(editPriceValue);
    if (isNaN(newPrice) || newPrice < 0) {
      error(ES.messages.fillRequiredFields);
      return;
    }
    setLoading(true);
    try {
      const session = await SessionService.getSession(sessionId);
      if (!session) throw new Error('Session not found');

      const updatedServices = (session.services || []).map((svc) =>
        svc.id === serviceId ? { ...svc, price: newPrice } : svc
      );
      const servicePrices = updatedServices.reduce((sum, s) => sum + s.price, 0);

      await SessionRepository.updateSession(sessionId, {
        services: updatedServices,
        totalAmount: servicePrices,
      });
      setEditingPrice(null);
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
      <div className="pt-2 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">{ES.staff.myWork}</h1>
            <p className="text-sm text-gray-500 mt-1 truncate">
              {userData?.firstName} · {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          {isToday && (
            <Button size="lg" className="py-3 px-4 text-sm shrink-0" onClick={() => setIsCreateModalOpen(true)}>
              {ES.staff.newWork}
            </Button>
          )}
        </div>

        {/* Date selector — same pattern as sessions page */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedDate(today)}
              className={`flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] text-sm border rounded-lg font-medium whitespace-nowrap transition-colors ${
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
              className={`flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] text-sm border rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedDate === yesterday
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              Ayer
            </button>
          </div>
          <div className="flex flex-col flex-1">
            <input
              type="date"
              value={selectedDate}
              min={getBoliviaDateOffset(7)}
              max={today}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg text-sm w-full"
            />
            <span className="text-[10px] text-gray-500 mt-0.5">{fmtDate(selectedDate)}</span>
          </div>
        </div>

        {!isToday && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <p className="text-xs text-amber-800">
              Viendo {fmtDate(selectedDate)} — solo lectura
            </p>
          </div>
        )}
      </div>

      {/* === SKILLS NOT CONFIGURED BANNER === */}
      {isToday && staffList && !skillsConfigured && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">{ES.staff.skillsNotConfigured}</p>
          <p className="text-xs text-amber-700 mt-0.5">{ES.staff.skillsNotConfiguredHint}</p>
        </div>
      )}

      {/* === SIGUIENTE HERO — the single next action ===
          Older workers should see one decision, not ten. The hero picks by
          priority (active > preferred queue > paused > open queue > unassigned)
          and renders a large, single-CTA card. Everything else on the page
          becomes optional review. */}
      {isToday && nextAction.kind !== 'idle' && (() => {
        if (nextAction.kind === 'active') {
          const { session, service } = nextAction;
          const elapsed = Math.max(
            0,
            Math.floor((Date.now() - toDate(service.startTime).getTime()) / 60000),
          );
          return (
            <Card className="border-2 border-blue-500 bg-blue-50">
              <CardBody>
                <div className="space-y-3">
                  <p className="text-[11px] uppercase tracking-widest text-blue-700 font-bold">
                    {ES.staff.nextUpTitle}
                  </p>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{service.serviceName}</p>
                    <p className="text-base text-gray-700 mt-0.5">{getClientName(session.clientId)}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {ES.staff.nextStartedAgo} {elapsed} min
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="lg"
                      variant="primary"
                      className="flex-1 py-4 text-base min-h-[52px]"
                      onClick={() => handleAdvanceStatus(session, service)}
                      loading={loading}
                    >
                      {service.status === 'pending' ? ES.staff.advancePending : ES.staff.advanceInProgress}
                    </Button>
                    {service.status === 'in_progress' && (
                      <Button
                        size="lg"
                        variant="ghost"
                        className="py-4 px-4 min-h-[52px] text-amber-700"
                        onClick={() => handlePauseResume(session, service)}
                        loading={loading}
                      >
                        {ES.servicePause.pause}
                      </Button>
                    )}
                  </div>
                  {/* Secondary action — materials are logged mid-service, so
                      earning a spot on the hero even though other secondary
                      actions (release, history) live on the expanded card. */}
                  <button
                    type="button"
                    onClick={() => openMaterialModal(session, service)}
                    className="w-full text-sm text-blue-700 font-medium underline-offset-2 hover:underline min-h-[40px]"
                  >
                    {ES.staff.addMyMaterial}
                  </button>
                </div>
              </CardBody>
            </Card>
          );
        }
        if (nextAction.kind === 'queue-preferred' || nextAction.kind === 'queue-open') {
          const entry = nextAction.entry;
          const mins = Math.max(0, Math.floor((Date.now() - entry.arrivalTime.getTime()) / 60000));
          const busy = entry.clientId
            ? getClientBusyState(entry.clientId, activeSessions, getStaffName)
            : ({ kind: 'free' } as const);
          const takeDisabled = busy.kind === 'in_progress';
          return (
            <Card className="border-2 border-green-500 bg-green-50">
              <CardBody>
                <div className="space-y-3">
                  <p className="text-[11px] uppercase tracking-widest text-green-700 font-bold">
                    {ES.cola.nextUp}
                  </p>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{entry.walkInName || '—'}</p>
                    <p className="text-base text-gray-700 mt-0.5 truncate">
                      {(entry.serviceNames || []).join(' · ')}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {ES.staff.nextWaiting} {mins} min
                    </p>
                    {busy.kind === 'in_progress' && (
                      <p className="text-xs text-red-700 font-medium mt-1">
                        {ES.cola.clientBusyInProgress} {busy.staffName}
                      </p>
                    )}
                    {busy.kind === 'paused' && (
                      <p className="text-xs text-amber-700 mt-1">
                        {ES.cola.clientBusyPaused} {busy.staffName} · {ES.cola.clientBusyHintPaused}
                      </p>
                    )}
                  </div>
                  <Button
                    size="lg"
                    variant="primary"
                    className="w-full py-4 text-base min-h-[52px]"
                    onClick={() => handleTakeFromQueue(entry.id)}
                    loading={loading}
                    disabled={takeDisabled}
                    title={takeDisabled ? ES.cola.takeBlocked : undefined}
                  >
                    {ES.staff.nextTakeClient}
                  </Button>
                </div>
              </CardBody>
            </Card>
          );
        }
        if (nextAction.kind === 'paused') {
          const { session, service } = nextAction;
          const pausedFor = service.pausedAt
            ? Math.max(0, Math.floor((Date.now() - toDate(service.pausedAt).getTime()) / 60000))
            : 0;
          return (
            <Card className="border-2 border-amber-500 bg-amber-50">
              <CardBody>
                <div className="space-y-3">
                  <p className="text-[11px] uppercase tracking-widest text-amber-700 font-bold">
                    {ES.staff.nextUpTitle}
                  </p>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{service.serviceName}</p>
                    <p className="text-base text-gray-700 mt-0.5">{getClientName(session.clientId)}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {ES.staff.nextPausedFor} {pausedFor} min
                    </p>
                  </div>
                  <Button
                    size="lg"
                    variant="primary"
                    className="w-full py-4 text-base min-h-[52px]"
                    onClick={() => handlePauseResume(session, service)}
                    loading={loading}
                  >
                    {ES.staff.nextResume}
                  </Button>
                  <button
                    type="button"
                    onClick={() => openMaterialModal(session, service)}
                    className="w-full text-sm text-amber-800 font-medium underline-offset-2 hover:underline min-h-[40px]"
                  >
                    {ES.staff.addMyMaterial}
                  </button>
                </div>
              </CardBody>
            </Card>
          );
        }
        // unassigned
        const { session, service } = nextAction;
        return (
          <Card className="border-2 border-blue-400 bg-blue-50">
            <CardBody>
              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-widest text-blue-700 font-bold">
                  {ES.staff.nextUpTitle}
                </p>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{service.serviceName}</p>
                  <p className="text-base text-gray-700 mt-0.5">{getClientName(session.clientId)}</p>
                </div>
                <Button
                  size="lg"
                  variant="primary"
                  className="w-full py-4 text-base min-h-[52px]"
                  onClick={() => handleSelfAssign(session, service)}
                  loading={loading}
                >
                  {ES.staff.nextSelfAssign}
                </Button>
              </div>
            </CardBody>
          </Card>
        );
      })()}

      {/* Idle state — calm, no list */}
      {isToday && nextAction.kind === 'idle' && myActiveServices.length === 0 && myPausedServices.length === 0 && (
        <Card>
          <CardBody>
            <div className="py-6 text-center">
              <p className="text-lg font-semibold text-gray-800">{ES.staff.nextIdle}</p>
              <p className="text-sm text-gray-500 mt-1">{ES.staff.nextIdleHint}</p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* === READY-TO-START APPOINTMENT BANNER === */}
      {isToday && readyAppointments.length > 0 && (
        <div className="space-y-2">
          {readyAppointments.map((apt) => {
            const client = clients?.find((c) => c.id === apt.clientId);
            const cName = client ? `${client.firstName} ${client.lastName}` : 'Cliente';
            return (
              <Card key={apt.id} className="bg-blue-50 border border-blue-200">
                <CardBody>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-blue-600 font-medium">{ES.appointments.startNow}</p>
                      <p className="text-sm font-semibold text-blue-900 truncate">{cName} · {apt.startTime}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => router.push('/my-appointments')}
                      className="shrink-0 text-xs"
                    >
                      {ES.sessions.create}
                    </Button>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

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
                          {editingPrice?.sessionId === session.id && editingPrice?.serviceId === service.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                value={editPriceValue}
                                onChange={(e) => setEditPriceValue(e.target.value)}
                                className="w-20 text-right text-sm py-1"
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSavePrice(session.id, service.id); if (e.key === 'Escape') setEditingPrice(null); }}
                                autoFocus
                              />
                              <button onClick={() => handleSavePrice(session.id, service.id)} className="text-green-600 hover:text-green-800 text-sm font-bold px-1">✓</button>
                              <button onClick={() => setEditingPrice(null)} className="text-gray-400 hover:text-gray-600 text-sm px-1">✕</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingPrice({ sessionId: session.id, serviceId: service.id }); setEditPriceValue(String(service.price)); }}
                              className="text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors"
                              title={ES.actions.edit}
                            >
                              {fmtBs(service.price)} <span className="text-xs text-gray-400">✎</span>
                            </button>
                          )}
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

                      {isToday && (
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            size="lg"
                            variant="primary"
                            className="flex-1 py-3 text-sm min-h-[44px]"
                            onClick={() => handleAdvanceStatus(session, service)}
                            loading={loading}
                          >
                            {service.status === 'pending'
                              ? ES.staff.advancePending
                              : service.status === 'paused'
                              ? ES.servicePause.resume
                              : ES.staff.advanceInProgress}
                          </Button>
                          {service.status === 'in_progress' && (
                            <Button
                              size="lg"
                              variant="ghost"
                              className="py-3 px-3 text-sm min-h-[44px] text-amber-700"
                              onClick={() => handlePauseResume(session, service)}
                              loading={loading}
                            >
                              {ES.servicePause.pause}
                            </Button>
                          )}
                          <Button
                            size="lg"
                            variant="secondary"
                            className="py-3 px-3 text-sm min-h-[44px]"
                            onClick={() => openMaterialModal(session, service)}
                          >
                            {ES.staff.addMyMaterial}
                          </Button>
                          {(service.status === 'pending' || service.status === 'paused') && (
                            <Button
                              size="lg"
                              variant="ghost"
                              className="py-3 px-3 text-sm min-h-[44px] text-gray-600"
                              onClick={() => handleReleaseService(session, service)}
                              loading={loading}
                              title={ES.staff.releaseHint}
                            >
                              {ES.staff.releaseService}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* === MY PAUSED SERVICES === */}
      {isToday && myPausedServices.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-amber-800 mb-1">{ES.servicePause.pausedServices}</h2>
          <p className="text-xs text-amber-700 mb-3">{ES.servicePause.pausedHint}</p>
          <div className="space-y-2">
            {myPausedServices.map(({ session, service }) => {
              const pausedSince = service.pausedAt
                ? Math.max(0, Math.floor((Date.now() - toDate(service.pausedAt).getTime()) / 60000))
                : 0;
              return (
                <Card key={`paused-${session.id}-${service.id}`} className="border-l-4 border-amber-400 bg-amber-50">
                  <CardBody>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-xs rounded-full bg-amber-200 text-amber-900 font-medium">
                            {ES.servicePause.paused}
                          </span>
                          <p className="font-semibold text-gray-900 truncate">{service.serviceName}</p>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          {getClientName(session.clientId)} · {ES.servicePause.pausedSince}: {pausedSince} min
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          className="min-h-[44px]"
                          onClick={() => handlePauseResume(session, service)}
                          loading={loading}
                        >
                          {ES.servicePause.resume}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="min-h-[44px] text-gray-600"
                          onClick={() => handleReleaseService(session, service)}
                          loading={loading}
                        >
                          {ES.staff.releaseService}
                        </Button>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* === AVAILABLE (UNASSIGNED) SERVICES === */}
      {isToday && availableServices.length > 0 && (
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

      {/* === LISTA DE ESPERA (queue entries relevant to me) === */}
      {isToday && myWaitingList.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">{ES.cola.title}</h2>
            <span className="text-xs text-gray-500">{myWaitingList.length} {ES.cola.waitingCount}</span>
          </div>
          <div className="space-y-2">
            {myWaitingList.map((entry) => {
              const mins = Math.max(
                0,
                Math.floor((Date.now() - entry.arrivalTime.getTime()) / 60000),
              );
              const forMe = entryMatchesMe(entry);
              // Which of the entry's services can I actually do?
              const doableIdxs = (entry.serviceIds || [])
                .map((sid, i) => (canDoService(myStaffRecord, sid) ? i : -1))
                .filter((i) => i >= 0);
              const partialSkill = doableIdxs.length > 0 && doableIdxs.length < (entry.serviceIds || []).length;
              const doableNames = doableIdxs.map((i) => entry.serviceNames?.[i]).filter(Boolean);
              // Client-busy state: if the client is already being worked on
              // somewhere, take must wait. Paused is fine — parallel work is
              // the point of pausing.
              const busy = entry.clientId
                ? getClientBusyState(entry.clientId, activeSessions, getStaffName)
                : ({ kind: 'free' } as const);
              const takeDisabled = busy.kind === 'in_progress';
              // Priority lives in the Siguiente hero card, so queue rows are
              // deliberately flat: no color borders, no red/amber competition.
              // Typography weight + "Para ti" pill is enough hierarchy.
              return (
                <Card key={`queue-${entry.id}`}>
                  <CardBody>
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900 truncate">
                            {entry.walkInName || '—'}
                          </p>
                          {forMe && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800 font-medium">
                              {ES.cola.forYou}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5 truncate">
                          {(entry.serviceNames || []).join(' · ')}
                        </p>
                        {partialSkill && skillsConfigured && (
                          <p className="text-[11px] text-blue-700 mt-0.5 truncate">
                            ✓ {doableNames.join(' · ')}
                          </p>
                        )}
                        {busy.kind === 'in_progress' && (
                          <p className="text-[11px] text-red-700 font-medium mt-0.5 truncate">
                            {ES.cola.clientBusyInProgress} {busy.staffName}
                          </p>
                        )}
                        {busy.kind === 'paused' && (
                          <p className="text-[11px] text-amber-700 mt-0.5 truncate">
                            {ES.cola.clientBusyPaused} {busy.staffName} · {ES.cola.clientBusyHintPaused}
                          </p>
                        )}
                        <p className="text-xs mt-0.5 text-gray-500 tabular-nums">
                          {mins} min · {entry.arrivalTime.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="primary"
                        className="min-h-[44px] shrink-0"
                        onClick={() => handleTakeFromQueue(entry.id)}
                        loading={loading}
                        disabled={takeDisabled}
                        title={takeDisabled ? ES.cola.takeBlocked : undefined}
                      >
                        {ES.cola.take}
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Atenciones en Curso (all-salon session browser) removed from /my-work.
          It surfaced manager-level context that overwhelmed workers. Workers
          add services to their own sessions through Mis Servicios Activos.
          Admins/gerentes use /sessions for full-salon visibility. */}

      {/* === COMPLETED (selected date) — collapsed by default on today,
          expanded automatically when viewing a past date (main purpose of
          navigating back is to review completed work). */}
      {myCompletedServices.length > 0 && (() => {
        const expanded = !isToday || showCompleted;
        return (
          <section>
            <button
              type="button"
              onClick={() => isToday && setShowCompleted((v) => !v)}
              disabled={!isToday}
              className="w-full flex items-center justify-between text-left min-h-[44px] px-1 py-2"
            >
              <h2 className="text-base font-semibold text-gray-700">
                {isToday ? ES.staff.myCompletedToday : `Completados ${fmtDate(selectedDate)}`}
                <span className="ml-2 text-xs font-normal text-gray-500">{myCompletedServices.length}</span>
              </h2>
              {isToday && (
                <span className="text-xs text-blue-600 font-medium">
                  {showCompleted ? ES.staff.hideCompletedToday : ES.staff.showCompletedToday}
                </span>
              )}
            </button>
            {expanded && (
              <div className="space-y-2 mt-2">
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
            )}
          </section>
        );
      })()}

      {/* === MATERIAL MODAL === */}
      <Modal
        isOpen={!!materialModal}
        onClose={() => { setMaterialModal(null); setMaterials([]); }}
        title={`${ES.sessions.materialsUsed} — ${materialModal?.serviceName || ''}`}
        size="lg"
      >
        <div className="space-y-4 pb-16 sm:pb-0">
          {materials.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">{ES.sessions.noMaterials}</p>
          ) : (
            <div className="space-y-3">
              {materials.map((mat, idx) => {
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
                      {/* Stock indicator */}
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>Stock: {mat.maxStock} {mat.unit}</span>
                        <span>{fmtBs(mat.pricePerUnit)}/{mat.unit}</span>
                      </div>

                      {/* Stepper: big -/+ buttons with quantity in center */}
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

                      {/* Cost total */}
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
      <Modal isOpen={isCreateModalOpen} onClose={() => { setIsCreateModalOpen(false); setClientId('__walkin__'); setSelectedServiceId(''); }} title={ES.staff.createWork}>
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
            label={ES.staff.selectService}
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
            required
          />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1 py-3" onClick={() => { setIsCreateModalOpen(false); setClientId('__walkin__'); setSelectedServiceId(''); }}>
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
          <Input label={ES.clients.name} value={quickClient.firstName} onChange={(e) => setQuickClient({ ...quickClient, firstName: e.target.value })} required maxLength={30} />
          <Input label={ES.clients.lastName} value={quickClient.lastName} onChange={(e) => setQuickClient({ ...quickClient, lastName: e.target.value })} maxLength={30} />
          <Input label={ES.clients.phoneOptional} type="tel" value={quickClient.phone} onChange={(e) => setQuickClient({ ...quickClient, phone: e.target.value })} maxLength={10} />
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

      {/* Duplicate session confirmation */}
      <Modal
        isOpen={!!duplicateConfirm}
        onClose={() => setDuplicateConfirm(null)}
        title={ES.staff.clientHasActiveSession}
        size="sm"
      >
        {duplicateConfirm && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm font-semibold text-amber-900">
                {getClientName(duplicateConfirm.existingSession.clientId)}
              </p>
              <p className="text-xs text-amber-700 mt-1">
                {(duplicateConfirm.existingSession.services || []).length} {(duplicateConfirm.existingSession.services || []).length === 1 ? 'servicio' : 'servicios'} en curso
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                className="w-full py-3 min-h-[44px]"
                onClick={handleConfirmAddToExisting}
                loading={loading}
              >
                {ES.staff.addToExistingSession}
              </Button>
              <Button
                variant="secondary"
                className="w-full py-3 min-h-[44px]"
                onClick={() => {
                  const d = duplicateConfirm;
                  setDuplicateConfirm(null);
                  performCreateSession(d.existingSession.clientId, d.serviceId);
                }}
                loading={loading}
              >
                {ES.staff.createNewSession}
              </Button>
              <Button
                variant="ghost"
                className="w-full py-3 min-h-[44px]"
                onClick={() => setDuplicateConfirm(null)}
              >
                {ES.actions.cancel}
              </Button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
