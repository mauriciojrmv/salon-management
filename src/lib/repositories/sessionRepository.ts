import { addDocument, updateDocument, getDocument, queryDocuments, firebaseConstraints } from '@/lib/firebase/db';
import { Session } from '@/types/models';
import { CreateSessionRequest } from '@/types/api';
import { sortByCreatedAtDesc } from '@/lib/utils/helpers';

export class SessionRepository {
  static async createSession(data: CreateSessionRequest): Promise<string> {
    return await addDocument('sessions', {
      ...data,
      services: [],
      payments: [],
      materialsUsed: [],
      totalAmount: 0,
      tax: 0,
      status: 'active',
    });
  }

  static async getSession(sessionId: string): Promise<Session | null> {
    return await getDocument('sessions', sessionId) as Session | null;
  }

  static async updateSession(sessionId: string, data: Partial<Record<string, unknown>>): Promise<void> {
    await updateDocument('sessions', sessionId, data);
  }

  static async getUserSessions(salonId: string, clientId: string): Promise<Session[]> {
    const results = await queryDocuments('sessions', [
      firebaseConstraints.where('salonId', '==', salonId),
      firebaseConstraints.where('clientId', '==', clientId),
    ]) as Session[];
    return results.sort(sortByCreatedAtDesc);
  }

  static async getSalonDailySessions(salonId: string, date: string): Promise<Session[]> {
    return await queryDocuments('sessions', [
      firebaseConstraints.where('salonId', '==', salonId),
      firebaseConstraints.where('date', '==', date),
    ]) as Session[];
  }

  static async getSalonSessions(salonId: string): Promise<Session[]> {
    const results = await queryDocuments('sessions', [
      firebaseConstraints.where('salonId', '==', salonId),
    ]) as Session[];
    return results.sort(sortByCreatedAtDesc);
  }
}
