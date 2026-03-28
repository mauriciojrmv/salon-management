'use client';

import React, { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { Modal } from '@/components/Modal';
import { Toast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useNotification } from '@/hooks/useNotification';
import { LoyaltyRepository } from '@/lib/repositories/loyaltyRepository';
import type { LoyaltyReward } from '@/types/models';
import { fmtBs } from '@/lib/utils/helpers';
import ES from '@/config/text.es';

const rewardTypeOptions = [
  { value: 'discount', label: ES.loyalty.typeDiscount },
  { value: 'free_service', label: ES.loyalty.typeFreeService },
  { value: 'free_product', label: ES.loyalty.typeFreeProduct },
  { value: 'credit', label: ES.loyalty.typeCredit },
];

const initialForm = {
  name: '',
  description: '',
  pointsCost: 0,
  type: 'discount' as LoyaltyReward['type'],
  value: 0,
};

export default function RewardsPage() {
  const { userData } = useAuth();
  const { notifications, removeNotification, success, error } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<LoyaltyReward | null>(null);
  const [formData, setFormData] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [confirmDeleteRewardId, setConfirmDeleteRewardId] = useState<string | null>(null);

  const { data: rewards, refetch } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return LoyaltyRepository.getSalonRewards(userData.salonId);
  }, [userData?.salonId]);

  const resetForm = () => {
    setFormData({ ...initialForm });
    setEditingReward(null);
  };

  const openCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEdit = (reward: LoyaltyReward) => {
    setEditingReward(reward);
    setFormData({
      name: reward.name,
      description: reward.description,
      pointsCost: reward.pointsCost,
      type: reward.type,
      value: reward.value,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || formData.pointsCost <= 0) {
      error(ES.messages.fillRequiredFields);
      return;
    }
    setLoading(true);
    try {
      if (editingReward) {
        await LoyaltyRepository.updateReward(editingReward.id, {
          name: formData.name,
          description: formData.description,
          pointsCost: formData.pointsCost,
          type: formData.type,
          value: formData.value,
        });
        success(ES.loyalty.rewardUpdated);
      } else {
        await LoyaltyRepository.createReward(userData?.salonId || '', {
          name: formData.name,
          description: formData.description,
          pointsCost: formData.pointsCost,
          type: formData.type,
          value: formData.value,
        });
        success(ES.loyalty.rewardCreated);
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

  const handleDelete = async (rewardId: string) => {
    try {
      await LoyaltyRepository.updateReward(rewardId, { isActive: false });
      success(ES.loyalty.rewardDeleted);
      setConfirmDeleteRewardId(null);
      refetch();
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    }
  };

  const typeLabels: Record<string, string> = {
    discount: ES.loyalty.typeDiscount,
    free_service: ES.loyalty.typeFreeService,
    free_product: ES.loyalty.typeFreeProduct,
    credit: ES.loyalty.typeCredit,
  };

  const typeColors: Record<string, string> = {
    discount: 'bg-blue-100 text-blue-700',
    free_service: 'bg-green-100 text-green-700',
    free_product: 'bg-purple-100 text-purple-700',
    credit: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="space-y-6 p-6">
      <Toast notifications={notifications} onDismiss={removeNotification} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{ES.loyalty.rewards}</h1>
          <p className="text-sm text-gray-500">{ES.loyalty.earnRate}</p>
        </div>
        <Button onClick={openCreate} size="lg">{ES.loyalty.addReward}</Button>
      </div>

      {(rewards || []).length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-center text-gray-500 py-4">{ES.loyalty.noRewards}</p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(rewards || []).map((reward) => (
            <Card key={reward.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{reward.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[reward.type] || 'bg-gray-100'}`}>
                    {typeLabels[reward.type]}
                  </span>
                </div>
              </CardHeader>
              <CardBody>
                {reward.description && <p className="text-sm text-gray-600 mb-2">{reward.description}</p>}
                <div className="flex items-center justify-between mb-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-amber-600">{reward.pointsCost}</p>
                    <p className="text-xs text-gray-500">{ES.loyalty.points}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-gray-900">
                      {reward.type === 'discount' ? `${reward.value}%` : fmtBs(reward.value)}
                    </p>
                    <p className="text-xs text-gray-500">{ES.loyalty.rewardValue}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(reward)}>
                    {ES.actions.edit}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteRewardId(reward.id)}>
                    {ES.actions.delete}
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!confirmDeleteRewardId} onClose={() => setConfirmDeleteRewardId(null)} title={ES.actions.delete}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{ES.loyalty.deleteRewardConfirm}</p>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setConfirmDeleteRewardId(null)}>
              {ES.actions.cancel}
            </Button>
            <Button variant="danger" onClick={() => confirmDeleteRewardId && handleDelete(confirmDeleteRewardId)}>
              {ES.actions.delete}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingReward ? ES.loyalty.editReward : ES.loyalty.addReward}>
        <div className="space-y-4">
          <Input
            label={ES.loyalty.rewardName}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ej: 10% descuento en siguiente visita"
            required
          />
          <Input
            label={ES.loyalty.rewardDescription}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Ej: Valido en cualquier servicio"
          />
          <Input
            label={ES.loyalty.pointsCost}
            type="number"
            value={formData.pointsCost || ''}
            onChange={(e) => setFormData({ ...formData, pointsCost: parseInt(e.target.value) || 0 })}
            required
          />
          <Select
            label={ES.loyalty.rewardType}
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as LoyaltyReward['type'] })}
            options={rewardTypeOptions}
          />
          <Input
            label={formData.type === 'discount' ? `${ES.loyalty.rewardValue} (%)` : `${ES.loyalty.rewardValue} (Bs.)`}
            type="number"
            value={formData.value || ''}
            onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
            required
          />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              {ES.actions.cancel}
            </Button>
            <Button onClick={handleSubmit} loading={loading}>
              {editingReward ? ES.actions.update : ES.actions.create}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
