'use client';

import React, { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { Table, TableColumn } from '@/components/Table';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useNotification } from '@/hooks/useNotification';
import { ClientRepository } from '@/lib/repositories/clientRepository';
import { Client } from '@/types/models';
import ES from '@/config/text.es';

export default function ClientsPage() {
  const { userData } = useAuth();
  const { success, error } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    notes: '',
  });

  const { data: clientsData, loading: clientsLoading, refetch } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ClientRepository.getSalonClients(userData.salonId);
  }, [userData?.salonId]);

  const clients = clientsData || [];

  const handleCreateClient = async () => {
    if (!formData.firstName || !formData.email || !userData?.salonId) {
      error(ES.messages.fillRequiredFields);
      return;
    }

    setLoading(true);
    try {
      await ClientRepository.createClient(userData.salonId, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        notes: formData.notes,
      });
      success(ES.actions.success);
      setIsModalOpen(false);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        dateOfBirth: '',
        gender: '',
        notes: '',
      });
      refetch();
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to add client');
    } finally {
      setLoading(false);
    }
  };

  const clientColumns: TableColumn<Client>[] = [
    {
      key: 'firstName',
      label: ES.clients.name,
      render: (v, item) => `${item.firstName} ${item.lastName}`
    },
    { key: 'email', label: ES.clients.email },
    { key: 'phone', label: ES.clients.phone },
    { key: 'totalSessions', label: ES.sessions.title },
    {
      key: 'totalSpent',
      label: ES.clients.totalSpent,
      render: (v) => `$${v?.toFixed(2) || '0.00'}`
    },
    {
      key: 'lastVisit',
      label: ES.clients.lastVisit,
      render: (v) => (v ? new Date(v).toLocaleDateString('es-ES') : '-'),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{ES.clients.title}</h1>
        <Button onClick={() => setIsModalOpen(true)} size="lg">
          {ES.clients.add}
        </Button>
      </div>

      {/* Clients Table */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">{ES.clients.title}</h2>
        </CardHeader>
        <CardBody>
          <Table
            columns={clientColumns}
            data={clients}
            rowKey="id"
            loading={clientsLoading}
            emptyMessage={ES.clients.noClients}
          />
        </CardBody>
      </Card>

      {/* Add Client Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={ES.clients.add}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label={ES.clients.name}
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            required
          />
          <Input
            label={ES.clients.name}
            placeholder={ES.clients.name}
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            required
          />
          <Input
            label={ES.clients.email}
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
          <Input
            label={ES.clients.phone}
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            required
          />
          <Input
            label={ES.clients.dateOfBirth}
            type="date"
            value={formData.dateOfBirth}
            onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
          />
          <Input
            label={ES.clients.notes}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Alergias, preferencias, etc."
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              {ES.actions.cancel}
            </Button>
            <Button onClick={handleCreateClient} loading={loading}>
              {ES.clients.add}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
