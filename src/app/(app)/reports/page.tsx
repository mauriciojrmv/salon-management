'use client';

import React, { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Table, TableColumn } from '@/components/Table';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { AnalyticsService } from '@/lib/services/analyticsService';

export default function ReportsPage() {
  const { userData } = useAuth();
  const [startDate, setStartDate] = useState(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: profitability, loading: profitabilityLoading } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return AnalyticsService.getServiceProfitability(userData.salonId, startDate, endDate);
  }, [userData?.salonId, startDate, endDate]);

  const { data: staffPerformance, loading: staffLoading } = useAsync(async () => {
    if (!userData?.salonId) return [];
    const month = startDate.substring(0, 7);
    return AnalyticsService.getStaffPerformance(userData.salonId, month);
  }, [userData?.salonId, startDate]);

  const profitabilityColumns = [
    { key: 'serviceId', label: 'Service ID' },
    { key: 'count', label: 'Sessions' },
    { key: 'revenue', label: 'Revenue', render: (v: number) => `$${v?.toFixed(2)}` },
    { key: 'materialCost', label: 'Material Cost', render: (v: number) => `$${v?.toFixed(2)}` },
    { key: 'profit', label: 'Profit', render: (v: number) => `$${v?.toFixed(2)}` },
    { key: 'profitMargin', label: 'Margin %', render: (v: number) => `${v?.toFixed(1)}%` },
  ];

  const staffColumns = [
    { key: 'staffId', label: 'Staff ID' },
    { key: 'servicesCompleted', label: 'Services' },
    { key: 'revenue', label: 'Revenue', render: (v: number) => `$${v?.toFixed(2)}` },
    { key: 'earnings', label: 'Earnings', render: (v: number) => `$${v?.toFixed(2)}` },
  ];

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>

      {/* Date Filter */}
      <Card>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <Button variant="secondary" size="sm">
              Apply Filter
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Service Profitability */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">Service Profitability</h2>
          <p className="text-sm text-gray-600 mt-1">
            Period: {startDate} to {endDate}
          </p>
        </CardHeader>
        <CardBody>
          <Table
            columns={profitabilityColumns}
            data={profitability || []}
            rowKey="serviceId"
            loading={profitabilityLoading}
            emptyMessage="No data for selected period"
          />
        </CardBody>
      </Card>

      {/* Staff Performance */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">Staff Performance</h2>
        </CardHeader>
        <CardBody>
          <Table
            columns={staffColumns}
            data={staffPerformance || []}
            rowKey="staffId"
            loading={staffLoading}
            emptyMessage="No staff performance data"
          />
        </CardBody>
      </Card>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardBody>
            <p className="text-gray-600 text-sm font-medium mb-2">Total Revenue</p>
            <p className="text-3xl font-bold text-gray-900">
              ${profitability?.reduce((sum, s) => sum + s.revenue, 0).toFixed(2) || '0.00'}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-gray-600 text-sm font-medium mb-2">Total Material Cost</p>
            <p className="text-3xl font-bold text-gray-900">
              ${profitability?.reduce((sum, s) => sum + s.materialCost, 0).toFixed(2) || '0.00'}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-gray-600 text-sm font-medium mb-2">Total Profit</p>
            <p className="text-3xl font-bold text-green-600">
              ${profitability?.reduce((sum, s) => sum + s.profit, 0).toFixed(2) || '0.00'}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-gray-600 text-sm font-medium mb-2">Avg Profit Margin</p>
            <p className="text-3xl font-bold text-gray-900">
              {profitability && profitability.length > 0
                ? (profitability.reduce((sum, s) => sum + s.profitMargin, 0) /
                    profitability.length).toFixed(1)
                : '0'}
              %
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Staff Earnings */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">Total Staff Earnings</h2>
        </CardHeader>
        <CardBody>
          <p className="text-3xl font-bold text-gray-900">
            ${staffPerformance?.reduce((sum, s) => sum + s.earnings, 0).toFixed(2) || '0.00'}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
