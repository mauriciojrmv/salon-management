import { addDocument, queryDocuments, firebaseConstraints } from '@/lib/firebase/db';
import { RetailSale } from '@/types/models';
import { CreateRetailSaleRequest } from '@/types/api';
import { sortByCreatedAtDesc } from '@/lib/utils/helpers';

export class RetailSaleRepository {
  static async createSale(data: CreateRetailSaleRequest): Promise<string> {
    return await addDocument('retailSales', {
      salonId: data.salonId,
      clientId: data.clientId || '',
      items: data.items,
      totalAmount: data.totalAmount,
      payment: {
        method: data.paymentMethod,
        amount: data.totalAmount,
        status: 'completed',
      },
      notes: data.notes || '',
      soldBy: data.soldBy,
    });
  }

  static async getSalonSales(salonId: string): Promise<RetailSale[]> {
    const results = await queryDocuments('retailSales', [
      firebaseConstraints.where('salonId', '==', salonId),
    ]) as RetailSale[];
    return results.sort(sortByCreatedAtDesc);
  }

  static async getSalonDailySales(salonId: string, date: string): Promise<RetailSale[]> {
    const sales = await this.getSalonSales(salonId);
    return sales.filter((s) => {
      const d = s.createdAt instanceof Date
        ? s.createdAt
        : new Date((s.createdAt as unknown as { seconds: number }).seconds * 1000);
      const saleDate = d.toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
      return saleDate === date;
    });
  }
}
