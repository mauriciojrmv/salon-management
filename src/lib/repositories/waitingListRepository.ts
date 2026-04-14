import {
  addDocument,
  queryDocuments,
  updateDocument,
  firebaseConstraints,
} from '@/lib/firebase/db';
import type { WaitingListEntry } from '@/types/models';
import { toDate } from '@/lib/utils/helpers';

type RawEntry = Omit<WaitingListEntry, 'arrivalTime' | 'takenAt' | 'cancelledAt'> & {
  arrivalTime: unknown;
  takenAt?: unknown;
  cancelledAt?: unknown;
};

function normalize(raw: RawEntry): WaitingListEntry {
  return {
    ...raw,
    arrivalTime: toDate(raw.arrivalTime),
    takenAt: raw.takenAt ? toDate(raw.takenAt) : undefined,
    cancelledAt: raw.cancelledAt ? toDate(raw.cancelledAt) : undefined,
  };
}

export interface CreateWaitingListRequest {
  salonId: string;
  clientId: string;
  walkInName: string;
  phone: string;
  serviceIds: string[];
  serviceNames: string[];
  preferredStaffId: string;
  preferredStaffName: string;
  date: string;
  notes: string;
  createdBy: string;
}

export class WaitingListRepository {
  static async createEntry(data: CreateWaitingListRequest): Promise<string> {
    const now = new Date();
    return await addDocument('waitingList', {
      salonId: data.salonId,
      clientId: data.clientId || '',
      walkInName: data.walkInName || '',
      phone: data.phone || '',
      serviceIds: data.serviceIds,
      serviceNames: data.serviceNames,
      preferredStaffId: data.preferredStaffId || '',
      preferredStaffName: data.preferredStaffName || '',
      arrivalTime: now,
      date: data.date,
      status: 'waiting',
      notes: data.notes || '',
      order: now.getTime(),
      createdBy: data.createdBy,
    });
  }

  static async getSalonQueue(salonId: string, date: string): Promise<WaitingListEntry[]> {
    const results = (await queryDocuments('waitingList', [
      firebaseConstraints.where('salonId', '==', salonId),
      firebaseConstraints.where('date', '==', date),
    ])) as RawEntry[];
    return results
      .map(normalize)
      .sort((a, b) => a.order - b.order);
  }

  static async markTaken(entryId: string, sessionId: string): Promise<void> {
    await updateDocument('waitingList', entryId, {
      status: 'taken',
      takenAt: new Date(),
      takenSessionId: sessionId,
    });
  }

  static async cancelEntry(entryId: string, reason: string): Promise<void> {
    await updateDocument('waitingList', entryId, {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancellationReason: reason || '',
    });
  }

  static async reorder(entryId: string, newOrder: number): Promise<void> {
    await updateDocument('waitingList', entryId, { order: newOrder });
  }
}
