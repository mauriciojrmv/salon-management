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
import { StaffRepository } from '@/lib/repositories/staffRepository';
import { SessionRepository } from '@/lib/repositories/sessionRepository';
import { LoyaltyRepository } from '@/lib/repositories/loyaltyRepository';
import { ClientHistoryModal } from '@/components/ClientHistoryModal';
import { Client, LoyaltyReward, LoyaltyTransaction } from '@/types/models';
import { toDate, fmtBs } from '@/lib/utils/helpers';
import ES from '@/config/text.es';
import { useMemo } from 'react';

export default function ClientsPage() {
  const { userData } = useAuth();
  const { notifications, removeNotification, success, error } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [creditModalClient, setCreditModalClient] = useState<Client | null>(null);
  const [creditAmount, setCreditAmount] = useState(0);
  const [loyaltyClient, setLoyaltyClient] = useState<Client | null>(null);
  const [loyaltyRewards, setLoyaltyRewards] = useState<LoyaltyReward[]>([]);
  const [loyaltyHistory, setLoyaltyHistory] = useState<LoyaltyTransaction[]>([]);
  const [confirmDeleteClientId, setConfirmDeleteClientId] = useState<string | null>(null);
  const [confirmRedeemReward, setConfirmRedeemReward] = useState<LoyaltyReward | null>(null);
  const [historyClient, setHistoryClient] = useState<Client | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
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

  const { data: staffList } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return StaffRepository.getSalonStaff(userData.salonId);
  }, [userData?.salonId]);

  const clients = clientsData || [];

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const term = searchQuery.toLowerCase();
    return clients.filter(
      (c) =>
        c.firstName.toLowerCase().includes(term) ||
        c.lastName.toLowerCase().includes(term) ||
        (c.phone && c.phone.includes(term))
    );
  }, [clients, searchQuery]);

  const getStaffName = (id: string) => {
    const s = (staffList || []).find((x) => x.id === id);
    return s ? `${s.firstName} ${s.lastName}` : id;
  };

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

    // Client-side phone uniqueness check (fallback in case Firestore index is missing)
    if (formData.phone?.trim()) {
      const duplicate = clients.find(
        (c) => c.phone === formData.phone.trim() && c.id !== editingClient?.id
      );
      if (duplicate) {
        error(ES.clients.phoneExists);
        return;
      }
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

  const handleDelete = async (clientId: string) => {
    try {
      if (userData?.salonId) {
        const sessions = await SessionRepository.getUserSessions(userData.salonId, clientId);
        if (sessions.length > 0) {
          error(ES.clients.deleteBlockedHasSessions);
          return;
        }
      }
      await ClientRepository.deleteClient(clientId);
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

  const getLoyaltyTier = (sessions: number) => {
    if (sessions >= 20) return { label: ES.birthday.vip, color: 'bg-purple-100 text-purple-700' };
    if (sessions >= 10) return { label: ES.birthday.frequent, color: 'bg-blue-100 text-blue-700' };
    if (sessions >= 3) return { label: ES.birthday.regular, color: 'bg-green-100 text-green-700' };
    return { label: ES.birthday.newClient, color: 'bg-gray-100 text-gray-600' };
  };

  const openLoyaltyModal = async (client: Client) => {
    setLoyaltyClient(client);
    setLoyaltyRewards([]);
    setLoyaltyHistory([]);
    if (userData?.salonId) {
      try {
        const [rewards, history] = await Promise.all([
          LoyaltyRepository.getSalonRewards(userData.salonId),
          LoyaltyRepository.getClientTransactions(userData.salonId, client.id),
        ]);
        setLoyaltyRewards(rewards);
        setLoyaltyHistory(history);
      } catch { /* ignore */ }
    }
  };

  const handleRedeemReward = async (reward: LoyaltyReward) => {
    if (!loyaltyClient || !userData?.salonId) return;
    const clientPoints = loyaltyClient.loyaltyPoints || 0;
    if (clientPoints < reward.pointsCost) {
      error(ES.loyalty.insufficientPoints);
      return;
    }
    setConfirmRedeemReward(reward);
  };

  const executeRedeemReward = async (reward: LoyaltyReward) => {
    if (!loyaltyClient || !userData?.salonId) return;
    const clientPoints = loyaltyClient.loyaltyPoints || 0;
    setLoading(true);
    try {
      // Deduct points
      await ClientRepository.updateClient(loyaltyClient.id, {
        loyaltyPoints: clientPoints - reward.pointsCost,
      });
      // Add credit to client balance for applicable reward types
      // discount type stores a percentage — admin applies manually during payment
      if (reward.type !== 'discount') {
        await ClientRepository.addCredit(loyaltyClient.id, reward.value);
      }
      // Record transaction
      await LoyaltyRepository.addTransaction({
        salonId: userData.salonId,
        clientId: loyaltyClient.id,
        type: 'redeemed',
        points: reward.pointsCost,
        description: reward.name,
        rewardId: reward.id,
      });
      success(reward.type === 'discount' ? ES.loyalty.redeemedDiscount : ES.loyalty.redeemedCredit);
      setLoyaltyClient(null);
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
      render: (v) => fmtBs((v as number) || 0),
    },
    {
      key: 'creditBalance' as keyof Client,
      label: ES.payments.creditBalance,
      render: (v) => {
        const bal = (v as number) || 0;
        return bal > 0 ? <span className="text-green-600 font-semibold">{fmtBs(bal)}</span> : '-';
      },
    },
    {
      key: 'loyaltyPoints' as keyof Client,
      label: ES.loyalty.points,
      render: (v, item) => {
        const pts = (v as number) || 0;
        const tier = getLoyaltyTier(item.totalSessions || 0);
        return (
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-amber-600">{pts}</span>
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${tier.color}`}>{tier.label}</span>
          </div>
        );
      },
    },
    {
      key: 'lastVisit',
      label: ES.clients.lastVisit,
      render: (v) => {
        if (!v) return '-';
        const d = v instanceof Date ? v : (v && typeof v === 'object' && 'toDate' in v) ? (v as { toDate: () => Date }).toDate() : new Date(v as string);
        return d.toLocaleDateString('es-BO', { timeZone: 'America/La_Paz', day: '2-digit', month: '2-digit', year: 'numeric' });
      },
    },
    {
      key: 'id' as keyof Client,
      label: '',
      render: (_v, item) => (
        <div className="flex flex-wrap gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => openEditModal(item)}>
            {ES.actions.edit}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setHistoryClient(item)}>
            {ES.clients.viewHistory}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { setCreditModalClient(item); setCreditAmount(0); }}>
            {ES.payments.addCredit}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => openLoyaltyModal(item)}>
            {ES.clients.redeemPoints}
          </Button>
          <Button variant="danger" size="sm" onClick={() => setConfirmDeleteClientId(item.id)}>
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
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900 shrink-0">{ES.clients.title}</h2>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={ES.clients.search}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </CardHeader>
        <CardBody>
          <Table
            columns={clientColumns}
            data={filteredClients}
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
            maxLength={30}
          />
          <Input
            label={ES.clients.lastName}
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            maxLength={30}
          />
          <Input
            label={ES.clients.phoneOptional}
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            maxLength={10}
          />
          <Input
            label={ES.clients.emailOptional}
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            maxLength={50}
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
            maxLength={200}
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
              <p className="text-2xl font-bold text-green-800">{fmtBs(creditModalClient.creditBalance || 0)}</p>
            </div>
          )}
          <Input
            label={ES.payments.creditAmount}
            type="number"
            value={creditAmount || ''}
            onChange={(e) => setCreditAmount(parseFloat(e.target.value) || 0)}
            required
            min={0}
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

      {/* Loyalty Points Modal */}
      <Modal
        isOpen={!!loyaltyClient}
        onClose={() => setLoyaltyClient(null)}
        title={`${ES.loyalty.points} — ${loyaltyClient?.firstName || ''} ${loyaltyClient?.lastName || ''}`}
        size="lg"
      >
        {loyaltyClient && (
          <div className="space-y-4">
            {/* Points balance + tier */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <p className="text-xs text-amber-600 font-medium mb-1">{ES.loyalty.pointsBalance}</p>
              <p className="text-4xl font-black text-amber-700">{loyaltyClient.loyaltyPoints || 0}</p>
              <div className="mt-2">
                {(() => {
                  const tier = getLoyaltyTier(loyaltyClient.totalSessions || 0);
                  return <span className={`px-3 py-1 rounded-full text-sm font-medium ${tier.color}`}>{tier.label}</span>;
                })()}
              </div>
              <p className="text-xs text-amber-500 mt-2">{ES.loyalty.earnRate}</p>
            </div>

            {/* Available rewards to redeem */}
            {loyaltyRewards.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">{ES.loyalty.rewards}</p>
                <div className="space-y-2">
                  {loyaltyRewards.map((reward) => {
                    const canRedeem = (loyaltyClient.loyaltyPoints || 0) >= reward.pointsCost;
                    const typeLabels: Record<string, string> = {
                      discount: ES.loyalty.typeDiscount,
                      free_service: ES.loyalty.typeFreeService,
                      free_product: ES.loyalty.typeFreeProduct,
                      credit: ES.loyalty.typeCredit,
                    };
                    return (
                      <div key={reward.id} className={`flex items-center justify-between p-3 rounded-lg border ${canRedeem ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                        <div>
                          <p className="font-medium text-gray-900">{reward.name}</p>
                          <p className="text-xs text-gray-500">{typeLabels[reward.type] || reward.type}: {reward.type === 'discount' ? `${reward.value}%` : `Bs. ${reward.value}`}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-amber-600">{reward.pointsCost} pts</span>
                          <Button
                            size="sm"
                            variant={canRedeem ? 'primary' : 'secondary'}
                            disabled={!canRedeem}
                            onClick={() => handleRedeemReward(reward)}
                            loading={loading}
                          >
                            {ES.loyalty.redeem}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Points history */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">{ES.loyalty.history}</p>
              {loyaltyHistory.length === 0 ? (
                <p className="text-sm text-gray-500">{ES.loyalty.noHistory}</p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {loyaltyHistory.slice(0, 20).map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-50">
                      <div>
                        <span className={tx.type === 'earned' ? 'text-green-600' : 'text-red-600'}>
                          {tx.type === 'earned' ? '+' : '-'}{tx.points}
                        </span>
                        <span className="text-gray-500 ml-2">{tx.description}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {toDate(tx.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button variant="secondary" onClick={() => setLoyaltyClient(null)} className="w-full">
              {ES.actions.close}
            </Button>
          </div>
        )}
      </Modal>

      {/* Confirm Delete Client Modal */}
      <Modal
        isOpen={!!confirmDeleteClientId}
        onClose={() => setConfirmDeleteClientId(null)}
        title={ES.actions.delete}
      >
        <div className="space-y-4">
          <p className="text-gray-700">{ES.clients.deleteConfirm}</p>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setConfirmDeleteClientId(null)}>
              {ES.actions.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const id = confirmDeleteClientId!;
                setConfirmDeleteClientId(null);
                handleDelete(id);
              }}
            >
              {ES.actions.delete}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Client Session History Modal */}
      {historyClient && (
        <ClientHistoryModal
          isOpen={!!historyClient}
          onClose={() => setHistoryClient(null)}
          clientId={historyClient.id}
          clientName={`${historyClient.firstName} ${historyClient.lastName}`}
          salonId={userData?.salonId || ''}
          getStaffName={getStaffName}
        />
      )}

      {/* Confirm Redeem Reward Modal */}
      <Modal
        isOpen={!!confirmRedeemReward}
        onClose={() => setConfirmRedeemReward(null)}
        title={ES.loyalty.redeem}
      >
        <div className="space-y-4">
          <p className="text-gray-700">{ES.loyalty.redeemConfirm}</p>
          {confirmRedeemReward && (
            <p className="text-sm text-amber-700 font-medium">
              {confirmRedeemReward.name} — {confirmRedeemReward.pointsCost} pts
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setConfirmRedeemReward(null)}>
              {ES.actions.cancel}
            </Button>
            <Button
              onClick={() => {
                const reward = confirmRedeemReward!;
                setConfirmRedeemReward(null);
                executeRedeemReward(reward);
              }}
              loading={loading}
            >
              {ES.loyalty.redeem}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
