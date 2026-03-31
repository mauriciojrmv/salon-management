'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardBody } from '@/components/Card';
import { Toast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useRealtime } from '@/hooks/useRealtime';
import { useNotification } from '@/hooks/useNotification';
import { firebaseConstraints } from '@/lib/firebase/db';
import type { Session } from '@/types/models';
import { fmtBs, getBoliviaDate } from '@/lib/utils/helpers';
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

  const sessionConstraints = useMemo(() => [
    firebaseConstraints.where('salonId', '==', userData?.salonId || ''),
    firebaseConstraints.where('date', '==', selectedDate),
  ], [userData?.salonId, selectedDate]);
  const { data: sessions } = useRealtime<Session>('sessions', sessionConstraints, !!userData?.salonId);

  const myCompletedServices = useMemo(() => {
    const result: { serviceName: string; price: number; materialCost: number; commission: number }[] = [];
    (sessions || []).forEach((session) => {
      (session.services || []).forEach((svc) => {
        if (svc.assignedStaff?.includes(staffId) && svc.status === 'completed') {
          const materialCost = (svc.materialsUsed || []).reduce((s, m) => s + (m.cost || 0), 0);
          const commission = Math.max(0, (svc.price - materialCost) * (svc.commissionRate / 100));
          result.push({ serviceName: svc.serviceName, price: svc.price, materialCost, commission });
        }
      });
    });
    return result;
  }, [sessions, staffId]);

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
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1"
        />
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
            <p className="text-center text-gray-400 py-6 text-sm">{ES.staff.noEarningsToday}</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-2">
          {myCompletedServices.map((s, i) => (
            <Card key={i}>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{s.serviceName}</p>
                    <p className="text-xs text-gray-400">
                      {fmtBs(s.price)} - {fmtBs(s.materialCost)} {ES.reports.materialDeduction.toLowerCase()}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-green-600">{fmtBs(s.commission)}</p>
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
    </div>
  );
}
