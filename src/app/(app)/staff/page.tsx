'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { Modal } from '@/components/Modal';
import { Table, TableColumn } from '@/components/Table';
import { Toast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useNotification } from '@/hooks/useNotification';
import { StaffRepository } from '@/lib/repositories/staffRepository';
import { ServiceRepository } from '@/lib/repositories/serviceRepository';
import { SessionRepository } from '@/lib/repositories/sessionRepository';
import { Staff } from '@/types/models';
import ES from '@/config/text.es';

const specialtyOptions = [
  { value: 'stylist', label: ES.staff.stylist },
  { value: 'colorist', label: ES.staff.colorist },
  { value: 'nail_tech', label: ES.staff.nailTech },
  { value: 'aesthetician', label: ES.staff.aesthetician },
  { value: 'barber', label: ES.staff.barber },
  { value: 'masseur', label: ES.staff.masseur },
  { value: 'makeup_artist', label: ES.staff.makeupArtist },
  { value: 'eyebrow_specialist', label: ES.staff.eyebrowSpecialist },
  { value: 'lash_specialist', label: ES.staff.lashSpecialist },
  { value: 'waxing_specialist', label: ES.staff.waxingSpecialist },
  { value: 'spa_therapist', label: ES.staff.spaTherapist },
  { value: 'hair_treatment_specialist', label: ES.staff.hairTreatmentSpecialist },
  { value: 'assistant', label: ES.staff.assistant },
  { value: 'multi_service', label: ES.staff.multiService },
];

const specialtyLabels: Record<string, string> = {
  stylist: ES.staff.stylist,
  colorist: ES.staff.colorist,
  nail_tech: ES.staff.nailTech,
  aesthetician: ES.staff.aesthetician,
  barber: ES.staff.barber,
  masseur: ES.staff.masseur,
  makeup_artist: ES.staff.makeupArtist,
  eyebrow_specialist: ES.staff.eyebrowSpecialist,
  lash_specialist: ES.staff.lashSpecialist,
  waxing_specialist: ES.staff.waxingSpecialist,
  spa_therapist: ES.staff.spaTherapist,
  hair_treatment_specialist: ES.staff.hairTreatmentSpecialist,
  assistant: ES.staff.assistant,
  multi_service: ES.staff.multiService,
};

