import React, { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
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
  onEditStaff?: (serviceItemId: string, serviceName: string, currentStaff: string[]) => void;
  onEditPrice?: (serviceItemId: string, newPrice: number) => void;
  onAddRetailProduct?: () => void;
  onRemoveRetailItem?: (itemId: string) => void;
  onAssignClient?: () => void;
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
  onEditStaff,
  onEditPrice,
  onAddRetailProduct,
  onRemoveRetailItem,
  onAssignClient,
  canCancel = false,
  loading = false,
}: SessionCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [confirmRemoveServiceId, setConfirmRemoveServiceId] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState('');

  const sessionServices = session.services || [];
  const sessionPayments = session.payments || [];
  const sessionMaterials = session.materialsUsed || [];
  const retailItems = session.retailItems || [];

  // Client-facing total: service prices + retail items — materials are internal cost tracking
  const serviceTotal = sessionServices.reduce((sum, s) => sum + s.price, 0);
  const retailTotal = retailItems.reduce((sum, r) => sum + r.total, 0);
  const total = serviceTotal + retailTotal;
  const paidAmount = sessionPayments.filter((p) => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);
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
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-gray-900 text-lg">{clientName}</h3>
                {canCancel && onAssignClient && !session.clientId && session.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onAssignClient(); }}
                    className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg min-w-[32px] min-h-[32px] flex items-center justify-center text-sm"
                    title={ES.sessions.assignClient}
                  >
                    ✎
                  </button>
                )}
              </div>
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
                    <div key={service.id} className={`py-3 pl-3 pr-1 border-b border-gray-100 border-l-4 ${borderColor} rounded-l-sm space-y-2`}>
                      {/* Row 1: Service name + time | Price */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{service.serviceName}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-gray-400">
                              {toDate(service.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {service.assignedStaff?.length > 0 ? (
                              <span className="text-xs text-gray-500">
                                {service.assignedStaff.map((id) => getStaffName(id)).join(', ')}
                                {onEditStaff && session.status === 'active' && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onEditStaff(service.id, service.serviceName, service.assignedStaff || []); }}
                                    className="ml-1 text-blue-500 hover:text-blue-700 text-xs font-medium inline-flex items-center justify-center min-w-[28px] min-h-[28px] rounded hover:bg-blue-50"
                                  >✎</button>
                                )}
                              </span>
                            ) : (
                              onEditStaff && session.status === 'active' && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); onEditStaff(service.id, service.serviceName, []); }}
                                  className="text-xs text-orange-600 hover:text-orange-800 font-medium"
                                >+ {ES.sessions.assignStaff}</button>
                              )
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {onEditPrice && session.status === 'active' && editingPriceId === service.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                value={editPriceValue}
                                onChange={(e) => setEditPriceValue(e.target.value)}
                                className="w-20 text-right text-sm py-1"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { const v = parseFloat(editPriceValue); if (!isNaN(v) && v >= 0) { onEditPrice(service.id, v); setEditingPriceId(null); } }
                                  if (e.key === 'Escape') setEditingPriceId(null);
                                }}
                                autoFocus
                              />
                              <button onClick={() => { const v = parseFloat(editPriceValue); if (!isNaN(v) && v >= 0) { onEditPrice(service.id, v); setEditingPriceId(null); } }} className="text-green-600 hover:text-green-800 text-sm font-bold px-1">✓</button>
                              <button onClick={() => setEditingPriceId(null)} className="text-gray-400 hover:text-gray-600 text-sm px-1">✕</button>
                            </div>
                          ) : onEditPrice && session.status === 'active' ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingPriceId(service.id); setEditPriceValue(String(service.price)); }}
                              className="text-sm font-bold text-gray-900 hover:text-blue-600 transition-colors"
                            >
                              {fmtBs(service.price)} <span className="text-xs text-gray-400 ml-1">✎</span>
                            </button>
                          ) : (
                            <p className="text-sm font-bold text-gray-900">{fmtBs(service.price)}</p>
                          )}
                        </div>
                      </div>

                      {/* Materials (if any) */}
                      {service.materialsUsed?.length > 0 && (
                        <div className="pl-2 border-l-2 border-gray-200">
                          {service.materialsUsed.map((mat, i) => (
                            <p key={i} className="text-xs text-gray-400">
                              {mat.productName}: {mat.quantity} {mat.unit} · {fmtBs(mat.cost)}
                            </p>
                          ))}
                        </div>
                      )}

                      {/* Row 2: Action pills — only on active sessions */}
                      {session.status === 'active' && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {onUpdateServiceStatus && svcStatus.next && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onUpdateServiceStatus(service.id, svcStatus.next!); }}
                              className={`px-3 py-1.5 min-h-[36px] rounded-full text-xs font-medium ${svcStatus.badgeColor} hover:opacity-80 transition-opacity`}
                            >
                              {svcStatus.label} →
                            </button>
                          )}
                          {!svcStatus.next && (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${svcStatus.badgeColor}`}>
                              {svcStatus.label}
                            </span>
                          )}
                          {onEditMaterials && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onEditMaterials(service.id, service.serviceName); }}
                              className="px-3 py-1.5 min-h-[36px] rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                            >
                              {ES.sessions.materialsUsed}
                            </button>
                          )}
                          {onRemoveService && canCancel && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setConfirmRemoveServiceId(service.id); }}
                              className="px-3 py-1.5 min-h-[36px] rounded-full text-xs font-medium bg-red-50 text-red-500 hover:bg-red-100 transition-colors ml-auto"
                            >
                              {ES.sessions.removeService}
                            </button>
                          )}
                        </div>
                      )}
                      {/* Completed/non-active: just show status badge */}
                      {session.status !== 'active' && (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${svcStatus.badgeColor}`}>
                          {svcStatus.label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-4">{ES.sessions.noServices}</p>
            )}

            {/* Retail Items */}
            {retailItems.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{ES.sessions.retailItems}</p>
                <div className="space-y-1">
                  {retailItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-1.5 px-2 bg-purple-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">{item.productName}</p>
                        <p className="text-xs text-gray-500">{item.quantity} × {fmtBs(item.unitPrice)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold text-gray-900">{fmtBs(item.total)}</span>
                        {session.status === 'active' && onRemoveRetailItem && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onRemoveRetailItem(item.id); }}
                            className="text-red-400 hover:text-red-600 p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-red-50"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary — client-facing: Servicios + Productos = Total */}
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

              {/* Sell product button */}
              {session.status === 'active' && onAddRetailProduct && (
                <Button variant="secondary" onClick={onAddRetailProduct} className="w-full" loading={loading}>
                  {ES.sessions.addRetailProduct}
                </Button>
              )}

              {/* Secondary actions */}
              <div className="flex flex-wrap gap-2">
                {onViewClientHistory && (
                  <Button size="sm" variant="ghost" onClick={onViewClientHistory} loading={loading}>
                    {ES.sessions.viewClientHistory}
                  </Button>
                )}
              </div>

              {/* Close + Cancel actions — separated with border */}
              {canCancel && (
                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-gray-100">
                  <Button variant="primary" onClick={() => setConfirmClose(true)} className="w-full sm:flex-1 bg-green-600 hover:bg-green-700" loading={loading}>
                    {ES.sessions.closeSession}
                  </Button>
                  {onCancelSession && (
                    <Button variant="ghost" onClick={() => setConfirmCancel(true)} className="w-full sm:flex-1 text-red-600 hover:bg-red-50" loading={loading}>
                      {ES.sessions.cancelSession}
                    </Button>
                  )}
                </div>
              )}

              {/* Non-admin close button (no cancel shown) */}
              {!canCancel && (
                <Button variant="primary" onClick={() => setConfirmClose(true)} className="w-full bg-green-600 hover:bg-green-700" loading={loading}>
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
          {remaining > 0.01 ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700 font-medium">{ES.sessions.closeHasBalance}</p>
              <p className="text-sm text-red-700 mt-1">{ES.payments.remaining}: <span className="font-bold">{fmtBs(remaining)}</span></p>
            </div>
          ) : (
            <p className="text-gray-700">{ES.sessions.confirmClose}</p>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setConfirmClose(false)} className="flex-1">
              {ES.actions.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => { onCloseSession(); setConfirmClose(false); }}
              className="flex-1"
              disabled={remaining > 0.01}
            >
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
