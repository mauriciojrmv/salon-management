'use client';

import React, { useEffect, useState } from 'react';
import type { Notification } from '@/hooks/useNotification';

interface ToastProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

const typeStyles: Record<Notification['type'], { bg: string; border: string; text: string; icon: string }> = {
  success: { bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-800', icon: '✓' },
  error: { bg: 'bg-red-50', border: 'border-red-400', text: 'text-red-800', icon: '✕' },
  warning: { bg: 'bg-yellow-50', border: 'border-yellow-400', text: 'text-yellow-800', icon: '⚠' },
  info: { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-800', icon: 'ℹ' },
};

function ToastItem({ notification, onDismiss }: { notification: Notification; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  const style = typeStyles[notification.type];

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div
      className={`flex items-start gap-2 px-4 py-3 rounded-lg border shadow-lg transition-all duration-300 ${style.bg} ${style.border} ${style.text} ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}
      role="alert"
    >
      <span className="font-bold text-sm shrink-0">{style.icon}</span>
      <div className="flex-1 min-w-0">
        {notification.title && <p className="font-semibold text-sm">{notification.title}</p>}
        <p className="text-sm">{notification.message}</p>
      </div>
      <button onClick={onDismiss} className="shrink-0 text-sm opacity-60 hover:opacity-100">✕</button>
    </div>
  );
}

export function Toast({ notifications, onDismiss }: ToastProps) {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-auto">
      {notifications.map((n) => (
        <ToastItem key={n.id} notification={n} onDismiss={() => onDismiss(n.id)} />
      ))}
    </div>
  );
}
