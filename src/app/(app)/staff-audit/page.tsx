'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardBody } from '@/components/Card';
import { Button } from '@/components/Button';
import { Toast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useNotification } from '@/hooks/useNotification';
import { StaffRepository } from '@/lib/repositories/staffRepository';
import { SessionRepository } from '@/lib/repositories/sessionRepository';
import { ClientRepository } from '@/lib/repositories/clientRepository';
import { batchUpdate } from '@/lib/firebase/db';
import type { Session, Staff, Client, SessionServiceItem } from '@/types/models';
import { fmtDate } from '@/lib/utils/helpers';
import ES from '@/config/text.es';
import { AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';

// Firebase Auth UIDs are deterministic 28-char alphanumeric strings.
// Firestore auto-IDs (from addDocument) are 20 chars. Anything other than
// 28 chars in the users collection is almost certainly NOT backed by an auth
// account — and therefore an orphan staff record that workers can't "be".
const AUTH_UID_LENGTH = 28;

function isLikelyAuthUid(id: string): boolean {
  return typeof id === 'string' && id.length === AUTH_UID_LENGTH;
}

// A service is "stuck" when its parent session is completed but the service
// itself never got marked completed. Filters on /my-work and /my-earnings
// require svc.status === 'completed', so a stuck service is invisible to the
// worker even though it's in their assignedStaff.
// Cancelled sessions are deliberately excluded — that work is voided, not stuck;
// forcing those services to 'completed' would wrongly inflate worker earnings.
function isStuckService(session: Session, svc: SessionServiceItem): boolean {
  if (svc.status === 'completed') return false;
  return session.status === 'completed';
}

interface ImpactExample {
  session: Session;
  service: SessionServiceItem;
  stuck: boolean;
}

interface Impact {
  sessionIds: Set<string>;
  serviceCount: number;
  stuckCount: number;
  examples: ImpactExample[];
}

export default function StaffAuditPage() {
  const { userData } = useAuth();
  const { notifications, removeNotification, success, error } = useNotification();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [repairing, setRepairing] = useState(false);

  const salonId = userData?.salonId || '';

  const { data: staff, loading: staffLoading } = useAsync<Staff[]>(
    () => (salonId ? StaffRepository.getSalonStaff(salonId) : Promise.resolve([])),
    [salonId],
  );

  const { data: sessions, loading: sessionsLoading, refetch: refetchSessions } = useAsync<Session[]>(
    () => (salonId ? SessionRepository.getSalonSessions(salonId) : Promise.resolve([])),
    [salonId],
  );

  const { data: clients } = useAsync<Client[]>(
    () => (salonId ? ClientRepository.getSalonClients(salonId) : Promise.resolve([])),
    [salonId],
  );

  const clientName = (id: string): string => {
    if (!id) return ES.staff.walkInClient;
    const c = (clients || []).find((x) => x.id === id);
    return c ? `${c.firstName} ${c.lastName}` : '-';
  };

  const impactByStaffId = useMemo<Record<string, Impact>>(() => {
    const map: Record<string, Impact> = {};
    (sessions || []).forEach((s) => {
      (s.services || []).forEach((svc) => {
        (svc.assignedStaff || []).forEach((sid) => {
          if (!map[sid]) map[sid] = { sessionIds: new Set(), serviceCount: 0, stuckCount: 0, examples: [] };
          const stuck = isStuckService(s, svc);
          map[sid].sessionIds.add(s.id);
          map[sid].serviceCount += 1;
          if (stuck) map[sid].stuckCount += 1;
          if (map[sid].examples.length < 10) {
            map[sid].examples.push({ session: s, service: svc, stuck });
          }
        });
      });
    });
    return map;
  }, [sessions]);

  const rows = useMemo(() => {
    return (staff || []).map((s) => {
      const healthy = isLikelyAuthUid(s.id);
      const impact = impactByStaffId[s.id] || { sessionIds: new Set<string>(), serviceCount: 0, stuckCount: 0, examples: [] };
      return { staff: s, healthy, impact };
    });
  }, [staff, impactByStaffId]);

  const orphans = rows.filter((r) => !r.healthy);
  const totalImpactedSessions = orphans.reduce((acc, r) => {
    r.impact.sessionIds.forEach((id) => acc.add(id));
    return acc;
  }, new Set<string>()).size;
  const totalImpactedServices = orphans.reduce((n, r) => n + r.impact.serviceCount, 0);

  // Stuck services across the whole salon (all staff, not just orphans)
  const stuckServices = useMemo(() => {
    const out: { session: Session; serviceIndex: number; service: SessionServiceItem }[] = [];
    (sessions || []).forEach((s) => {
      (s.services || []).forEach((svc, idx) => {
        if (isStuckService(s, svc)) out.push({ session: s, serviceIndex: idx, service: svc });
      });
    });
    return out;
  }, [sessions]);

  const stuckSessionIds = useMemo(() => new Set(stuckServices.map((x) => x.session.id)), [stuckServices]);

  const handleRepair = async () => {
    if (stuckServices.length === 0) return;
    setRepairing(true);
    try {
      // Group stuck services by session, rewrite each session's services array
      // in a single update. `services` is an embedded array on the session doc,
      // so we have to write the whole array — one update per session via batch.
      const bySession = new Map<string, Session>();
      stuckServices.forEach(({ session }) => {
        if (!bySession.has(session.id)) bySession.set(session.id, session);
      });

      const updates: { collection: string; docId: string; data: Record<string, unknown> }[] = [];
      let repaired = 0;
      bySession.forEach((session) => {
        const patched = (session.services || []).map((svc) => {
          if (isStuckService(session, svc)) {
            repaired += 1;
            return { ...svc, status: 'completed' as const };
          }
          return svc;
        });
        updates.push({
          collection: 'sessions',
          docId: session.id,
          data: { services: patched },
        });
      });

      await batchUpdate(updates);
      success(ES.staffAudit.repairDone(repaired));
      refetchSessions();
    } catch (e) {
      console.error(e);
      error(ES.staffAudit.repairFailed);
    } finally {
      setRepairing(false);
    }
  };

  const loading = staffLoading || sessionsLoading;

  return (
    <div className="space-y-6 p-4 max-w-4xl mx-auto">
      <Toast notifications={notifications} onDismiss={removeNotification} />

      <div className="pt-2">
        <h1 className="text-2xl font-bold text-gray-900">{ES.staffAudit.title}</h1>
        <p className="text-sm text-gray-500 mt-1">{ES.staffAudit.subtitle}</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">{ES.staffAudit.banner}</p>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">{ES.staffAudit.bannerBody}</p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardBody>
          <p className="text-xs text-gray-500 mb-1">{ES.staffAudit.summaryTotal}</p>
          <p className="text-2xl font-bold text-gray-900">{rows.length}</p>
        </CardBody></Card>
        <Card><CardBody>
          <p className="text-xs text-gray-500 mb-1">{ES.staffAudit.summaryOrphans}</p>
          <p className={`text-2xl font-bold ${orphans.length > 0 ? 'text-red-600' : 'text-green-600'}`}>{orphans.length}</p>
        </CardBody></Card>
        <Card><CardBody>
          <p className="text-xs text-gray-500 mb-1">{ES.staffAudit.summaryImpactedSessions}</p>
          <p className={`text-2xl font-bold ${totalImpactedSessions > 0 ? 'text-red-600' : 'text-gray-900'}`}>{totalImpactedSessions}</p>
        </CardBody></Card>
        <Card><CardBody>
          <p className="text-xs text-gray-500 mb-1">{ES.staffAudit.summaryStuck}</p>
          <p className={`text-2xl font-bold ${stuckServices.length > 0 ? 'text-red-600' : 'text-green-600'}`}>{stuckServices.length}</p>
        </CardBody></Card>
      </div>

      {/* Stuck-services banner with one-click repair */}
      {stuckServices.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-900">{ES.staffAudit.stuckBannerTitle}</p>
              <p className="text-xs text-red-800 mt-1 leading-relaxed">{ES.staffAudit.stuckBannerBody}</p>
              <p className="text-xs text-red-900 font-medium mt-2">
                {stuckServices.length} {stuckServices.length === 1 ? 'servicio' : 'servicios'} · {stuckSessionIds.size} {stuckSessionIds.size === 1 ? 'atención' : 'atenciones'}
              </p>
              <div className="mt-3">
                <Button variant="danger" onClick={handleRepair} disabled={repairing}>
                  {repairing ? ES.staffAudit.repairing : ES.staffAudit.repair}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <Card><CardBody>
          <p className="text-center text-gray-500 py-6 text-sm">{ES.staffAudit.loading}</p>
        </CardBody></Card>
      ) : rows.length === 0 ? (
        <Card><CardBody>
          <p className="text-center text-gray-500 py-6 text-sm">{ES.staffAudit.emptyState}</p>
        </CardBody></Card>
      ) : orphans.length === 0 && stuckServices.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <p className="text-sm text-green-900">{ES.staffAudit.allHealthy}</p>
        </div>
      ) : null}

      {/* Rows */}
      <div className="space-y-2">
        {rows.map(({ staff: s, healthy, impact }) => {
          const expanded = expandedId === s.id;
          const hasImpact = impact.sessionIds.size > 0;
          const hasStuck = impact.stuckCount > 0;
          return (
            <Card key={s.id}>
              <CardBody>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{s.firstName} {s.lastName}</p>
                      {healthy ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle2 className="w-3 h-3" />
                          {ES.staffAudit.healthy}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <AlertTriangle className="w-3 h-3" />
                          {ES.staffAudit.orphan}
                        </span>
                      )}
                      {hasStuck && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <AlertTriangle className="w-3 h-3" />
                          {impact.stuckCount} {ES.staffAudit.stuckLabel.toLowerCase()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{s.email || '—'}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-mono break-all">{s.id}</p>
                    <p className="text-xs text-gray-600 mt-1.5">
                      {healthy ? ES.staffAudit.healthyHint : ES.staffAudit.orphanHint}
                    </p>
                    {hasStuck && (
                      <p className="text-xs text-red-700 mt-1.5">{ES.staffAudit.stuckHint}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-500">{ES.staffAudit.colImpact}</p>
                    <p className={`text-sm font-semibold ${hasStuck ? 'text-red-600' : 'text-gray-900'}`}>
                      {ES.staffAudit.impactSessions(impact.sessionIds.size)}
                    </p>
                    <p className="text-xs text-gray-500">{ES.staffAudit.impactServices(impact.serviceCount)}</p>
                    {hasImpact && (
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : s.id)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium mt-1.5"
                      >
                        {expanded ? ES.staffAudit.hideSessions : ES.staffAudit.showSessions}
                      </button>
                    )}
                  </div>
                </div>

                {expanded && hasImpact && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-1.5">
                    {impact.examples.map(({ session, service, stuck }, i) => (
                      <div key={`${session.id}-${i}`} className="flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0 flex-1">
                          <span className="text-gray-700">{fmtDate(session.date)}</span>
                          <span className="text-gray-400 mx-1.5">·</span>
                          <span className="text-gray-900 font-medium">{clientName(session.clientId)}</span>
                          <span className="text-gray-400 mx-1.5">·</span>
                          <span className="text-gray-600">{service.serviceName}</span>
                          <span className="text-gray-400 mx-1.5">·</span>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            session.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                            session.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {session.status}
                          </span>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ml-1 ${
                            service.status === 'completed' ? 'bg-green-100 text-green-700' :
                            stuck ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {service.status}
                          </span>
                          {stuck && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-red-700 ml-1 font-semibold">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              {ES.staffAudit.stuckLabel}
                            </span>
                          )}
                        </div>
                        <Link
                          href={`/sessions?openSession=${session.id}`}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 shrink-0"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {ES.staffAudit.viewInSessions}
                        </Link>
                      </div>
                    ))}
                    {impact.sessionIds.size > impact.examples.length && (
                      <p className="text-[10px] text-gray-400 pt-1">
                        +{impact.sessionIds.size - impact.examples.length} más
                      </p>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
