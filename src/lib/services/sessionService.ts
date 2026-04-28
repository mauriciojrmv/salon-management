import { SessionRepository } from '@/lib/repositories/sessionRepository';
import { ProductRepository } from '@/lib/repositories/productRepository';
import { ClientRepository } from '@/lib/repositories/clientRepository';
import { ServiceRepository } from '@/lib/repositories/serviceRepository';
import { LoyaltyRepository } from '@/lib/repositories/loyaltyRepository';
import { Session, SessionServiceItem, MaterialUsage, Payment, Appointment, Service, Client } from '@/types/models';
import { AddServiceToSessionRequest, ProcessPaymentRequest, CreateSessionRequest } from '@/types/api';
import { batchUpdate } from '@/lib/firebase/db';
import { DEFAULT_COMMISSION_RATE, LOYALTY_POINTS_RATE, getBoliviaDate } from '@/lib/utils/helpers';

function auditLog(action: string, details: Record<string, unknown>) {
  console.log(`[AUDIT] ${new Date().toISOString()} | ${action}`, details);
}

export class SessionService {
  static async createSession(data: CreateSessionRequest): Promise<string> {
    const id = await SessionRepository.createSession(data);
    auditLog('SESSION_CREATED', { sessionId: id, clientId: data.clientId, salonId: data.salonId });
    return id;
  }

  // Atomic conversion: builds the SessionServiceItem array from the appointment
  // and writes a single Firestore document with services already populated.
  // Falls back to fetching the salon's services if any appointment serviceId is
  // missing from the in-memory lookup — prevents the silent "started session has
  // no work" bug when the page's service cache is stale or partial.
  static async createSessionFromAppointment(
    salonId: string,
    appointment: Appointment,
    servicesLookup?: Service[],
  ): Promise<string> {
    const serviceIds = appointment.serviceIds || [];
    let pool: Service[] = servicesLookup || [];
    const allFound = serviceIds.every((sid) => pool.some((s) => s.id === sid));
    if (!allFound) {
      pool = await ServiceRepository.getSalonServices(salonId);
    }

    const items: SessionServiceItem[] = [];
    const missing: string[] = [];
    for (const sid of serviceIds) {
      const svc = pool.find((s) => s.id === sid);
      if (!svc) {
        missing.push(sid);
        continue;
      }
      items.push({
        id: `service_${Date.now()}_${items.length}`,
        serviceId: svc.id,
        serviceName: svc.name,
        price: svc.price,
        commissionRate: DEFAULT_COMMISSION_RATE,
        assignedStaff: appointment.staffId ? [appointment.staffId] : [],
        startTime: new Date(),
        status: 'pending',
        materialsUsed: [],
      });
    }

    if (serviceIds.length > 0 && items.length === 0) {
      throw new Error('APPOINTMENT_SERVICES_MISSING');
    }

    const totalAmount = items.reduce((sum, s) => sum + s.price, 0);
    const sessionId = await SessionRepository.createSessionWithServices(
      {
        salonId,
        clientId: appointment.clientId,
        date: getBoliviaDate(),
        startTime: new Date(),
      },
      items,
      totalAmount,
    );

    auditLog('SESSION_CREATED_FROM_APPOINTMENT', {
      sessionId,
      appointmentId: appointment.id,
      serviceCount: items.length,
      missing,
    });
    return sessionId;
  }

  static async getSession(sessionId: string): Promise<Session | null> {
    return SessionRepository.getSession(sessionId);
  }

