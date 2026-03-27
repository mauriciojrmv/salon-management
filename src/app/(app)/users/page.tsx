'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { Modal } from '@/components/Modal';
import { Alert } from '@/components/Alert';
import { Toast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useNotification } from '@/hooks/useNotification';
import { createUserWithoutSignIn, createUserDocument } from '@/lib/firebase/auth';
import { queryDocuments, updateDocument, firebaseConstraints } from '@/lib/firebase/db';
import type { User } from '@/types/models';
import ES from '@/config/text.es';

interface NewUserForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  role: 'admin' | 'manager' | 'staff';
}

const emptyForm: NewUserForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  role: 'staff',
};

export default function UsersPage() {
  const { user, userData } = useAuth();
  const { notifications, removeNotification, success, error } = useNotification();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<NewUserForm>(emptyForm);

  // Only admins can access this page
  const isAdmin = userData?.role === 'admin';

  useEffect(() => {
    if (userData?.salonId) {
      loadUsers();
    }
  }, [userData?.salonId]);

  const loadUsers = async () => {
    if (!userData?.salonId) return;
    setLoading(true);
    try {
      const docs = await queryDocuments('users', [
        firebaseConstraints.where('salonId', '==', userData.salonId),
      ]);
      setUsers(docs as unknown as User[]);
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      error(ES.users.passwordMismatch);
      return;
    }
    if (formData.password.length < 6) {
      error(ES.users.passwordMinLength);
      return;
    }

    if (!formData.email || !formData.firstName) {
      error(ES.messages.fillRequiredFields);
      return;
    }

    setCreating(true);

    try {
      // Step 1: Create Firebase Auth account via secondary app (doesn't affect admin session)
      console.log('Step 1: Creating auth account for', formData.email);
      const newUser = await createUserWithoutSignIn(formData.email, formData.password);
      console.log('Step 1 done: Auth user created', newUser.uid);

      // Step 2: Create Firestore user document
      console.log('Step 2: Creating Firestore document');
      await createUserDocument(newUser.uid, {
        id: newUser.uid,
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName || '',
        phone: formData.phone || '',
        role: formData.role,
        salonId: userData?.salonId || '',
        isActive: true,
      });
      console.log('Step 2 done: Firestore document created');

      success(ES.users.createSuccess);
      setShowModal(false);
      setFormData(emptyForm);
      loadUsers();
    } catch (err) {
      console.error('User creation failed:', err);
      const msg = err instanceof Error ? err.message : ES.users.createFailed;
      error(msg);
    } finally {
      setCreating(false);
    }
  };

  const toggleUserActive = async (targetUser: User) => {
    try {
      await updateDocument('users', targetUser.id, {
        isActive: !targetUser.isActive,
      });
      success(ES.messages.operationSuccess);
      loadUsers();
    } catch (err) {
      error(ES.messages.operationFailed);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Alert type="error" message={ES.users.accessDeniedUsers} />
      </div>
    );
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      case 'staff': return 'bg-green-100 text-green-800';
      case 'client': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Toast notifications={notifications} onDismiss={removeNotification} />
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">{ES.users.title}</h1>
        <Button onClick={() => setShowModal(true)}>{ES.users.add}</Button>
      </div>

      {/* Users List */}
      <Card>
        <CardBody>
          {loading ? (
            <p className="text-center text-gray-500 py-8">{ES.actions.loading}</p>
          ) : users.length === 0 ? (
            <p className="text-center text-gray-500 py-8">{ES.users.noUsers}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-600">{ES.users.name}</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600">{ES.users.email}</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600">{ES.users.role}</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600">{ES.users.status}</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-600">{ES.actions.edit}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        {u.firstName} {u.lastName}
                      </td>
                      <td className="py-3 px-4 text-gray-600">{u.email}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(u.role)}`}>
                          {ES.roles[u.role as keyof typeof ES.roles] || u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          u.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {u.isActive ? ES.status.active : ES.status.inactive}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {u.role !== 'admin' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleUserActive(u)}
                          >
                            {u.isActive ? ES.app.deactivate : ES.app.activate}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Create User Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setFormData(emptyForm);
        }}
        title={ES.users.add}
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={ES.auth.firstName}
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
            />
            <Input
              label={ES.auth.lastName}
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              required
            />
          </div>

          <Input
            label={ES.users.email}
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />

          <Input
            label={ES.auth.phone}
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />

          <Select
            label={ES.users.role}
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'manager' | 'staff' })}
            options={[
              { value: 'admin', label: `${ES.roles.admin} - ${ES.users.roleDescAdmin}` },
              { value: 'manager', label: `${ES.roles.manager} - ${ES.users.roleDescManager}` },
              { value: 'staff', label: `${ES.roles.staff} - ${ES.users.roleDescStaff}` },
            ]}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={ES.users.password}
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
            <Input
              label={ES.users.confirmPassword}
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setShowModal(false);
                setFormData(emptyForm);
              }}
            >
              {ES.actions.cancel}
            </Button>
            <Button type="submit" loading={creating}>
              {ES.actions.save}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
