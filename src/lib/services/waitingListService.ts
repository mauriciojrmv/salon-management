import { WaitingListRepository } from '@/lib/repositories/waitingListRepository';
import { SessionRepository } from '@/lib/repositories/sessionRepository';
import { ServiceRepository } from '@/lib/repositories/serviceRepository';
import type { WaitingListEntry } from '@/types/models';
import { getBoliviaDate } from '@/lib/utils/helpers';

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

    // Pre-add selected services. Each service is assigned to its preferred worker
    // (from servicePreferences). If the preferred worker is the taking staff, assign
    // them. If another worker is preferred, leave that service assigned to THAT
    // worker (so they see it in /my-work). If no preference and it's the taking
    // staff's implicit load, fall back to the taking staff.
    const prefs = queue.servicePreferences || [];
    const legacyPref = queue.preferredStaffId || '';
    for (const serviceId of queue.serviceIds || []) {
      const service = await ServiceRepository.getService(serviceId);
      if (!service) continue;
      const session = await SessionRepository.getSession(sessionId);
      if (!session) break;

      const pref = prefs.find((p) => p.serviceId === serviceId);
      const preferredId = pref ? pref.preferredStaffId : legacyPref;
      // Assigned worker rules:
      //  - If a preference exists, use that worker.
      //  - If no preference, assign to the taking worker as default.
      const assignedStaff = preferredId
        ? [preferredId]
        : [params.takenByStaffId];

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
