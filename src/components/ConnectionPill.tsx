'use client';

import { useConnectionState } from '@/hooks/useConnectionState';
import { Wifi, WifiOff, RotateCw } from 'lucide-react';
import ES from '@/config/text.es';

// Small status indicator shown in the header so workers can tell at a glance
// whether their last tap has been acknowledged. Critical on the salon's flaky
// wifi — without this, a "Tomar" that queued offline looks identical to one
// that succeeded, which breeds confusion and double-taps.
export function ConnectionPill({ compact = false }: { compact?: boolean }) {
  const { status, pending } = useConnectionState();

  const config = {
    online: {
      bg: 'bg-green-500/15',
      text: 'text-green-300',
      dot: 'bg-green-400',
      Icon: Wifi,
      label: ES.connection.online,
    },
    syncing: {
      bg: 'bg-amber-500/15',
      text: 'text-amber-300',
      dot: 'bg-amber-400 animate-pulse',
      Icon: RotateCw,
      label: ES.connection.syncing,
    },
    offline: {
      bg: 'bg-red-500/15',
      text: 'text-red-300',
      dot: 'bg-red-400',
      Icon: WifiOff,
      label: ES.connection.offline,
    },
  }[status];

  const countLabel =
    pending === 0
      ? ''
      : pending === 1
        ? ES.connection.pendingOne
        : ES.connection.pendingMany(pending);

  const title =
    status === 'offline'
      ? pending > 0
        ? `${ES.connection.offline} — ${countLabel}. ${ES.connection.offlineHint}`
        : `${ES.connection.offline}. ${ES.connection.offlineHint}`
      : status === 'syncing'
        ? countLabel
        : ES.connection.online;

  if (compact) {
    return (
      <div
        title={title}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
        aria-label={title}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        {status === 'syncing' && pending > 0 && <span>{pending}</span>}
        {status === 'offline' && <span>{ES.connection.offline}</span>}
      </div>
    );
  }

  const { Icon } = config;
  return (
    <div
      title={title}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
      aria-label={title}
    >
      <Icon className={`w-3.5 h-3.5 ${status === 'syncing' ? 'animate-spin' : ''}`} />
      <span>{config.label}</span>
      {status !== 'online' && pending > 0 && (
        <span className="opacity-80">· {pending}</span>
      )}
    </div>
  );
}
