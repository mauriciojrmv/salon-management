'use client';

import React, { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { Toast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useNotification } from '@/hooks/useNotification';
import { Button } from '@/components/Button';
import { AnalyticsService, PayrollStaffEntry } from '@/lib/services/analyticsService';
import { ExpenseRepository } from '@/lib/repositories/expenseRepository';
import { PayrollPaymentRepository, PayrollPaymentRecord } from '@/lib/repositories/payrollPaymentRepository';
import { StaffRepository } from '@/lib/repositories/staffRepository';
import ES from '@/config/text.es';
import { fmtBs, fmtDate, getBoliviaDate, whatsappUrl, toDate } from '@/lib/utils/helpers';

function PayrollCard({ entry, onRegisterPayment }: { entry: PayrollStaffEntry; onRegisterPayment: (entry: PayrollStaffEntry) => void }) {
  const isPaid = entry.totalCommission <= 0;
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardBody>
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

        <div className="mt-3 flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex-1 py-2 text-sm text-blue-600 font-medium hover:bg-blue-50 rounded-lg transition-colors"
          >
            {expanded ? ES.reports.collapseDetail : ES.reports.expandDetail} ({entry.details.length})
          </button>
          {entry.staffPhone && (
            <button
              type="button"
              onClick={() => {
                const lines = entry.details
                  .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
                  .map((d) => `${fmtDate(d.date)} ${d.time} · ${d.serviceName} · ${d.clientName} · ${fmtBs(d.commission)}`);
                const msg = `📋 *Resumen de pagos — ${entry.staffName}*\n\n${lines.join('\n')}\n\n*Total: ${fmtBs(entry.totalCommission)}*`;
                window.open(whatsappUrl(entry.staffPhone, msg), '_blank');
              }}
              className="py-2 px-3 text-sm text-green-600 font-medium hover:bg-green-50 rounded-lg transition-colors"
            >
              📲 WhatsApp
            </button>
          )}
          {isPaid ? (
            <span className="flex-1 py-2 text-sm text-center text-green-700 bg-green-50 rounded-lg font-semibold">{ES.reports.paid}</span>
          ) : (
            <Button size="sm" variant="primary" onClick={() => onRegisterPayment(entry)}>
              {ES.reports.registerPayment}
            </Button>
          )}
        </div>

        {expanded && (
          <div className="mt-3 border-t border-gray-200 pt-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="pb-2 pr-3">{ES.reports.date}</th>
                    <th className="pb-2 pr-3">{ES.appointments.time}</th>
                    <th className="pb-2 pr-3">{ES.reports.client}</th>
                    <th className="pb-2 pr-3">{ES.reports.service}</th>
                    <th className="pb-2 pr-3 text-right">{ES.reports.price}</th>
                    <th className="pb-2 pr-3 text-right">{ES.reports.materials}</th>
                    <th className="pb-2 text-right">{ES.reports.commission}</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.details
                    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
                    .map((d, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="py-2 pr-3 text-gray-600">{fmtDate(d.date)}</td>
                      <td className="py-2 pr-3 text-gray-500">{d.time}</td>
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
                    <td colSpan={4} className="py-2 text-gray-900">{ES.payments.total}</td>
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

export default function PagosPage() {
  const { userData } = useAuth();
  const { notifications, removeNotification, success, error } = useNotification();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
  });
  const [endDate, setEndDate] = useState(() => getBoliviaDate());
  const [paymentEntry, setPaymentEntry] = useState<PayrollStaffEntry | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [payrollRefreshKey, setPayrollRefreshKey] = useState(0);

  const validStartDate = startDate <= endDate ? startDate : endDate;
  const validEndDate = startDate <= endDate ? endDate : startDate;

  const { data: payroll, loading: payrollLoading } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return AnalyticsService.getStaffPayroll(userData.salonId, validStartDate, validEndDate);
  }, [userData?.salonId, validStartDate, validEndDate, payrollRefreshKey]);

  const totalPayroll = payroll?.reduce((sum, s) => sum + s.totalCommission, 0) || 0;

  // Payment history
  const { data: paymentHistory, loading: historyLoading } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return PayrollPaymentRepository.getSalonPayments(userData.salonId);
  }, [userData?.salonId, payrollRefreshKey]);

  // Staff phone lookup for WA sharing on history items
  const { data: staffList } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return StaffRepository.getSalonStaff(userData.salonId);
  }, [userData?.salonId]);

  const getStaffPhone = (staffId: string) => {
    const s = staffList?.find((x) => x.id === staffId);
    return s?.phone || '';
  };

  const handleRegisterPayment = async () => {
    if (!paymentEntry || !userData?.salonId) return;
    setPaymentLoading(true);
    try {
      const expenseId = await ExpenseRepository.createExpense({
        salonId: userData.salonId,
        category: 'salaries',
        description: `${ES.reports.payrollPayment}: ${paymentEntry.staffName} (${validStartDate} – ${validEndDate})`,
        amount: paymentEntry.totalCommission,
        date: getBoliviaDate(),
        recurring: false,
        paidTo: paymentEntry.staffName,
        paymentMethod: 'cash',
        createdBy: userData.id || '',
      });
      await PayrollPaymentRepository.createPayment({
        salonId: userData.salonId,
        staffId: paymentEntry.staffId,
        staffName: paymentEntry.staffName,
        amount: paymentEntry.totalCommission,
        periodStart: validStartDate,
        periodEnd: validEndDate,
        paidSessionServiceIds: paymentEntry.unpaidSessionServiceIds,
        paidBy: userData.id || '',
        expenseId,
      });
      success(ES.reports.paymentRegistered);
      setPaymentEntry(null);
      setPayrollRefreshKey((k) => k + 1);
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Toast notifications={notifications} onDismiss={removeNotification} />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold text-gray-900">{ES.nav.pagos}</h1>
      </div>

      <Card>
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

      <Card>
        <CardBody>
          <p className="text-gray-600 text-sm font-medium mb-1">{ES.reports.totalPayroll}</p>
          <p className="text-3xl font-bold text-orange-600">{fmtBs(totalPayroll)}</p>
        </CardBody>
      </Card>

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
            <PayrollCard key={entry.staffId} entry={entry} onRegisterPayment={setPaymentEntry} />
          ))}
        </div>
      )}

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

      {/* Payment History */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">{ES.reports.paymentHistory}</h2>
          <p className="text-sm text-gray-500 mt-1">{ES.reports.paymentHistorySubtitle}</p>
        </CardHeader>
      </Card>

      {historyLoading ? (
        <p className="text-center text-gray-500 py-4">{ES.actions.loading}</p>
      ) : !paymentHistory || paymentHistory.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-center text-gray-500 py-4">{ES.reports.noPaymentHistory}</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {paymentHistory.map((payment: PayrollPaymentRecord) => {
            const phone = getStaffPhone(payment.staffId);
            const paidDate = (() => {
              try { return toDate(payment.paidAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/La_Paz' }); }
              catch { return '-'; }
            })();
            const serviceCount = (payment.paidSessionServiceIds || []).length;
            return (
              <Card key={payment.id}>
                <CardBody>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{payment.staffName}</p>
                      <p className="text-sm text-gray-500">
                        {ES.reports.paidOn} {paidDate} · {serviceCount} {ES.reports.servicesIncluded}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {ES.reports.periodLabel}: {fmtDate(payment.periodStart)} – {fmtDate(payment.periodEnd)}
                      </p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <p className="text-xl font-bold text-green-600">{fmtBs(payment.amount)}</p>
                      {phone && (
                        <button
                          type="button"
                          onClick={() => {
                            const msg = `✅ *Comprobante de Pago*\n\n*Trabajador:* ${payment.staffName}\n*Monto:* ${fmtBs(payment.amount)}\n*Período:* ${fmtDate(payment.periodStart)} – ${fmtDate(payment.periodEnd)}\n*Servicios:* ${serviceCount}\n*Fecha de pago:* ${paidDate}\n\n_Pago registrado en sistema._`;
                            window.open(whatsappUrl(phone, msg), '_blank');
                          }}
                          className="text-xs px-3 py-1.5 text-green-600 font-medium hover:bg-green-50 rounded-lg transition-colors"
                        >
                          📲 {ES.reports.shareReceipt}
                        </button>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
