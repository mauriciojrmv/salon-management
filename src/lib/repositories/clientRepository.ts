import { addDocument, updateDocument, getDocument, queryDocuments, deleteDocument, firebaseConstraints } from '@/lib/firebase/db';
import { Client } from '@/types/models';
import { CreateClientRequest } from '@/types/api';
import { sortByCreatedAtDesc } from '@/lib/utils/helpers';

export class ClientRepository {
  static async findByPhone(salonId: string, phone: string): Promise<Client | null> {
    if (!phone) return null;
    const results = await queryDocuments('users', [
      firebaseConstraints.where('salonId', '==', salonId),
      firebaseConstraints.where('role', '==', 'client'),
      firebaseConstraints.where('phone', '==', phone),
      firebaseConstraints.where('isActive', '==', true),
    ]) as Client[];
    return results.length > 0 ? results[0] : null;
  }

  static async createClient(salonId: string, data: CreateClientRequest): Promise<string> {
    if (!data.firstName) {
      throw new Error('Missing required fields');
    }

    // Check phone uniqueness if phone is provided
    if (data.phone) {
      const existing = await this.findByPhone(salonId, data.phone);
      if (existing) {
        throw new Error('PHONE_EXISTS');
      }
    }

    const clientId = await addDocument('users', {
      email: data.email || '',
      firstName: data.firstName,
      lastName: data.lastName || '',
      phone: data.phone,
      dateOfBirth: data.dateOfBirth || '',
      gender: data.gender || '',
      notes: data.notes || '',
      role: 'client',
      salonId,
      totalSpent: 0,
      totalSessions: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return clientId;
  }

  static async getClient(clientId: string): Promise<Client | null> {
    return await getDocument('users', clientId) as Client | null;
  }

  static async updateClient(clientId: string, data: Partial<Client>): Promise<void> {
    await updateDocument('users', clientId, {
      ...data,
      updatedAt: new Date(),
    });
  }

  static async deleteClient(clientId: string): Promise<void> {
    await deleteDocument('users', clientId);
  }

  static async getSalonClients(salonId: string): Promise<Client[]> {
    const results = await queryDocuments('users', [
      firebaseConstraints.where('salonId', '==', salonId),
      firebaseConstraints.where('role', '==', 'client'),
      firebaseConstraints.where('isActive', '==', true),
    ]) as Client[];
    return results.sort(sortByCreatedAtDesc);
  }

  static async searchClients(salonId: string, searchTerm: string): Promise<Client[]> {
    const clients = await this.getSalonClients(salonId);
    const term = searchTerm.toLowerCase();
    return clients.filter(
      (c) =>
        c.firstName.toLowerCase().includes(term) ||
        c.lastName.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        (c.phone && c.phone.includes(term))
    );
  }

  static async updateClientSpent(clientId: string, amount: number): Promise<void> {
    const client = await this.getClient(clientId);
    if (!client) throw new Error('Client not found');

    await this.updateClient(clientId, {
      totalSpent: (client.totalSpent || 0) + amount,
      lastVisit: new Date(),
    });
  }

  static async incrementClientSessions(clientId: string): Promise<void> {
    const client = await this.getClient(clientId);
    if (!client) throw new Error('Client not found');

    await this.updateClient(clientId, {
      totalSessions: (client.totalSessions || 0) + 1,
    });
  }

  static async addCredit(clientId: string, amount: number): Promise<void> {
    const client = await this.getClient(clientId);
    if (!client) throw new Error('Client not found');
    await this.updateClient(clientId, {
      creditBalance: (client.creditBalance || 0) + amount,
    });
  }

  static async deductCredit(clientId: string, amount: number): Promise<void> {
    const client = await this.getClient(clientId);
    if (!client) throw new Error('Client not found');
    const current = client.creditBalance || 0;
    if (amount > current) throw new Error('Insufficient credit balance');
    await this.updateClient(clientId, {
      creditBalance: current - amount,
    });
  }
}
