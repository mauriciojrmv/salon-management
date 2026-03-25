'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { logoutUser } from '@/lib/firebase/auth';
import { useRouter } from 'next/navigation';

const navigation = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Sessions', href: '/sessions' },
  { name: 'Appointments', href: '/appointments' },
  { name: 'Services', href: '/services' },
  { name: 'Staff', href: '/staff' },
  { name: 'Inventory', href: '/inventory' },
  { name: 'Reports', href: '/reports' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, userData } = useAuth();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleLogout = async () => {
    await logoutUser();
    router.push('/auth');
  };

  if (!user || !userData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`${
          isSidebarOpen ? 'w-64' : 'w-20'
        } bg-gray-900 text-white transition-all duration-300 flex flex-col`}
      >
        <div className="p-6 flex items-center justify-between">
          <h1 className={`font-bold ${isSidebarOpen ? 'text-xl' : 'hidden'}`}>Salon Pro</h1>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-gray-400 hover:text-white"
          >
            ☰
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors text-sm"
            >
              <span className="w-5 h-5 flex items-center justify-center">
                {item.name.charAt(0)}
              </span>
              {isSidebarOpen && <span>{item.name}</span>}
            </Link>
          ))}
        </nav>

        {/* User Menu */}
        <div className="border-t border-gray-800 p-4 space-y-3">
          <div className="text-xs text-gray-400 truncate">
            {isSidebarOpen && userData?.email}
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-sm rounded-lg hover:bg-gray-800 transition-colors text-gray-300 hover:text-white"
          >
            {isSidebarOpen ? 'Logout' : '←'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
