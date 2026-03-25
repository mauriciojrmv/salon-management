'use client';

import React, { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { Modal } from '@/components/Modal';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useNotification } from '@/hooks/useNotification';
import { SessionService } from '@/lib/services/sessionService';
import { Session } from '@/types/models';

export default function SessionsPage() {
  const { userData } = useAuth();
  const { success, error } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientId, setClientId] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: sessions, refetch } = useAsync(async () => {
    if (!userData?.salonId) return [];
    const today = new Date().toISOString().split('T')[0];
    return SessionService.getSalonDailySessions(userData.salonId, today);
  }, [userData?.salonId]);

  const handleCreateSession = async () => {
    if (!clientId || !userData?.salonId) {
      error('Please select a client');
      return;
    }

    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await SessionService.createSession({
        clientId,
        date: today,
        startTime: new Date(),
        salonId: userData.salonId,
      });
      success('Session created successfully');
      setIsModalOpen(false);
      setClientId('');
      refetch();
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Sessions</h1>
        <Button onClick={() => setIsModalOpen(true)} size="lg">
          + New Session
        </Button>
      </div>

      {/* Active Sessions */}
      <div className="grid grid-cols-1 gap-4">
        {sessions?.filter((s) => s.status === 'active').length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-center text-gray-500">No active sessions</p>
            </CardBody>
          </Card>
        ) : (
          sessions
            ?.filter((s) => s.status === 'active')
            .map((session) => (
              <SessionCard key={session.id} session={session} />
            ))
        )}
      </div>

      {/* Create Session Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Session">
        <div className="space-y-4">
          <Input
            label="Client ID"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Enter client ID"
            required
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSession} loading={loading}>
              Create Session
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SessionCard({ session }: { session: Session }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card onClick={() => setIsExpanded(!isExpanded)} className="cursor-pointer">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Session {session.id}</h3>
            <p className="text-sm text-gray-600">Client: {session.clientId}</p>
          </div>
          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
            {session.status}
          </span>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardBody>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="text-lg font-semibold">${session.totalAmount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Services</p>
              <p className="text-lg font-semibold">{session.services.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Start Time</p>
              <p className="text-sm">{new Date(session.startTime).toLocaleTimeString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Tax</p>
              <p className="text-lg font-semibold">${session.tax.toFixed(2)}</p>
            </div>
          </div>

          {session.services.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="font-semibold text-gray-900 mb-3">Services</h4>
              <div className="space-y-2">
                {session.services.map((service) => (
                  <div key={service.id} className="flex justify-between text-sm">
                    <span className="text-gray-700">{service.serviceName}</span>
                    <span className="font-medium">${service.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <Button size="sm" variant="secondary">
              Add Service
            </Button>
            <Button size="sm" variant="primary">
              Close Session
            </Button>
          </div>
        </CardBody>
      )}
    </Card>
  );
}
