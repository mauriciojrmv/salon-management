'use client';

import { useEffect, useState } from 'react';
import { subscribe, getPendingCount } from '@/lib/firebase/connectionState';

export type ConnectionStatus = 'online' | 'syncing' | 'offline';

export interface ConnectionState {
  status: ConnectionStatus;
  online: boolean;
  pending: number;
}

function readOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

// Subscribes to both the Firestore pending-writes counter and the browser's
// online/offline events. The pill derives a single status from the pair:
//   offline: navigator reports offline
//   syncing: online but ≥1 write queued locally, waiting for server ACK
//   online:  online with no pending writes
export function useConnectionState(): ConnectionState {
  const [online, setOnline] = useState<boolean>(readOnline);
  const [pending, setPending] = useState<number>(() => getPendingCount());

  useEffect(() => {
    const unsub = subscribe(() => setPending(getPendingCount()));
    return unsub;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const status: ConnectionStatus = !online ? 'offline' : pending > 0 ? 'syncing' : 'online';
  return { status, online, pending };
}
