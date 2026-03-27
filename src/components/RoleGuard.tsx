'use client';

import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { canAccessRoute, type UserRole } from '@/lib/auth/roles';
import { Alert } from '@/components/Alert';
import ES from '@/config/text.es';

interface RoleGuardProps {
  children: React.ReactNode;
  route: string;
}

export function RoleGuard({ children, route }: RoleGuardProps) {
  const { userData, loading } = useAuth();

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">{ES.actions.loading}</div>
    );
  }

  if (!userData) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const userRole = (userData.role || 'staff') as UserRole;

  // Admin can access everything
  if (userRole === 'admin') {
    return <>{children}</>;
  }

  // Dashboard is always accessible
  if (route === '/dashboard') {
    return <>{children}</>;
  }

  if (!canAccessRoute(userRole, route)) {
    return (
      <div className="p-6">
        <Alert type="error" message={`${ES.app.accessDenied} ${ES.app.adminOnly}`} />
      </div>
    );
  }

  return <>{children}</>;
}
