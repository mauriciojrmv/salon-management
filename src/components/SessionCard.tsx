import React, { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Session } from '@/types/models';
import { toDate } from '@/lib/utils/helpers';
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
  canCancel?: boolean; // admin/manager only
}

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
  canCancel = false,
}: SessionCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const sessionServices = session.services || [];
  const sessionPayments = session.payments || [];
  const sessionMaterials = session.materialsUsed || [];

  const servicePrices = sessionServices.reduce((sum, s) => sum + s.price, 0);
  const materialPrices = sessionMaterials.reduce((sum, m) => sum + m.cost, 0);
  const total = servicePrices + materialPrices;
  const paidAmount = sessionPayments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = total - paidAmount;

  return (
    <Card>
      <CardHeader>
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div>
            <h3 className="font-semibold text-gray-900 text-lg">{clientName}</h3>
            <p className="text-sm text-gray-500">
              {sessionServices.length} {ES.sessions.services.toLowerCase()} · ${total.toFixed(2)}
            </p>
          </div>
          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
            {ES.sessions.active}
          </span>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardBody>
          {/* Services list */}
          {sessionServices.length > 0 ? (
            <div className="space-y-2 mb-4">
              {sessionServices.map((service) => {
                const statusConfig: Record<string, { label: string; color: string; next?: 'in_progress' | 'completed' }> = {
                  pending: { label: ES.sessions.pendingService, color: 'bg-yellow-100 text-yellow-700', next: 'in_progress' },
                  in_progress: { label: ES.sessions.inProgressService, color: 'bg-blue-100 text-blue-700', next: 'completed' },
                  completed: { label: ES.sessions.completedService, color: 'bg-green-100 text-green-700' },
                };
                const svcStatus = statusConfig[service.status || 'pending'] || statusConfig.pending;

                return (
                  <div key={service.id} className="py-2 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-900">{service.serviceName}</p>
                          <span className="text-xs text-gray-400">
                            {toDate(service.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {onUpdateServiceStatus && svcStatus.next ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateServiceStatus(service.id, svcStatus.next!);
                              }}
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${svcStatus.color} hover:opacity-80 transition-opacity`}
                              title={svcStatus.next === 'in_progress' ? ES.sessions.inProgressService : ES.sessions.completedService}
                            >
                              {svcStatus.label} →
                            </button>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${svcStatus.color}`}>
                              {svcStatus.label}
                            </span>
                          )}
                        </div>
                        {service.assignedStaff?.length > 0 && (
                          <p className="text-xs text-gray-500">
                            {service.assignedStaff.map((id) => getStaffName(id)).join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">${service.price.toFixed(2)}</p>
                        {onRemoveService && canCancel && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(ES.sessions.confirmRemoveService)) {
                                onRemoveService(service.id);
                              }
                            }}
                            className="text-red-400 hover:text-red-600 text-xs p-1"
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
                          <p key={i} className="text-xs text-gray-400">
                            {mat.productName}: {mat.quantity} {mat.unit} · ${mat.cost.toFixed(2)}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 mb-4">{ES.sessions.noServices}</p>
          )}

          {/* Summary — client-facing: Servicios + Materiales = Total */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">{ES.sessions.servicesSubtotal}</span>
              <span className="font-medium">${servicePrices.toFixed(2)}</span>
            </div>
            {materialPrices > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">{ES.sessions.materialsSubtotal}</span>
                <span className="font-medium">${materialPrices.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
              <span className="text-gray-900 font-semibold">{ES.payments.total}</span>
              <span className="text-gray-900 font-bold">${total.toFixed(2)}</span>
            </div>
            {paidAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">{ES.payments.paid}</span>
                <span className="text-green-600 font-semibold">${paidAmount.toFixed(2)}</span>
              </div>
            )}
            {remaining > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">{ES.payments.remaining}</span>
                <span className="text-red-600 font-semibold">${remaining.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={onAddService}>
              {ES.sessions.addService}
            </Button>
            <Button size="sm" variant="primary" onClick={onProcessPayment}>
              {ES.payments.processPayment}
            </Button>
            {onViewClientHistory && (
              <Button size="sm" variant="ghost" onClick={onViewClientHistory}>
                {ES.sessions.viewClientHistory}
              </Button>
            )}
            <Button size="sm" variant="danger" onClick={onCloseSession}>
              {ES.sessions.closeSession}
            </Button>
            {canCancel && onCancelSession && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (confirm(ES.sessions.confirmCancel)) {
                    onCancelSession();
                  }
                }}
              >
                {ES.sessions.cancelSession}
              </Button>
            )}
          </div>
        </CardBody>
      )}
    </Card>
  );
}
