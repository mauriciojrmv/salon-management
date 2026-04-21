import { WaitingListRepository } from '@/lib/repositories/waitingListRepository';
import { ServiceRepository } from '@/lib/repositories/serviceRepository';
import { StaffRepository } from '@/lib/repositories/staffRepository';
import { db } from '@/lib/firebase/config';
import { trackWrite } from '@/lib/firebase/connectionState';
import {
  collection,
  doc,
  getDoc,
  runTransaction,
} from 'firebase/firestore';
import type { WaitingListEntry, SessionServiceItem } from '@/types/models';
import { getBoliviaDate, toDate } from '@/lib/utils/helpers';
import { canDoService } from '@/lib/utils/staffSkills';

export interface TakeEntryParams {
  entryId: string;
  takenByStaffId: string; // staff taking ownership (may differ from preferred)
}

export class WaitingListService {
  // Atomic take: verifies the entry is still 'waiting' and marks it 'taken' + creates
  // the session in a single Firestore transaction. Two workers tapping Tomar at the
  // same time on a flaky connection → exactly one wins, the other gets ENTRY_ALREADY_TAKEN.
  // All lookups (services, staff skills) happen before the transaction, so the critical
  // section stays small and the transaction only touches 2 documents.
  static async take(params: TakeEntryParams): Promise<string> {
    const entryRef = doc(db, 'waitingList', params.entryId);

    const preSnap = await getDoc(entryRef);
    if (!preSnap.exists()) throw new Error('Waiting list entry not found');
    const raw = preSnap.data() as Omit<WaitingListEntry, 'arrivalTime'> & { arrivalTime: unknown };
    const entry: WaitingListEntry = { ...raw, arrivalTime: toDate(raw.arrivalTime) } as WaitingListEntry;
    if (entry.status !== 'waiting') throw new Error('ENTRY_ALREADY_TAKEN');

    // Pre-fetch everything we need to build the session payload
    const services = await Promise.all(
      (entry.serviceIds || []).map((id) => ServiceRepository.getService(id)),
    );
    const taker = await StaffRepository.getStaff(params.takenByStaffId);
    const takerSkills = taker as { serviceIds?: string[] } | null;
    const prefs = entry.servicePreferences || [];
    const legacyPref = entry.preferredStaffId || '';

    // Per-service assignment rules:
    //  1. Preference wins (preferred worker takes it, even if another worker "took" the entry)
    //  2. Else if the taking worker is skilled for this service, assign to them
    //  3. Else leave unassigned — surfaces in "Disponibles" for another skilled worker
    const now = new Date();
    const serviceItems: SessionServiceItem[] = services
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .map((service, idx) => {
        const pref = prefs.find((p) => p.serviceId === service.id);
        const preferredId = pref ? pref.preferredStaffId : legacyPref;
        let assignedStaff: string[];
        if (preferredId) assignedStaff = [preferredId];
        else if (canDoService(takerSkills, service.id)) assignedStaff = [params.takenByStaffId];
        else assignedStaff = [];
        return {
          id: `service_${now.getTime()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          serviceId: service.id,
          serviceName: service.name,
          price: service.price,
          commissionRate: 50,
          assignedStaff,
          startTime: now,
          status: 'pending',
          materialsUsed: [],
        };
      });

    const totalAmount = serviceItems.reduce((s, it) => s + it.price, 0);
    const newSessionRef = doc(collection(db, 'sessions'));

    await trackWrite(() => runTransaction(db, async (tx) => {
      const snap = await tx.get(entryRef);
      if (!snap.exists()) throw new Error('Waiting list entry not found');
      const cur = snap.data() as { status?: string };
      if (cur.status !== 'waiting') throw new Error('ENTRY_ALREADY_TAKEN');

      tx.set(newSessionRef, {
        salonId: entry.salonId,
        clientId: entry.clientId || '',
        date: entry.date || getBoliviaDate(),
        startTime: now,
        services: serviceItems,
        payments: [],
        materialsUsed: [],
        totalAmount,
        tax: 0,
        status: 'active',
        origin: 'cola',
        waitingListEntryId: params.entryId,
        createdAt: now,
        updatedAt: now,
      });

      tx.update(entryRef, {
        status: 'taken',
        takenAt: now,
        takenSessionId: newSessionRef.id,
        updatedAt: now,
      });
    }));

    return newSessionRef.id;
  }
}
