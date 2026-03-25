import { addDocument, updateDocument, getDocument, queryDocuments, firebaseConstraints } from '@/lib/firebase/db';
import { Session, SessionServiceItem, MaterialUsage, Payment } from '@/types/models';
import { CreateSessionRequest, AddServiceToSessionRequest, RecordMaterialUsageRequest, ProcessPaymentRequest } from '@/types/api';

export class SessionService {
  static async createSession(data: CreateSessionRequest): Promise<string> {
    const sessionId = await addDocument('sessions', {
      ...data,
      services: [],
      payments: [],
      materialsUsed: [],
      totalAmount: 0,
      tax: 0,
      status: 'active',
    });
    return sessionId;
  }

  static async getSession(sessionId: string): Promise<Session | null> {
    return await getDocument('sessions', sessionId) as Session | null;
  }

  static async addServiceToSession(data: AddServiceToSessionRequest): Promise<void> {
    const session = await this.getSession(data.sessionId);
    if (!session) throw new Error('Session not found');

    const newService: SessionServiceItem = {
      id: `service_${Date.now()}`,
      serviceId: data.serviceId,
      serviceName: '', // Fetch from service
      price: 0, // Fetch from service
      assignedStaff: data.staffIds,
      startTime: new Date(),
      status: 'pending',
      materialsUsed: [],
    };

    const updatedServices = [...session.services, newService];
    const newTotal = updatedServices.reduce((sum, s) => sum + s.price, 0);

    await updateDocument('sessions', data.sessionId, {
      services: updatedServices,
      totalAmount: newTotal,
    });
  }

  static async recordMaterialUsage(data: RecordMaterialUsageRequest): Promise<void> {
    const session = await this.getSession(data.sessionId);
    if (!session) throw new Error('Session not found');

    const materialUsage: MaterialUsage = {
      productId: data.productId,
      productName: '', // Fetch from product
      quantity: data.quantity,
      unit: '', // Fetch from product
      cost: 0, // Calculate based on product cost
      usedAt: new Date(),
    };

    const updatedMaterials = [...session.materialsUsed, materialUsage];
    await updateDocument('sessions', data.sessionId, {
      materialsUsed: updatedMaterials,
    });
  }

  static async processPayment(data: ProcessPaymentRequest): Promise<void> {
    const session = await this.getSession(data.sessionId);
    if (!session) throw new Error('Session not found');

    const payment: Payment = {
      id: `payment_${Date.now()}`,
      salonId: session.salonId,
      sessionId: data.sessionId,
      amount: data.amount,
      method: data.method as any,
      status: 'completed',
      processedAt: new Date(),
    };

    const updatedPayments = [...session.payments, payment];
    const paidAmount = updatedPayments.reduce((sum, p) => sum + (p.status === 'completed' ? p.amount : 0), 0);

    await updateDocument('sessions', data.sessionId, {
      payments: updatedPayments,
    });
  }

  static async closeSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    // Calculate final totals
    const totalAmount = session.services.reduce((sum, s) => sum + s.price, 0);
    const tax = totalAmount * 0.1; // Example: 10% tax
    const materialsTotal = session.materialsUsed.reduce((sum, m) => sum + m.cost, 0);

    await updateDocument('sessions', sessionId, {
      status: 'completed',
      endTime: new Date(),
      totalAmount,
      tax,
    });
  }

  static async getUserSessions(salonId: string, clientId: string): Promise<Session[]> {
    return await queryDocuments('sessions', [
      firebaseConstraints.where('salonId', '==', salonId),
      firebaseConstraints.where('clientId', '==', clientId),
      firebaseConstraints.orderBy('createdAt', 'desc'),
    ]) as Session[];
  }

  static async getSalonDailySessions(salonId: string, date: string): Promise<Session[]> {
    return await queryDocuments('sessions', [
      firebaseConstraints.where('salonId', '==', salonId),
      firebaseConstraints.where('date', '==', date),
    ]) as Session[];
  }
}
