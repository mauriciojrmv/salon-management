'use client';

import React, { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { Table, TableColumn } from '@/components/Table';
import { Toast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useNotification } from '@/hooks/useNotification';
import { ClientRepository } from '@/lib/repositories/clientRepository';
import { Client } from '@/types/models';
import ES from '@/config/text.es';

export default function ClientsPage() {
  const { userData } = useAuth();
  const { notifications, removeNotification, success, error } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [creditModalClient, setCreditModalClient] = useState<Client | null>(null);
  const [creditAmount, setCreditAmount] = useState(0);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    notes: '',
  });

  const { data: clientsData, loading: clientsLoading, refetch } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ClientRepository.getSalonClients(userData.salonId);
  }, [userData?.salonId]);

  const clients = clientsData || [];

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      dateOfBirth: '',
      notes: '',
    });
    setEditingClient(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setFormData({
      firstName: client.firstName || '',
      lastName: client.lastName || '',
      email: client.email || '',
      phone: client.phone || '',
      dateOfBirth: client.dateOfBirth || '',
      notes: client.notes || '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSubmit = async () => {
    if (!formData.firstName || !userData?.salonId) {
      error(ES.messages.fillRequiredFields);
      return;
    }

    setLoading(true);
    try {
      if (editingClient) {
        await ClientRepository.updateClient(editingClient.id, {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          dateOfBirth: formData.dateOfBirth,
          notes: formData.notes,
        });
        success(ES.clients.updated);
      } else {
        await ClientRepository.createClient(userData.salonId, {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          dateOfBirth: formData.dateOfBirth,
          notes: formData.notes,
        });
        success(ES.actions.success);
      }
      closeModal();
      refetch();
    } catch (err) {
      const msg = err instanceof Error && err.message === 'PHONE_EXISTS'
        ? ES.clients.phoneExists
        : err instanceof Error ? err.message : ES.messages.operationFailed;
      error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (client: Client) => {
    if (!window.confirm(ES.clients.deleteConfirm)) return;

    try {
      await ClientRepository.deleteClient(client.id);
      success(ES.clients.deleted);
      refetch();
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    }
  };

  const handleAddCredit = async () => {
    if (!creditModalClient || creditAmount <= 0) {
      error(ES.messages.fillRequiredFields);
      return;
    }
    setLoading(true);
    try {
      await ClientRepository.addCredit(creditModalClient.id, creditAmount);
      success(ES.payments.creditAdded);
      setCreditModalClient(null);
      setCreditAmount(0);
      refetch();
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  const clientColumns: TableColumn<Client>[] = [
    {
      key: 'firstName',
      label: ES.clients.name,
      render: (_v, item) => `${item.firstName} ${item.lastName}`,
    },
    { key: 'phone', label: ES.clients.phone },
    { key: 'email', label: ES.clients.email },
    { key: 'totalSessions', label: ES.clients.totalSessions },
    {
      key: 'totalSpent',
      label: ES.clients.totalSpent,
      render: (v) => `$${(v as number)?.toFixed(2) || '0.00'}`,
    },
    {
      key: 'creditBalance' as keyof Client,
      label: ES.payments.creditBalance,
      render: (v) => {
        const bal = (v as number) || 0;
        return bal > 0 ? <span className="text-green-600 font-semibold">${bal.toFixed(2)}</span> : '-';
      },
    },
    {
      key: 'lastVisit',
      label: ES.clients.lastVisit,
      render: (v) => (v ? new Date(v as string).toLocaleDateString('es-ES') : '-'),
    },
    {
      key: 'id' as keyof Client,
      label: '',
      render: (_v, item) => (
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => openEditModal(item)}>
            {ES.actions.edit}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setCreditModalClient(item); setCreditAmount(0); }}>
            {ES.payments.addCredit}
          </Button>
          <Button variant="danger" size="sm" onClick={() => handleDelete(item)}>
            {ES.actions.delete}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <Toast notifications={notifications} onDismiss={removeNotification} />
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{ES.clients.title}</h1>
        <Button onClick={openCreateModal} size="lg">
          {ES.clients.add}
        </Button>
      </div>

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

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingClient ? ES.clients.editClient : ES.clients.add}
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
            label={ES.clients.lastName}
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
          />
          <Input
            label={ES.clients.phoneOptional}
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <Input
            label={ES.clients.emailOptional}
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
            placeholder={ES.clients.notesPlaceholder}
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={closeModal}>
              {ES.actions.cancel}
            </Button>
            <Button onClick={handleSubmit} loading={loading}>
              {editingClient ? ES.actions.update : ES.clients.add}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Credit / Advance Payment Modal */}
      <Modal
        isOpen={!!creditModalClient}
        onClose={() => setCreditModalClient(null)}
        title={`${ES.payments.addCredit} — ${creditModalClient?.firstName || ''} ${creditModalClient?.lastName || ''}`}
      >
        <div className="space-y-4">
          {creditModalClient && (creditModalClient.creditBalance || 0) > 0 && (
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xs text-green-600">{ES.payments.creditBalance}</p>
              <p className="text-2xl font-bold text-green-800">${(creditModalClient.creditBalance || 0).toFixed(2)}</p>
            </div>
          )}
          <Input
            label={ES.payments.creditAmount}
            type="number"
            value={creditAmount || ''}
            onChange={(e) => setCreditAmount(parseFloat(e.target.value) || 0)}
            required
          />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCreditModalClient(null)}>
              {ES.actions.cancel}
            </Button>
            <Button onClick={handleAddCredit} loading={loading}>
              {ES.payments.addCredit}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
