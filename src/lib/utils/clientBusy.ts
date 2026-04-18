import type { Session } from '@/types/models';

// A client can only have ONE in_progress service at a time across the whole
// salon. If they're actively being worked on, no other worker can start a
// second parallel service. Paused or pending services don't lock the client —
// another worker can pick up a different service while the first is paused.
//
// Used by /cola (block "Tomar" for in_progress) and /my-work (queue card pill
// + disabled take button with the owning worker's name for context).

export type ClientBusyState =
  | { kind: 'free' }
  | { kind: 'in_progress'; staffId: string; staffName: string }
  | { kind: 'paused'; staffId: string; staffName: string }
  | { kind: 'pending'; staffId: string; staffName: string };

export function getClientBusyState(
  clientId: string,
  activeSessions: readonly Session[],
  resolveStaffName: (staffId: string) => string,
): ClientBusyState {
  if (!clientId) return { kind: 'free' };

  let inProgressStaff = '';
  let pausedStaff = '';
  let pendingStaff = '';

  for (const session of activeSessions) {
    if (session.status !== 'active') continue;
    if (session.clientId !== clientId) continue;
    for (const svc of session.services || []) {
      const sid = svc.assignedStaff?.[0] || '';
      if (svc.status === 'in_progress' && !inProgressStaff) inProgressStaff = sid;
      else if (svc.status === 'paused' && !pausedStaff) pausedStaff = sid;
      else if (svc.status === 'pending' && !pendingStaff) pendingStaff = sid;
    }
  }

  if (inProgressStaff) {
    return { kind: 'in_progress', staffId: inProgressStaff, staffName: resolveStaffName(inProgressStaff) };
  }
  if (pausedStaff) {
    return { kind: 'paused', staffId: pausedStaff, staffName: resolveStaffName(pausedStaff) };
  }
  if (pendingStaff) {
    return { kind: 'pending', staffId: pendingStaff, staffName: resolveStaffName(pendingStaff) };
  }
  return { kind: 'free' };
}

// Take is blocked only when the client has an in_progress service. Paused
// services are fine — that's the whole point of pausing, to free the client
// for another service in parallel.
export function canTakeClient(state: ClientBusyState): boolean {
  return state.kind !== 'in_progress';
}
