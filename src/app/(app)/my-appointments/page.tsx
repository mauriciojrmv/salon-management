'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardBody } from '@/components/Card';
import { Modal } from '@/components/Modal';
import { Toast } from '@/components/Toast';
import { Button } from '@/components/Button';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useRealtime } from '@/hooks/useRealtime';
import { useNotification } from '@/hooks/useNotification';
import { AppointmentService } from '@/lib/services/appointmentService';
import { SessionService } from '@/lib/services/sessionService';
import { ClientRepository } from '@/lib/repositories/clientRepository';
import { ServiceRepository } from '@/lib/repositories/serviceRepository';
import { SalonRepository } from '@/lib/repositories/salonRepository';
import { firebaseConstraints } from '@/lib/firebase/db';
import type { Appointment } from '@/types/models';
import { getBoliviaDate, fmtDate, whatsappUrl } from '@/lib/utils/helpers';
import { useRouter } from 'next/navigation';
import ES from '@/config/text.es';

const DECLINE_REASONS = [
  { key: 'cant_at_time', label: ES.appointments.reasonCantAtTime, hint: ES.appointments.reasonCantAtTimeHint, waTag: '🔄 Reagendar' },
  { key: 'already_booked', label: ES.appointments.reasonAlreadyBooked, hint: ES.appointments.reasonAlreadyBookedHint, waTag: '⚠️ Conflicto horario' },
  { key: 'not_available_day', label: ES.appointments.reasonNotAvailableDay, hint: ES.appointments.reasonNotAvailableDayHint, waTag: '📅 No estará ese día' },
  { key: 'personal', label: ES.appointments.reasonPersonal, hint: ES.appointments.reasonPersonalHint, waTag: '🚫 Motivo personal' },
  { key: 'other', label: ES.appointments.reasonOther, hint: ES.appointments.reasonOtherHint, waTag: '📝 Otro' },
] as const;

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  no_show: 'No asistió',
  cancelled: 'Cancelada',
  completed: 'Completada',
};

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  no_show: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-blue-100 text-blue-700',
};

