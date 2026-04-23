'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardBody } from '@/components/Card';
import { Toast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useRealtime } from '@/hooks/useRealtime';
import { useAsync } from '@/hooks/useAsync';
import { useNotification } from '@/hooks/useNotification';
import { firebaseConstraints } from '@/lib/firebase/db';
import { ProductRepository } from '@/lib/repositories/productRepository';
import { PayrollPaymentRepository, PayrollPaymentRecord } from '@/lib/repositories/payrollPaymentRepository';
import type { Session } from '@/types/models';
import { fmtBs, fmtDate, getBoliviaDate, toDate } from '@/lib/utils/helpers';
import ES from '@/config/text.es';

export default function MyEarningsPage() {
  const { user, userData } = useAuth();
  const { notifications, removeNotification } = useNotification();

  const staffId = user?.uid || '';
  const today = useMemo(() => getBoliviaDate(), []);
  const yesterday = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
  }, []);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [historyLimit, setHistoryLimit] = useState(5);

  const sessionConstraints = useMemo(() => [
    firebaseConstraints.where('salonId', '==', userData?.salonId || ''),
    firebaseConstraints.where('date', '==', selectedDate),
  ], [userData?.salonId, selectedDate]);
  const { data: sessions } = useRealtime<Session>('sessions', sessionConstraints, !!userData?.salonId, [userData?.salonId, selectedDate]);
  const { data: allProducts } = useAsync(
    () => userData?.salonId ? ProductRepository.getSalonProducts(userData.salonId) : Promise.resolve([]),
    [userData?.salonId]
  );
  const { data: allPayments, loading: paymentsLoading } = useAsync(
    () => userData?.salonId ? PayrollPaymentRepository.getSalonPayments(userData.salonId) : Promise.resolve([]),
    [userData?.salonId]
  );

  const myPayments = useMemo(() => {
    return (allPayments || []).filter((p) => p.staffId === staffId);
  }, [allPayments, staffId]);

  const totalReceived = useMemo(() => myPayments.reduce((sum, p) => sum + p.amount, 0), [myPayments]);
  const visiblePayments = myPayments.slice(0, historyLimit);
  const hasMorePayments = myPayments.length > historyLimit;

  const productCostMap = useMemo(() => {
    const map: Record<string, number> = {};
    (allProducts || []).forEach((p) => { map[p.id] = p.cost; });
    return map;
  }, [allProducts]);

  const myCompletedServices = useMemo(() => {
    const result: { serviceName: string; price: number; materialCost: number; commission: number; rate: number }[] = [];
    (sessions || []).forEach((session) => {
      // Cancelled sessions are voided work — never count toward earnings even
      // if the individual service was marked completed before the cancellation.
      if (session.status === 'cancelled') return;
      (session.services || []).forEach((svc) => {
        if (svc.assignedStaff?.includes(staffId) && svc.status === 'completed') {
          const materialCost = (svc.materialsUsed || []).reduce((s, m) => s + (productCostMap[m.productId] ?? 0) * m.quantity, 0);
          const rate = svc.commissionRate || 50;
          const commission = Math.max(0, (svc.price - materialCost) * (rate / 100));
          result.push({ serviceName: svc.serviceName, price: svc.price, materialCost, commission, rate });
        }
      });
    });
    return result;
  }, [sessions, staffId, productCostMap]);

  const totals = myCompletedServices.reduce(
    (acc, s) => ({ revenue: acc.revenue + s.price, commission: acc.commission + s.commission }),
    { revenue: 0, commission: 0 }
  );

  return (
    <div className="space-y-6 p-4 max-w-lg mx-auto">
      <Toast notifications={notifications} onDismiss={removeNotification} />
      <div className="pt-2">
        <h1 className="text-2xl font-bold text-gray-900">{ES.nav.myEarnings}</h1>
        <p className="text-sm text-gray-500 mt-1">{userData?.firstName}</p>
      </div>

      {/* Date selector */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSelectedDate(today)}
            className={`flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] text-sm border rounded-lg font-medium whitespace-nowrap transition-colors ${
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
            className={`flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] text-sm border rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedDate === yesterday
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
            }`}
          >
            Ayer
          </button>
        </div>
        <div className="flex flex-col flex-1">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg text-sm w-full"
          />
          <span className="text-[10px] text-gray-500 mt-0.5">{fmtDate(selectedDate)}</span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardBody>
            <p className="text-xs text-gray-500 mb-1">{ES.staff.myCompletedToday}</p>
            <p className="text-2xl font-bold text-gray-900">{myCompletedServices.length}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-gray-500 mb-1">{ES.staff.myCommissionToday}</p>
            <p className="text-2xl font-bold text-green-600">{fmtBs(totals.commission)}</p>
          </CardBody>
        </Card>
      </div>

      {/* Per-service breakdown */}
      {myCompletedServices.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-center text-gray-500 py-6 text-sm">{ES.staff.noEarningsToday}</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-2">
          {myCompletedServices.map((s, i) => (
            <Card key={i}>
              <CardBody>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 text-sm">{s.serviceName}</p>
                    <p className="text-xs text-gray-500">
                      ({fmtBs(s.price)} - {fmtBs(s.materialCost)} mat.) &times; {s.rate}% = {fmtBs(s.commission)}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-green-600 shrink-0">{fmtBs(s.commission)}</p>
                </div>
              </CardBody>
            </Card>
          ))}

          {/* Total row */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
            <p className="font-semibold text-green-800">{ES.payments.total}</p>
            <p className="text-xl font-bold text-green-700">{fmtBs(totals.commission)}</p>
          </div>
        </div>
      )}

      {/* Payment history received from admin/gerente */}
      <div className="pt-2">
        <div className="flex items-end justify-between mb-3 gap-2">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{ES.reports.paymentHistory}</h2>
            {myPayments.length > 0 && (
              <p className="text-xs text-gray-500">{myPayments.length} {myPayments.length === 1 ? 'pago' : 'pagos'}</p>
            )}
          </div>
          {totalReceived > 0 && (
            <div className="text-right">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">{ES.reports.totalPaid}</p>
              <p className="text-lg font-bold text-green-700">{fmtBs(totalReceived)}</p>
            </div>
          )}
        </div>

        {paymentsLoading ? (
          <Card>
            <CardBody>
              <p className="text-center text-gray-500 py-4 text-sm">{ES.actions.loading}</p>
            </CardBody>
          </Card>
        ) : myPayments.length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-center text-gray-500 py-6 text-sm">{ES.reports.noPaymentHistory}</p>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-2">
            {visiblePayments.map((payment: PayrollPaymentRecord) => {
              const paidDate = (() => {
                try { return toDate(payment.paidAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/La_Paz' }); }
                catch { return '-'; }
              })();
              const serviceCount = (payment.paidSessionServiceIds || []).length;
              return (
                <Card key={payment.id}>
                  <CardBody>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900">{ES.reports.paidOn} {paidDate}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {ES.reports.periodLabel}: {fmtDate(payment.periodStart)} – {fmtDate(payment.periodEnd)}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {serviceCount} {ES.reports.servicesIncluded}
                        </p>
                      </div>
                      <p className="text-lg font-bold text-green-600 shrink-0">{fmtBs(payment.amount)}</p>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
            {hasMorePayments && (
              <button
                type="button"
                onClick={() => setHistoryLimit((l) => l + 5)}
                className="w-full py-3 min-h-[44px] text-sm text-blue-600 font-medium hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
              >
                {ES.reports.showMore} ({myPayments.length - historyLimit} más)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
