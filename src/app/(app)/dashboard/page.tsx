'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Table, type TableColumn } from '@/components/Table';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useRealtime } from '@/hooks/useRealtime';
import { AnalyticsService } from '@/lib/services/analyticsService';
import { ClientRepository } from '@/lib/repositories/clientRepository';
import { ProductRepository } from '@/lib/repositories/productRepository';
import { RetailSaleRepository } from '@/lib/repositories/retailSaleRepository';
import { firebaseConstraints } from '@/lib/firebase/db';
import { StaffRepository } from '@/lib/repositories/staffRepository';
import { Session, Client, Product } from '@/types/models';
import ES from '@/config/text.es';
import { fmtBs, unitLabel, getBoliviaDate } from '@/lib/utils/helpers';

export default function Dashboard() {
  const { user, userData, loading: authLoading } = useAuth();
  const isStaff = userData?.role === 'staff';
  const [selectedDate, setSelectedDate] = useState<string>(getBoliviaDate());

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

  // Load staff to resolve names
  const { data: staffList } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return StaffRepository.getSalonStaff(userData.salonId);
  }, [userData?.salonId]);

  // Low-stock products
  const { data: lowStockProducts } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ProductRepository.getLowStockProducts(userData.salonId);
  }, [userData?.salonId]);

  // Retail sales for selected date
  const { data: retailSales } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return RetailSaleRepository.getSalonDailySales(userData.salonId, selectedDate);
  }, [userData?.salonId, selectedDate]);

  const retailTotal = (retailSales || []).reduce((sum, s) => sum + s.totalAmount, 0);
  const retailCount = (retailSales || []).length;

  // Materials used in services (sell price charged to client, embedded in session totals)
  const materialsConsumed = (sessions || []).reduce((sum, s) => {
    return sum + (s.materialsUsed || []).reduce((ms, m) => ms + (m.cost || 0), 0);
  }, 0);

  // Birthday detection
  const birthdayClients = useMemo(() => {
    if (!clients) return { today: [] as Client[], week: [] as Client[] };
    const now = new Date();
    const todayMonth = now.getMonth() + 1;
    const todayDay = now.getDate();

    const today: Client[] = [];
    const week: Client[] = [];

    clients.forEach((c) => {
      if (!c.dateOfBirth) return;
      const parts = c.dateOfBirth.split('-');
      if (parts.length < 3) return;
      const bMonth = parseInt(parts[1], 10);
      const bDay = parseInt(parts[2], 10);
      if (isNaN(bMonth) || isNaN(bDay)) return;

      if (bMonth === todayMonth && bDay === todayDay) {
        today.push(c);
      } else {
        // Check if birthday is within next 7 days
        for (let d = 1; d <= 7; d++) {
          const future = new Date(now);
          future.setDate(future.getDate() + d);
          if (bMonth === future.getMonth() + 1 && bDay === future.getDate()) {
            week.push(c);
            break;
          }
        }
      }
    });

    return { today, week };
  }, [clients]);

  // Loyalty tier helper
  const getLoyaltyTier = (totalSessions: number) => {
    if (totalSessions >= 20) return { label: ES.birthday.vip, color: 'bg-purple-100 text-purple-700' };
    if (totalSessions >= 10) return { label: ES.birthday.frequent, color: 'bg-blue-100 text-blue-700' };
    if (totalSessions >= 3) return { label: ES.birthday.regular, color: 'bg-green-100 text-green-700' };
    return { label: ES.birthday.newClient, color: 'bg-gray-100 text-gray-600' };
  };

  const getClientName = (clientId: string) => {
    const client = clients?.find((c) => c.id === clientId);
    return client ? `${client.firstName} ${client.lastName}` : '-';
  };

  const getStaffName = (id: string) => {
    const s = staffList?.find((x) => x.id === id);
    return s ? `${s.firstName} ${s.lastName}` : id;
  };

  // For staff role: filter sessions to only those with services assigned to this staff
  const staffSessions = useMemo(() => {
    if (!isStaff || !user?.uid) return sessions || [];
    return (sessions || []).filter((s) =>
      (s.services || []).some((svc) => svc.assignedStaff?.includes(user.uid))
    );
  }, [isStaff, user?.uid, sessions]);

  // Staff-specific KPIs (only when role === 'staff')
  const staffKPIs = useMemo(() => {
    if (!isStaff || !user?.uid) return null;
    let completedCount = 0;
    let totalRevenue = 0;
    let totalCommission = 0;
    staffSessions.forEach((session) => {
      (session.services || []).forEach((svc) => {
        if (svc.assignedStaff?.includes(user.uid) && svc.status === 'completed') {
          completedCount++;
          totalRevenue += svc.price;
          const matCost = (svc.materialsUsed || []).reduce((s, m) => s + (m.cost || 0), 0);
          totalCommission += Math.max(0, (svc.price - matCost) * ((svc.commissionRate || 50) / 100));
        }
      });
    });
    return { completedCount, totalRevenue, totalCommission };
  }, [isStaff, user?.uid, staffSessions]);

  const today = getBoliviaDate();
  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' }); })();

  if (authLoading) {
    return <div className="p-6 text-center">{ES.actions.loading}</div>;
  }

  const sessionColumns: TableColumn<Session>[] = [
    {
      key: 'clientId',
      label: ES.sessions.client,
      render: (v) => getClientName(v as string),
    },
    {
      key: 'services',
      label: ES.sessions.services,
      render: (_, row) => (
        <div className="space-y-0.5">
          {(row.services || []).map((svc) => (
            <div key={svc.id} className="text-xs text-gray-600">
              <span className="font-medium">{svc.serviceName}</span>
              {svc.assignedStaff?.length > 0 && (
                <span className="text-gray-400"> — {svc.assignedStaff.map(getStaffName).join(', ')}</span>
              )}
            </div>
          ))}
          {(row.services || []).length === 0 && <span className="text-xs text-gray-400">-</span>}
        </div>
      ),
    },
    { key: 'totalAmount', label: ES.sessions.totalAmount, render: (v) => fmtBs(Number(v) || 0) },
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedDate(today)}
            className={`px-3 py-2 text-sm border rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedDate === today
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
            }`}
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => setSelectedDate(yesterday)}
            className={`px-3 py-2 text-sm border rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedDate === yesterday
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
            }`}
          >
            Ayer
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>

      {/* Key Metrics */}
      {isStaff ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardBody>
              <p className="text-gray-600 text-sm font-medium mb-1">{ES.staff.myCompletedToday}</p>
              <p className="text-2xl font-bold text-gray-900">{staffKPIs?.completedCount ?? 0}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-gray-600 text-sm font-medium mb-1">{ES.staff.myCommissionToday}</p>
              <p className="text-2xl font-bold text-green-600">{fmtBs(staffKPIs?.totalCommission ?? 0)}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-gray-600 text-sm font-medium mb-1">{ES.staff.myRevenueToday}</p>
              <p className="text-2xl font-bold text-gray-900">{fmtBs(staffKPIs?.totalRevenue ?? 0)}</p>
            </CardBody>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          <Card>
            <CardBody>
              <p className="text-gray-600 text-sm font-medium mb-1">{ES.dashboard.totalRevenue}</p>
              <p className="text-2xl font-bold text-gray-900">
                {fmtBs(metrics?.totalRevenue ?? 0)}
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
                {fmtBs(metrics?.averageTransactionValue ?? 0)}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-gray-600 text-sm font-medium mb-1">{ES.retail.todaySales}</p>
              <p className="text-2xl font-bold text-gray-900">{retailCount}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-gray-600 text-sm font-medium mb-1">{ES.retail.totalSales}</p>
              <p className="text-2xl font-bold text-purple-600">{fmtBs(retailTotal)}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-gray-600 text-sm font-medium mb-1">{ES.dashboard.materialsConsumed}</p>
              <p className="text-2xl font-bold text-orange-600">{fmtBs(materialsConsumed)}</p>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Low-Stock Alert */}
      {(lowStockProducts || []).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-600 text-lg">&#9888;</span>
            <h3 className="font-semibold text-red-800">{ES.stockAlert.title}</h3>
            <span className="text-sm text-red-600">({(lowStockProducts || []).length} {ES.stockAlert.productsLow})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(lowStockProducts || []).map((p: Product) => (
              <div key={p.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-red-100">
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-500">{ES.stockAlert.currentStock}: {p.currentStock} {unitLabel(p.unit)} / {ES.stockAlert.minStock}: {p.minStock}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.currentStock === 0 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {p.currentStock === 0 ? ES.stockAlert.outOfStock : ES.stockAlert.lowStock}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Birthday Alerts */}
      {(birthdayClients.today.length > 0 || birthdayClients.week.length > 0) && (
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">{ES.birthday.todayBirthdays}</h2>
          </CardHeader>
          <CardBody>
            {birthdayClients.today.length > 0 && (
              <div className="space-y-2 mb-3">
                {birthdayClients.today.map((c) => {
                  const tier = getLoyaltyTier(c.totalSessions || 0);
                  return (
                    <div key={c.id} className="flex items-center gap-3 bg-pink-50 border border-pink-200 rounded-lg p-3">
                      <span className="text-2xl">&#127874;</span>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{c.firstName} {c.lastName}</p>
                        <p className="text-xs text-gray-500">{c.totalSessions || 0} {ES.birthday.visits}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tier.color}`}>{tier.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {birthdayClients.week.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">{ES.birthday.weekBirthdays}</p>
                <div className="space-y-1">
                  {birthdayClients.week.map((c) => {
                    const tier = getLoyaltyTier(c.totalSessions || 0);
                    return (
                      <div key={c.id} className="flex items-center justify-between text-sm py-1">
                        <span className="text-gray-700">{c.firstName} {c.lastName} — {c.dateOfBirth?.slice(5)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tier.color}`}>{tier.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Cierre de Caja — daily payment summary by method (admin/manager only) */}
      {!isStaff && (() => {
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
                  <p className="text-xl font-bold text-green-800">{fmtBs(cash)}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-blue-600 font-medium">{ES.dashboard.totalCard}</p>
                  <p className="text-xl font-bold text-blue-800">{fmtBs(card)}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-purple-600 font-medium">{ES.dashboard.totalQR}</p>
                  <p className="text-xl font-bold text-purple-800">{fmtBs(qr)}</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-orange-600 font-medium">{ES.dashboard.totalTransfer}</p>
                  <p className="text-xl font-bold text-orange-800">{fmtBs(transfer)}</p>
                </div>
              </div>
              <div className="flex justify-between items-center border-t border-gray-200 pt-3">
                <div>
                  <p className="text-sm text-gray-500">{ES.dashboard.totalCollected}</p>
                  <p className="text-2xl font-bold text-gray-900">{fmtBs(totalCollected)}</p>
                </div>
                {activeTotal > 0 && (
                  <div className="text-right">
                    <p className="text-sm text-gray-500">{ES.dashboard.pendingCollection}</p>
                    <p className="text-xl font-bold text-orange-600">{fmtBs(activeTotal)}</p>
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
            data={staffSessions}
            rowKey="id"
            loading={sessionsLoading}
            emptyMessage={ES.dashboard.noSessions}
          />
        </CardBody>
      </Card>

      {/* Top Services — admin/manager only */}
      {!isStaff && metrics?.topServices && metrics.topServices.length > 0 && (
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
                  <p className="text-lg font-semibold text-gray-900">{fmtBs(service.revenue)}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Top Staff — admin/manager only */}
      {!isStaff && metrics?.topStaff && metrics.topStaff.length > 0 && (
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
                  <p className="text-lg font-semibold text-gray-900">{fmtBs(staff.earnings)}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
