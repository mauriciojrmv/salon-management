import { useState, useCallback, useRef } from 'react';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  title?: string;
  duration?: number;
}

export function useNotification() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeNotification = useCallback((id: string) => {
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback(
    (notification: Omit<Notification, 'id'>) => {
      const id = `notification_${Date.now()}`;
      const newNotification = { ...notification, id };

      setNotifications((prev) => [...prev, newNotification]);

      if (notification.duration !== 0) {
        const duration = notification.duration || 3000;
        const timeout = setTimeout(() => {
          timeoutsRef.current.delete(id);
          setNotifications((prev) => prev.filter((n) => n.id !== id));
        }, duration);
        timeoutsRef.current.set(id, timeout);
      }

      return id;
    },
    []
  );

  const success = useCallback(
    (message: string, title?: string) => {
      addNotification({ type: 'success', message, title });
    },
    [addNotification]
  );

  const error = useCallback(
    (message: string, title?: string) => {
      addNotification({ type: 'error', message, title });
    },
    [addNotification]
  );

  const warning = useCallback(
    (message: string, title?: string) => {
      addNotification({ type: 'warning', message, title });
    },
    [addNotification]
  );

  const info = useCallback(
    (message: string, title?: string) => {
      addNotification({ type: 'info', message, title });
    },
    [addNotification]
  );

  return {
    notifications,
    addNotification,
    removeNotification,
    success,
    error,
    warning,
    info,
  };
}
