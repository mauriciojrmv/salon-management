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
import { useAsync } from '@/hooks/useAsync';
import { useNotification } from '@/hooks/useNotification';
import { ServiceRepository } from '@/lib/repositories/serviceRepository';
import ES from '@/config/text.es';

export default function ServicesPage() {
  const { userData } = useAuth();
  const { success, error } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'haircut' as const,
    price: 0,
    duration: 30,
  });

  const { data: servicesData, loading: servicesLoading, refetch } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ServiceRepository.getSalonServices(userData.salonId);
  }, [userData?.salonId]);

  const services = servicesData || [];

  const handleCreateService = async () => {
    if (!formData.name || !userData?.salonId) {
      error(ES.messages.fillRequiredFields);
      return;
    }

    setLoading(true);
    try {
      await ServiceRepository.createService(userData.salonId, {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        price: formData.price,
        duration: formData.duration,
      });
      success(ES.actions.success);
      setIsModalOpen(false);
      setFormData({
        name: '',
        description: '',
        category: 'haircut',
        price: 0,
        duration: 30,
      });
      refetch();
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to create service');
    } finally {
      setLoading(false);
    }
  };

  const serviceColumns: TableColumn<Service>[] = [
    { key: 'name', label: ES.services.name },
    { key: 'category', label: ES.services.category },
    { key: 'price', label: ES.services.price, render: (v) => `$${v?.toFixed(2)}` },
    { key: 'duration', label: ES.services.duration, render: (v) => `${v} min` },
    {
      key: 'isActive',
      label: ES.actions.view,
      render: (v) => (
        <span className={v ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
          {v ? ES.status.active : ES.status.inactive}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{ES.services.title}</h1>
        <Button onClick={() => setIsModalOpen(true)} size="lg">
          {ES.services.add}
        </Button>
      </div>

      {/* Services Table */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">{ES.services.title}</h2>
        </CardHeader>
        <CardBody>
          <Table
            columns={serviceColumns}
            data={services}
            rowKey="id"
            loading={servicesLoading}
            emptyMessage={ES.services.noServices}
          />
        </CardBody>
      </Card>

      {/* Add Service Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={ES.services.add}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label={ES.services.name}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label={ES.services.description}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <Select
            label={ES.services.category}
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
            options={[
              { value: 'haircut', label: ES.services.haircut },
              { value: 'coloring', label: ES.services.coloring },
              { value: 'styling', label: ES.services.styling },
              { value: 'nails', label: ES.services.nails },
              { value: 'waxing', label: ES.services.waxing },
              { value: 'skincare', label: ES.services.skincare },
              { value: 'massage', label: ES.services.massage },
              { value: 'other', label: ES.services.other },
            ]}
            required
          />
          <Input
            label={`${ES.services.price} ($)`}
            type="number"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
            required
          />
          <Input
            label={`${ES.services.duration} (${ES.services.duration})`}
            type="number"
            value={formData.duration}
            onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
            required
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              {ES.actions.cancel}
            </Button>
            <Button onClick={handleCreateService} loading={loading}>
              {ES.services.add}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
