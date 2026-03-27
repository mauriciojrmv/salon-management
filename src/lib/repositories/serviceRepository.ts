import { addDocument, updateDocument, getDocument, queryDocuments, deleteDocument, firebaseConstraints } from '@/lib/firebase/db';
import { Service } from '@/types/models';
import { CreateServiceRequest } from '@/types/api';
import { sortByCreatedAtDesc } from '@/lib/utils/helpers';

export class ServiceRepository {
  static async createService(salonId: string, data: CreateServiceRequest): Promise<string> {
    if (!data.name || !data.price || !data.duration) {
      throw new Error('Missing required fields');
    }

    const serviceId = await addDocument('services', {
      ...data,
      salonId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return serviceId;
  }

  static async getService(serviceId: string): Promise<Service | null> {
    return await getDocument('services', serviceId) as Service | null;
  }

  static async updateService(serviceId: string, data: Partial<Service>): Promise<void> {
    await updateDocument('services', serviceId, {
      ...data,
      updatedAt: new Date(),
    });
  }

  static async deleteService(serviceId: string): Promise<void> {
    await updateDocument('services', serviceId, {
      isActive: false,
      updatedAt: new Date(),
    });
  }

  static async getSalonServices(salonId: string): Promise<Service[]> {
    const results = await queryDocuments('services', [
      firebaseConstraints.where('salonId', '==', salonId),
      firebaseConstraints.where('isActive', '==', true),
    ]) as Service[];
    return results.sort(sortByCreatedAtDesc);
  }

  static async getServicesByCategory(salonId: string, category: string): Promise<Service[]> {
    return await queryDocuments('services', [
      firebaseConstraints.where('salonId', '==', salonId),
      firebaseConstraints.where('category', '==', category),
      firebaseConstraints.where('isActive', '==', true),
    ]) as Service[];
  }

  static async listenToServices(
    salonId: string,
    callback: (services: Service[]) => void
  ): Promise<() => void> {
    // This would require real-time listener setup
    // For now, just fetch once
    const services = await this.getSalonServices(salonId);
    callback(services);
    return () => {};
  }
}
