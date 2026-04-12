'use client';

import React, { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Input } from '@/components/Input';
import { Table } from '@/components/Table';
import { Toast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useNotification } from '@/hooks/useNotification';
import { Button } from '@/components/Button';
import { AnalyticsService } from '@/lib/services/analyticsService';
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

  const { data: payroll } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return AnalyticsService.getStaffPayroll(userData.salonId, validStartDate, validEndDate);
  }, [userData?.salonId, validStartDate, validEndDate]);

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
  const salonProfit = totalRevenue - totalMaterialCost - totalPayroll;
  const avgTicket = totalSessions > 0 ? totalRevenue / totalSessions : 0;

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

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <p className="text-gray-600 text-sm font-medium mb-1">{ES.reports.totalRevenue}</p>
            <p className="text-2xl font-bold text-gray-900">{fmtBs(totalRevenue)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-gray-600 text-sm font-medium mb-1">{ES.reports.sessionsCount}</p>
            <p className="text-2xl font-bold text-gray-900">{totalSessions}</p>
            <p className="text-xs text-gray-500 mt-0.5">{ES.dashboard.avgTransaction}: {fmtBs(avgTicket)}</p>
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
      </div>

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
