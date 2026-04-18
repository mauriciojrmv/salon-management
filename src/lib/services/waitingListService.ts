import { WaitingListRepository } from '@/lib/repositories/waitingListRepository';
import { SessionRepository } from '@/lib/repositories/sessionRepository';
import { ServiceRepository } from '@/lib/repositories/serviceRepository';
import { StaffRepository } from '@/lib/repositories/staffRepository';
import type { WaitingListEntry } from '@/types/models';
import { getBoliviaDate } from '@/lib/utils/helpers';
import { canDoService } from '@/lib/utils/staffSkills';

export interface TakeEntryParams {
  entryId: string;
  takenByStaffId: string; // staff taking ownership (may differ from preferred)
}

export class WaitingListService {
  static async take(params: TakeEntryParams): Promise<string> {
    const queue = await this.findEntry(params.entryId);
    if (!queue) throw new Error('Waiting list entry not found');
    if (queue.status !== 'waiting') throw new Error('Entry is no longer waiting');

    const sessionId = await SessionRepository.createSession({
      salonId: queue.salonId,
      clientId: queue.clientId || '',
      date: queue.date || getBoliviaDate(),
      startTime: new Date(),
    });

    // Tag session as coming from the queue so workers cannot add services ad-hoc
    await SessionRepository.updateSession(sessionId, {
      origin: 'cola',
      waitingListEntryId: params.entryId,
    });

    // Per-service assignment rules:
    //  1. Preference wins (preferred worker takes it, even if another worker "took" the entry)
    //  2. Else if the taking worker is skilled for this service, assign to them
    //  3. Else leave unassigned — surfaces in "Disponibles" for another skilled worker
    const prefs = queue.servicePreferences || [];
    const legacyPref = queue.preferredStaffId || '';
    const taker = await StaffRepository.getStaff(params.takenByStaffId);
    const takerSkills = taker as { serviceIds?: string[] } | null;

    for (const serviceId of queue.serviceIds || []) {
      const service = await ServiceRepository.getService(serviceId);
      if (!service) continue;
      const session = await SessionRepository.getSession(sessionId);
      if (!session) break;

      const pref = prefs.find((p) => p.serviceId === serviceId);
      const preferredId = pref ? pref.preferredStaffId : legacyPref;

      let assignedStaff: string[];
      if (preferredId) {
        assignedStaff = [preferredId];
      } else if (canDoService(takerSkills, serviceId)) {
        assignedStaff = [params.takenByStaffId];
      } else {
        assignedStaff = [];
      }

      const existing = session.services || [];
      const newItem = {
        id: `service_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        serviceId: service.id,
        serviceName: service.name,
        price: service.price,
        commissionRate: 50,
        assignedStaff,
        startTime: new Date(),
        status: 'pending' as const,
        materialsUsed: [],
      };
      const updatedServices = [...existing, newItem];
      const totalAmount = updatedServices.reduce((s, it) => s + it.price, 0);
      await SessionRepository.updateSession(sessionId, {
        services: updatedServices,
        totalAmount,
      });
    }

    await WaitingListRepository.markTaken(params.entryId, sessionId);
    return sessionId;
  }

  private static async findEntry(entryId: string): Promise<WaitingListEntry | null> {
    // No direct getById helper; scan today's queues. Cheap enough — small collection.
    // Fallback to a direct document fetch via repository.
    const { getDocument } = await import('@/lib/firebase/db');
    const raw = (await getDocument('waitingList', entryId)) as (WaitingListEntry & { arrivalTime: unknown }) | null;
    if (!raw) return null;
    const { toDate } = await import('@/lib/utils/helpers');
    return { ...raw, arrivalTime: toDate(raw.arrivalTime) } as WaitingListEntry;
  }
}
