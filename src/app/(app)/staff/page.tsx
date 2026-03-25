'use client';

import React, { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { Modal } from '@/components/Modal';
import { Table, TableColumn } from '@/components/Table';
import { useAuth } from '@/hooks/useAuth';
import { useNotification } from '@/hooks/useNotification';
import { Staff } from '@/types/models';

export default function StaffPage() {
  const { userData } = useAuth();
  const { success, error } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [staffList, setStaffList] = useState<Staff[]>([]); // Mock data
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    skills: [] as string[],
    commissionType: 'percentage' as const,
    commissionValue: 20,
  });

  const handleCreateStaff = async () => {
    if (!formData.firstName || !formData.email) {
      error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      // TODO: Integrate with Firebase
      success('Staff member added successfully');
      setIsModalOpen(false);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        skills: [],
        commissionType: 'percentage',
        commissionValue: 20,
      });
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to add staff member');
    } finally {
      setLoading(false);
    }
  };

  const staffColumns: TableColumn<Staff>[] = [
    { key: 'firstName', label: 'Name', render: (v, item) => `${item.firstName} ${item.lastName}` },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    {
      key: 'commissionConfig',
      label: 'Commission',
      render: (v) => `${v?.type === 'percentage' ? v.value + '%' : '$' + v?.value}`,
    },
    { key: 'totalEarnings', label: 'Earnings', render: (v) => `$${v?.toFixed(2)}` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Staff Management</h1>
        <Button onClick={() => setIsModalOpen(true)} size="lg">
          + Add Staff
        </Button>
      </div>

      {/* Staff Table */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">Team Members</h2>
        </CardHeader>
        <CardBody>
          <Table
            columns={staffColumns}
            data={staffList}
            rowKey="id"
            emptyMessage="No staff members yet"
          />
        </CardBody>
      </Card>

      {/* Add Staff Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Staff Member"
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="First Name"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            required
          />
          <Input
            label="Last Name"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
          <Input
            label="Phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Commission Type
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
                <span>Percentage</span>
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
                <span>Fixed Amount</span>
              </label>
            </div>
          </div>

          <Input
            label={formData.commissionType === 'percentage' ? 'Commission %' : 'Commission Amount'}
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
              Cancel
            </Button>
            <Button onClick={handleCreateStaff} loading={loading}>
              Add Staff
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