  static async addServiceToSession(data: AddServiceToSessionRequest): Promise<void> {
    const session = await SessionRepository.getSession(data.sessionId);
    if (!session) throw new Error('Session not found');

    const materials: MaterialUsage[] = (data.materials || []).map((m) => ({
      productId: m.productId,
      productName: m.productName,
      quantity: m.quantity,
      unit: m.unit,
      cost: m.cost,
      usedAt: new Date(),
    }));

    const newService: SessionServiceItem = {
      id: `service_${Date.now()}`,
      serviceId: data.serviceId,
      serviceName: data.serviceName,
      price: data.price,
      commissionRate: DEFAULT_COMMISSION_RATE,
      assignedStaff: data.staffIds,
      startTime: new Date(),
      status: 'pending',
      materialsUsed: materials,
    };

    const updatedServices = [...(session.services || []), newService];
    const updatedSessionMaterials = [...(session.materialsUsed || []), ...materials];

    // totalAmount = service prices + retail items — materials are internal cost tracking, NOT charged to client
    const servicePrices = updatedServices.reduce((sum, s) => sum + s.price, 0);
    const retailTotal = (session.retailItems || []).reduce((sum, r) => sum + r.total, 0);

    // Adding a service to a completed session auto-reopens it so the new work can be processed
    const reopen = session.status === 'completed';

    await SessionRepository.updateSession(data.sessionId, {
      services: updatedServices,
      materialsUsed: updatedSessionMaterials,
      totalAmount: servicePrices + retailTotal,
      ...(reopen ? { status: 'active' } : {}),
    });
    auditLog('SERVICE_ADDED', { sessionId: data.sessionId, serviceId: data.serviceId, serviceName: data.serviceName, price: data.price, materials: materials.length, reopened: reopen });
  }

  static async processPayment(data: ProcessPaymentRequest): Promise<void> {
    const session = await SessionRepository.getSession(data.sessionId);
    if (!session) throw new Error('Session not found');
    if (session.status === 'cancelled') throw new Error('Cannot add payments to a cancelled session');

    const totalPaid = (session.payments || [])
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);
    if (data.amount <= 0) throw new Error('Payment amount must be greater than zero');
    if (totalPaid + data.amount > session.totalAmount * 1.01) {
      throw new Error('Payment exceeds remaining balance');
    }

    const payment: Payment = {
      id: `payment_${Date.now()}`,
      salonId: session.salonId,
      sessionId: data.sessionId,
      amount: data.amount,
      method: data.method as Payment['method'],
      status: 'completed',
      processedAt: new Date(),
      ...(data.serviceIds && data.serviceIds.length > 0 ? { serviceIds: data.serviceIds } : {}),
    };

    const updatedPayments = [...(session.payments || []), payment];