export default function StaffPage() {
  const { userData } = useAuth();
  const { notifications, removeNotification, success, error } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    specialty: 'stylist',
    serviceIds: [] as string[],
    commissionType: 'percentage' as 'percentage' | 'fixed',
    commissionValue: 20,
  });

  const { data: staffData, loading: staffLoading, refetch } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return StaffRepository.getSalonStaff(userData.salonId);
  }, [userData?.salonId]);

  const { data: servicesData } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ServiceRepository.getSalonServices(userData.salonId);
  }, [userData?.salonId]);

  const staff = staffData || [];
  const services = servicesData || [];

  const [searchQuery, setSearchQuery] = useState('');
  const filteredStaff = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((s) =>
      s.firstName.toLowerCase().includes(q) ||
      (s.lastName || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.phone || '').includes(q),
    );
  }, [staff, searchQuery]);

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      specialty: 'stylist',
      serviceIds: [],
      commissionType: 'percentage',
      commissionValue: 20,
    });
    setEditingStaff(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (member: Staff) => {
    setEditingStaff(member);
    const extMember = member as Staff & { specialty?: string; serviceIds?: string[] };
    setFormData({
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      phone: member.phone || '',
      specialty: extMember.specialty || 'stylist',
      serviceIds: extMember.serviceIds || [],
      commissionType: member.commissionConfig?.type || 'percentage',
      commissionValue: member.commissionConfig?.value || 20,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSaveStaff = async () => {
    if (!formData.firstName || !formData.email || !userData?.salonId) {
      error(ES.messages.fillRequiredFields);
      return;
    }

    setLoading(true);
    try {
      const staffPayload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        specialty: formData.specialty,
        serviceIds: formData.serviceIds,
        commissionConfig: {
          type: formData.commissionType,
          value: formData.commissionValue,
        },
      };

      if (editingStaff) {
        await StaffRepository.updateStaff(editingStaff.id, staffPayload as Partial<Staff>);
        success(ES.staff.updated);
      } else {
        await StaffRepository.createStaff(userData.salonId, {
          ...staffPayload,
          commissionType: formData.commissionType,
          commissionValue: formData.commissionValue,
          skills: [],
        });
        success(ES.actions.success);
      }
      closeModal();
      refetch();
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStaff = async (id: string) => {
    try {
      // Check if staff has any sessions before deleting
      if (userData?.salonId) {
        const allSessions = await SessionRepository.getSalonSessions(userData.salonId);
        const hasWork = allSessions.some((s) =>
          (s.services || []).some((svc) => svc.assignedStaff?.includes(id))
        );
        if (hasWork) {
          error(ES.staff.cannotDeleteHasWork);
          setConfirmDeleteId(null);
          return;
        }
      }
      await StaffRepository.deleteStaff(id);
      success(ES.staff.deleted);
      setConfirmDeleteId(null);
      refetch();
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    }
  };

  // Resolve service names for display
  const getServiceNames = (item: Staff) => {
    const ids = (item as Staff & { serviceIds?: string[] }).serviceIds || [];
    if (ids.length === 0) return '-';
    const names = ids
      .map((id) => services.find((s) => s.id === id)?.name)
      .filter(Boolean);
    if (names.length === 0) return '-';
    if (names.length <= 2) return names.join(', ');
    return `${names[0]}, ${names[1]} +${names.length - 2}`;
  };

  const staffColumns: TableColumn<Staff>[] = [
    {
      key: 'firstName',
      label: ES.staff.name,
      render: (_v, item) => `${item.firstName} ${item.lastName}`,
    },
    {
      key: 'email' as keyof Staff,
      label: ES.staff.specialty,
      render: (_v, item) => specialtyLabels[(item as Staff & { specialty?: string }).specialty || ''] || '-',
    },
    {
      key: 'phone' as keyof Staff,
      label: ES.staff.servicesOffered,
      render: (_v, item) => getServiceNames(item),
    },
    {
      key: 'commissionConfig',
      label: ES.staff.commission,
      render: (v) =>
        v ? `${v.type === 'percentage' ? v.value + '%' : '$' + v.value}` : '-',
    },
    {
      key: 'id',
      label: '',
      render: (_v, item) => (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              openEditModal(item);
            }}
          >
            {ES.actions.edit}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              setConfirmDeleteId(item.id);
            }}
          >
            {ES.actions.delete}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <Toast notifications={notifications} onDismiss={removeNotification} />
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{ES.staff.title}</h1>
        <Button onClick={openCreateModal} size="lg">
          {ES.staff.add}
        </Button>
      </div>

      {/* Staff Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900 shrink-0">
              {ES.staff.teamMembers}
            </h2>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={ES.staff.search}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </CardHeader>
        <CardBody>
          <Table
            columns={staffColumns}
            data={filteredStaff}
            rowKey="id"
            loading={staffLoading}
            emptyMessage={ES.staff.noStaff}
          />
        </CardBody>
      </Card>

      {/* Add/Edit Staff Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingStaff ? ES.staff.editStaff : ES.staff.add}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={ES.auth.firstName}
              value={formData.firstName}
              onChange={(e) =>
                setFormData({ ...formData, firstName: e.target.value })
              }
              required
              maxLength={30}
            />
            <Input
              label={ES.staff.lastName}
              value={formData.lastName}
              onChange={(e) =>
                setFormData({ ...formData, lastName: e.target.value })
              }
              required
              maxLength={30}
            />
          </div>
          <Input
            label={ES.staff.email}
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            required
            maxLength={50}
          />
          <Input
            label={ES.staff.phone}
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
            required
            maxLength={10}
          />

          <Select
            label={ES.staff.specialty}
            value={formData.specialty}
            onChange={(e) =>
              setFormData({ ...formData, specialty: e.target.value })
            }
            options={specialtyOptions}
            required
          />

          {/* Multi-service selection: what can this person do? */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ES.staff.servicesOffered}
            </label>
            {services.length === 0 ? (
              <p className="text-sm text-gray-500">{ES.staff.addServicesFirst}</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {services.map((svc) => (
                  <label
                    key={svc.id}
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formData.serviceIds.includes(svc.id)}
                      onChange={(e) => {
                        const ids = e.target.checked
                          ? [...formData.serviceIds, svc.id]
                          : formData.serviceIds.filter((id) => id !== svc.id);
                        setFormData({ ...formData, serviceIds: ids });
                      }}
                      className="rounded"
                    />
                    <span className="text-sm font-medium">{svc.name}</span>
                    <span className="text-xs text-gray-500 ml-auto">
                      ${svc.price} · {svc.duration}min
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

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
            min={0}
            max={formData.commissionType === 'percentage' ? 100 : undefined}
          />

          <div className="flex gap-2">
            <Button variant="secondary" onClick={closeModal}>
              {ES.actions.cancel}
            </Button>
            <Button onClick={handleSaveStaff} loading={loading}>
              {editingStaff ? ES.actions.save : ES.staff.add}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        title={ES.staff.deleteConfirm}
      >
        <div className="space-y-4">
          <p className="text-gray-700">Esta acción no se puede deshacer.</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setConfirmDeleteId(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => confirmDeleteId && handleDeleteStaff(confirmDeleteId)}>
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
