'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardBody } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { Toast } from '@/components/Toast';
import { RoleGuard } from '@/components/RoleGuard';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useRealtime } from '@/hooks/useRealtime';
import { useNotification } from '@/hooks/useNotification';
import { ClientRepository } from '@/lib/repositories/clientRepository';
import { ServiceRepository } from '@/lib/repositories/serviceRepository';
import { StaffRepository } from '@/lib/repositories/staffRepository';
import { WaitingListRepository } from '@/lib/repositories/waitingListRepository';
import { WaitingListService } from '@/lib/services/waitingListService';
import { AppointmentService } from '@/lib/services/appointmentService';
import { firebaseConstraints } from '@/lib/firebase/db';
import { toDate, fmtBs, getBoliviaDate } from '@/lib/utils/helpers';
import { canDoAny } from '@/lib/utils/staffSkills';
import { getClientBusyState, canTakeClient } from '@/lib/utils/clientBusy';
import type { WaitingListEntry, ServicePreference, Appointment, Session } from '@/types/models';
import ES from '@/config/text.es';
import { Clock, UserPlus, Check, X, Bell, Megaphone, ChevronDown, ChevronUp, Calendar, PhoneOff, RotateCw } from 'lucide-react';

// Only position #1 gets an "overdue" pulse — if they've been waiting this long,
// something is blocking the first slot and the worker should act now.
const NEXT_OVERDUE_MIN = 15;

