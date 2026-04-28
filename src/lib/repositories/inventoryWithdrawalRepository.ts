import { addDocument, queryDocuments, firebaseConstraints } from '@/lib/firebase/db';
import { InventoryWithdrawal } from '@/types/models';
import { sortByCreatedAtDesc } from '@/lib/utils/helpers';

// Withdrawals are immutable audit records. We only ever append new ones; we do
// not edit/delete (cancel a withdrawal by issuing a counter-restock instead).
export class InventoryWithdrawalRepository {
  static async create(data: Omit<InventoryWithdrawal, 'id' | 'createdAt'>): Promise<string> {
    return await addDocument('inventoryWithdrawals', { ...data });
  }

  static async getSalonWithdrawals(salonId: string): Promise<InventoryWithdrawal[]> {
    const results = await queryDocuments('inventoryWithdrawals', [
      firebaseConstraints.where('salonId', '==', salonId),
    ]) as InventoryWithdrawal[];
    return results.sort(sortByCreatedAtDesc);
  }

  static async getRecentWithdrawals(salonId: string, fromDate: string): Promise<InventoryWithdrawal[]> {
    const all = await this.getSalonWithdrawals(salonId);
    return all.filter((w) => {
      const ts = w.createdAt instanceof Date ? w.createdAt : new Date(w.createdAt as unknown as string);
      const iso = ts.toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
      return iso >= fromDate;
    });
  }
}
