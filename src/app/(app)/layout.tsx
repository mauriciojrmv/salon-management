'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { logoutUser } from '@/lib/firebase/auth';
import { updateUserDocument } from '@/lib/firebase/auth';
import { SalonRepository } from '@/lib/repositories/salonRepository';
import { useRouter } from 'next/navigation';
import { canAccessRoute } from '@/lib/auth/roles';
import type { Salon } from '@/types/models';
import type { UserRole } from '@/lib/auth/roles';
import { RoleGuard } from '@/components/RoleGuard';
import ES from '@/config/text.es';
import {
  LayoutDashboard,
  Scissors,
  Calendar,
  Users,
  ListChecks,
  UserCheck,
  Package,
  ClipboardList,
  ShoppingCart,
  Receipt,
  BarChart2,
  Gift,
  Building2,
  UserCog,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const allNavItems: NavItem[] = [
  { name: ES.nav.dashboard, href: '/dashboard', icon: LayoutDashboard },
  { name: ES.nav.sessions, href: '/sessions', icon: Scissors },
  { name: ES.nav.appointments, href: '/appointments', icon: Calendar },
  { name: ES.nav.clients, href: '/clients', icon: Users },
  { name: ES.nav.services, href: '/services', icon: ListChecks },
  { name: ES.nav.staff, href: '/staff', icon: UserCheck },
  { name: ES.nav.inventory, href: '/inventory', icon: Package },
  { name: ES.nav.myWork, href: '/my-work', icon: ClipboardList },
  { name: ES.retail.title, href: '/sales', icon: ShoppingCart },
  { name: ES.expenses.title, href: '/expenses', icon: Receipt },
  { name: ES.nav.reports, href: '/reports', icon: BarChart2 },
  { name: ES.loyalty.rewards, href: '/rewards', icon: Gift, adminOnly: true },
  { name: ES.salons.title, href: '/salons', icon: Building2, adminOnly: true },
  { name: ES.users.title, href: '/users', icon: UserCog, adminOnly: true },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, userData } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

  const userRole = (userData?.role || 'staff') as UserRole;

  // Load salons for admin salon switcher
  const { data: salons } = useAsync(async () => {
    if (!user?.uid || userRole !== 'admin') return [];
    return SalonRepository.getOwnerSalons(user.uid);
  }, [user?.uid, userRole]);

  const handleSwitchSalon = async (salonId: string) => {
    if (!user?.uid || salonId === userData?.salonId) return;
    await updateUserDocument(user.uid, { salonId });
    window.location.reload();
  };

  const currentSalonName = (salons || []).find((s: Salon) => s.id === userData?.salonId)?.name;

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const visibleNav = useMemo(() => {
    return allNavItems.filter((item) => {
      if (item.adminOnly) return userRole === 'admin';
      if (item.href === '/dashboard') return true;
      return canAccessRoute(userRole, item.href);
    });
  }, [userRole]);

  const handleLogout = async () => {
    await logoutUser();
    router.push('/auth');
  };

  if (!user || !userData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-500 text-sm">{ES.actions.loading}</p>
        </div>
      </div>
    );
  }

  const sidebarContent = (isMobile: boolean) => {
    const showLabels = isMobile || !isDesktopCollapsed;
    return (
      <>
        <div className="p-4 flex items-center justify-between">
          {showLabels && <h1 className="font-bold text-xl">{ES.app.name}</h1>}
          {!isMobile && (
            <button
              onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
              className="text-gray-400 hover:text-white p-1"
            >
              ☰
            </button>
          )}
          {isMobile && (
            <button
              onClick={() => setIsMobileOpen(false)}
              className="text-gray-400 hover:text-white p-2 text-2xl leading-none"
            >
              ✕
            </button>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm ${
                  isActive
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {showLabels && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-800 p-4 space-y-2">
          {/* Salon switcher for admins with multiple salons */}
          {showLabels && userRole === 'admin' && (salons || []).length > 1 && (
            <div className="pb-2 mb-2 border-b border-gray-700">
              <p className="text-xs text-gray-500 mb-1">{ES.salons.switchSalon}</p>
              <select
                value={userData?.salonId || ''}
                onChange={(e) => handleSwitchSalon(e.target.value)}
                className="w-full bg-gray-800 text-white text-sm rounded px-2 py-1.5 border border-gray-700 focus:border-blue-500 outline-none"
              >
                {(salons || []).map((s: Salon) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          {showLabels && (
            <>
              <div className="text-sm text-white font-medium truncate">
                {userData?.firstName} {userData?.lastName}
              </div>
              {currentSalonName && (
                <div className="text-xs text-gray-400 truncate">{currentSalonName}</div>
              )}
              <div className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                userRole === 'admin' ? 'bg-red-500/20 text-red-300' :
                userRole === 'manager' ? 'bg-blue-500/20 text-blue-300' :
                'bg-green-500/20 text-green-300'
              }`}>
                {ES.roles[userRole as keyof typeof ES.roles] || userRole}
              </div>
            </>
          )}
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-sm rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white"
          >
            {showLabels ? ES.auth.logout : '←'}
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-30 bg-gray-900 text-white flex items-center justify-between px-4 py-3 md:hidden">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="text-white text-2xl p-1"
        >
          ☰
        </button>
        <h1 className="font-bold text-lg">{ES.app.name}</h1>
        <div className={`px-2 py-0.5 rounded text-xs font-medium ${
          userRole === 'admin' ? 'bg-red-500/20 text-red-300' :
          userRole === 'manager' ? 'bg-blue-500/20 text-blue-300' :
          'bg-green-500/20 text-green-300'
        }`}>
          {ES.roles[userRole as keyof typeof ES.roles] || userRole}
        </div>
      </div>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-gray-900 text-white flex flex-col transform transition-transform duration-300 md:hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent(true)}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex ${
          isDesktopCollapsed ? 'w-20' : 'w-64'
        } bg-gray-900 text-white transition-all duration-300 flex-col shrink-0`}
      >
        {sidebarContent(false)}
      </aside>

      {/* Main Content with Role Protection */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        <RoleGuard route={pathname}>
          {children}
        </RoleGuard>
      </main>
    </div>
  );
}
