'use client';

import React, { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { Table, TableColumn } from '@/components/Table';
import { useAuth } from '@/hooks/useAuth';
import { useNotification } from '@/hooks/useNotification';
import { Client } from '@/types/models';

export default function ClientsPage() {
  const { userData } = useAuth();
  const { success, error } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]); // Mock data
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

  const handleCreateClient = async () => {
    if (!formData.firstName || !formData.email) {
      error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      // TODO: Integrate with Firebase
      success('Client added successfully');
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
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to add client');
    } finally {
      setLoading(false);
    }
  };

  const clientColumns: TableColumn<Client>[] = [
    { key: 'firstName', label: 'Name', render: (v, item) => `${item.firstName} ${item.lastName}` },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'totalSessions', label: 'Sessions' },
    { key: 'totalSpent', label: 'Total Spent', render: (v) => `$${v?.toFixed(2)}` },
    {
      key: 'lastVisit',
      label: 'Last Visit',
      render: (v) => (v ? new Date(v).toLocaleDateString() : '-'),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
        <Button onClick={() => setIsModalOpen(true)} size="lg">
          + Add Client
        </Button>
      </div>

      {/* Clients Table */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">Client List</h2>
        </CardHeader>
        <CardBody>
          <Table
            columns={clientColumns}
            data={clients}
            rowKey="id"
            emptyMessage="No clients yet"
          />
        </CardBody>
      </Card>

      {/* Add Client Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Client"
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="First Name"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            required
          />
          <Input
            label="Last Name"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
          <Input
            label="Phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            required
          />
          <Input
            label="Date of Birth"
            type="date"
            value={formData.dateOfBirth}
            onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
          />
          <Input
            label="Notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Allergies, preferences, etc."
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateClient} loading={loading}>
              Add Client
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
