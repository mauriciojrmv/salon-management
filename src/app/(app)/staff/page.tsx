'use client';

import React, { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { Table, TableColumn } from '@/components/Table';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useNotification } from '@/hooks/useNotification';
import { StaffRepository } from '@/lib/repositories/staffRepository';
import { Staff } from '@/types/models';
import ES from '@/config/text.es';

export default function StaffPage() {
  const { userData } = useAuth();
  const { success, error } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    commissionType: 'percentage' as 'percentage' | 'fixed',
    commissionValue: 20,
  });

  const { data: staffData, loading: staffLoading, refetch } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return StaffRepository.getSalonStaff(userData.salonId);
  }, [userData?.salonId]);

  const staff = staffData || [];

  const handleCreateStaff = async () => {
    if (!formData.firstName || !formData.email || !userData?.salonId) {
      error(ES.messages.fillRequiredFields);
      return;
    }

    setLoading(true);
    try {
      await StaffRepository.createStaff(userData.salonId, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        commissionType: formData.commissionType,
        commissionValue: formData.commissionValue,
        skills: [],
      });
      success(ES.actions.success);
      setIsModalOpen(false);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        commissionType: 'percentage',
        commissionValue: 20,
      });
      refetch();
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to add staff member');
    } finally {
      setLoading(false);
    }
  };

  const staffColumns: TableColumn<Staff>[] = [
    {
      key: 'firstName',
      label: ES.staff.name,
      render: (v, item) => `${item.firstName} ${item.lastName}`
    },
    { key: 'email', label: ES.staff.email },
    { key: 'phone', label: ES.staff.phone },
    {
      key: 'commissionConfig',
      label: ES.staff.commission,
      render: (v) => v ? `${v.type === 'percentage' ? v.value + '%' : '$' + v.value}` : '-',
    },
    {
      key: 'totalEarnings',
      label: ES.dashboard.myEarnings,
      render: (v) => `$${v?.toFixed(2) || '0.00'}`
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{ES.staff.title}</h1>
        <Button onClick={() => setIsModalOpen(true)} size="lg">
          {ES.staff.add}
        </Button>
      </div>

      {/* Staff Table */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">{ES.staff.teamMembers}</h2>
        </CardHeader>
        <CardBody>
          <Table
            columns={staffColumns}
            data={staff}
            rowKey="id"
            loading={staffLoading}
            emptyMessage={ES.staff.noStaff}
          />
        </CardBody>
      </Card>

      {/* Add Staff Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={ES.staff.add}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label={ES.staff.name}
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            required
          />
          <Input
            label={ES.staff.name}
            placeholder={ES.staff.name}
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            required
          />
          <Input
            label={ES.staff.email}
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
          <Input
            label={ES.staff.phone}
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ES.staff.commission}
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={formData.commissionType === 'percentage'}
                  onChange={() =>
                    setFormData({
                      ...formData,
                      commissionType: 'percentage',
                      commissionValue: 20,
                    })
                  }
                  className="mr-2"
                />
                <span>{ES.staff.percentage}</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={formData.commissionType === 'fixed'}
                  onChange={() =>
                    setFormData({
                      ...formData,
                      commissionType: 'fixed',
                      commissionValue: 0,
                    })
                  }
                  className="mr-2"
                />
                <span>{ES.staff.fixed}</span>
              </label>
            </div>
          </div>

          <Input
            label={`${ES.staff.commission} ${formData.commissionType === 'percentage' ? '%' : '$'}`}
            type="number"
            value={formData.commissionValue}
            onChange={(e) =>
              setFormData({
                ...formData,
                commissionValue: parseFloat(e.target.value),
              })
            }
            required
          />

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              {ES.actions.cancel}
            </Button>
            <Button onClick={handleCreateStaff} loading={loading}>
              {ES.staff.add}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