export default function ColaPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const { notifications, removeNotification, success, error } = useNotification();

  const today = useMemo(() => getBoliviaDate(), []);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [actionEntryId, setActionEntryId] = useState<string>('');
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isTakeOpen, setIsTakeOpen] = useState(false);
  const [takeStaffId, setTakeStaffId] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedEntryId, setExpandedEntryId] = useState<string>('');
  const [showEstimates, setShowEstimates] = useState(true);
  const [showSkipped, setShowSkipped] = useState(true);
  const [callEntry, setCallEntry] = useState<WaitingListEntry | null>(null);
  // After the call overlay closes we ask "did they respond?" to drive the
  // no-show flow (skipped → maybe no_show after 2 attempts).
  const [callResponsePending, setCallResponsePending] = useState<WaitingListEntry | null>(null);

  // Form state — unified client flow (matching appointments page)
  const [formClientId, setFormClientId] = useState('');
  const [formServiceIds, setFormServiceIds] = useState<string[]>([]);
  // Per-service worker preference. Key = serviceId, value = staffId ('' = any worker).
  const [formServicePrefs, setFormServicePrefs] = useState<Record<string, string>>({});
  const [formNotes, setFormNotes] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  // Quick-create client modal (same pattern as appointments page)
  const [isQuickClientOpen, setIsQuickClientOpen] = useState(false);
  const [quickClient, setQuickClient] = useState({ firstName: '', lastName: '', phone: '' });

  const { data: clients, refetch: refetchClients } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ClientRepository.getSalonClients(userData.salonId);
  }, [userData?.salonId]);

  const { data: services } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ServiceRepository.getSalonServices(userData.salonId);
  }, [userData?.salonId]);

  const { data: staff } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return StaffRepository.getSalonStaff(userData.salonId);
  }, [userData?.salonId]);

  // Today's appointments — used both for priority banner and smart estimate.
  // One-shot fetch (useAsync) is acceptable; the cola page is used actively
  // by front-desk so a manual refresh or navigation retriggers.
  const { data: appointments } = useAsync(async () => {
    if (!userData?.salonId) return [] as Appointment[];
    return AppointmentService.getSalonAppointments(userData.salonId, today);
  }, [userData?.salonId, today]);

  const { data: queue } = useRealtime<WaitingListEntry>(
    'waitingList',
    userData?.salonId
      ? [
          firebaseConstraints.where('salonId', '==', userData.salonId),
          firebaseConstraints.where('date', '==', today),
        ]
      : [],
    !!userData?.salonId,
    [userData?.salonId, today],
  );

  // Today's active sessions — used to seed per-worker busy load for estimates.
  // Without this, freeAt starts at `now` for every worker even if they're
  // mid-service, which massively under-estimates wait time.
  const { data: activeSessionsToday } = useRealtime<Session>(
    'sessions',
    userData?.salonId
      ? [
          firebaseConstraints.where('salonId', '==', userData.salonId),
          firebaseConstraints.where('date', '==', today),
        ]
      : [],
    !!userData?.salonId,
    [userData?.salonId, today],
  );

  const sortedQueue = useMemo(() => {
    const list = [...(queue || [])].map((e) => ({ ...e, arrivalTime: toDate(e.arrivalTime) }));
    return list.sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [queue]);

  const waiting = sortedQueue.filter((e) => e.status === 'waiting');
  const taken = sortedQueue.filter((e) => e.status === 'taken');
  const cancelled = sortedQueue.filter((e) => e.status === 'cancelled');
  const skipped = sortedQueue.filter((e) => e.status === 'skipped');

  const resetForm = () => {
    setFormClientId('');
    setFormServiceIds([]);
    setFormServicePrefs({});
    setFormNotes('');
    setServiceSearch('');
  };

  const canSubmit = formServiceIds.length > 0 && !!formClientId;

  const handleQuickCreateClient = async () => {
    if (!quickClient.firstName || !quickClient.phone || !userData?.salonId) {
      error(ES.messages.fillRequiredFields);
      return;
    }
    setLoading(true);
    try {
      const newClientId = await ClientRepository.createClient(userData.salonId, {
        firstName: quickClient.firstName,
        lastName: quickClient.lastName,
        phone: quickClient.phone,
      });
      success(ES.clients.clientCreated);
      setQuickClient({ firstName: '', lastName: '', phone: '' });
      setIsQuickClientOpen(false);
      setFormClientId(newClientId);
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

  const handleAdd = async () => {
    if (!userData?.salonId || !userData.id) return;
    if (formServiceIds.length === 0) {
      error(ES.cola.selectServicesRequired);
      return;
    }
    if (!formClientId) {
      error(ES.cola.nameRequired);
      return;
    }
    setLoading(true);
    try {
      const serviceNames = formServiceIds
        .map((id) => services?.find((s) => s.id === id)?.name || '')
        .filter(Boolean);
      const client = clients?.find((c) => c.id === formClientId);
      const servicePreferences: ServicePreference[] = formServiceIds.map((serviceId) => {
        const staffId = formServicePrefs[serviceId] || '';
        const st = staff?.find((s) => s.id === staffId);
        return {
          serviceId,
          preferredStaffId: staffId,
          preferredStaffName: st ? `${st.firstName} ${st.lastName}` : '',
        };
      });

      await WaitingListRepository.createEntry({
        salonId: userData.salonId,
        clientId: formClientId,
        walkInName: client ? `${client.firstName} ${client.lastName}` : '',
        phone: client?.phone || '',
        serviceIds: formServiceIds,
        serviceNames,
        servicePreferences,
        preferredStaffId: '',
        preferredStaffName: '',
        date: today,
        notes: formNotes.trim(),
        createdBy: userData.id,
      });
      success(ES.cola.added);
      setIsAddOpen(false);
      resetForm();
    } catch (e) {
      console.error(e);
      error(ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  const openTake = (entryId: string) => {
    setActionEntryId(entryId);
    setTakeStaffId('');
    setIsTakeOpen(true);
  };

  const handleTake = async () => {
    if (!actionEntryId || !takeStaffId) {
      error(ES.cola.selectServicesRequired);
      return;
    }
    // Block take if client has an in_progress service elsewhere — paused is
    // fine (that's the whole point of pausing, to free the client for parallel
    // work), but an active service means two workers would fight over the same
    // person at the same time.
    const entry = sortedQueue.find((e) => e.id === actionEntryId);
    if (entry && entry.clientId) {
      const busy = getClientBusyState(entry.clientId, activeSessionsToday || [], resolveStaffName);
      if (!canTakeClient(busy)) {
        error(ES.cola.takeBlocked);
        return;
      }
    }
    setLoading(true);
    try {
      const sessionId = await WaitingListService.take({
        entryId: actionEntryId,
        takenByStaffId: takeStaffId,
      });
      success(ES.cola.taken);
      setIsTakeOpen(false);
      setActionEntryId('');
      router.push(`/sessions?openSession=${sessionId}`);
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

  const openCancel = (entryId: string) => {
    setActionEntryId(entryId);
    setCancelReason('');
    setIsCancelOpen(true);
  };

  const handleCancel = async () => {
    if (!actionEntryId) return;
    setLoading(true);
    try {
      await WaitingListRepository.cancelEntry(actionEntryId, cancelReason.trim());
      success(ES.cola.cancelled);
      setIsCancelOpen(false);
      setActionEntryId('');
    } catch (e) {
      console.error(e);
      error(ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  const waitingMinutes = (arrival: Date): number => {
    return Math.max(0, Math.floor((Date.now() - arrival.getTime()) / 60000));
  };

  // Called when the worker clicks "Llamar": record the call attempt and open
  // overlay. When they close the overlay we ask "¿Respondió?".
  const openCall = async (entry: WaitingListEntry) => {
    setCallEntry(entry);
    try {
      await WaitingListRepository.recordCallAttempt(entry.id, entry.callAttempts || 0);
    } catch (e) {
      console.error(e);
    }
  };
  const closeCallOverlay = () => {
    const entry = callEntry;
    setCallEntry(null);
    if (entry) setCallResponsePending(entry);
  };
  const handleDidRespond = () => {
    const entry = callResponsePending;
    setCallResponsePending(null);
    if (entry) openTake(entry.id);
  };
  const handleDidNotRespond = async () => {
    const entry = callResponsePending;
    setCallResponsePending(null);
    if (!entry) return;
    setLoading(true);
    try {
      // Second failed attempt → move to cancelled as no_show; otherwise → skipped.
      const attempts = (entry.callAttempts || 0) + 1;
      if (attempts >= 2) {
        await WaitingListRepository.cancelEntry(entry.id, 'no_show');
        success(ES.cola.noShowFinal);
      } else {
        await WaitingListRepository.markSkipped(entry.id);
        success(ES.cola.skippedEntry);
      }
    } catch (e) {
      console.error(e);
      error(ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };
  const handleRetry = async (entryId: string) => {
    setLoading(true);
    try {
      await WaitingListRepository.restoreToWaiting(entryId);
    } catch (e) {
      console.error(e);
      error(ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  // Clients already waiting today shouldn't appear in the add-to-cola picker
  // — adding them again would create a duplicate entry. Once their entry is
  // taken (session started) they're back in the picker — they might legitimately
  // want to queue for a later service.
  const inQueueClientIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of sortedQueue) {
      if (e.status === 'waiting' && e.clientId) ids.add(e.clientId);
    }
    return ids;
  }, [sortedQueue]);

  const clientOptions = (clients || [])
    .filter((c) => !inQueueClientIds.has(c.id))
    .map((c) => ({
      value: c.id,
      label: `${c.firstName} ${c.lastName}`,
      secondary: c.phone,
    }));

  const resolveStaffName = (id: string): string => {
    const s = (staff || []).find((x) => x.id === id);
    return s ? `${s.firstName} ${s.lastName}` : '';
  };

  const takeStaffOptions = (staff || []).map((s) => ({
    value: s.id,
    label: `${s.firstName} ${s.lastName}`,
    secondary: '',
  }));

  const serviceOptions = (services || []).map((s) => ({
    value: s.id,
    label: s.name,
    secondary: fmtBs(s.price),
  }));

  // Entry duration = sum of durations of its services
  const entryDuration = (entry: WaitingListEntry): number => {
    return (entry.serviceIds || []).reduce((sum, sid) => {
      const s = services?.find((x) => x.id === sid);
      return sum + (s?.duration || 0);
    }, 0);
  };

  // Smart estimate v3 — per-worker timeline with:
  //   (a) appointment blocks (unchanged)
  //   (b) current active-session load seeded into freeAt
  //   (c) skill-aware worker selection (round-robin only among skilled workers)
  //
  // For each cola entry (FIFO), assign to preferred worker if skilled, else the
  // skilled worker with earliest free slot. Push entry duration onto that
  // worker's timeline, skipping past appointment blocks. Estimate = minutes
  // from now until earliest valid start.
  const estimateMap = useMemo(() => {
    const map = new Map<string, number>();
    const workers = staff || [];
    if (workers.length === 0) return map;

    const now = new Date();
    const hhmmToDate = (hhmm: string): Date => {
      const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
      const d = new Date(now);
      d.setHours(h || 0, m || 0, 0, 0);
      return d;
    };

    // (a) Appointment blocks per worker
    const blocksByWorker = new Map<string, Array<{ start: Date; end: Date }>>();
    for (const w of workers) blocksByWorker.set(w.id, []);
    for (const apt of appointments || []) {
      if (apt.status === 'cancelled' || apt.status === 'completed' || apt.status === 'no_show') continue;
      const list = blocksByWorker.get(apt.staffId);
      if (!list) continue;
      list.push({ start: hhmmToDate(apt.startTime), end: hhmmToDate(apt.endTime) });
    }
    for (const list of blocksByWorker.values()) list.sort((a, b) => a.start.getTime() - b.start.getTime());

    // (b) Seed freeAt based on current active-session load. For each worker,
    // sum remaining duration of uncompleted services they're assigned to:
    //   in_progress → remaining = max(3, duration - elapsed)
    //   paused      → remaining = full duration (they still have to finish)
    //   pending     → remaining = full duration
    const freeAt = new Map<string, Date>();
    for (const w of workers) freeAt.set(w.id, new Date(now));

    const serviceDurationById = (id: string) => services?.find((s) => s.id === id)?.duration || 20;
    for (const session of activeSessionsToday || []) {
      if (session.status !== 'active') continue;
      for (const svc of session.services || []) {
        if (svc.status === 'completed') continue;
        for (const sid of svc.assignedStaff || []) {
          const current = freeAt.get(sid);
          if (!current) continue;
          const full = serviceDurationById(svc.serviceId);
          let remaining: number;
          if (svc.status === 'in_progress') {
            const elapsed = svc.startTime ? Math.max(0, (now.getTime() - toDate(svc.startTime).getTime()) / 60000) : 0;
            remaining = Math.max(3, full - elapsed);
          } else {
            remaining = full;
          }
          const next = new Date(current.getTime() + remaining * 60000);
          freeAt.set(sid, next);
        }
      }
    }

    // Helper: earliest non-colliding start for a worker given a duration
    const findSlot = (workerId: string, durationMin: number): Date => {
      let start = freeAt.get(workerId)!;
      const blocks = blocksByWorker.get(workerId) || [];
      for (const b of blocks) {
        const end = new Date(start.getTime() + durationMin * 60000);
        if (end <= b.start) break;
        if (start < b.end) start = new Date(b.end);
      }
      return start;
    };

    for (const entry of waiting) {
      const duration = entryDuration(entry) || 15;

      // (c) Skill-aware worker pick. Preferred first if they can actually do
      // the service. Else round-robin among workers capable of at least one
      // service in this entry.
      let workerId = '';
      const preferred = entry.preferredStaffId
        || (entry.servicePreferences || []).find((p) => p.preferredStaffId)?.preferredStaffId
        || '';
      if (preferred && freeAt.has(preferred)) {
        const w = workers.find((x) => x.id === preferred) as { serviceIds?: string[] } | undefined;
        if (canDoAny(w, entry.serviceIds || [])) workerId = preferred;
      }
      if (!workerId) {
        let earliest: { id: string; t: Date } | null = null;
        for (const [id, t] of freeAt.entries()) {
          const w = workers.find((x) => x.id === id) as { serviceIds?: string[] } | undefined;
          if (!canDoAny(w, entry.serviceIds || [])) continue;
          if (!earliest || t < earliest.t) earliest = { id, t };
        }
        // Fallback: if no skilled worker found (e.g. no one has matching
        // serviceIds configured), pick absolute earliest free worker so the
        // estimate is still produced instead of returning 0.
        if (!earliest) {
          for (const [id, t] of freeAt.entries()) {
            if (!earliest || t < earliest.t) earliest = { id, t };
          }
        }
        workerId = earliest!.id;
      }

      const start = findSlot(workerId, duration);
      const waitMin = Math.max(0, Math.round((start.getTime() - now.getTime()) / 60000));
      map.set(entry.id, waitMin);
      freeAt.set(workerId, new Date(start.getTime() + duration * 60000));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting, services, staff, appointments, activeSessionsToday, today]);

  // Format a point-estimate as a range ±~30% rounded to 5-min buckets.
  // Communicates uncertainty honestly: a 15-min wait shown as "15-20 min" is
  // harder to get wrong than "15 min" exactly.
  //
  // Zero-minute estimates (no prior load, worker is free) render as "≤ 5 min"
  // rather than collapsing to position text — the caller already shows a
  // "Siguiente en atención" subtitle via fmtBehindCount, so the time column
  // should stay a time.
  const fmtEstimateRange = (pointMin: number): string => {
    if (pointMin <= 0) return `≤ 5 ${ES.cola.estMinutes}`;
    const roundTo5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);
    const low = roundTo5(pointMin * 0.85);
    const high = roundTo5(Math.max(pointMin * 1.3, pointMin + 5));
    if (high <= low) return `~${low} ${ES.cola.estMinutes}`;
    return `${low}–${high} ${ES.cola.estMinutes}`;
  };

  const fmtBehindCount = (index: number): string => {
    if (index <= 0) return ES.cola.behindCountNone;
    if (index === 1) return ES.cola.behindCountOne;
    return ES.cola.behindCountMany.replace('{n}', String(index));
  };

  const renderEntry = (entry: WaitingListEntry & { arrivalTime: Date }, idx: number) => {
    const mins = waitingMinutes(entry.arrivalTime);
    const displayName = entry.walkInName || '—';
    const isWaiting = entry.status === 'waiting';
    const isExpanded = expandedEntryId === entry.id;
    // Only position #1 carries urgency styling. Everyone else is "just waiting".
    const isNext = isWaiting && idx === 0;
    const isOverdue = isNext && mins >= NEXT_OVERDUE_MIN;
    const busy = entry.clientId
      ? getClientBusyState(entry.clientId, activeSessionsToday || [], resolveStaffName)
      : ({ kind: 'free' } as const);
    const takeBlocked = busy.kind === 'in_progress';

    const cardClass = isOverdue
      ? 'border-2 border-red-500 bg-red-50 animate-pulse-slow'
      : isNext
      ? 'border-2 border-green-500 bg-green-50'
      : '';

    return (
      <Card key={entry.id} className={cardClass}>
        <CardBody>
          {/* Top row */}
          <div className="flex items-center gap-3">
            {isWaiting && (
              <span
                className={`inline-flex items-center justify-center rounded-full font-bold shrink-0 ${
                  isNext
                    ? `w-14 h-14 text-2xl ${isOverdue ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`
                    : 'w-9 h-9 text-sm bg-gray-100 text-gray-600'
                }`}
              >
                {idx + 1}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {isNext && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-bold uppercase tracking-wide ${
                    isOverdue ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
                  }`}>
                    {isOverdue && <Bell className="w-3 h-3" />}
                    {isOverdue ? ES.cola.attendNow : ES.cola.nextUp}
                  </span>
                )}
                <h3 className={`font-semibold text-gray-900 truncate ${isNext ? 'text-xl' : 'text-base'}`}>
                  {displayName}
                </h3>
                {entry.status === 'taken' && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                    {ES.cola.statusTaken}
                  </span>
                )}
                {entry.status === 'cancelled' && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                    {ES.cola.statusCancelled}
                  </span>
                )}
              </div>
              <p className={`text-gray-600 mt-0.5 truncate ${isNext ? 'text-sm' : 'text-xs'}`}>
                {(entry.serviceNames || []).join(' · ')}
              </p>
              {/* Wait time shown ONLY on the next-up card — not on positions 2+ to avoid alarming noise */}
              {isNext && (
                <p className="text-sm mt-1">
                  <span className={isOverdue ? 'text-red-700 font-bold' : 'text-green-700 font-semibold'}>
                    {ES.cola.waitingSince} {mins} min
                  </span>
                </p>
              )}
              {isWaiting && busy.kind === 'in_progress' && (
                <p className="text-xs mt-1 text-red-700 font-medium">
                  {ES.cola.clientBusyInProgress} {busy.staffName}
                </p>
              )}
              {isWaiting && busy.kind === 'paused' && (
                <p className="text-xs mt-1 text-amber-700">
                  {ES.cola.clientBusyPaused} {busy.staffName} · {ES.cola.clientBusyHintPaused}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setExpandedEntryId(isExpanded ? '' : entry.id)}
              className="text-gray-400 hover:text-gray-700 p-1 min-w-[32px] min-h-[32px] flex items-center justify-center"
              title={isExpanded ? ES.cola.showLess : ES.cola.showMore}
            >
              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>

          {/* Expanded details */}
          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
              {entry.phone && (
                <p className="text-xs text-gray-500">{entry.phone}</p>
              )}
              <div className="space-y-1">
                {(entry.serviceIds || []).map((sid, i) => {
                  const name = entry.serviceNames?.[i] || '';
                  const pref = (entry.servicePreferences || []).find(
                    (p) => p.serviceId === sid,
                  );
                  const prefName = pref?.preferredStaffName || entry.preferredStaffName;
                  const prefId = pref?.preferredStaffId || entry.preferredStaffId;
                  return (
                    <div
                      key={sid || i}
                      className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-purple-50 border border-purple-100"
                    >
                      <span className="text-xs text-purple-800 font-medium truncate">
                        {name}
                      </span>
                      <span className="text-[11px] text-gray-600 shrink-0">
                        {prefId ? prefName : ES.cola.anyWorker}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {entry.arrivalTime.toLocaleTimeString('es-BO', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              {entry.notes && (
                <p className="text-xs text-gray-600 italic">{entry.notes}</p>
              )}
            </div>
          )}

          {/* Actions */}
          {isWaiting && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => openTake(entry.id)}
                className="flex-1 min-h-[44px]"
                disabled={takeBlocked}
                title={takeBlocked ? ES.cola.takeBlocked : undefined}
              >
                <Check className="w-4 h-4 mr-1" />
                {ES.cola.take}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openCall(entry)}
                className="flex-1 min-h-[44px]"
              >
                <Megaphone className="w-4 h-4 mr-1" />
                {ES.cola.callClient}
                {(entry.callAttempts || 0) > 0 && (
                  <span className="ml-1 text-[10px] font-bold bg-amber-200 text-amber-900 rounded-full px-1.5 py-0.5">
                    {entry.callAttempts}
                  </span>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openCancel(entry.id)}
                className="min-h-[44px] text-red-600"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    );
  };

  return (
    <RoleGuard route="/cola">
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
        <Toast notifications={notifications} onDismiss={removeNotification} />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{ES.cola.title}</h1>
            <p className="text-sm text-gray-500">{ES.cola.subtitle}</p>
          </div>
          <Button
            variant="primary"
            onClick={() => {
              resetForm();
              setIsAddOpen(true);
            }}
            className="min-h-[44px]"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            {ES.cola.add}
          </Button>
        </div>

        {/* Upcoming appointments banner — appointments due within ~30 min.
            Appointments are a promise to a client at a specific time, so they
            take priority over walk-in queue. Worker should honor ≤10min grace. */}
        {(() => {
          const now = new Date();
          const toMin = (hhmm: string) => {
            const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
            const d = new Date(now);
            d.setHours(h || 0, m || 0, 0, 0);
            return Math.round((d.getTime() - now.getTime()) / 60000);
          };
          const relevant = (appointments || [])
            .filter((a) => a.status !== 'cancelled' && a.status !== 'completed' && a.status !== 'no_show')
            .map((a) => ({ apt: a, minsToStart: toMin(a.startTime) }))
            .filter((x) => x.minsToStart <= 30) // show upcoming within 30 min, plus any overdue
            .sort((a, b) => a.minsToStart - b.minsToStart);
          if (relevant.length === 0) return null;
          return (
            <Card className="border-2 border-indigo-200">
              <CardBody>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <p className="text-sm font-semibold text-indigo-900">
                    {ES.cola.upcomingAppointments}
                  </p>
                </div>
                <div className="space-y-1">
                  {relevant.map(({ apt, minsToStart }) => {
                    const staffMember = (staff || []).find((s) => s.id === apt.staffId);
                    const staffName = staffMember
                      ? `${staffMember.firstName} ${staffMember.lastName}`
                      : '—';
                    const client = (clients || []).find((c) => c.id === apt.clientId);
                    const clientName = client
                      ? `${client.firstName} ${client.lastName}`
                      : '—';
                    // State decision: overdue > 0 min past start → red; within 10 min → amber;
                    // further out → neutral
                    const isOverdue = minsToStart < 0;
                    const isImminent = minsToStart >= 0 && minsToStart <= 10;
                    const rowClass = isOverdue
                      ? 'bg-red-50 border-red-300'
                      : isImminent
                      ? 'bg-amber-50 border-amber-300'
                      : 'bg-white border-gray-200';
                    return (
                      <div
                        key={apt.id}
                        className={`flex items-center gap-3 p-2 rounded border ${rowClass}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {clientName}
                            <span className="text-gray-400 mx-2">·</span>
                            <span className="text-gray-600">{staffName}</span>
                          </p>
                          <p className="text-xs text-gray-600">
                            {ES.cola.appointmentAt} {apt.startTime}
                            <span className="text-gray-400 mx-2">·</span>
                            {isOverdue ? (
                              <span className="font-semibold text-red-700">
                                {ES.cola.appointmentOverdue} ({Math.abs(minsToStart)} min)
                              </span>
                            ) : isImminent ? (
                              <span className="font-semibold text-amber-700">
                                {ES.cola.appointmentDue} ({minsToStart} min)
                              </span>
                            ) : (
                              <span className="text-gray-500">{minsToStart} min</span>
                            )}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="shrink-0 min-h-[36px]"
                          onClick={() => router.push('/appointments')}
                        >
                          {ES.cola.startAppointment}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          );
        })()}

        {/* Summary — counts + next-wait ticker (for telling walk-ins how long) */}
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  {ES.cola.waitingCount}
                </p>
                <p className="text-3xl font-bold text-blue-700">{waiting.length}</p>
              </div>
              {waiting.length > 0 && (
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    {ES.cola.avgWaitLabel}
                  </p>
                  <p className="text-2xl font-bold text-amber-700">
                    {fmtEstimateRange(estimateMap.get(waiting[waiting.length - 1]?.id) ?? 0)}
                  </p>
                </div>
              )}
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  {ES.cola.statusTaken}
                </p>
                <p className="text-3xl font-bold text-green-700">{taken.length}</p>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Admin/gerente estimated-times panel — for the front desk to answer
            "how long will it take?" per client. Collapsible so the main queue
            stays the focus. */}
        {waiting.length > 0 && (
          <Card>
            <CardBody>
              <button
                type="button"
                onClick={() => setShowEstimates((v) => !v)}
                className="w-full flex items-center justify-between text-left min-h-[44px]"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {ES.cola.estimatedTimes}
                  </p>
                  <p className="text-xs text-gray-500">{ES.cola.estimatedTimesHint}</p>
                </div>
                {showEstimates ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>
              {showEstimates && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                  {waiting.map((entry, i) => {
                    const est = estimateMap.get(entry.id) ?? 0;
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0"
                      >
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-700 text-xs font-bold shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 font-medium truncate">
                            {entry.walkInName || '—'}
                          </p>
                          <p className="text-[11px] text-gray-500 truncate">{fmtBehindCount(i)}</p>
                        </div>
                        <span className="text-sm font-semibold text-amber-700 shrink-0 tabular-nums">
                          {fmtEstimateRange(est)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {/* Waiting list */}
        {waiting.length === 0 ? (
          <Card>
            <CardBody>
              <div className="text-center py-8">
                <p className="text-gray-700 font-medium">{ES.cola.empty}</p>
                <p className="text-sm text-gray-500 mt-1">{ES.cola.emptySubtitle}</p>
              </div>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-2">
            {waiting.map((entry, idx) => renderEntry(entry, idx))}
          </div>
        )}

        {/* Skipped (no-response) section — clients who didn't answer the call.
            Expanded by default so staff remembers to retry; each has "Volver a
            Intentar" to push them back to waiting. */}
        {skipped.length > 0 && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowSkipped((v) => !v)}
              className="flex items-center gap-2 text-sm font-semibold text-amber-800 uppercase tracking-wide pt-4"
            >
              {showSkipped ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              {ES.cola.skippedSection} ({skipped.length})
            </button>
            {showSkipped &&
              skipped.map((entry) => (
                <Card key={entry.id} className="border-l-4 border-amber-400 bg-amber-50">
                  <CardBody>
                    <div className="flex items-center gap-3">
                      <PhoneOff className="w-5 h-5 text-amber-700 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-gray-900 truncate">
                          {entry.walkInName || '—'}
                        </p>
                        <p className="text-xs text-gray-600">
                          {ES.cola.callAttempt} {entry.callAttempts || 0}
                          <span className="text-gray-400 mx-1">·</span>
                          {(entry.serviceNames || []).join(' · ')}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="primary"
                        className="shrink-0 min-h-[40px]"
                        onClick={() => handleRetry(entry.id)}
                        loading={loading}
                      >
                        <RotateCw className="w-4 h-4 mr-1" />
                        {ES.cola.retryCall}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 min-h-[40px] text-red-600"
                        onClick={() => openCancel(entry.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              ))}
          </div>
        )}

        {/* Taken */}
        {taken.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide pt-4">
              {ES.cola.statusTaken}
            </h2>
            {taken.map((entry, idx) => renderEntry(entry, idx))}
          </div>
        )}

        {/* Cancelled toggle */}
        {cancelled.length > 0 && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowCancelled((v) => !v)}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              {showCancelled ? ES.cola.hideCancelled : ES.cola.showCancelled} ({cancelled.length})
            </button>
            {showCancelled && cancelled.map((entry, idx) => renderEntry(entry, idx))}
          </div>
        )}
      </div>

      {/* Add modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title={ES.cola.newEntry}
        size="lg"
        footer={
          <div className="space-y-2">
            {canSubmit && (
              <p className="text-xs text-gray-600 truncate">
                {ES.cola.summary}:{' '}
                <span className="font-medium text-gray-900">
                  {(() => {
                    const c = clients?.find((cl) => cl.id === formClientId);
                    return c ? `${c.firstName} ${c.lastName}` : '';
                  })()}
                </span>
                {' · '}
                {formServiceIds
                  .map((id) => services?.find((s) => s.id === id)?.name)
                  .filter(Boolean)
                  .join(', ')}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setIsAddOpen(false)}
                className="flex-1 min-h-[44px]"
                disabled={loading}
              >
                {ES.actions.cancel}
              </Button>
              <Button
                variant="primary"
                onClick={handleAdd}
                className="flex-1 min-h-[44px]"
                disabled={loading || !canSubmit}
              >
                {ES.actions.add}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          {/* Client selector — same pattern as appointments page:
              SearchableSelect + quick-create button. Every client gets saved. */}
          <SearchableSelect
            label={ES.appointments.selectClient}
            value={formClientId}
            onChange={setFormClientId}
            options={clientOptions}
            placeholder={ES.actions.search}
          />
          <button
            type="button"
            onClick={() => setIsQuickClientOpen(true)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium -mt-1"
          >
            {ES.clients.addQuick}
          </button>

          {/* Service multi-select — pills instead of dropdown: older staff can see all options, no tap-to-reveal */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                {ES.cola.services}
              </label>
              {formServiceIds.length > 0 && (
                <span className="text-xs text-purple-700 font-medium">
                  {formServiceIds.length} {ES.cola.selectedCount}
                </span>
              )}
            </div>
            <input
              type="text"
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
              placeholder={ES.cola.searchServices}
              className="w-full mb-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-2 bg-gray-50">
              {(() => {
                const q = serviceSearch.trim().toLowerCase();
                const filtered = q
                  ? serviceOptions.filter((o) => o.label.toLowerCase().includes(q))
                  : serviceOptions;
                if (filtered.length === 0) {
                  return (
                    <p className="text-xs text-gray-500 italic p-2">
                      {ES.cola.noServicesMatch}
                    </p>
                  );
                }
                return filtered.map((opt) => {
                  const selected = formServiceIds.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setFormServiceIds((prev) => {
                          if (selected) {
                            setFormServicePrefs((p) => {
                              const next = { ...p };
                              delete next[opt.value];
                              return next;
                            });
                            return prev.filter((x) => x !== opt.value);
                          }
                          return [...prev, opt.value];
                        })
                      }
                      className={`min-h-[44px] px-3 py-2 rounded-lg border text-xs font-medium ${
                        selected
                          ? 'bg-purple-100 border-purple-500 text-purple-800'
                          : 'bg-white border-gray-300 text-gray-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                });
              })()}
            </div>
          </div>

          {/* Per-service worker preference — one picker per selected service */}
          {formServiceIds.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {ES.cola.preferredStaff}
              </label>
              <div className="space-y-2">
                {formServiceIds.map((sid) => {
                  const svc = services?.find((s) => s.id === sid);
                  return (
                    <div
                      key={sid}
                      className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 border border-gray-200"
                    >
                      <span className="text-xs font-medium text-gray-700 flex-1 truncate">
                        {svc?.name || sid}
                      </span>
                      <select
                        value={formServicePrefs[sid] || ''}
                        onChange={(e) =>
                          setFormServicePrefs((p) => ({ ...p, [sid]: e.target.value }))
                        }
                        className="min-h-[40px] px-2 py-1 border border-gray-300 rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">{ES.cola.anyWorker}</option>
                        {(staff || []).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.firstName} {s.lastName}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ES.cola.notes}
            </label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder={ES.cola.notesPlaceholder}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </Modal>

      {/* Take modal */}
      <Modal
        isOpen={isTakeOpen}
        onClose={() => setIsTakeOpen(false)}
        title={ES.cola.take}
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setIsTakeOpen(false)}
              className="flex-1 min-h-[44px]"
              disabled={loading}
            >
              {ES.actions.cancel}
            </Button>
            <Button
              variant="primary"
              onClick={handleTake}
              className="flex-1 min-h-[44px]"
              disabled={loading || !takeStaffId}
            >
              {ES.cola.take}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">{ES.cola.takeConfirm}</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ES.staff.assignedToMe}
            </label>
            <SearchableSelect
              value={takeStaffId}
              onChange={setTakeStaffId}
              options={takeStaffOptions}
              placeholder={ES.sessions.selectStaff}
            />
          </div>
        </div>
      </Modal>

      {/* Call client overlay */}
      {callEntry && (
        <div
          className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4"
          onClick={closeCallOverlay}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full p-8 sm:p-12 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm uppercase tracking-wide text-gray-500 mb-3">
              {ES.cola.callClientTitle}
            </p>
            <h2 className="text-5xl sm:text-7xl font-bold text-gray-900 mb-6 break-words">
              {callEntry.walkInName || '—'}
            </h2>
            <p className="text-xl sm:text-2xl text-purple-700 font-medium mb-2">
              {(callEntry.serviceNames || []).join(' · ')}
            </p>
            {(callEntry.servicePreferences || []).some((p) => p.preferredStaffId) && (
              <div className="text-base text-gray-600 mb-4 space-y-1">
                {(callEntry.servicePreferences || [])
                  .filter((p) => p.preferredStaffId)
                  .map((p, i) => {
                    const idx = (callEntry.serviceIds || []).indexOf(p.serviceId);
                    const name = idx >= 0 ? callEntry.serviceNames?.[idx] : '';
                    return (
                      <p key={i}>
                        <span>{name}</span>
                        <span className="text-gray-400 mx-2">→</span>
                        <span className="font-semibold">{p.preferredStaffName}</span>
                      </p>
                    );
                  })}
              </div>
            )}
            <p className="text-sm text-gray-500 mb-6">{ES.cola.callClientHint}</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button
                variant="secondary"
                onClick={() => {
                  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                    const text = `${callEntry.walkInName || ''}, ${(callEntry.serviceNames || []).join(', ')}`;
                    const u = new SpeechSynthesisUtterance(text);
                    u.lang = 'es-ES';
                    u.rate = 0.9;
                    window.speechSynthesis.speak(u);
                  }
                }}
                className="min-h-[56px] text-base"
              >
                <Megaphone className="w-5 h-5 mr-2" />
                {ES.cola.speakAloud}
              </Button>
              <Button
                variant="primary"
                onClick={closeCallOverlay}
                className="min-h-[56px] text-base"
              >
                {ES.actions.close}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ¿Respondió? — follow-up after the call overlay. Drives the no-show
          flow: "Sí" → opens Take; "No responde" → skipped / auto no_show. */}
      <Modal
        isOpen={!!callResponsePending}
        onClose={() => setCallResponsePending(null)}
        title={ES.cola.didRespond}
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={handleDidNotRespond}
              className="flex-1 min-h-[48px] text-red-600"
              disabled={loading}
            >
              <PhoneOff className="w-4 h-4 mr-1" />
              {ES.cola.noRespond}
            </Button>
            <Button
              variant="primary"
              onClick={handleDidRespond}
              className="flex-1 min-h-[48px]"
              disabled={loading}
            >
              <Check className="w-4 h-4 mr-1" />
              {ES.cola.yesRespond}
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          <p className="text-base text-gray-800 font-medium">
            {callResponsePending?.walkInName || '—'}
          </p>
          {callResponsePending && (callResponsePending.callAttempts || 0) >= 2 && (
            <p className="text-xs text-red-700">
              {ES.cola.callAttempt} {callResponsePending.callAttempts || 0}
            </p>
          )}
        </div>
      </Modal>

      {/* Cancel modal */}
      <Modal
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        title={ES.cola.cancel}
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setIsCancelOpen(false)}
              className="flex-1 min-h-[44px]"
              disabled={loading}
            >
              {ES.actions.close}
            </Button>
            <Button
              variant="danger"
              onClick={handleCancel}
              className="flex-1 min-h-[44px]"
              disabled={loading}
            >
              {ES.actions.confirm}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">{ES.cola.cancelConfirm}</p>
          <Input
            label={ES.cola.cancelReason}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </div>
      </Modal>
      {/* Quick Client Creation Modal — same as appointments page */}
      <Modal
        isOpen={isQuickClientOpen}
        onClose={() => setIsQuickClientOpen(false)}
        title={ES.clients.quickAddTitle}
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setIsQuickClientOpen(false)}
              className="flex-1 min-h-[44px]"
              disabled={loading}
            >
              {ES.actions.cancel}
            </Button>
            <Button
              variant="primary"
              onClick={handleQuickCreateClient}
              className="flex-1 min-h-[44px]"
              loading={loading}
            >
              {ES.actions.save}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input
            label={ES.clients.name}
            value={quickClient.firstName}
            onChange={(e) => setQuickClient({ ...quickClient, firstName: e.target.value })}
            maxLength={30}
          />
          <Input
            label={ES.clients.lastName}
            value={quickClient.lastName}
            onChange={(e) => setQuickClient({ ...quickClient, lastName: e.target.value })}
            maxLength={30}
          />
          <Input
            label={ES.clients.phone}
            type="tel"
            value={quickClient.phone}
            onChange={(e) => setQuickClient({ ...quickClient, phone: e.target.value })}
            maxLength={10}
          />
        </div>
      </Modal>
    </RoleGuard>
  );
}
