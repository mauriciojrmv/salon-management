'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Table, type TableColumn } from '@/components/Table';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useRealtime } from '@/hooks/useRealtime';
import { AnalyticsService } from '@/lib/services/analyticsService';
import { ClientRepository } from '@/lib/repositories/clientRepository';
import { firebaseConstraints } from '@/lib/firebase/db';
import { Session } from '@/types/models';
import ES from '@/config/text.es';

export default function Dashboard() {
  const { userData, loading: authLoading } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const { data: metrics } = useAsync(async () => {
    if (!userData?.salonId) return null;
    return AnalyticsService.getDailyMetrics(userData.salonId, selectedDate);
  }, [userData?.salonId, selectedDate]);

  const sessionConstraints = useMemo(() => [
    firebaseConstraints.where('salonId', '==', userData?.salonId || ''),
    firebaseConstraints.where('date', '==', selectedDate),
  ], [userData?.salonId, selectedDate]);
  const { data: sessions, loading: sessionsLoading } = useRealtime<Session>('sessions', sessionConstraints, !!userData?.salonId);

  // Load clients to resolve names
  const { data: clients } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ClientRepository.getSalonClients(userData.salonId);
  }, [userData?.salonId]);

  const getClientName = (clientId: string) => {
    const client = clients?.find((c) => c.id === clientId);
    return client ? `${client.firstName} ${client.lastName}` : '-';
  };

  if (authLoading) {
    return <div className="p-6 text-center">{ES.actions.loading}</div>;
  }

  const sessionColumns: TableColumn<Session>[] = [
    {
      key: 'clientId',
      label: ES.sessions.client,
      render: (v) => getClientName(v as string),
    },
    { key: 'totalAmount', label: ES.sessions.totalAmount, render: (v) => `$${v?.toFixed(2)}` },
    {
      key: 'status',
      label: ES.sessions.status || 'Estado',
      render: (v) => {
        const statusMap: Record<string, { label: string; color: string }> = {
          active: { label: ES.sessions.active, color: 'bg-blue-100 text-blue-700' },
          completed: { label: ES.sessions.completed, color: 'bg-green-100 text-green-700' },
          cancelled: { label: ES.sessions.cancelled, color: 'bg-red-100 text-red-700' },
        };
        const s = statusMap[v as string] || { label: v, color: 'bg-gray-100 text-gray-700' };
        return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
      },
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{ES.dashboard.title}</h1>
          <p className="text-gray-600">{ES.dashboard.welcome}, {userData?.firstName}!</p>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardBody>
            <p className="text-gray-600 text-sm font-medium mb-1">{ES.dashboard.totalRevenue}</p>
            <p className="text-2xl font-bold text-gray-900">
              ${metrics?.totalRevenue.toFixed(2) || '0.00'}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-gray-600 text-sm font-medium mb-1">{ES.dashboard.sessions}</p>
            <p className="text-2xl font-bold text-gray-900">{metrics?.totalSessions || 0}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-gray-600 text-sm font-medium mb-1">{ES.dashboard.clients}</p>
            <p className="text-2xl font-bold text-gray-900">{metrics?.totalClients || 0}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-gray-600 text-sm font-medium mb-1">{ES.dashboard.avgTransaction}</p>
            <p className="text-2xl font-bold text-gray-900">
              ${metrics?.averageTransactionValue.toFixed(2) || '0.00'}
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Cierre de Caja — daily payment summary by method */}
      {(() => {
        const completedToday = (sessions || []).filter((s) => s.status === 'completed');
        const allPayments = completedToday.flatMap((s) => (s.payments || []).filter((p) => p.status === 'completed'));
        const cash = allPayments.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amount, 0);
        const card = allPayments.filter((p) => p.method === 'card').reduce((s, p) => s + p.amount, 0);
        const qr = allPayments.filter((p) => p.method === 'qr_code').reduce((s, p) => s + p.amount, 0);
        const transfer = allPayments.filter((p) => p.method === 'transfer').reduce((s, p) => s + p.amount, 0);
        const totalCollected = cash + card + qr + transfer;

        const activeTotal = (sessions || [])
          .filter((s) => s.status === 'active')
          .reduce((sum, s) => {
            const paid = (s.payments || []).filter((p) => p.status === 'completed').reduce((a, p) => a + p.amount, 0);
            return sum + (s.totalAmount - paid);
          }, 0);

        return (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-900">{ES.dashboard.dailyClose}</h2>
              <p className="text-sm text-gray-500">{ES.dashboard.dailyCloseSubtitle}</p>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-green-600 font-medium">{ES.dashboard.totalCash}</p>
                  <p className="text-xl font-bold text-green-800">${cash.toFixed(2)}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-blue-600 font-medium">{ES.dashboard.totalCard}</p>
                  <p className="text-xl font-bold text-blue-800">${card.toFixed(2)}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-purple-600 font-medium">{ES.dashboard.totalQR}</p>
                  <p className="text-xl font-bold text-purple-800">${qr.toFixed(2)}</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-orange-600 font-medium">{ES.dashboard.totalTransfer}</p>
                  <p className="text-xl font-bold text-orange-800">${transfer.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex justify-between items-center border-t border-gray-200 pt-3">
                <div>
                  <p className="text-sm text-gray-500">{ES.dashboard.totalCollected}</p>
                  <p className="text-2xl font-bold text-gray-900">${totalCollected.toFixed(2)}</p>
                </div>
                {activeTotal > 0 && (
                  <div className="text-right">
                    <p className="text-sm text-gray-500">{ES.dashboard.pendingCollection}</p>
                    <p className="text-xl font-bold text-orange-600">${activeTotal.toFixed(2)}</p>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        );
      })()}

      {/* Today's Sessions */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">{ES.dashboard.todaySessions}</h2>
        </CardHeader>
        <CardBody>
          <Table
            columns={sessionColumns}
            data={sessions || []}
            rowKey="id"
            loading={sessionsLoading}
            emptyMessage={ES.dashboard.noSessions}
          />
        </CardBody>
      </Card>

      {/* Top Services */}
      {metrics?.topServices && metrics.topServices.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">{ES.dashboard.topServices}</h2>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {metrics.topServices.map((service) => (
                <div
                  key={service.serviceId}
                  className="flex items-center justify-between border-b border-gray-100 pb-3"
                >
                  <div>
                    <p className="font-medium text-gray-900">{service.serviceName}</p>
                    <p className="text-sm text-gray-500">
                      {service.count} {ES.dashboard.sessionsCount}
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">${service.revenue.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Top Staff */}
      {metrics?.topStaff && metrics.topStaff.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">{ES.dashboard.topStaff}</h2>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {metrics.topStaff.map((staff) => (
                <div
                  key={staff.staffId}
                  className="flex items-center justify-between border-b border-gray-100 pb-3"
                >
                  <div>
                    <p className="font-medium text-gray-900">{staff.staffName}</p>
                    <p className="text-sm text-gray-500">
                      {staff.sessionsCompleted} {ES.dashboard.sessionsCount}
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">${staff.earnings.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
