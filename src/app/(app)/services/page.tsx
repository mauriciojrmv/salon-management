'use client';

import React, { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { Modal } from '@/components/Modal';
import { Table, TableColumn } from '@/components/Table';
import { Service } from '@/types/models';
import { useAuth } from '@/hooks/useAuth';
import { useNotification } from '@/hooks/useNotification';

export default function ServicesPage() {
  const { userData } = useAuth();
  const { success, error } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [services, setServices] = useState<Service[]>([]); // Mock data
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'haircut',
    price: 0,
    duration: 30,
  });

  const handleCreateService = async () => {
    if (!formData.name || !userData?.salonId) {
      error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      // TODO: Integrate with Firebase
      success('Service created successfully');
      setIsModalOpen(false);
      setFormData({
        name: '',
        description: '',
        category: 'haircut',
        price: 0,
        duration: 30,
      });
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to create service');
    } finally {
      setLoading(false);
    }
  };

  const serviceColumns: TableColumn<Service>[] = [
    { key: 'name', label: 'Service Name' },
    { key: 'category', label: 'Category' },
    { key: 'price', label: 'Price', render: (v) => `$${v?.toFixed(2)}` },
    { key: 'duration', label: 'Duration', render: (v) => `${v} mins` },
    {
      key: 'isActive',
      label: 'Status',
      render: (v) => (
        <span className={v ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
          {v ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Services</h1>
        <Button onClick={() => setIsModalOpen(true)} size="lg">
          + Add Service
        </Button>
      </div>

      {/* Services Table */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">Service Catalog</h2>
        </CardHeader>
        <CardBody>
          <Table
            columns={serviceColumns}
            data={services}
            rowKey="id"
            emptyMessage="No services yet"
          />
        </CardBody>
      </Card>

      {/* Add Service Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Service"
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Service Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <Select
            label="Category"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            options={[
              { value: 'haircut', label: 'Haircut' },
              { value: 'coloring', label: 'Coloring' },
              { value: 'styling', label: 'Styling' },
              { value: 'nails', label: 'Nails' },
              { value: 'waxing', label: 'Waxing' },
              { value: 'skincare', label: 'Skincare' },
              { value: 'massage', label: 'Massage' },
              { value: 'other', label: 'Other' },
            ]}
            required
          />
          <Input
            label="Price ($)"
            type="number"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
            required
          />
          <Input
            label="Duration (minutes)"
            type="number"
            value={formData.duration}
            onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
            required
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateService} loading={loading}>
              Add Service
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
