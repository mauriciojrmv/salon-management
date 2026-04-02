'use client';

import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/Modal';
import { Session } from '@/types/models';
import { SessionService } from '@/lib/services/sessionService';
import { toDate, fmtBs, fmtDate } from '@/lib/utils/helpers';
import ES from '@/config/text.es';

interface ClientHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  salonId: string;
  getStaffName: (id: string) => string;
}

export function ClientHistoryModal({
  isOpen,
  onClose,
  clientId,
  clientName,
  salonId,
  getStaffName,
}: ClientHistoryModalProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && clientId && salonId) {
      setLoading(true);
      SessionService.getUserSessions(salonId, clientId)
        .then((data) => setSessions(data))
        .catch(() => setSessions([]))
        .finally(() => setLoading(false));
    }
  }, [isOpen, clientId, salonId]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${ES.sessions.clientHistory} — ${clientName}`} size="lg">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-center text-gray-500 py-8">{ES.sessions.noHistory}</p>
      ) : (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {sessions.map((session) => (
            <div key={session.id} className="border border-gray-200 rounded-lg p-4">
              {/* Session header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-900">
                  {fmtDate(session.date)}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  session.status === 'completed'
                    ? 'bg-green-100 text-green-700'
                    : session.status === 'active'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {session.status === 'completed' ? ES.sessions.completed
                    : session.status === 'active' ? ES.sessions.active
                    : ES.sessions.cancelled}
                </span>
              </div>

              {/* Services in this session */}
              {(session.services || []).map((service) => (
                <div key={service.id} className="py-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-800">{service.serviceName}</p>
                        <span className="text-xs text-gray-400">
                          {toDate(service.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {service.assignedStaff?.length > 0 && (
                        <p className="text-xs text-gray-500">
                          {service.assignedStaff.map((id) => getStaffName(id)).join(', ')}
                        </p>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-700">{fmtBs(service.price)}</p>
                  </div>

                  {/* Materials used — critical for tint/color reference */}
                  {service.materialsUsed?.length > 0 && (
                    <div className="mt-1 pl-3 border-l-2 border-gray-200">
                      {service.materialsUsed.map((mat, i) => (
                        <p key={i} className="text-xs text-gray-500">
                          {mat.productName}: {mat.quantity} {mat.unit}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Notes */}
                  {service.notes && (
                    <p className="text-xs text-gray-500 mt-1 italic">{service.notes}</p>
                  )}
                </div>
              ))}

              {/* Session total */}
              <div className="pt-2 border-t border-gray-100 flex justify-between text-sm">
                <span className="text-gray-500">{ES.payments.total}</span>
                <span className="font-semibold">{fmtBs(session.totalAmount)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
