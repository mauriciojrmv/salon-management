import { addDocument, getDocument, updateDocument, queryDocuments, firebaseConstraints } from '@/lib/firebase/db';
import { Salon } from '@/types/models';

export class SalonRepository {
  static async createSalon(data: Partial<Salon>): Promise<string> {
    return await addDocument('salons', {
      ...data,
      isActive: true,
      settings: data.settings || {
        businessHours: {},
        taxRate: 0,
        autoBackup: false,
      },
    });
  }

  static async getSalon(salonId: string): Promise<Salon | null> {
    return await getDocument('salons', salonId) as Salon | null;
  }

  static async updateSalon(salonId: string, data: Partial<Salon>): Promise<void> {
    await updateDocument('salons', salonId, data as Record<string, unknown>);
  }

  static async getOwnerSalons(ownerId: string): Promise<Salon[]> {
    const results = await queryDocuments('salons', [
      firebaseConstraints.where('owner', '==', ownerId),
      firebaseConstraints.where('isActive', '==', true),
    ]) as Salon[];
    return results;
  }

  static async getAllSalons(): Promise<Salon[]> {
    const results = await queryDocuments('salons', [
      firebaseConstraints.where('isActive', '==', true),
    ]) as Salon[];
    return results;
  }
}
