import React from 'react';
import { useNotification, Notification } from '@/hooks/useNotification';
import { Alert } from '@/components/Alert';

interface LayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
}

export function Layout({ children, sidebar }: LayoutProps) {
  const { notifications, removeNotification } = useNotification();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {sidebar && <aside className="w-64 bg-white shadow h-screen sticky top-0">{sidebar}</aside>}
        <main className="flex-1">
          <div className="p-6">{children}</div>
        </main>
      </div>

      {/* Notification Container */}
      <div className="fixed top-6 right-6 space-y-3 max-w-md">
        {notifications.map((notification) => (
          <div key={notification.id} className="animate-slideIn">
            <Alert
              type={notification.type}
              title={notification.title}
              message={notification.message}
              onClose={() => removeNotification(notification.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
