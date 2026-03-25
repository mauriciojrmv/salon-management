import { addDocument, updateDocument, getDocument, queryDocuments, firebaseConstraints } from '@/lib/firebase/db';
import { Client } from '@/types/models';
import { CreateClientRequest } from '@/types/api';

export class ClientRepository {
  static async createClient(salonId: string, data: CreateClientRequest): Promise<string> {
    if (!data.firstName || !data.email) {
      throw new Error('Missing required fields');
    }

    const clientId = await addDocument('users', {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender,
      notes: data.notes,
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

  static async getSalonClients(salonId: string): Promise<Client[]> {
    return await queryDocuments('users', [
      firebaseConstraints.where('salonId', '==', salonId),
      firebaseConstraints.where('role', '==', 'client'),
      firebaseConstraints.where('isActive', '==', true),
      firebaseConstraints.orderBy('createdAt', 'desc'),
    ]) as Client[];
  }

  static async searchClients(salonId: string, searchTerm: string): Promise<Client[]> {
    const clients = await this.getSalonClients(salonId);
    const term = searchTerm.toLowerCase();
    return clients.filter(
      (c) =>
        c.firstName.toLowerCase().includes(term) ||
        c.lastName.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term)
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
}
