'use client';

import React, { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { Table, TableColumn } from '@/components/Table';
import { SearchableSelect } from '@/components/SearchableSelect';
import { Toast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useNotification } from '@/hooks/useNotification';
import { AppointmentService } from '@/lib/services/appointmentService';
import { SessionService } from '@/lib/services/sessionService';
import { ClientRepository } from '@/lib/repositories/clientRepository';
import { ServiceRepository } from '@/lib/repositories/serviceRepository';
import { StaffRepository } from '@/lib/repositories/staffRepository';
import { Appointment } from '@/types/models';
import { fmtBs, getBoliviaDate } from '@/lib/utils/helpers';
import ES from '@/config/text.es';

export default function AppointmentsPage() {
  const { userData } = useAuth();
  const { notifications, removeNotification, success, error } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuickClientOpen, setIsQuickClientOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getBoliviaDate());
  const [cancelApptId, setCancelApptId] = useState<string | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [formData, setFormData] = useState({
    clientId: '',
    serviceIds: [] as string[],
    staffId: '',
    startTime: '09:00',
    endTime: '10:00',
  });
  const [loading, setLoading] = useState(false);
  const [quickClient, setQuickClient] = useState({ firstName: '', lastName: '', phone: '' });

  const { data: appointments, refetch } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return AppointmentService.getSalonAppointments(userData.salonId, selectedDate);
  }, [userData?.salonId, selectedDate]);

  // Load lookup data for dropdowns
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

  // Build dropdown options
  const clientOptions = (clients || []).map((c) => ({
    value: c.id,
    label: `${c.firstName} ${c.lastName}`,
    secondary: c.phone,
  }));

  const serviceOptions = (services || []).map((s) => ({
    value: s.id,
    label: s.name,
    secondary: `Bs. ${s.price} · ${s.duration}min`,
  }));

  const staffOptions = (staffList || []).map((s) => ({
    value: s.id,
    label: `${s.firstName} ${s.lastName}`,
    secondary: s.phone,
  }));

  // Resolve names for table display
  const getClientName = (id: string) => {
    const c = clients?.find((x) => x.id === id);
    return c ? `${c.firstName} ${c.lastName}` : '-';
  };

  const getStaffName = (id: string) => {
    const s = staffList?.find((x) => x.id === id);
    return s ? `${s.firstName} ${s.lastName}` : '-';
  };

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
      setFormData({ ...formData, clientId: newClientId });
      refetchClients();
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (apt: Appointment) => {
    setEditingAppointment(apt);
    setFormData({
      clientId: apt.clientId,
      serviceIds: apt.serviceIds || [],
      staffId: apt.staffId,
      startTime: apt.startTime,
      endTime: apt.endTime,
    });
    setIsModalOpen(true);
  };

  const handleSaveAppointment = async () => {
    if (!formData.clientId || !formData.staffId) {
      error(ES.messages.fillRequiredFields);
      return;
    }

    setLoading(true);
    try {
      if (editingAppointment) {
        await AppointmentService.updateAppointment(editingAppointment.id, {
          clientId: formData.clientId,
          serviceIds: formData.serviceIds,
          staffId: formData.staffId,
          startTime: formData.startTime,
          endTime: formData.endTime,
          appointmentDate: selectedDate,
        });
        success(ES.appointments.updated);
      } else {
        await AppointmentService.createAppointment({
          ...formData,
          appointmentDate: selectedDate,
          salonId: userData!.salonId,
        });
        success(ES.appointments.created);
      }
      setIsModalOpen(false);
      setEditingAppointment(null);
      setFormData({
        clientId: '',
        serviceIds: [],
        staffId: '',
        startTime: '09:00',
        endTime: '10:00',
      });
      refetch();
    } catch (err) {
      const msg = err instanceof Error && err.message === 'STAFF_DOUBLE_BOOKED'
        ? ES.appointments.staffDoubleBooked
        : err instanceof Error ? err.message : ES.appointments.createFailed;
      error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAppointment = async (appointmentId: string) => {
    try {
      await AppointmentService.confirmAppointment(appointmentId);
      success(ES.appointments.confirmed2);
      refetch();
    } catch (err) {
      error(err instanceof Error ? err.message : ES.appointments.confirmFailed);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      await AppointmentService.updateAppointmentStatus(appointmentId, 'cancelled');
      success(ES.appointments.cancelled);
      setCancelApptId(null);
      refetch();
    } catch (err) {
      error(err instanceof Error ? err.message : ES.appointments.cancelFailed || ES.messages.operationFailed);
    }
  };

  const handleConvertToWork = async (appointment: Appointment) => {
    if (!userData?.salonId) return;
    setLoading(true);
    try {
      const today = getBoliviaDate();
      const sessionId = await SessionService.createSession({
        clientId: appointment.clientId,
        date: today,
        startTime: new Date(),
        salonId: userData.salonId,
      });

      // Add each service from the appointment to the new session
      for (const serviceId of (appointment.serviceIds || [])) {
        const svc = services?.find((s) => s.id === serviceId);
        if (svc) {
          await SessionService.addServiceToSession({
            sessionId,
            serviceId: svc.id,
            serviceName: svc.name,
            price: svc.price,
            staffIds: appointment.staffId ? [appointment.staffId] : [],
            materials: [],
          });
        }
      }

      // Mark appointment as completed
      await AppointmentService.updateAppointmentStatus(appointment.id, 'completed');
      success(ES.appointments.converted);
      refetch();
    } catch (err) {
      error(err instanceof Error ? err.message : ES.appointments.convertFailed);
    } finally {
      setLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-green-100 text-green-800',
    completed: 'bg-blue-100 text-blue-800',
    cancelled: 'bg-red-100 text-red-800',
    no_show: 'bg-gray-100 text-gray-800',
  };

  const statusLabels: Record<string, string> = {
    pending: ES.appointments.pending,
    confirmed: ES.appointments.confirmed,
    completed: ES.status.completed,
    cancelled: ES.appointments.cancelled,
    no_show: ES.appointments.noShow,
  };

  const appointmentColumns: TableColumn<Appointment>[] = [
    {
      key: 'clientId',
      label: ES.sessions.client,
      render: (v) => getClientName(v as string),
    },
    {
      key: 'staffId',
      label: ES.nav.staff,
      render: (v) => getStaffName(v as string),
    },
    {
      key: 'startTime',
      label: ES.appointments.time,
      render: (v, item) => `${item.startTime} - ${item.endTime}`,
    },
    {
      key: 'status',
      label: ES.users.status,
      render: (v) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[v as string] || ''}`}>
          {statusLabels[v as string] || v}
        </span>
      ),
    },
    {
      key: 'id',
      label: '',
      render: (value, item) => (
        <div className="flex gap-2 flex-wrap">
          {item.status === 'pending' && (
            <Button size="sm" onClick={() => handleConfirmAppointment(value as string)}>
              {ES.appointments.confirm}
            </Button>
          )}
          {(item.status === 'confirmed' || item.status === 'pending') && (
            <Button size="sm" variant="primary" onClick={() => handleConvertToWork(item)}>
              {ES.appointments.convertToWork}
            </Button>
          )}
          {(item.status === 'pending' || item.status === 'confirmed') && (
            <Button size="sm" variant="secondary" onClick={() => openEditModal(item)}>
              {ES.actions.edit}
            </Button>
          )}
          {(item.status === 'pending' || item.status === 'confirmed') && (
            <Button size="sm" variant="danger" onClick={() => setCancelApptId(value as string)}>
              {ES.actions.cancel}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <Toast notifications={notifications} onDismiss={removeNotification} />
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{ES.appointments.title}</h1>
        <Button onClick={() => setIsModalOpen(true)} size="lg">
          {ES.appointments.new}
        </Button>
      </div>

      {/* Date Filter */}
      <Card>
        <CardBody>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {ES.appointments.filterByDate}
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          />
        </CardBody>
      </Card>

      {/* Appointments Table */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">
            {ES.appointments.forDate} {selectedDate}
          </h2>
        </CardHeader>
        <CardBody>
          <Table
            columns={appointmentColumns}
            data={appointments || []}
            rowKey="id"
            emptyMessage={ES.appointments.noAppointments}
          />
        </CardBody>
      </Card>

      {/* Create Appointment Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingAppointment(null); }}
        title={editingAppointment ? ES.appointments.editTitle : ES.appointments.create}
      >
        <div className="space-y-4">
          <Input
            label={ES.appointments.date}
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            required
          />
          <SearchableSelect
            label={ES.appointments.selectClient}
            options={clientOptions}
            value={formData.clientId}
            onChange={(v) => setFormData({ ...formData, clientId: v })}
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

          <SearchableSelect
            label={ES.appointments.selectStaff}
            options={staffOptions}
            value={formData.staffId}
            onChange={(v) => setFormData({ ...formData, staffId: v })}
            placeholder={ES.actions.search}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ES.appointments.selectServices}
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
              {serviceOptions.map((opt) => (
                <label key={opt.value} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.serviceIds.includes(opt.value)}
                    onChange={(e) => {
                      const ids = e.target.checked
                        ? [...formData.serviceIds, opt.value]
                        : formData.serviceIds.filter((id) => id !== opt.value);
                      setFormData({ ...formData, serviceIds: ids });
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">{opt.label}</span>
                  <span className="text-xs text-gray-500 ml-auto">{opt.secondary}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={ES.appointments.startTime}
              type="time"
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              required
            />
            <Input
              label={ES.appointments.endTime}
              type="time"
              value={formData.endTime}
              onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
              required
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              {ES.actions.cancel}
            </Button>
            <Button onClick={handleSaveAppointment} loading={loading}>
              {editingAppointment ? ES.actions.save : ES.appointments.create}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancel Appointment Confirmation */}
      <Modal isOpen={!!cancelApptId} onClose={() => setCancelApptId(null)} title={ES.appointments.cancelTitle} size="sm">
        <div className="space-y-4">
          <p className="text-gray-700">{ES.appointments.confirmCancel}</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setCancelApptId(null)} className="flex-1">{ES.actions.cancel}</Button>
            <Button variant="danger" onClick={() => cancelApptId && handleCancelAppointment(cancelApptId)} className="flex-1">{ES.appointments.cancelTitle}</Button>
          </div>
        </div>
      </Modal>

      {/* Quick Client Creation Modal */}
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
            label={ES.clients.phone}
            type="tel"
            value={quickClient.phone}
            onChange={(e) => setQuickClient({ ...quickClient, phone: e.target.value })}
            required
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
    </div>
  );
}
