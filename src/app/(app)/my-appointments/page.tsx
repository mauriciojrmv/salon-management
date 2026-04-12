'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardBody } from '@/components/Card';
import { Toast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useNotification } from '@/hooks/useNotification';
import { AppointmentService } from '@/lib/services/appointmentService';
import { SessionService } from '@/lib/services/sessionService';
import { ClientRepository } from '@/lib/repositories/clientRepository';
import { ServiceRepository } from '@/lib/repositories/serviceRepository';
import { SalonRepository } from '@/lib/repositories/salonRepository';
import type { Appointment } from '@/types/models';
import { getBoliviaDate, fmtDate, whatsappUrl } from '@/lib/utils/helpers';
import { useRouter } from 'next/navigation';
import ES from '@/config/text.es';

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
  const router = useRouter();

  const staffId = user?.uid || '';
  const today = useMemo(() => getBoliviaDate(), []);
  const [selectedDate, setSelectedDate] = useState<string>(today);

  const { data: appointments, loading, refetch } = useAsync(async () => {
    if (!userData?.salonId || !staffId) return [];
    return AppointmentService.getStaffAppointments(userData.salonId, staffId, selectedDate);
  }, [userData?.salonId, staffId, selectedDate]);

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
      refetch();
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

  const handleDecline = async (apt: Appointment) => {
    try {
      await AppointmentService.updateAppointment(apt.id, {
        status: 'cancelled',
        cancellationReason: 'Rechazado por personal',
      });
      success(ES.appointments.declined);
      refetch();
      // Worker notifies SALON (not client) via WhatsApp — admin will handle client communication
      const clientName = getClientName(apt.clientId);
      const waNumber = salon?.whatsappNumber || salon?.phone;
      if (waNumber) {
        const msg = `❌ No puedo atender la cita de ${clientName} el ${fmtDate(apt.appointmentDate)} a las ${apt.startTime}`;
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
              className={`flex flex-col items-center justify-center min-w-[52px] py-2 px-2 rounded-lg border text-xs font-medium relative ${
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
                          onClick={() => handleDecline(apt)}
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
    </div>
  );
}
