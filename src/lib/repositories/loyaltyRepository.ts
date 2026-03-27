import { addDocument, updateDocument, getDocument, queryDocuments, firebaseConstraints } from '@/lib/firebase/db';
import { LoyaltyReward, LoyaltyTransaction } from '@/types/models';

export class LoyaltyRepository {
  // --- Rewards ---
  static async createReward(salonId: string, data: Partial<LoyaltyReward>): Promise<string> {
    return await addDocument('loyaltyRewards', {
      salonId,
      name: data.name || '',
      description: data.description || '',
      pointsCost: data.pointsCost || 0,
      type: data.type || 'discount',
      value: data.value || 0,
      isActive: true,
    });
  }

  static async getReward(rewardId: string): Promise<LoyaltyReward | null> {
    return await getDocument('loyaltyRewards', rewardId) as LoyaltyReward | null;
  }

  static async updateReward(rewardId: string, data: Partial<LoyaltyReward>): Promise<void> {
    await updateDocument('loyaltyRewards', rewardId, data as Record<string, unknown>);
  }

  static async getSalonRewards(salonId: string): Promise<LoyaltyReward[]> {
    const results = await queryDocuments('loyaltyRewards', [
      firebaseConstraints.where('salonId', '==', salonId),
      firebaseConstraints.where('isActive', '==', true),
    ]) as LoyaltyReward[];
    return results;
  }

  // --- Transactions ---
  static async addTransaction(data: {
    salonId: string;
    clientId: string;
    type: 'earned' | 'redeemed';
    points: number;
    description: string;
    sessionId?: string;
    rewardId?: string;
  }): Promise<string> {
    return await addDocument('loyaltyTransactions', {
      ...data,
      sessionId: data.sessionId || '',
      rewardId: data.rewardId || '',
    });
  }

  static async getClientTransactions(salonId: string, clientId: string): Promise<LoyaltyTransaction[]> {
    const results = await queryDocuments('loyaltyTransactions', [
      firebaseConstraints.where('salonId', '==', salonId),
      firebaseConstraints.where('clientId', '==', clientId),
    ]) as LoyaltyTransaction[];
    // Sort newest first
    return results.sort((a, b) => {
      const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date((a.createdAt as unknown as { seconds: number }).seconds * 1000).getTime();
      const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date((b.createdAt as unknown as { seconds: number }).seconds * 1000).getTime();
      return bTime - aTime;
    });
  }
}