export default function MyAppointmentsPage() {
  const { user, userData } = useAuth();
  const { notifications, removeNotification, success, error: showError } = useNotification();
  const [startingId, setStartingId] = useState<string | null>(null);
  const [declineAppt, setDeclineAppt] = useState<Appointment | null>(null);
  const [declineReason, setDeclineReason] = useState<string>('');
  const [declineOtherText, setDeclineOtherText] = useState('');
  const router = useRouter();

  const staffId = user?.uid || '';
  const today = useMemo(() => getBoliviaDate(), []);
  const [selectedDate, setSelectedDate] = useState<string>(today);

  // Real-time appointments — syncs across admin/gerente/worker instantly
  const appointmentConstraints = useMemo(() => [
    firebaseConstraints.where('salonId', '==', userData?.salonId || ''),
    firebaseConstraints.where('staffId', '==', staffId),
    firebaseConstraints.where('appointmentDate', '==', selectedDate),
  ], [userData?.salonId, staffId, selectedDate]);
  const { data: allAppointments, loading } = useRealtime<Appointment>('appointments', appointmentConstraints, !!(userData?.salonId && staffId), [userData?.salonId, staffId, selectedDate]);
  const appointments = allAppointments;

  const { data: salon } = useAsync(async () => {
    if (!userData?.salonId) return null;
    return SalonRepository.getSalon(userData.salonId);
  }, [userData?.salonId]);

  // Upcoming appointments for 7-day strip indicators
  const { data: upcomingAppointments } = useAsync(async () => {
    if (!userData?.salonId || !staffId) return [];
    return AppointmentService.getUpcomingStaffAppointments(userData.salonId, staffId);
  }, [userData?.salonId, staffId, selectedDate]);

  const dateStrip = useMemo(() => {
    const days: { iso: string; label: string; weekday: string; count: number }[] = [];
    const counts = new Map<string, number>();
    (upcomingAppointments || []).forEach((a) => {
      counts.set(a.appointmentDate, (counts.get(a.appointmentDate) || 0) + 1);
    });
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const iso = d.toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
      days.push({
        iso,
        label: String(d.getDate()),
        weekday: d.toLocaleDateString('es-ES', { weekday: 'short', timeZone: 'America/La_Paz' }),
        count: counts.get(iso) || 0,
      });
    }
    return days;
  }, [upcomingAppointments]);

  const { data: clients } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ClientRepository.getSalonClients(userData.salonId);
  }, [userData?.salonId]);

  const { data: salonServices } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ServiceRepository.getSalonServices(userData.salonId);
  }, [userData?.salonId]);

  const getClientName = (id: string) => {
    const c = clients?.find((x) => x.id === id);
    return c ? `${c.firstName} ${c.lastName}` : '-';
  };

  const getServiceNames = (ids: string[]) => {
    if (!ids?.length) return '';
    return ids
      .map((id) => salonServices?.find((s) => s.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  const handleConfirm = async (apt: Appointment) => {
    try {
      await AppointmentService.updateAppointmentStatus(apt.id, 'confirmed');
      success(ES.appointments.confirmed);
      // Worker notifies SALON (not client) via WhatsApp
      const clientName = getClientName(apt.clientId);
      const svcNames = getServiceNames(apt.serviceIds || []);
      const waNumber = salon?.whatsappNumber || salon?.phone;
      if (waNumber) {
        const msg = `✅ Confirmo asistencia para ${clientName} el ${fmtDate(apt.appointmentDate)} a las ${apt.startTime} (${svcNames || 'atención'})`;
        window.open(whatsappUrl(waNumber, msg), '_blank');
      }
    } catch {
      showError(ES.messages.operationFailed);
    }
  };

  const openDeclineModal = (apt: Appointment) => {
    setDeclineAppt(apt);
    setDeclineReason('');
    setDeclineOtherText('');
  };

  const handleDeclineConfirm = async () => {
    if (!declineAppt || !declineReason) return;
    const apt = declineAppt;
    const reasonDef = DECLINE_REASONS.find((r) => r.key === declineReason);
    const reasonLabel = declineReason === 'other' && declineOtherText.trim()
      ? `${reasonDef?.label}: ${declineOtherText.trim()}`
      : reasonDef?.label || declineReason;

    try {
      await AppointmentService.updateAppointment(apt.id, {
        status: 'cancelled',
        cancellationReason: `Rechazado por personal: ${reasonLabel}`,
      });
      success(ES.appointments.declined);
      setDeclineAppt(null);

      // Worker notifies SALON (not client) via WhatsApp — admin will handle client communication
      const clientName = getClientName(apt.clientId);
      const svcNames = getServiceNames(apt.serviceIds || []);
      const waNumber = salon?.whatsappNumber || salon?.phone;
      if (waNumber) {
        const tag = reasonDef?.waTag || '';
        const msg = `❌ No puedo atender la cita de ${clientName} el ${fmtDate(apt.appointmentDate)} a las ${apt.startTime}${svcNames ? ` (${svcNames})` : ''}\n\n${tag} Motivo: ${reasonLabel}`;
        window.open(whatsappUrl(waNumber, msg), '_blank');
      }
    } catch {
      showError(ES.messages.operationFailed);
    }
  };

  const handleStartSession = async (apt: Appointment) => {
    if (!userData?.salonId) return;
    setStartingId(apt.id);
    try {
      const sessionId = await SessionService.createSession({
        clientId: apt.clientId,
        date: getBoliviaDate(),
        startTime: new Date(),
        salonId: userData.salonId,
      });
      for (const serviceId of (apt.serviceIds || [])) {
        const svc = salonServices?.find((s) => s.id === serviceId);
        if (svc) {
          await SessionService.addServiceToSession({
            sessionId,
            serviceId: svc.id,
            serviceName: svc.name,
            price: svc.price,
            staffIds: apt.staffId ? [apt.staffId] : [],
            materials: [],
          });
        }
      }
      await AppointmentService.updateAppointmentStatus(apt.id, 'completed');
      success(ES.sessions.sessionCreated);
      router.push('/my-work');
    } catch {
      showError(ES.messages.operationFailed);
    } finally {
      setStartingId(null);
    }
  };

  const sorted = (appointments as Appointment[] || [])
    .filter((a) => a.status !== 'cancelled')
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="space-y-6 p-4 max-w-lg mx-auto">
      <Toast notifications={notifications} onDismiss={removeNotification} />
      <div className="pt-2">
        <h1 className="text-2xl font-bold text-gray-900">{ES.nav.myAppointments}</h1>
        <p className="text-sm text-gray-500 mt-1">{userData?.firstName}</p>
      </div>

      {/* 7-day strip with appointment count badges */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {dateStrip.map((d) => {
          const isSelected = d.iso === selectedDate;
          return (
            <button
              key={d.iso}
              type="button"
              onClick={() => setSelectedDate(d.iso)}
              className={`flex flex-col items-center justify-center min-w-[52px] min-h-[56px] py-3 px-2 rounded-lg border text-xs font-medium relative ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span className="capitalize">{d.weekday.replace('.', '')}</span>
              <span className="text-base font-bold">{d.label}</span>
              {d.count > 0 && (
                <span
                  className={`absolute top-1 right-1 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-bold ${
                    isSelected ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'
                  }`}
                >
                  {d.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardBody>
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-center text-gray-500 py-6 text-sm">{ES.staff.noAppointmentsToday}</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((apt) => (
            <Card key={apt.id}>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{getClientName(apt.clientId)}</p>
                    <p className="text-sm text-gray-500">{apt.startTime} – {apt.endTime}</p>
                    {apt.serviceIds?.length > 0 && (
                      <p className="text-sm text-blue-600 mt-0.5">{getServiceNames(apt.serviceIds)}</p>
                    )}
                    {apt.notes && <p className="text-xs text-gray-500 mt-1 italic">{apt.notes}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2 ml-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLS[apt.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[apt.status] || apt.status}
                    </span>
                    {apt.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleConfirm(apt)}
                          className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                        >
                          {ES.appointments.accept}
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeclineModal(apt)}
                          className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
                        >
                          {ES.appointments.decline}
                        </button>
                      </>
                    )}
                    {(apt.status === 'pending' || apt.status === 'confirmed') && (
                      <button
                        type="button"
                        disabled={startingId === apt.id}
                        onClick={() => handleStartSession(apt)}
                        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300"
                      >
                        {startingId === apt.id ? '…' : ES.sessions.create}
                      </button>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Decline reason modal */}
      <Modal isOpen={!!declineAppt} onClose={() => setDeclineAppt(null)} title={ES.appointments.declineTitle}>
        {declineAppt && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{ES.appointments.declineSubtitle}</p>
            <div className="space-y-2">
              {DECLINE_REASONS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setDeclineReason(r.key)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    declineReason === r.key
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <p className="font-medium text-gray-900 text-sm">{r.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{r.hint}</p>
                </button>
              ))}
            </div>
            {declineReason === 'other' && (
              <textarea
                value={declineOtherText}
                onChange={(e) => setDeclineOtherText(e.target.value)}
                placeholder={ES.appointments.otherReasonPlaceholder}
                className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                rows={2}
              />
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" onClick={() => setDeclineAppt(null)}>{ES.actions.cancel}</Button>
              <Button
                variant="danger"
                onClick={handleDeclineConfirm}
                disabled={!declineReason || (declineReason === 'other' && !declineOtherText.trim())}
              >
                {ES.appointments.confirmDecline}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