    await SessionRepository.updateSession(data.sessionId, {
      payments: updatedPayments,
    });
    auditLog('PAYMENT_PROCESSED', { sessionId: data.sessionId, amount: data.amount, method: data.method, serviceIds: data.serviceIds });
  }

  static async closeSession(sessionId: string): Promise<void> {
    const session = await SessionRepository.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    // totalAmount = service prices + retail items — materials are internal cost tracking, NOT charged to client
    const servicePrices = (session.services || []).reduce((sum, s) => sum + s.price, 0);
    const retailTotal = (session.retailItems || []).reduce((sum, r) => sum + r.total, 0);
    const totalAmount = servicePrices + retailTotal;

    // Block close when there's an outstanding balance — session must be fully paid
    const totalPaid = (session.payments || [])
      .filter((p) => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);
    const remaining = totalAmount - totalPaid;
    if (remaining > 0.01) {
      throw new Error(`SESSION_UNPAID_BALANCE:${remaining.toFixed(2)}`);
    }

    // Guard: only award loyalty points once per session
    const alreadyAwarded = (session as unknown as Record<string, unknown>).loyaltyPointsAwarded === true;
    const pointsEarned = alreadyAwarded ? 0 : Math.floor(totalAmount / LOYALTY_POINTS_RATE);

    // Cascade: any service still in pending/in_progress/paused when the session
    // closes is treated as done. Without this, /my-work and /my-earnings (which
    // filter on svc.status === 'completed') stay empty for the worker even
    // though the session is closed and they're in assignedStaff.
    const cascadedServices = (session.services || []).map((s) =>
      s.status === 'completed' ? s : { ...s, status: 'completed' as const },
    );

    await SessionRepository.updateSession(sessionId, {
      status: 'completed',
      endTime: new Date(),
      totalAmount,
      services: cascadedServices,
      ...(pointsEarned > 0 ? { loyaltyPointsAwarded: true } : {}),
    });

    // Update client totalSpent and award loyalty points + persist per-(staff, service)
    // recipe memory so the worker doesn't have to re-enter the same materials on
    // the next visit. Keyed by `${primaryStaffId}__${serviceId}`. Skipped for
    // walk-ins (no clientId) and for services with no assigned staff.
    if (session.clientId) {
      try {
        const client = await ClientRepository.getClient(session.clientId);
        if (client) {
          const existingFormulas = (client as Client & { lastFormulasByStaff?: Record<string, unknown> }).lastFormulasByStaff || {};
          const updatedFormulas: Record<string, { materials: MaterialUsage[]; updatedAt: Date }> = { ...existingFormulas as Record<string, { materials: MaterialUsage[]; updatedAt: Date }> };
          for (const svc of cascadedServices) {
            const primaryStaff = svc.assignedStaff?.[0];
            if (!primaryStaff || !svc.serviceId) continue;
            const mats = svc.materialsUsed || [];
            // Only persist if there were materials — empty list shouldn't overwrite a
            // prior good recipe. Skipped services / no-material services keep the
            // last known formula.
            if (mats.length === 0) continue;
            const key = `${primaryStaff}__${svc.serviceId}`;
            updatedFormulas[key] = {
              materials: mats.map((m) => ({
                productId: m.productId,
                productName: m.productName,
                quantity: m.quantity,
                unit: m.unit,
                cost: m.cost,
                usedAt: m.usedAt,
              })),
              updatedAt: new Date(),
            };
          }
          await ClientRepository.updateClient(session.clientId, {
            totalSpent: (client.totalSpent || 0) + totalAmount,
            totalSessions: (client.totalSessions || 0) + 1,
            lastVisit: new Date(),
            ...(pointsEarned > 0 ? { loyaltyPoints: (client.loyaltyPoints || 0) + pointsEarned } : {}),
            ...(Object.keys(updatedFormulas).length > 0 ? { lastFormulasByStaff: updatedFormulas } : {}),
          } as Partial<Client>);
          if (pointsEarned > 0) {
            await LoyaltyRepository.addTransaction({
              salonId: session.salonId,
              clientId: session.clientId,
              type: 'earned',
              points: pointsEarned,
              description: `Trabajo #${sessionId.slice(-6)} — Bs. ${totalAmount.toFixed(2)}`,
              sessionId,
            });
          }
        }
      } catch (err) {
        console.error('Failed to update client stats:', err);
      }
    }

    auditLog('SESSION_CLOSED', { sessionId, totalAmount, pointsEarned });
  }

  static async cancelSession(sessionId: string, reason: string): Promise<void> {
    const session = await SessionRepository.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.status === 'cancelled') throw new Error('Session already cancelled');

    // Reverse loyalty activity on this session: refund redeemed points AND revoke earned points.
    // Also reverse client stats if the session had been completed.
    if (session.clientId) {
      try {
        const txs = await LoyaltyRepository.getClientTransactions(session.salonId, session.clientId);
        const sessionTxs = txs.filter((t) => t.sessionId === sessionId);
        const redeemedPoints = sessionTxs.filter((t) => t.type === 'redeemed').reduce((sum, t) => sum + t.points, 0);
        const earnedPoints = sessionTxs.filter((t) => t.type === 'earned').reduce((sum, t) => sum + t.points, 0);
        const netAdjustment = redeemedPoints - earnedPoints;
        const client = await ClientRepository.getClient(session.clientId);
        if (client) {
          const updates: Record<string, unknown> = {};
          if (netAdjustment !== 0) {
            updates.loyaltyPoints = Math.max(0, (client.loyaltyPoints || 0) + netAdjustment);
          }
          // If session was completed, its close() had bumped totalSpent/totalSessions — reverse them
          if (session.status === 'completed') {
            updates.totalSpent = Math.max(0, (client.totalSpent || 0) - (session.totalAmount || 0));
            updates.totalSessions = Math.max(0, (client.totalSessions || 0) - 1);
          }
          if (Object.keys(updates).length > 0) {
            await ClientRepository.updateClient(session.clientId, updates);
          }
        }
        if (netAdjustment !== 0) {
          if (redeemedPoints > 0) {
            await LoyaltyRepository.addTransaction({
              salonId: session.salonId,
              clientId: session.clientId,
              type: 'earned',
              points: redeemedPoints,
              description: `Reembolso por anulación — Trabajo #${sessionId.slice(-6)}`,
              sessionId,
            });
          }
          if (earnedPoints > 0) {
            await LoyaltyRepository.addTransaction({
              salonId: session.salonId,
              clientId: session.clientId,
              type: 'redeemed',
              points: earnedPoints,
              description: `Reverso por anulación — Trabajo #${sessionId.slice(-6)}`,
              sessionId,
            });
          }
        }
      } catch (err) {
        console.error('Failed to reverse loyalty on cancel:', err);
      }
    }

    // Restore stock for all materials used across all services
    const allMaterials = session.materialsUsed || [];
    if (allMaterials.length > 0) {
      const stockRestores = await Promise.all(
        allMaterials.map(async (m) => {
          const product = await ProductRepository.getProduct(m.productId);
          if (!product) return null;
          return {
            collection: 'products',
            docId: m.productId,
            data: { currentStock: product.currentStock + m.quantity } as Record<string, unknown>,
          };
        })
      );
      const validRestores = stockRestores.filter((r): r is NonNullable<typeof r> => r !== null);
      if (validRestores.length > 0) {
        await batchUpdate(validRestores);
      }
    }

    // Restore stock for retail items sold in this session
    const retailItems = session.retailItems || [];
    if (retailItems.length > 0) {
      const retailRestores = await Promise.all(
        retailItems.map(async (item) => {
          const product = await ProductRepository.getProduct(item.productId);
          if (!product) return null;
          return {
            collection: 'products',
            docId: item.productId,
            data: { currentStock: product.currentStock + item.quantity } as Record<string, unknown>,
          };
        })
      );
      const validRetailRestores = retailRestores.filter((r): r is NonNullable<typeof r> => r !== null);
      if (validRetailRestores.length > 0) {
        await batchUpdate(validRetailRestores);
      }
    }

    // Void all payments (mark as refunded, don't delete)
    const updatedPayments = (session.payments || []).map((p) => ({
      ...p,
      status: 'refunded' as const,
      refundedAt: new Date(),
      refundAmount: p.amount,
    }));

    await SessionRepository.updateSession(sessionId, {
      status: 'cancelled',
      endTime: new Date(),
      payments: updatedPayments,
      notes: `ANULADO: ${reason}${session.notes ? ` | ${session.notes}` : ''}`,
    });
    auditLog('SESSION_CANCELLED', { sessionId, reason, materialsRestored: (session.materialsUsed || []).length, retailRestored: retailItems.length, paymentsVoided: (session.payments || []).length });
  }

  static async removeServiceFromSession(sessionId: string, serviceItemId: string): Promise<void> {
    const session = await SessionRepository.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.status !== 'active') throw new Error('Can only remove services from active sessions');

    const serviceToRemove = (session.services || []).find((s) => s.id === serviceItemId);
    if (!serviceToRemove) throw new Error('Service not found in session');

    // Restore stock for this service's materials
    const materialsToRestore = serviceToRemove.materialsUsed || [];
    if (materialsToRestore.length > 0) {
      const stockRestores = await Promise.all(
        materialsToRestore.map(async (m) => {
          const product = await ProductRepository.getProduct(m.productId);
          if (!product) return null;
          return {
            collection: 'products',
            docId: m.productId,
            data: { currentStock: product.currentStock + m.quantity } as Record<string, unknown>,
          };
        })
      );
      const validRestores = stockRestores.filter((r): r is NonNullable<typeof r> => r !== null);
      if (validRestores.length > 0) {
        await batchUpdate(validRestores);
      }
    }

    // Remove service and its materials from session
    const updatedServices = (session.services || []).filter((s) => s.id !== serviceItemId);
    const removedMaterialIds = new Set(materialsToRestore.map((m) => `${m.productId}_${m.quantity}_${m.cost}`));
    let remainingMaterials = [...(session.materialsUsed || [])];
    for (const mat of materialsToRestore) {
      const idx = remainingMaterials.findIndex(
        (m) => m.productId === mat.productId && m.quantity === mat.quantity && m.cost === mat.cost
      );
      if (idx !== -1) remainingMaterials.splice(idx, 1);
    }

    // Recalculate total — service prices + retail items
    const servicePrices = updatedServices.reduce((sum, s) => sum + s.price, 0);
    const retailTotal = (session.retailItems || []).reduce((sum, r) => sum + r.total, 0);

    await SessionRepository.updateSession(sessionId, {
      services: updatedServices,
      materialsUsed: remainingMaterials,
      totalAmount: servicePrices + retailTotal,
    });
    auditLog('SERVICE_REMOVED', { sessionId, serviceItemId, serviceName: serviceToRemove.serviceName, materialsRestored: materialsToRestore.length });
  }

  static async updateServiceStatus(
    sessionId: string,
    serviceItemId: string,
    newStatus: 'pending' | 'in_progress' | 'paused' | 'completed'
  ): Promise<void> {
    const session = await SessionRepository.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.status !== 'active') throw new Error('Can only update services on active sessions');

    const updatedServices = (session.services || []).map((s) => {
      if (s.id !== serviceItemId) return s;
      const patch: Partial<SessionServiceItem> = { status: newStatus };
      if (newStatus === 'paused') patch.pausedAt = new Date();
      return { ...s, ...patch };
    });

    await SessionRepository.updateSession(sessionId, {
      services: updatedServices,
    });
  }

  static async reopenSession(sessionId: string): Promise<void> {
    const session = await SessionRepository.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.status !== 'completed') throw new Error('Can only reopen completed sessions');

    await SessionRepository.updateSession(sessionId, {
      status: 'active',
      endTime: '',
    });
    auditLog('SESSION_REOPENED', { sessionId });
  }

  static async assignClient(sessionId: string, newClientId: string): Promise<void> {
    const session = await SessionRepository.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.status === 'cancelled') throw new Error('Cannot assign client on cancelled session');
    // Only allow attach-from-walkin; swapping A→B requires manual stats reversal
    if (session.clientId) throw new Error('SESSION_ALREADY_HAS_CLIENT');
    if (!newClientId) throw new Error('Client id required');

    await SessionRepository.updateSession(sessionId, { clientId: newClientId });

    // If session was already completed when walk-in: reconcile client stats + loyalty now
    if (session.status === 'completed') {
      const totalAmount = session.totalAmount || 0;
      const alreadyAwarded = (session as unknown as Record<string, unknown>).loyaltyPointsAwarded === true;
      const pointsEarned = alreadyAwarded ? 0 : Math.floor(totalAmount / LOYALTY_POINTS_RATE);

      try {
        const client = await ClientRepository.getClient(newClientId);
        if (client) {
          await ClientRepository.updateClient(newClientId, {
            totalSpent: (client.totalSpent || 0) + totalAmount,
            totalSessions: (client.totalSessions || 0) + 1,
            lastVisit: new Date(),
            ...(pointsEarned > 0 ? { loyaltyPoints: (client.loyaltyPoints || 0) + pointsEarned } : {}),
          });
          if (pointsEarned > 0) {
            await SessionRepository.updateSession(sessionId, { loyaltyPointsAwarded: true } as Record<string, unknown>);
            await LoyaltyRepository.addTransaction({
              salonId: session.salonId,
              clientId: newClientId,
              type: 'earned',
              points: pointsEarned,
              description: `Trabajo #${sessionId.slice(-6)} — Bs. ${totalAmount.toFixed(2)}`,
              sessionId,
            });
          }
        }
      } catch (err) {
        console.error('Failed to reconcile client stats on assign:', err);
      }
    }

    auditLog('CLIENT_ASSIGNED', { sessionId, newClientId, status: session.status });
  }

  static async addSessionNote(sessionId: string, note: string): Promise<void> {
    const session = await SessionRepository.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const existing = session.notes || '';
    const timestamp = new Date().toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const updatedNotes = existing
      ? `${existing} | [${timestamp}] ${note}`
      : `[${timestamp}] ${note}`;

    await SessionRepository.updateSession(sessionId, { notes: updatedNotes });
    auditLog('NOTE_ADDED', { sessionId, note });
  }

  static async getUserSessions(salonId: string, clientId: string): Promise<Session[]> {
    return SessionRepository.getUserSessions(salonId, clientId);
  }

  static async getSalonDailySessions(salonId: string, date: string): Promise<Session[]> {
    return SessionRepository.getSalonDailySessions(salonId, date);
  }
}
