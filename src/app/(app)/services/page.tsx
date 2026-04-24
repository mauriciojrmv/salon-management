'use client';

import React, { useMemo, useState } from 'react';
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
import { DuplicateHint } from '@/components/DuplicateHint';
import { fmtBs } from '@/lib/utils/helpers';
import { findSimilarByName } from '@/lib/utils/fuzzy';
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
  { value: 'treatment', label: ES.services.treatment },
  { value: 'nails', label: ES.services.nails },
  { value: 'waxing', label: ES.services.waxing },
  { value: 'skincare', label: ES.services.skincare },
  { value: 'makeup', label: ES.services.makeup },
  { value: 'eyebrows', label: ES.services.eyebrows },
  { value: 'eyelashes', label: ES.services.eyelashes },
  { value: 'massage', label: ES.services.massage },
  { value: 'spa', label: ES.services.spa },
  { value: 'other', label: ES.services.other },
];

const categoryLabels: Record<string, string> = {
  haircut: ES.services.haircut,
  coloring: ES.services.coloring,
  styling: ES.services.styling,
  treatment: ES.services.treatment,
  nails: ES.services.nails,
  waxing: ES.services.waxing,
  skincare: ES.services.skincare,
  makeup: ES.services.makeup,
  eyebrows: ES.services.eyebrows,
  eyelashes: ES.services.eyelashes,
  massage: ES.services.massage,
  spa: ES.services.spa,
  other: ES.services.other,
};

export default function ServicesPage() {
  const { userData } = useAuth();
  const { notifications, removeNotification, success, error } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmCreateAnyway, setConfirmCreateAnyway] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState(initialFormData);

  const { data: servicesData, loading: servicesLoading, refetch } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ServiceRepository.getSalonServices(userData.salonId);
  }, [userData?.salonId]);

  const services = servicesData || [];

  // Live duplicate detection as admin types — excludes the item being edited.
  const similarServices = useMemo(() => {
    return findSimilarByName(formData.name, services, {
      excludeId: editingService?.id,
    }).map((s) => ({ id: s.id, name: s.name, secondary: `${fmtBs(s.price)} · ${s.duration} min` }));
  }, [formData.name, services, editingService?.id]);

  const pickExisting = (id: string) => {
    const svc = services.find((s) => s.id === id);
    if (svc) {
      setEditingService(svc);
      setFormData({
        name: svc.name,
        description: svc.description,
        category: svc.category,
        price: svc.price,
        duration: svc.duration,
      });
    }
  };

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

  const handleSave = async (force = false) => {
    if (!formData.name || !userData?.salonId) {
      error(ES.messages.fillRequiredFields);
      return;
    }

    // Soft-confirm: if we're creating (not editing) and similar names exist,
    // require an explicit "crear igual" tap first. Edits skip this.
    if (!editingService && !force && similarServices.length > 0) {
      setConfirmCreateAnyway(true);
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

  const handleDelete = async (id: string) => {
    try {
      await ServiceRepository.deleteService(id);
      success(ES.services.deleted);
      setConfirmDeleteId(null);
      refetch();
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    }
  };

  const serviceColumns: TableColumn<Service>[] = [
    { key: 'name', label: ES.services.name },
    { key: 'category', label: ES.services.category, render: (v) => categoryLabels[v as string] || v },
    { key: 'price', label: ES.services.price, render: (v) => fmtBs(Number(v)) },
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
          {userData?.role === 'admin' && (
            <Button variant="danger" size="sm" onClick={() => setConfirmDeleteId(row.id)}>
              {ES.actions.delete}
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
          <div>
            <Input
              label={ES.services.name}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              maxLength={50}
            />
            <DuplicateHint
              kind="service"
              matches={editingService ? [] : similarServices}
              onPick={pickExisting}
            />
          </div>
          <Input
            label={ES.services.description}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            maxLength={200}
          />
          <Select
            label={ES.services.category}
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value as ServiceCategory })}
            options={categoryOptions}
            required
          />
          <Input
            label={`${ES.services.price} (Bs.)`}
            type="number"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
            required
            min={0}
          />
          <Input
            label={ES.services.duration}
            type="number"
            value={formData.duration}
            onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
            required
            min={1}
            max={480}
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={closeModal}>
              {ES.actions.cancel}
            </Button>
            <Button onClick={() => handleSave()} loading={loading}>
              {editingService ? ES.actions.save : ES.services.add}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Duplicate soft-confirm */}
      <Modal
        isOpen={confirmCreateAnyway}
        onClose={() => setConfirmCreateAnyway(false)}
        title={ES.duplicateHint.confirmTitle}
        size="sm"
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">{ES.duplicateHint.confirmCreateAnyway}</p>
          <div className="flex flex-wrap gap-1.5">
            {similarServices.map((m) => (
              <span key={m.id} className="text-xs px-2 py-1 bg-amber-50 border border-amber-200 rounded-md text-amber-900">{m.name}</span>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setConfirmCreateAnyway(false)}>
              {ES.duplicateHint.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmCreateAnyway(false);
                handleSave(true);
              }}
            >
              {ES.duplicateHint.createAnyway}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        title={ES.services.deleteConfirm}
      >
        <div className="space-y-4">
          <p className="text-gray-700">Esta acción no se puede deshacer.</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setConfirmDeleteId(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}>
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
