// Role definitions and permissions
export type UserRole = 'admin' | 'manager' | 'staff';

export interface RolePermissions {
  canCreateSessions: boolean;
  canAssignStaff: boolean;
  canProcessPayments: boolean;
  canLogMaterialUsage: boolean;
  canViewAllSessions: boolean;
  canViewAllUsers: boolean;
  canManageStaff: boolean;
  canManageServices: boolean;
  canManageProducts: boolean;
  canViewReports: boolean;
  canViewAllEarnings: boolean;
  canEditSettings: boolean;
  canCreateAdmin: boolean;
  canCreateManager: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    canCreateSessions: true,
    canAssignStaff: true,
    canProcessPayments: true,
    canLogMaterialUsage: true,
    canViewAllSessions: true,
    canViewAllUsers: true,
    canManageStaff: true,
    canManageServices: true,
    canManageProducts: true,
    canViewReports: true,
    canViewAllEarnings: true,
    canEditSettings: true,
    canCreateAdmin: true,
    canCreateManager: true,
  },
  manager: {
    canCreateSessions: true,
    canAssignStaff: true,
    canProcessPayments: true,
    canLogMaterialUsage: true,
    canViewAllSessions: true,
    canViewAllUsers: false,
    canManageStaff: false,
    canManageServices: true,
    canManageProducts: true,
    canViewReports: true,
    canViewAllEarnings: true,
    canEditSettings: false,
    canCreateAdmin: false,
    canCreateManager: false,
  },
  staff: {
    canCreateSessions: false,
    canAssignStaff: false,
    canProcessPayments: false,
    canLogMaterialUsage: true,
    canViewAllSessions: false, // Only own sessions
    canViewAllUsers: false,
    canManageStaff: false,
    canManageServices: false,
    canManageProducts: false,
    canViewReports: false,
    canViewAllEarnings: false, // Only own earnings
    canEditSettings: false,
    canCreateAdmin: false,
    canCreateManager: false,
  },
};

export function hasPermission(role: UserRole, permission: keyof RolePermissions): boolean {
  return ROLE_PERMISSIONS[role][permission];
}

export function canAccessRoute(role: UserRole, route: string): boolean {
  const routePermissions: Record<string, (role: UserRole) => boolean> = {
    '/dashboard': () => true, // All can access
    '/sessions': (r) => hasPermission(r, 'canViewAllSessions'),
    '/appointments': (r) => hasPermission(r, 'canCreateSessions'),
    '/clients': (r) => hasPermission(r, 'canViewAllSessions'),
    '/services': (r) => hasPermission(r, 'canManageServices'),
    '/staff': (r) => hasPermission(r, 'canManageStaff'),
    '/inventory': (r) => hasPermission(r, 'canManageProducts'),
    '/reports': (r) => hasPermission(r, 'canViewReports'),
    '/pagos': (r) => hasPermission(r, 'canViewReports'),
    '/cola': (r) => hasPermission(r, 'canViewAllSessions'),
    '/settings': (r) => hasPermission(r, 'canEditSettings'),
    '/my-earnings': (r) => r === 'staff',
    '/my-appointments': (r) => r === 'staff',
    '/my-work': (r) => r === 'staff',
    '/sales': (r) => hasPermission(r, 'canProcessPayments'),
    '/expenses': (r) => hasPermission(r, 'canViewReports'),
    '/rewards': (r) => r === 'admin',
    '/salons': (r) => r === 'admin',
    '/users': (r) => r === 'admin',
    '/staff-audit': (r) => r === 'admin',
  };

  const checker = routePermissions[route];
  return checker ? checker(role) : false;
}
