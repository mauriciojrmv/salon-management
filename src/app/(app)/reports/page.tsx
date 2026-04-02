'use client';

import React, { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { Table } from '@/components/Table';
import { Toast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useNotification } from '@/hooks/useNotification';
import { Button } from '@/components/Button';
import { AnalyticsService, PayrollStaffEntry } from '@/lib/services/analyticsService';
import { ExpenseRepository } from '@/lib/repositories/expenseRepository';
import ES from '@/config/text.es';
import { fmtBs, fmtDate } from '@/lib/utils/helpers';

function PayrollCard({ entry, onRegisterPayment, isPaid }: { entry: PayrollStaffEntry; onRegisterPayment: (entry: PayrollStaffEntry) => void; isPaid?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardBody>
        {/* Staff summary row — tap to expand */}
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div>
            <p className="font-semibold text-gray-900 text-lg">{entry.staffName}</p>
            <p className="text-sm text-gray-500">
              {entry.servicesCompleted} {ES.reports.servicesCount.toLowerCase()} · {ES.reports.revenue}: {fmtBs(entry.revenue)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{ES.reports.totalToPay}</p>
            <p className="text-2xl font-bold text-green-600">{fmtBs(entry.totalCommission)}</p>
          </div>
        </div>

        {/* Commission breakdown bar */}
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div className="bg-blue-50 rounded-lg p-2">
            <p className="text-xs text-blue-600">{ES.reports.serviceRevenue}</p>
            <p className="font-semibold text-blue-900">{fmtBs(entry.revenue)}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-2">
            <p className="text-xs text-red-600">{ES.reports.materialDeduction}</p>
            <p className="font-semibold text-red-900">-{fmtBs(entry.materialCost)}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-2">
            <p className="text-xs text-green-600">{ES.reports.commissionEarned}</p>
            <p className="font-semibold text-green-900">{fmtBs(entry.totalCommission)}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex-1 py-2 text-sm text-blue-600 font-medium hover:bg-blue-50 rounded-lg transition-colors"
          >
            {expanded ? ES.reports.collapseDetail : ES.reports.expandDetail} ({entry.details.length})
          </button>
          {isPaid ? (
            <span className="flex-1 py-2 text-sm text-center text-green-700 bg-green-50 rounded-lg font-semibold">{ES.reports.paid}</span>
          ) : (
            <Button size="sm" variant="primary" onClick={() => onRegisterPayment(entry)}>
              {ES.reports.registerPayment}
            </Button>
          )}
        </div>

        {/* Expanded detail — service-by-service breakdown */}
        {expanded && (
          <div className="mt-3 border-t border-gray-200 pt-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="pb-2 pr-3">{ES.reports.date}</th>
                    <th className="pb-2 pr-3">{ES.reports.client}</th>
                    <th className="pb-2 pr-3">{ES.reports.service}</th>
                    <th className="pb-2 pr-3 text-right">{ES.reports.price}</th>
                    <th className="pb-2 pr-3 text-right">{ES.reports.materials}</th>
                    <th className="pb-2 text-right">{ES.reports.commission}</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.details
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((d, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="py-2 pr-3 text-gray-600">{fmtDate(d.date)}</td>
                      <td className="py-2 pr-3 text-gray-900">{d.clientName}</td>
                      <td className="py-2 pr-3 text-gray-900">{d.serviceName}</td>
                      <td className="py-2 pr-3 text-right">{fmtBs(d.price)}</td>
                      <td className="py-2 pr-3 text-right text-red-600">
                        {d.materialCost > 0 ? `-${fmtBs(d.materialCost)}` : '-'}
                      </td>
                      <td className="py-2 text-right font-medium text-green-600">{fmtBs(d.commission)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 font-semibold">
                    <td colSpan={3} className="py-2 text-gray-900">{ES.payments.total}</td>
                    <td className="py-2 text-right">{fmtBs(entry.revenue)}</td>
                    <td className="py-2 text-right text-red-600">-{fmtBs(entry.materialCost)}</td>
                    <td className="py-2 text-right text-green-600">{fmtBs(entry.totalCommission)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export default function ReportsPage() {
  const { userData } = useAuth();
  const { notifications, removeNotification, success, error } = useNotification();
  const [startDate, setStartDate] = useState(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentEntry, setPaymentEntry] = useState<PayrollStaffEntry | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paidStaffIds, setPaidStaffIds] = useState<Set<string>>(new Set());

  const handleRegisterPayment = async () => {
    if (!paymentEntry || !userData?.salonId) return;
    setPaymentLoading(true);
    try {
      await ExpenseRepository.createExpense({
        salonId: userData.salonId,
        category: 'salaries',
        description: `${ES.reports.payrollPayment}: ${paymentEntry.staffName} (${validStartDate} – ${validEndDate})`,
        amount: paymentEntry.totalCommission,
        date: new Date().toISOString().split('T')[0],
        recurring: false,
        paidTo: paymentEntry.staffName,
        paymentMethod: 'cash',
        createdBy: '',
      });
      success(ES.reports.paymentRegistered);
      setPaidStaffIds((prev) => new Set([...prev, paymentEntry.staffId]));
      setPaymentEntry(null);
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setPaymentLoading(false);
    }
  };

  // Auto-correct: if start > end, swap them
  const validStartDate = startDate <= endDate ? startDate : endDate;
  const validEndDate = startDate <= endDate ? endDate : startDate;

  const { data: profitability, loading: profitabilityLoading } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return AnalyticsService.getServiceProfitability(userData.salonId, validStartDate, validEndDate);
  }, [userData?.salonId, validStartDate, validEndDate]);

  const { data: payroll, loading: payrollLoading } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return AnalyticsService.getStaffPayroll(userData.salonId, validStartDate, validEndDate);
  }, [userData?.salonId, validStartDate, validEndDate]);

  const profitabilityColumns = [
    { key: 'serviceName', label: ES.reports.service },
    { key: 'count', label: ES.reports.sessionsCount },
    { key: 'revenue', label: ES.reports.revenue, render: (v: number) => fmtBs(v ?? 0) },
    { key: 'materialCost', label: ES.reports.materialCost, render: (v: number) => fmtBs(v ?? 0) },
    { key: 'profit', label: ES.reports.profit, render: (v: number) => (
      <span className={v > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
        {fmtBs(v ?? 0)}
      </span>
    )},
    { key: 'profitMargin', label: ES.reports.margin, render: (v: number) => `${v?.toFixed(1)}%` },
  ];

  const totalRevenue = profitability?.reduce((sum, s) => sum + s.revenue, 0) || 0;
  const totalMaterialCost = profitability?.reduce((sum, s) => sum + s.materialCost, 0) || 0;
  const totalProfit = profitability?.reduce((sum, s) => sum + s.profit, 0) || 0;
  const totalPayroll = payroll?.reduce((sum, s) => sum + s.totalCommission, 0) || 0;
  const salonProfit = totalRevenue - totalMaterialCost - totalPayroll;

  return (
    <div className="space-y-6 p-6">
      <style>{`
        @media print {
          aside { display: none !important; }
          .no-print { display: none !important; }
          main { padding-top: 0 !important; overflow: visible !important; }
          body { background: white !important; }
        }
      `}</style>
      <Toast notifications={notifications} onDismiss={removeNotification} />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold text-gray-900">{ES.reports.title}</h1>
        <div className="flex gap-2 no-print">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (!profitability || profitability.length === 0) return;
              const headers = ['Servicio', 'Cantidad', 'Ingresos', 'Costo Material', 'Ganancia', 'Margen %'];
              const rows = profitability.map((r) =>
                [r.serviceName, r.count, r.revenue.toFixed(2), r.materialCost.toFixed(2), r.profit.toFixed(2), r.profitMargin.toFixed(1)]
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={ES.reports.startDate}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label={ES.reports.endDate}
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          {startDate > endDate && (
            <p className="text-sm text-orange-600 mt-2">
              Las fechas fueron intercambiadas automáticamente.
            </p>
          )}
        </CardBody>
      </Card>

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardBody>
            <p className="text-gray-600 text-sm font-medium mb-1">{ES.reports.totalRevenue}</p>
            <p className="text-2xl font-bold text-gray-900">{fmtBs(totalRevenue)}</p>
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
            <p className="text-gray-600 text-sm font-medium mb-1">{ES.reports.totalMaterialCost}</p>
            <p className="text-2xl font-bold text-red-600">{fmtBs(totalMaterialCost)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-gray-600 text-sm font-medium mb-1">{ES.reports.salonProfit}</p>
            <p className={`text-2xl font-bold ${salonProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {fmtBs(salonProfit)}
            </p>
          </CardBody>
        </Card>
      </div>

      {/* ==================== PAYROLL SECTION ==================== */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">{ES.reports.payroll}</h2>
          <p className="text-sm text-gray-500 mt-1">{ES.reports.payrollSubtitle}</p>
        </CardHeader>
      </Card>

      {payrollLoading ? (
        <p className="text-center text-gray-500 py-4">{ES.actions.loading}</p>
      ) : !payroll || payroll.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-center text-gray-500 py-4">{ES.reports.noPayrollData}</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {payroll.map((entry) => (
            <PayrollCard key={entry.staffId} entry={entry} onRegisterPayment={setPaymentEntry} isPaid={paidStaffIds.has(entry.staffId)} />
          ))}
        </div>
      )}

      {/* Confirm payroll payment modal */}
      <Modal isOpen={!!paymentEntry} onClose={() => setPaymentEntry(null)} title={ES.reports.registerPayment}>
        {paymentEntry && (
          <div className="space-y-4">
            <p className="text-gray-700">{ES.reports.registerPaymentConfirm}</p>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-sm text-green-700 font-medium">{paymentEntry.staffName}</p>
              <p className="text-3xl font-bold text-green-800 mt-1">{fmtBs(paymentEntry.totalCommission)}</p>
              <p className="text-xs text-green-600 mt-1">{validStartDate} – {validEndDate}</p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" onClick={() => setPaymentEntry(null)}>{ES.actions.cancel}</Button>
              <Button onClick={handleRegisterPayment} loading={paymentLoading}>{ES.reports.registerPayment}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ==================== SERVICE PROFITABILITY ==================== */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">{ES.reports.serviceProfitability}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {ES.app.period}: {validStartDate} — {validEndDate}
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
    </div>
  );
}
