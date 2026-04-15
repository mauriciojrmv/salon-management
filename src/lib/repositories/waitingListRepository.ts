import {
  addDocument,
  queryDocuments,
  updateDocument,
  firebaseConstraints,
} from '@/lib/firebase/db';
import type { WaitingListEntry, ServicePreference } from '@/types/models';
import { toDate } from '@/lib/utils/helpers';

type RawEntry = Omit<WaitingListEntry, 'arrivalTime' | 'takenAt' | 'cancelledAt' | 'lastCallAt'> & {
  arrivalTime: unknown;
  takenAt?: unknown;
  cancelledAt?: unknown;
  lastCallAt?: unknown;
};

function normalize(raw: RawEntry): WaitingListEntry {
  return {
    ...raw,
    arrivalTime: toDate(raw.arrivalTime),
    takenAt: raw.takenAt ? toDate(raw.takenAt) : undefined,
    cancelledAt: raw.cancelledAt ? toDate(raw.cancelledAt) : undefined,
    lastCallAt: raw.lastCallAt ? toDate(raw.lastCallAt) : undefined,
  };
}

export interface CreateWaitingListRequest {
  salonId: string;
  clientId: string;
  walkInName: string;
  phone: string;
  serviceIds: string[];
  serviceNames: string[];
  servicePreferences: ServicePreference[];
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
      servicePreferences: data.servicePreferences || [],
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

  static async recordCallAttempt(entryId: string, current: number): Promise<void> {
    await updateDocument('waitingList', entryId, {
      callAttempts: current + 1,
      lastCallAt: new Date(),
    });
  }

  static async markSkipped(entryId: string): Promise<void> {
    await updateDocument('waitingList', entryId, { status: 'skipped' });
  }

  static async restoreToWaiting(entryId: string): Promise<void> {
    await updateDocument('waitingList', entryId, {
      status: 'waiting',
      order: Date.now(),
    });
  }
}
