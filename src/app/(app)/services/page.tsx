'use client';

import React, { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { Modal } from '@/components/Modal';
import { Table, TableColumn } from '@/components/Table';
import { Toast } from '@/components/Toast';
import { Service, ServiceCategory } from '@/types/models';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useNotification } from '@/hooks/useNotification';
import { ServiceRepository } from '@/lib/repositories/serviceRepository';
import ES from '@/config/text.es';

const initialFormData = {
  name: '',
  description: '',
  category: 'haircut' as ServiceCategory,
  price: 0,
  duration: 30,
};

const categoryOptions = [
  { value: 'haircut', label: ES.services.haircut },
  { value: 'coloring', label: ES.services.coloring },
  { value: 'styling', label: ES.services.styling },
  { value: 'nails', label: ES.services.nails },
  { value: 'waxing', label: ES.services.waxing },
  { value: 'skincare', label: ES.services.skincare },
  { value: 'massage', label: ES.services.massage },
  { value: 'other', label: ES.services.other },
];

const categoryLabels: Record<string, string> = {
  haircut: ES.services.haircut,
  coloring: ES.services.coloring,
  styling: ES.services.styling,
  nails: ES.services.nails,
  waxing: ES.services.waxing,
  skincare: ES.services.skincare,
  massage: ES.services.massage,
  other: ES.services.other,
};

export default function ServicesPage() {
  const { userData } = useAuth();
  const { notifications, removeNotification, success, error } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState(initialFormData);

  const { data: servicesData, loading: servicesLoading, refetch } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ServiceRepository.getSalonServices(userData.salonId);
  }, [userData?.salonId]);

  const services = servicesData || [];

  const openCreateModal = () => {
    setEditingService(null);
    setFormData(initialFormData);
    setIsModalOpen(true);
  };

  const openEditModal = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description,
      category: service.category,
      price: service.price,
      duration: service.duration,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingService(null);
    setFormData(initialFormData);
  };

  const handleSave = async () => {
    if (!formData.name || !userData?.salonId) {
      error(ES.messages.fillRequiredFields);
      return;
    }

    setLoading(true);
    try {
      if (editingService) {
        await ServiceRepository.updateService(editingService.id, {
          name: formData.name,
          description: formData.description,
          category: formData.category,
          price: formData.price,
          duration: formData.duration,
        });
        success(ES.services.updated);
      } else {
        await ServiceRepository.createService(userData.salonId, {
          name: formData.name,
          description: formData.description,
          category: formData.category,
          price: formData.price,
          duration: formData.duration,
        });
        success(ES.actions.success);
      }
      closeModal();
      refetch();
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (service: Service) => {
    if (!window.confirm(ES.services.deleteConfirm)) return;

    try {
      await ServiceRepository.deleteService(service.id);
      success(ES.services.deleted);
      refetch();
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    }
  };

  const serviceColumns: TableColumn<Service>[] = [
    { key: 'name', label: ES.services.name },
    { key: 'category', label: ES.services.category, render: (v) => categoryLabels[v as string] || v },
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
    {
      key: 'id',
      label: ES.actions.edit,
      render: (_v, row) => (
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => openEditModal(row)}>
            {ES.actions.edit}
          </Button>
          <Button variant="danger" size="sm" onClick={() => handleDelete(row)}>
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
        <h1 className="text-3xl font-bold text-gray-900">{ES.services.title}</h1>
        <Button onClick={openCreateModal} size="lg">
          {ES.services.add}
        </Button>
      </div>

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

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingService ? ES.services.editService : ES.services.add}
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
            onChange={(e) => setFormData({ ...formData, category: e.target.value as ServiceCategory })}
            options={categoryOptions}
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
            label={ES.services.duration}
            type="number"
            value={formData.duration}
            onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
            required
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={closeModal}>
              {ES.actions.cancel}
            </Button>
            <Button onClick={handleSave} loading={loading}>
              {editingService ? ES.actions.save : ES.services.add}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
