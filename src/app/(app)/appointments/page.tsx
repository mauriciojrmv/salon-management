'use client';

import React, { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { Modal } from '@/components/Modal';
import { Table, TableColumn } from '@/components/Table';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useNotification } from '@/hooks/useNotification';
import { AppointmentService } from '@/lib/services/appointmentService';
import { Appointment } from '@/types/models';

export default function AppointmentsPage() {
  const { userData } = useAuth();
  const { success, error } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [formData, setFormData] = useState({
    clientId: '',
    serviceIds: [] as string[],
    staffId: '',
    startTime: '09:00',
    endTime: '10:00',
  });
  const [loading, setLoading] = useState(false);

  const { data: appointments, refetch } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return AppointmentService.getSalonAppointments(userData.salonId, selectedDate);
  }, [userData?.salonId, selectedDate]);

  const handleCreateAppointment = async () => {
    setLoading(true);
    try {
      await AppointmentService.createAppointment({
        ...formData,
        appointmentDate: selectedDate,
        salonId: userData!.salonId,
      });
      success('Appointment created successfully');
      setIsModalOpen(false);
      setFormData({
        clientId: '',
        serviceIds: [],
        staffId: '',
        startTime: '09:00',
        endTime: '10:00',
      });
      refetch();
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to create appointment');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAppointment = async (appointmentId: string) => {
    try {
      await AppointmentService.confirmAppointment(appointmentId);
      success('Appointment confirmed');
      refetch();
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to confirm appointment');
    }
  };

  const appointmentColumns: TableColumn<Appointment>[] = [
    { key: 'id', label: 'ID' },
    { key: 'clientId', label: 'Client' },
    { key: 'startTime', label: 'Time' },
    { key: 'status', label: 'Status' },
    {
      key: 'id',
      label: 'Actions',
      render: (value, item) =>
        item.status === 'pending' ? (
          <Button
            size="sm"
            onClick={() => handleConfirmAppointment(value)}
          >
            Confirm
          </Button>
        ) : (
          <span className="text-gray-500 text-sm">-</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Appointments</h1>
        <Button onClick={() => setIsModalOpen(true)} size="lg">
          + New Appointment
        </Button>
      </div>

      {/* Date Filter */}
      <Card>
        <CardBody>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Date
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
          <h2 className="text-xl font-semibold text-gray-900">Appointments for {selectedDate}</h2>
        </CardHeader>
        <CardBody>
          <Table
            columns={appointmentColumns}
            data={appointments || []}
            rowKey="id"
            emptyMessage="No appointments scheduled"
          />
        </CardBody>
      </Card>

      {/* Create Appointment Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Appointment"
      >
        <div className="space-y-4">
          <Input
            label="Client ID"
            value={formData.clientId}
            onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
            required
          />
          <Input
            label="Service IDs (comma-separated)"
            value={formData.serviceIds.join(',')}
            onChange={(e) =>
              setFormData({ ...formData, serviceIds: e.target.value.split(',') })
            }
            required
          />
          <Input
            label="Staff ID"
            value={formData.staffId}
            onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
            required
          />
          <Input
            label="Start Time"
            type="time"
            value={formData.startTime}
            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
            required
          />
          <Input
            label="End Time"
            type="time"
            value={formData.endTime}
            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
            required
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateAppointment} loading={loading}>
              Create Appointment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
