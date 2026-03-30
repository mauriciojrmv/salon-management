'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardBody } from '@/components/Card';
import { Toast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useNotification } from '@/hooks/useNotification';
import { AppointmentService } from '@/lib/services/appointmentService';
import { ClientRepository } from '@/lib/repositories/clientRepository';
import type { Appointment } from '@/types/models';
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
  const { notifications, removeNotification } = useNotification();

  const staffId = user?.uid || '';
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const yesterday = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0];
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

  const getClientName = (id: string) => {
    const c = clients?.find((x) => x.id === id);
    return c ? `${c.firstName} ${c.lastName}` : '-';
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
          className={`px-3 py-2 text-sm border rounded-lg font-medium whitespace-nowrap transition-colors ${
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
          className={`px-3 py-2 text-sm border rounded-lg font-medium whitespace-nowrap transition-colors ${
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
        <p className="text-center text-gray-500 py-8">{ES.actions.loading}</p>
      ) : sorted.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-center text-gray-400 py-6 text-sm">{ES.staff.noAppointmentsToday}</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((apt) => (
            <Card key={apt.id}>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{getClientName(apt.clientId)}</p>
                    <p className="text-sm text-gray-500">{apt.startTime} – {apt.endTime}</p>
                    {apt.notes && <p className="text-xs text-gray-400 mt-1 italic">{apt.notes}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLS[apt.status] || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABEL[apt.status] || apt.status}
                  </span>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
