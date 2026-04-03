'use client';

import React, { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { Toast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useNotification } from '@/hooks/useNotification';
import { SalonRepository } from '@/lib/repositories/salonRepository';
import type { Salon } from '@/types/models';
import ES from '@/config/text.es';

const initialForm = {
  name: '',
  address: '',
  city: '',
  phone: '',
  email: '',
};

export default function SalonsPage() {
  const { user, userData } = useAuth();
  const { notifications, removeNotification, success, error } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSalon, setEditingSalon] = useState<Salon | null>(null);
  const [formData, setFormData] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [confirmDeleteSalonId, setConfirmDeleteSalonId] = useState<string | null>(null);

  const { data: salons, refetch } = useAsync(async () => {
    if (!user?.uid) return [];
    return SalonRepository.getOwnerSalons(user.uid);
  }, [user?.uid]);

  const activeSalonId = userData?.salonId || '';

  const resetForm = () => {
    setFormData(initialForm);
    setEditingSalon(null);
  };

  const openCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEdit = (salon: Salon) => {
    setEditingSalon(salon);
    setFormData({
      name: salon.name,
      address: salon.address || '',
      city: salon.city || '',
      phone: salon.phone || '',
      email: salon.email || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      error(ES.messages.fillRequiredFields);
      return;
    }
    setLoading(true);
    try {
      if (editingSalon) {
        await SalonRepository.updateSalon(editingSalon.id, {
          name: formData.name,
          address: formData.address,
          city: formData.city,
          phone: formData.phone,
          email: formData.email,
        } as Partial<Salon>);
        success(ES.salons.updated);
      } else {
        await SalonRepository.createSalon({
          name: formData.name,
          address: formData.address,
          city: formData.city,
          phone: formData.phone,
          email: formData.email,
          owner: user?.uid || '',
          currency: 'BOB',
          country: '',
          postalCode: '',
          timezone: '',
        } as Partial<Salon>);
        success(ES.salons.created);
      }
      setIsModalOpen(false);
      resetForm();
      refetch();
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (salonId: string) => {
    try {
      await SalonRepository.updateSalon(salonId, { isActive: false } as Partial<Salon>);
      success(ES.salons.deleted);
      setConfirmDeleteSalonId(null);
      refetch();
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Toast notifications={notifications} onDismiss={removeNotification} />
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{ES.salons.title}</h1>
        <Button onClick={openCreate}>{ES.salons.add}</Button>
      </div>

      {(salons || []).length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-center text-gray-500 py-4">{ES.salons.noSalons}</p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(salons || []).map((salon) => (
            <Card key={salon.id} className={salon.id === activeSalonId ? 'ring-2 ring-blue-500' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{salon.name}</h3>
                    {salon.city && <p className="text-sm text-gray-500">{salon.city}</p>}
                  </div>
                  {salon.id === activeSalonId && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                      {ES.salons.currentSalon}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardBody>
                {salon.address && <p className="text-sm text-gray-600 mb-1">{salon.address}</p>}
                {salon.phone && <p className="text-sm text-gray-500">{salon.phone}</p>}
                {salon.email && <p className="text-sm text-gray-500">{salon.email}</p>}
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(salon)}>
                    {ES.actions.edit}
                  </Button>
                  {salon.id !== activeSalonId && (
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteSalonId(salon.id)}>
                      {ES.actions.delete}
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={!!confirmDeleteSalonId} onClose={() => setConfirmDeleteSalonId(null)} title={ES.actions.delete}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{ES.salons.deleteConfirm}</p>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setConfirmDeleteSalonId(null)}>
              {ES.actions.cancel}
            </Button>
            <Button variant="danger" onClick={() => confirmDeleteSalonId && handleDelete(confirmDeleteSalonId)}>
              {ES.actions.delete}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingSalon ? ES.salons.editSalon : ES.salons.add}>
        <div className="space-y-4">
          <Input
            label={ES.salons.name}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            maxLength={50}
          />
          <Input
            label={ES.salons.address}
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            maxLength={100}
          />
          <Input
            label={ES.salons.city}
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            maxLength={50}
          />
          <Input
            label={ES.salons.phone}
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            maxLength={10}
          />
          <Input
            label={ES.salons.email}
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            maxLength={50}
          />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              {ES.actions.cancel}
            </Button>
            <Button onClick={handleSubmit} loading={loading}>
              {editingSalon ? ES.actions.update : ES.actions.create}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
