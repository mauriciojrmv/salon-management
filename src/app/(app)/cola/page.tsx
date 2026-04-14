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
import { firebaseConstraints } from '@/lib/firebase/db';
import { toDate, fmtBs, getBoliviaDate } from '@/lib/utils/helpers';
import type { WaitingListEntry } from '@/types/models';
import ES from '@/config/text.es';
import { Clock, UserPlus, Check, X } from 'lucide-react';

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

  // Form state
  const [clientType, setClientType] = useState<'registered' | 'walkin'>('walkin');
  const [formClientId, setFormClientId] = useState('');
  const [formWalkInName, setFormWalkInName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formServiceIds, setFormServiceIds] = useState<string[]>([]);
  const [formPreferredStaffId, setFormPreferredStaffId] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const { data: clients } = useAsync(async () => {
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

  const sortedQueue = useMemo(() => {
    const list = [...(queue || [])].map((e) => ({ ...e, arrivalTime: toDate(e.arrivalTime) }));
    return list.sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [queue]);

  const waiting = sortedQueue.filter((e) => e.status === 'waiting');
  const taken = sortedQueue.filter((e) => e.status === 'taken');
  const cancelled = sortedQueue.filter((e) => e.status === 'cancelled');

  const resetForm = () => {
    setClientType('walkin');
    setFormClientId('');
    setFormWalkInName('');
    setFormPhone('');
    setFormServiceIds([]);
    setFormPreferredStaffId('');
    setFormNotes('');
  };

  const handleAdd = async () => {
    if (!userData?.salonId || !userData.id) return;
    if (formServiceIds.length === 0) {
      error(ES.cola.selectServicesRequired);
      return;
    }
    if (clientType === 'walkin' && !formWalkInName.trim()) {
      error(ES.cola.nameRequired);
      return;
    }
    if (clientType === 'registered' && !formClientId) {
      error(ES.cola.nameRequired);
      return;
    }
    setLoading(true);
    try {
      const serviceNames = formServiceIds
        .map((id) => services?.find((s) => s.id === id)?.name || '')
        .filter(Boolean);
      const preferredStaff = staff?.find((s) => s.id === formPreferredStaffId);
      const client = clients?.find((c) => c.id === formClientId);

      await WaitingListRepository.createEntry({
        salonId: userData.salonId,
        clientId: clientType === 'registered' ? formClientId : '',
        walkInName:
          clientType === 'walkin'
            ? formWalkInName.trim()
            : client
            ? `${client.firstName} ${client.lastName}`
            : '',
        phone: clientType === 'walkin' ? formPhone.trim() : client?.phone || '',
        serviceIds: formServiceIds,
        serviceNames,
        preferredStaffId: formPreferredStaffId,
        preferredStaffName: preferredStaff
          ? `${preferredStaff.firstName} ${preferredStaff.lastName}`
          : '',
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
      error(ES.messages.operationFailed);
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

  const clientOptions = (clients || []).map((c) => ({
    value: c.id,
    label: `${c.firstName} ${c.lastName}`,
    secondary: c.phone,
  }));

  const staffOptions = [
    { value: '', label: ES.cola.anyWorker, secondary: '' },
    ...(staff || []).map((s) => ({
      value: s.id,
      label: `${s.firstName} ${s.lastName}`,
      secondary: '',
    })),
  ];

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

  const renderEntry = (entry: WaitingListEntry & { arrivalTime: Date }, idx: number) => {
    const mins = waitingMinutes(entry.arrivalTime);
    const displayName = entry.walkInName || '—';
    const isWaiting = entry.status === 'waiting';
    return (
      <Card key={entry.id}>
        <CardBody>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {isWaiting && (
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">
                    {idx + 1}
                  </span>
                )}
                <h3 className="text-base font-semibold text-gray-900 truncate">{displayName}</h3>
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
              {entry.phone && (
                <p className="text-xs text-gray-500 mb-1">{entry.phone}</p>
              )}
              <div className="flex flex-wrap gap-1 mb-2">
                {(entry.serviceNames || []).map((n, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 text-xs rounded bg-purple-50 text-purple-700 border border-purple-100"
                  >
                    {n}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {entry.arrivalTime.toLocaleTimeString('es-BO', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {isWaiting && (
                  <span className="font-medium text-amber-700">
                    {ES.cola.waitingTime}: {mins} min
                  </span>
                )}
                <span>
                  {entry.preferredStaffId
                    ? `${ES.cola.preferredStaff}: ${entry.preferredStaffName}`
                    : ES.cola.anyWorker}
                </span>
              </div>
              {entry.notes && (
                <p className="text-xs text-gray-600 mt-2 italic">{entry.notes}</p>
              )}
            </div>
            {isWaiting && (
              <div className="flex flex-row sm:flex-col gap-2 sm:w-32">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => openTake(entry.id)}
                  className="flex-1 min-h-[44px]"
                >
                  <Check className="w-4 h-4 mr-1" />
                  {ES.cola.take}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openCancel(entry.id)}
                  className="flex-1 min-h-[44px] text-red-600"
                >
                  <X className="w-4 h-4 mr-1" />
                  {ES.cola.cancel}
                </Button>
              </div>
            )}
          </div>
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

        {/* Summary */}
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  {ES.cola.waitingCount}
                </p>
                <p className="text-3xl font-bold text-blue-700">{waiting.length}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  {ES.cola.statusTaken}
                </p>
                <p className="text-3xl font-bold text-green-700">{taken.length}</p>
              </div>
            </div>
          </CardBody>
        </Card>

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
        size="md"
        footer={
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
              disabled={loading}
            >
              {ES.actions.add}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Client type toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ES.cola.clientType}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setClientType('walkin')}
                className={`flex-1 min-h-[44px] px-3 py-2 rounded-lg border text-sm font-medium ${
                  clientType === 'walkin'
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-700'
                }`}
              >
                {ES.cola.walkIn}
              </button>
              <button
                type="button"
                onClick={() => setClientType('registered')}
                className={`flex-1 min-h-[44px] px-3 py-2 rounded-lg border text-sm font-medium ${
                  clientType === 'registered'
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-700'
                }`}
              >
                {ES.cola.registeredClient}
              </button>
            </div>
          </div>

          {clientType === 'walkin' ? (
            <>
              <Input
                label={ES.cola.walkInName}
                value={formWalkInName}
                onChange={(e) => setFormWalkInName(e.target.value)}
                placeholder={ES.cola.walkInNamePlaceholder}
              />
              <Input
                label={ES.cola.phoneOptional}
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="70012345"
              />
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {ES.clients.title}
              </label>
              <SearchableSelect
                value={formClientId}
                onChange={setFormClientId}
                options={clientOptions}
                placeholder={ES.clients.search}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ES.cola.services}
            </label>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
              {serviceOptions.map((opt) => {
                const selected = formServiceIds.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setFormServiceIds((prev) =>
                        selected
                          ? prev.filter((x) => x !== opt.value)
                          : [...prev, opt.value],
                      )
                    }
                    className={`min-h-[44px] px-3 py-2 rounded-lg border text-xs ${
                      selected
                        ? 'bg-purple-100 border-purple-500 text-purple-800'
                        : 'bg-white border-gray-300 text-gray-700'
                    }`}
                  >
                    {opt.label} · {opt.secondary}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ES.cola.preferredStaff}
            </label>
            <SearchableSelect
              value={formPreferredStaffId}
              onChange={setFormPreferredStaffId}
              options={staffOptions}
              placeholder={ES.cola.anyWorker}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ES.cola.notes}
            </label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder={ES.cola.notesPlaceholder}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[60px]"
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
    </RoleGuard>
  );
}
