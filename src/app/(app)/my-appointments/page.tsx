'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardBody } from '@/components/Card';
import { Toast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useNotification } from '@/hooks/useNotification';
import { AppointmentService } from '@/lib/services/appointmentService';
import { ClientRepository } from '@/lib/repositories/clientRepository';
import { ServiceRepository } from '@/lib/repositories/serviceRepository';
import type { Appointment } from '@/types/models';
import { getBoliviaDate } from '@/lib/utils/helpers';
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
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const staffId = user?.uid || '';
  const today = useMemo(() => getBoliviaDate(), []);
  const yesterday = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
  }, []);
  const [selectedDate, setSelectedDate] = useState<string>(today);

  const { data: appointments, loading } = useAsync(async () => {
    if (!userData?.salonId || !staffId) return [];
    return AppointmentService.getStaffAppointments(userData.salonId, staffId, selectedDate);
  }, [userData?.salonId, staffId, selectedDate]);

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

  const handleConfirm = async (aptId: string) => {
    try {
      await AppointmentService.updateAppointmentStatus(aptId, 'confirmed');
      success(ES.appointments.confirmed);
      setConfirmingId(null);
    } catch {
      showError(ES.messages.operationFailed);
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

      {/* Date selector */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedDate(today)}
          className={`px-4 py-2.5 text-sm border rounded-lg font-medium whitespace-nowrap transition-colors ${
            selectedDate === today
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
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1"
        />
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
                      <button
                        type="button"
                        onClick={() => handleConfirm(apt.id)}
                        className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                      >
                        {ES.appointments.confirm}
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
