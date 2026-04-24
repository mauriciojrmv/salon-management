'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Input } from '@/components/Input';
import { Table } from '@/components/Table';
import { Toast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useNotification } from '@/hooks/useNotification';
import { Button } from '@/components/Button';
import { AnalyticsService } from '@/lib/services/analyticsService';
import { SessionRepository } from '@/lib/repositories/sessionRepository';
import { RetailSaleRepository } from '@/lib/repositories/retailSaleRepository';
import { ExpenseRepository } from '@/lib/repositories/expenseRepository';
import type { Session } from '@/types/models';
import ES from '@/config/text.es';
import { fmtBs, fmtDate, getBoliviaDate } from '@/lib/utils/helpers';

export default function ReportsPage() {
  const { userData } = useAuth();
  const { notifications, removeNotification } = useNotification();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
  });
  const [endDate, setEndDate] = useState(() => getBoliviaDate());

  // Auto-correct: if start > end, swap them
  const validStartDate = startDate <= endDate ? startDate : endDate;
  const validEndDate = startDate <= endDate ? endDate : startDate;

  const { data: profitability, loading: profitabilityLoading } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return AnalyticsService.getServiceProfitability(userData.salonId, validStartDate, validEndDate);
  }, [userData?.salonId, validStartDate, validEndDate]);

  // Uses the unfiltered perf range so totals and staff breakdown reflect the
  // whole period — not just the unpaid remainder. /pagos still uses the
  // paid-aware getStaffPayroll for its "owed now" flow.
  const { data: payroll } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return AnalyticsService.getStaffPerformanceRange(userData.salonId, validStartDate, validEndDate);
  }, [userData?.salonId, validStartDate, validEndDate]);

  // BI expansion: retail sales, expenses, sessions (for cancellation rate + cash flow), clients
  const { data: allSessions } = useAsync<Session[]>(
    () => userData?.salonId ? SessionRepository.getSalonSessions(userData.salonId) : Promise.resolve([]),
    [userData?.salonId],
  );
  const { data: retailSales } = useAsync(
    () => userData?.salonId ? RetailSaleRepository.getSalonSalesByDateRange(userData.salonId, validStartDate, validEndDate) : Promise.resolve([]),
    [userData?.salonId, validStartDate, validEndDate],
  );
  const { data: expenses } = useAsync(
    () => userData?.salonId ? ExpenseRepository.getSalonExpensesByDateRange(userData.salonId, validStartDate, validEndDate) : Promise.resolve([]),
    [userData?.salonId, validStartDate, validEndDate],
  );

  // Sessions in period (any status)
  const sessionsInPeriod = useMemo(
    () => (allSessions || []).filter((s) => s.date >= validStartDate && s.date <= validEndDate),
    [allSessions, validStartDate, validEndDate],
  );

  const profitabilityColumns = [
    { key: 'serviceName', label: ES.reports.service },
    { key: 'count', label: ES.reports.sessionsCount },
    { key: 'revenue', label: ES.reports.revenue, render: (v: number) => fmtBs(v ?? 0) },
    { key: 'materialCost', label: ES.reports.materialCost, render: (v: number) => fmtBs(v ?? 0) },
    { key: 'payrollCost', label: ES.reports.payrollCost, render: (v: number) => fmtBs(v ?? 0) },
    { key: 'profit', label: ES.reports.profit, render: (v: number) => (
      <span className={v > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
        {fmtBs(v ?? 0)}
      </span>
    )},
    { key: 'profitMargin', label: ES.reports.margin, render: (v: number) => `${v?.toFixed(1)}%` },
  ];

  const totalRevenue = profitability?.reduce((sum, s) => sum + s.revenue, 0) || 0;
  const totalSessions = profitability?.reduce((sum, s) => sum + s.count, 0) || 0;
  const totalMaterialCost = profitability?.reduce((sum, s) => sum + s.materialCost, 0) || 0;
  const totalPayroll = payroll?.reduce((sum, s) => sum + s.totalCommission, 0) || 0;
  const avgTicket = totalSessions > 0 ? totalRevenue / totalSessions : 0;

  // BI expansion metrics
  const retailRevenue = (retailSales || []).reduce((sum, s) => sum + s.totalAmount, 0);
  const totalExpenses = (expenses || []).reduce((sum, e) => sum + e.amount, 0);
  // Net profit matches the dashboard's cash-flow model: Ingresos + Ventas − Gastos.
  // Rationale: material purchases are typically logged in /gastos when products
  // are bought, so the cash already left. Per-service materialCost on this page
  // is internal bookkeeping (drives commission math + inventory planning), not
  // a new outflow. Same for payroll — /pagos creates an expense when commissions
  // are paid out, so they're already captured in totalExpenses. Subtracting
  // materialCost + payroll here would double-count those outflows.
  const netProfit = totalRevenue + retailRevenue - totalExpenses;
  // Service margin = service revenue left after the cost of materials consumed,
  // ignoring cash-timing. Useful for pricing decisions independent of the expense log.
  const serviceMargin = totalRevenue - totalMaterialCost;

  // Cash flow by payment method (only completed sessions + retail sales in period)
  const cashFlow = useMemo(() => {
    const flow = { cash: 0, card: 0, qr: 0, transfer: 0 };
    sessionsInPeriod
      .filter((s) => s.status === 'completed')
      .forEach((s) => {
        (s.payments || [])
          .filter((p) => p.status === 'completed')
          .forEach((p) => {
            if (p.method === 'cash') flow.cash += p.amount;
            else if (p.method === 'card') flow.card += p.amount;
            else if (p.method === 'qr_code') flow.qr += p.amount;
            else if (p.method === 'transfer') flow.transfer += p.amount;
          });
      });
    (retailSales || []).forEach((s) => {
      const method = s.payment?.method;
      if (method === 'cash') flow.cash += s.totalAmount;
      else if (method === 'card') flow.card += s.totalAmount;
      else if (method === 'qr_code') flow.qr += s.totalAmount;
      else if (method === 'transfer') flow.transfer += s.totalAmount;
    });
    return flow;
  }, [sessionsInPeriod, retailSales]);
  const totalCollected = cashFlow.cash + cashFlow.card + cashFlow.qr + cashFlow.transfer;

  // Cancellation health: cancellation rate as a service-quality signal
  const completedCount = sessionsInPeriod.filter((s) => s.status === 'completed').length;
  const cancelledCount = sessionsInPeriod.filter((s) => s.status === 'cancelled').length;
  const totalWithOutcome = completedCount + cancelledCount;
  const cancellationRate = totalWithOutcome > 0 ? (cancelledCount / totalWithOutcome) * 100 : 0;

  // Client mix: new vs returning inside the period (based on completed sessions)
  const clientMix = useMemo(() => {
    const first: Record<string, string> = {};
    (allSessions || [])
      .filter((s) => s.status === 'completed' && s.clientId)
      .forEach((s) => {
        const prev = first[s.clientId];
        if (!prev || s.date < prev) first[s.clientId] = s.date;
      });
    const newIds = new Set<string>();
    const returningIds = new Set<string>();
    sessionsInPeriod
      .filter((s) => s.status === 'completed' && s.clientId)
      .forEach((s) => {
        const firstDate = first[s.clientId];
        if (firstDate && firstDate >= validStartDate && firstDate <= validEndDate) {
          newIds.add(s.clientId);
        } else {
          returningIds.add(s.clientId);
        }
      });
    return { newCount: newIds.size, returningCount: returningIds.size };
  }, [allSessions, sessionsInPeriod, validStartDate, validEndDate]);

  // Pending balance: open (active) sessions with unpaid totals — cash the gerente hasn't collected yet
  const pendingBalance = useMemo(() => {
    return sessionsInPeriod
      .filter((s) => s.status === 'active')
      .reduce((sum, s) => {
        const paid = (s.payments || [])
          .filter((p) => p.status === 'completed')
          .reduce((a, p) => a + p.amount, 0);
        return sum + Math.max(0, (s.totalAmount || 0) - paid);
      }, 0);
  }, [sessionsInPeriod]);

  return (
    <div className="space-y-6 p-6">
      <style>{`
        @media print {
          aside, .no-print { display: none !important; }
          .print-only { display: block !important; }
          main { padding-top: 0 !important; overflow: visible !important; }
          body { background: white !important; }
          .space-y-6 > * { break-inside: avoid; }
        }
      `}</style>
      {/* Print header — hidden on screen, shown on print */}
      <div className="hidden print-only" style={{ display: 'none' }}>
        <div className="text-center border-b border-gray-300 pb-4 mb-6">
          <h1 className="text-2xl font-bold">{ES.reports.title}</h1>
          <p className="text-sm text-gray-600 mt-1">{fmtDate(startDate)} — {fmtDate(endDate)}</p>
        </div>
      </div>
      <Toast notifications={notifications} onDismiss={removeNotification} />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold text-gray-900">{ES.reports.title}</h1>
        <div className="flex gap-2 no-print">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (!profitability || profitability.length === 0) return;
              const headers = ['Servicio', 'Cantidad', 'Ingresos', 'Costo Material', 'Comisiones', 'Ganancia', 'Margen %'];
              const rows = profitability.map((r) =>
                [r.serviceName, r.count, r.revenue.toFixed(2), r.materialCost.toFixed(2), (r.payrollCost ?? 0).toFixed(2), r.profit.toFixed(2), r.profitMargin.toFixed(1)]
              );
              const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `reporte_${validStartDate}_${validEndDate}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            {ES.reports.exportCSV}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            {ES.reports.print}
          </Button>
        </div>
      </div>

      {/* Date Filter */}
      <Card className="no-print">
        <CardBody>
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              type="button"
              onClick={() => {
                const t = getBoliviaDate();
                setStartDate(t);
                setEndDate(t);
              }}
              className={`px-4 py-2 min-h-[44px] text-sm border rounded-lg font-medium transition-colors ${
                startDate === getBoliviaDate() && endDate === getBoliviaDate()
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() - 1);
                const y = d.toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
                setStartDate(y);
                setEndDate(y);
              }}
              className="px-4 py-2 min-h-[44px] text-sm border rounded-lg font-medium bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 transition-colors"
            >
              Ayer
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() - 7);
                setStartDate(d.toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' }));
                setEndDate(getBoliviaDate());
              }}
              className="px-4 py-2 min-h-[44px] text-sm border rounded-lg font-medium bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 transition-colors"
            >
              7 días
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() - 30);
                setStartDate(d.toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' }));
                setEndDate(getBoliviaDate());
              }}
              className="px-4 py-2 min-h-[44px] text-sm border rounded-lg font-medium bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 transition-colors"
            >
              30 días
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input
                label={ES.reports.startDate}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="text-[10px] text-gray-500 mt-0.5 block">{fmtDate(startDate)}</span>
            </div>
            <div>
              <Input
                label={ES.reports.endDate}
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <span className="text-[10px] text-gray-500 mt-0.5 block">{fmtDate(endDate)}</span>
            </div>
          </div>
          {startDate > endDate && (
            <p className="text-sm text-orange-600 mt-2">
              Las fechas fueron intercambiadas automáticamente.
            </p>
          )}
        </CardBody>
      </Card>

      {/* Top-line BI: services revenue, retail, material cost, payroll, expenses, net */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <p className="text-gray-600 text-sm font-medium mb-1">{ES.reports.totalRevenue}</p>
            <p className="text-2xl font-bold text-gray-900">{fmtBs(totalRevenue)}</p>
            <p className="text-xs text-gray-500 mt-0.5">{totalSessions} {ES.reports.sessionsCount.toLowerCase()} · {ES.dashboard.avgTransaction}: {fmtBs(avgTicket)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-gray-600 text-sm font-medium mb-1">{ES.reports.retailRevenue}</p>
            <p className="text-2xl font-bold text-purple-600">{fmtBs(retailRevenue)}</p>
            <p className="text-xs text-gray-500 mt-0.5">{(retailSales || []).length} ventas</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-gray-600 text-sm font-medium mb-1">{ES.reports.totalMaterialCost}</p>
            <p className="text-2xl font-bold text-red-600">{fmtBs(totalMaterialCost)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-gray-600 text-sm font-medium mb-1">{ES.reports.totalPayroll}</p>
            <p className="text-2xl font-bold text-orange-600">{fmtBs(totalPayroll)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-gray-600 text-sm font-medium mb-1">{ES.reports.totalExpenses}</p>
            <p className="text-2xl font-bold text-red-600">{fmtBs(totalExpenses)}</p>
            <p className="text-xs text-gray-500 mt-0.5">{(expenses || []).length} gastos</p>
          </CardBody>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardBody>
            <p className="text-green-800 text-sm font-semibold mb-1">{ES.reports.netProfit}</p>
            <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {fmtBs(netProfit)}
            </p>
            <p className="text-[10px] text-green-700 mt-0.5 leading-tight">{ES.reports.netProfitFormula}</p>
          </CardBody>
        </Card>
      </div>

      {/* Secondary metrics: service margin + operational health */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardBody>
            <p className="text-gray-600 text-sm font-medium mb-1">{ES.reports.serviceMargin}</p>
            <p className={`text-xl font-bold ${serviceMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtBs(serviceMargin)}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{ES.reports.serviceMarginFormula}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-gray-600 text-sm font-medium mb-1">{ES.reports.cancellationRate}</p>
            <p className={`text-xl font-bold ${cancellationRate <= 5 ? 'text-green-600' : cancellationRate <= 15 ? 'text-amber-600' : 'text-red-600'}`}>
              {cancellationRate.toFixed(1)}%
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">{cancelledCount} / {totalWithOutcome}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-gray-600 text-sm font-medium mb-1">{ES.reports.clientMix}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-bold text-blue-600">{clientMix.newCount}</p>
              <span className="text-[10px] text-gray-500">{ES.reports.newClients.toLowerCase()}</span>
            </div>
            <p className="text-xs text-gray-600">{clientMix.returningCount} {ES.reports.returningClients.toLowerCase()}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-gray-600 text-sm font-medium mb-1">{ES.reports.pendingBalance}</p>
            <p className={`text-xl font-bold ${pendingBalance > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{fmtBs(pendingBalance)}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{ES.reports.pendingBalanceSubtitle}</p>
          </CardBody>
        </Card>
      </div>

      {/* Cash flow by method */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">{ES.reports.cashFlow}</h2>
          <p className="text-sm text-gray-500 mt-1">{ES.reports.cashFlowSubtitle}</p>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-green-50 border border-green-100 rounded-lg p-3">
              <p className="text-xs text-green-700 font-medium">{ES.reports.cash}</p>
              <p className="text-lg font-bold text-green-800">{fmtBs(cashFlow.cash)}</p>
              <p className="text-[10px] text-green-700">{totalCollected > 0 ? `${((cashFlow.cash / totalCollected) * 100).toFixed(0)}%` : '0%'}</p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <p className="text-xs text-blue-700 font-medium">{ES.reports.card}</p>
              <p className="text-lg font-bold text-blue-800">{fmtBs(cashFlow.card)}</p>
              <p className="text-[10px] text-blue-700">{totalCollected > 0 ? `${((cashFlow.card / totalCollected) * 100).toFixed(0)}%` : '0%'}</p>
            </div>
            <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
              <p className="text-xs text-purple-700 font-medium">{ES.reports.qr}</p>
              <p className="text-lg font-bold text-purple-800">{fmtBs(cashFlow.qr)}</p>
              <p className="text-[10px] text-purple-700">{totalCollected > 0 ? `${((cashFlow.qr / totalCollected) * 100).toFixed(0)}%` : '0%'}</p>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
              <p className="text-xs text-orange-700 font-medium">{ES.reports.transfer}</p>
              <p className="text-lg font-bold text-orange-800">{fmtBs(cashFlow.transfer)}</p>
              <p className="text-[10px] text-orange-700">{totalCollected > 0 ? `${((cashFlow.transfer / totalCollected) * 100).toFixed(0)}%` : '0%'}</p>
            </div>
          </div>
          <div className="border-t border-gray-200 mt-3 pt-3 flex items-center justify-between">
            <p className="text-sm text-gray-500">{ES.reports.totalCollected}</p>
            <p className="text-xl font-bold text-gray-900">{fmtBs(totalCollected)}</p>
          </div>
        </CardBody>
      </Card>

      {/* ==================== SERVICE PROFITABILITY ==================== */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">{ES.reports.serviceProfitability}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {ES.app.period}: {fmtDate(validStartDate)} — {fmtDate(validEndDate)}
          </p>
        </CardHeader>
        <CardBody>
          <Table
            columns={profitabilityColumns}
            data={profitability || []}
            rowKey="serviceId"
            loading={profitabilityLoading}
            emptyMessage={ES.reports.noData}
          />
        </CardBody>
      </Card>

      {/* ==================== STAFF PAYROLL SUMMARY ==================== */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">{ES.reports.staffPerformance}</h2>
        </CardHeader>
        <CardBody>
          {(payroll || []).length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">{ES.reports.noStaffData}</p>
          ) : (
            <div className="space-y-3">
              {(payroll || []).map((staff) => (
                <div key={staff.staffId} className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <p className="font-medium text-gray-900">{staff.staffName}</p>
                    <p className="text-sm text-gray-500">
                      {staff.servicesCompleted} {ES.reports.servicesCount.toLowerCase()} · {ES.reports.revenue}: {fmtBs(staff.revenue)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-orange-600">{fmtBs(staff.totalCommission)}</p>
                    <p className="text-xs text-gray-500">{ES.reports.commission}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
