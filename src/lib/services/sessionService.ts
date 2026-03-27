import { SessionRepository } from '@/lib/repositories/sessionRepository';
import { ProductRepository } from '@/lib/repositories/productRepository';
import { Session, SessionServiceItem, MaterialUsage, Payment } from '@/types/models';
import { AddServiceToSessionRequest, ProcessPaymentRequest, CreateSessionRequest } from '@/types/api';
import { batchUpdate } from '@/lib/firebase/db';
import { DEFAULT_COMMISSION_RATE } from '@/lib/utils/helpers';

function auditLog(action: string, details: Record<string, unknown>) {
  console.log(`[AUDIT] ${new Date().toISOString()} | ${action}`, details);
}

export class SessionService {
  static async createSession(data: CreateSessionRequest): Promise<string> {
    const id = await SessionRepository.createSession(data);
    auditLog('SESSION_CREATED', { sessionId: id, clientId: data.clientId, salonId: data.salonId });
    return id;
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

    // totalAmount = service prices + material sell prices (what client pays)
    const servicePrices = updatedServices.reduce((sum, s) => sum + s.price, 0);
    const materialSellPrices = updatedSessionMaterials.reduce((sum, m) => sum + m.cost, 0);
    const newTotal = servicePrices + materialSellPrices;

    await SessionRepository.updateSession(data.sessionId, {
      services: updatedServices,
      materialsUsed: updatedSessionMaterials,
      totalAmount: newTotal,
    });
    auditLog('SERVICE_ADDED', { sessionId: data.sessionId, serviceId: data.serviceId, serviceName: data.serviceName, price: data.price, materials: materials.length });
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

    // totalAmount = service prices + material sell prices
    const servicePrices = (session.services || []).reduce((sum, s) => sum + s.price, 0);
    const materialSellPrices = (session.materialsUsed || []).reduce((sum, m) => sum + m.cost, 0);
    const totalAmount = servicePrices + materialSellPrices;

    await SessionRepository.updateSession(sessionId, {
      status: 'completed',
      endTime: new Date(),
      totalAmount,
    });
    auditLog('SESSION_CLOSED', { sessionId, totalAmount });
  }

  static async cancelSession(sessionId: string, reason: string): Promise<void> {
    const session = await SessionRepository.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.status === 'cancelled') throw new Error('Session already cancelled');

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
    auditLog('SESSION_CANCELLED', { sessionId, reason, materialsRestored: (session.materialsUsed || []).length, paymentsVoided: (session.payments || []).length });
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

    // Recalculate total
    const servicePrices = updatedServices.reduce((sum, s) => sum + s.price, 0);
    const materialSellPrices = remainingMaterials.reduce((sum, m) => sum + m.cost, 0);

    await SessionRepository.updateSession(sessionId, {
      services: updatedServices,
      materialsUsed: remainingMaterials,
      totalAmount: servicePrices + materialSellPrices,
    });
    auditLog('SERVICE_REMOVED', { sessionId, serviceItemId, serviceName: serviceToRemove.serviceName, materialsRestored: materialsToRestore.length });
  }

  static async updateServiceStatus(
    sessionId: string,
    serviceItemId: string,
    newStatus: 'pending' | 'in_progress' | 'completed'
  ): Promise<void> {
    const session = await SessionRepository.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.status !== 'active') throw new Error('Can only update services on active sessions');

    const updatedServices = (session.services || []).map((s) =>
      s.id === serviceItemId ? { ...s, status: newStatus } : s
    );

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
