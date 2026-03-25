'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardBody, CardHeader, CardFooter } from '@/components/Card';
import { Table, type TableColumn } from '@/components/Table';
import { Button } from '@/components/Button';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { AnalyticsService } from '@/lib/services/analyticsService';
import { SessionService } from '@/lib/services/sessionService';
import { Session, DailyMetrics } from '@/types/models';

export default function Dashboard() {
  const { userData, loading: authLoading } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const { data: metrics, loading: metricsLoading } = useAsync(async () => {
    if (!userData?.salonId) return null;
    return AnalyticsService.getDailyMetrics(userData.salonId, selectedDate);
  }, [userData?.salonId, selectedDate]);

  const { data: sessions, loading: sessionsLoading } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return SessionService.getSalonDailySessions(userData.salonId, selectedDate);
  }, [userData?.salonId, selectedDate]);

  if (authLoading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  const sessionColumns: TableColumn<Session>[] = [
    { key: 'id', label: 'Session ID', width: '120px' },
    { key: 'clientId', label: 'Client' },
    { key: 'totalAmount', label: 'Amount', render: (v) => `$${v?.toFixed(2)}` },
    { key: 'status', label: 'Status' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome back, {userData?.firstName}!</p>
      </div>

      {/* Date Selector */}
      <Card>
        <CardBody>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          />
        </CardBody>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardBody>
            <p className="text-gray-600 text-sm font-medium mb-2">Total Revenue</p>
            <p className="text-3xl font-bold text-gray-900">
              ${metrics?.totalRevenue.toFixed(2) || '0.00'}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-gray-600 text-sm font-medium mb-2">Sessions</p>
            <p className="text-3xl font-bold text-gray-900">
              {metrics?.totalSessions || 0}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-gray-600 text-sm font-medium mb-2">Clients</p>
            <p className="text-3xl font-bold text-gray-900">
              {metrics?.totalClients || 0}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-gray-600 text-sm font-medium mb-2">Avg. Transaction</p>
            <p className="text-3xl font-bold text-gray-900">
              ${metrics?.averageTransactionValue.toFixed(2) || '0.00'}
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Today's Sessions */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">Today's Sessions</h2>
        </CardHeader>
        <CardBody>
          <Table
            columns={sessionColumns}
            data={sessions || []}
            rowKey="id"
            loading={sessionsLoading}
          />
        </CardBody>
      </Card>

      {/* Top Services */}
      {metrics?.topServices && (
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">Top Services</h2>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {metrics.topServices.map((service) => (
                <div
                  key={service.serviceId}
                  className="flex items-center justify-between border-b border-gray-200 pb-3"
                >
                  <div>
                    <p className="font-medium text-gray-900">{service.serviceName}</p>
                    <p className="text-sm text-gray-600">{service.count} sessions</p>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    ${service.revenue.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Top Staff */}
      {metrics?.topStaff && (
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">Top Staff</h2>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {metrics.topStaff.map((staff) => (
                <div
                  key={staff.staffId}
                  className="flex items-center justify-between border-b border-gray-200 pb-3"
                >
                  <div>
                    <p className="font-medium text-gray-900">{staff.staffName}</p>
                    <p className="text-sm text-gray-600">
                      {staff.sessionsCompleted} sessions
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    ${staff.earnings.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
