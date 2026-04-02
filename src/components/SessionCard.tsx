import React, { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { Session } from '@/types/models';
import { toDate, fmtBs } from '@/lib/utils/helpers';
import ES from '@/config/text.es';

interface SessionCardProps {
  session: Session;
  clientName: string;
  getStaffName: (id: string) => string;
  onAddService: () => void;
  onProcessPayment: () => void;
  onCloseSession: () => void;
  onViewClientHistory?: () => void;
  onCancelSession?: () => void;
  onRemoveService?: (serviceItemId: string) => void;
  onUpdateServiceStatus?: (serviceItemId: string, newStatus: 'pending' | 'in_progress' | 'completed') => void;
  onEditMaterials?: (serviceItemId: string, serviceName: string) => void;
  canCancel?: boolean; // admin/manager only
  loading?: boolean;
}

// Left-border color by service status
const statusBorderColor: Record<string, string> = {
  pending: 'border-l-yellow-400',
  in_progress: 'border-l-blue-400',
  completed: 'border-l-green-400',
};

export function SessionCard({
  session,
  clientName,
  getStaffName,
  onAddService,
  onProcessPayment,
  onCloseSession,
  onViewClientHistory,
  onCancelSession,
  onRemoveService,
  onUpdateServiceStatus,
  onEditMaterials,
  canCancel = false,
  loading = false,
}: SessionCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [confirmRemoveServiceId, setConfirmRemoveServiceId] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const sessionServices = session.services || [];
  const sessionPayments = session.payments || [];
  const sessionMaterials = session.materialsUsed || [];

  // Client-facing total: service prices only — materials are internal cost tracking
  const total = sessionServices.reduce((sum, s) => sum + s.price, 0);
  const paidAmount = sessionPayments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = total - paidAmount;

  return (
    <>
      <Card>
        <CardHeader>
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">{clientName}</h3>
              <p className="text-sm text-gray-500">
                {sessionServices.length} {ES.sessions.services.toLowerCase()} · {fmtBs(total)}
              </p>
            </div>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
              {ES.sessions.active}
            </span>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardBody>
            {/* Services list — left-border color coded by status */}
            {sessionServices.length > 0 ? (
              <div className="space-y-2 mb-4">
                {sessionServices.map((service) => {
                  const statusConfig: Record<string, { label: string; badgeColor: string; next?: 'in_progress' | 'completed' }> = {
                    pending: { label: ES.sessions.pendingService, badgeColor: 'bg-yellow-100 text-yellow-700', next: 'in_progress' },
                    in_progress: { label: ES.sessions.inProgressService, badgeColor: 'bg-blue-100 text-blue-700', next: 'completed' },
                    completed: { label: ES.sessions.completedService, badgeColor: 'bg-green-100 text-green-700' },
                  };
                  const svcStatus = statusConfig[service.status || 'pending'] || statusConfig.pending;
                  const borderColor = statusBorderColor[service.status || 'pending'] || statusBorderColor.pending;

                  return (
                    <div key={service.id} className={`py-2 pl-3 border-b border-gray-100 border-l-4 ${borderColor} rounded-l-sm`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-gray-900">{service.serviceName}</p>
                            <span className="text-xs text-gray-500">
                              {toDate(service.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {onUpdateServiceStatus && svcStatus.next ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateServiceStatus(service.id, svcStatus.next!);
                                }}
                                className={`px-3 py-1.5 min-h-[44px] rounded-full text-xs font-medium ${svcStatus.badgeColor} hover:opacity-80 transition-opacity flex flex-col items-center`}
                                title={svcStatus.next === 'in_progress' ? ES.sessions.inProgressService : ES.sessions.completedService}
                              >
                                <span>{svcStatus.label} →</span>
                                <span className="text-[10px] opacity-70 font-normal">
                                  {svcStatus.next === 'in_progress' ? ES.sessions.tapToStart : ES.sessions.tapToComplete}
                                </span>
                              </button>
                            ) : (
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${svcStatus.badgeColor}`}>
                                {svcStatus.label}
                              </span>
                            )}
                          </div>
                          {service.assignedStaff?.length > 0 && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {service.assignedStaff.map((id) => getStaffName(id)).join(', ')}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {onEditMaterials && session.status === 'active' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditMaterials(service.id, service.serviceName);
                              }}
                              className="text-blue-500 hover:text-blue-700 text-xs font-medium px-2 py-1 rounded hover:bg-blue-50"
                              title={ES.sessions.addMaterial}
                            >
                              + Mat.
                            </button>
                          )}
                          <p className="text-sm font-semibold">{fmtBs(service.price)}</p>
                          {onRemoveService && canCancel && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmRemoveServiceId(service.id);
                              }}
                              className="text-red-400 hover:text-red-600 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded"
                              title={ES.sessions.removeService}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                      {service.materialsUsed?.length > 0 && (
                        <div className="mt-1 pl-3 border-l-2 border-gray-200">
                          {service.materialsUsed.map((mat, i) => (
                            <p key={i} className="text-xs text-gray-500">
                              {mat.productName}: {mat.quantity} {mat.unit} · {fmtBs(mat.cost)}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-4">{ES.sessions.noServices}</p>
            )}

            {/* Summary — client-facing: Servicios = Total only */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1 text-sm">
              <div className="flex justify-between border-gray-200">
                <span className="text-gray-900 font-semibold">{ES.payments.total}</span>
                <span className="text-gray-900 font-bold">{fmtBs(total)}</span>
              </div>
              {paidAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">{ES.payments.paid}</span>
                  <span className="text-green-600 font-semibold">{fmtBs(paidAmount)}</span>
                </div>
              )}
              {remaining > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">{ES.payments.remaining}</span>
                  <span className="text-red-600 font-semibold">{fmtBs(remaining)}</span>
                </div>
              )}
            </div>

            {/* Primary actions — full width stacked on mobile */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={onAddService} className="w-full" loading={loading}>
                  {ES.sessions.addService}
                </Button>
                <Button variant="primary" onClick={onProcessPayment} className="w-full" loading={loading}>
                  {ES.payments.processPayment}
                </Button>
              </div>

              {/* Secondary actions */}
              <div className="flex flex-wrap gap-2">
                {onViewClientHistory && (
                  <Button size="sm" variant="ghost" onClick={onViewClientHistory} loading={loading}>
                    {ES.sessions.viewClientHistory}
                  </Button>
                )}
              </div>

              {/* Destructive actions — separated with border */}
              {canCancel && (
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <Button variant="danger" onClick={() => setConfirmClose(true)} className="flex-1" loading={loading}>
                    {ES.sessions.closeSession}
                  </Button>
                  {onCancelSession && (
                    <Button variant="ghost" onClick={() => setConfirmCancel(true)} className="flex-1 text-red-600 hover:bg-red-50" loading={loading}>
                      {ES.sessions.cancelSession}
                    </Button>
                  )}
                </div>
              )}

              {/* Non-admin close button (no cancel shown) */}
              {!canCancel && (
                <Button variant="danger" onClick={() => setConfirmClose(true)} className="w-full" loading={loading}>
                  {ES.sessions.closeSession}
                </Button>
              )}
            </div>
          </CardBody>
        )}
      </Card>

      {/* Confirm: remove service */}
      <Modal isOpen={!!confirmRemoveServiceId} onClose={() => setConfirmRemoveServiceId(null)} title={ES.sessions.removeService} size="sm">
        <div className="space-y-4">
          <p className="text-gray-700">{ES.sessions.confirmRemoveService}</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setConfirmRemoveServiceId(null)} className="flex-1">
              {ES.actions.cancel}
            </Button>
            <Button variant="danger" onClick={() => { onRemoveService?.(confirmRemoveServiceId!); setConfirmRemoveServiceId(null); }} className="flex-1">
              {ES.actions.confirm}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm: close session */}
      <Modal isOpen={confirmClose} onClose={() => setConfirmClose(false)} title={ES.sessions.closeSession} size="sm">
        <div className="space-y-4">
          <p className="text-gray-700">{ES.sessions.confirmClose}</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setConfirmClose(false)} className="flex-1">
              {ES.actions.cancel}
            </Button>
            <Button variant="danger" onClick={() => { onCloseSession(); setConfirmClose(false); }} className="flex-1">
              {ES.sessions.closeSession}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm: cancel session — triggers the cancel modal in parent */}
      <Modal isOpen={confirmCancel} onClose={() => setConfirmCancel(false)} title={ES.sessions.cancelSession} size="sm">
        <div className="space-y-4">
          <p className="text-gray-700">{ES.sessions.confirmCancel}</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setConfirmCancel(false)} className="flex-1">
              {ES.actions.cancel}
            </Button>
            <Button variant="danger" onClick={() => { onCancelSession?.(); setConfirmCancel(false); }} className="flex-1">
              {ES.sessions.cancelSession}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
