import { queryDocuments, firebaseConstraints } from '@/lib/firebase/db';
import { Session, DailyMetrics, ServiceMetric, StaffMetric } from '@/types/models';
import { InventoryService } from './inventoryService';

export class AnalyticsService {
  static async getDailyMetrics(salonId: string, date: string): Promise<DailyMetrics> {
    const sessions = await queryDocuments('sessions', [
      firebaseConstraints.where('salonId', '==', salonId),
      firebaseConstraints.where('date', '==', date),
      firebaseConstraints.where('status', '==', 'completed'),
    ]) as Session[];

    const totalRevenue = sessions.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalTransactions = sessions.length;
    const uniqueClients = new Set(sessions.map(s => s.clientId)).size;

    // Calculate service metrics
    const serviceMap = new Map<string, { count: number; revenue: number }>();
    sessions.forEach(session => {
      session.services.forEach(service => {
        const existing = serviceMap.get(service.serviceId) || { count: 0, revenue: 0 };
        serviceMap.set(service.serviceId, {
          count: existing.count + 1,
          revenue: existing.revenue + service.price,
        });
      });
    });

    const topServices: ServiceMetric[] = Array.from(serviceMap.entries()).map(([serviceId, data]) => ({
      serviceId,
      serviceName: '', // Fetch from service
      ...data,
      profitMargin: 0, // Calculate based on materials
    }));

    // Calculate staff metrics
    const staffMap = new Map<string, { sessionsCompleted: number; earnings: number }>();
    sessions.forEach(session => {
      session.services.forEach(service => {
        service.assignedStaff.forEach(staffId => {
          const existing = staffMap.get(staffId) || { sessionsCompleted: 0, earnings: 0 };
          staffMap.set(staffId, {
            sessionsCompleted: existing.sessionsCompleted + 1,
            earnings: existing.earnings + service.price * 0.2, // 20% commission
          });
        });
      });
    });

    const topStaff: StaffMetric[] = Array.from(staffMap.entries()).map(([staffId, data]) => ({
      staffId,
      staffName: '', // Fetch from staff
      ...data,
    }));

    return {
      salonId,
      date,
      totalRevenue,
      totalTransactions,
      totalClients: uniqueClients,
      totalSessions: sessions.length,
      averageTransactionValue: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
      topServices: topServices.sort((a, b) => b.revenue - a.revenue).slice(0, 5),
      topStaff: topStaff.sort((a, b) => b.earnings - a.earnings).slice(0, 5),
    };
  }

  static async getMonthlyMetrics(salonId: string, month: string): Promise<DailyMetrics[]> {
    // Fetch all sessions for the month and aggregate
    const sessions = await queryDocuments('sessions', [
      firebaseConstraints.where('salonId', '==', salonId),
      firebaseConstraints.where('status', '==', 'completed'),
    ]) as Session[];

    const metricsByDate = new Map<string, Session[]>();
    sessions.forEach(session => {
      if (session.date.startsWith(month)) {
        const key = session.date;
        if (!metricsByDate.has(key)) {
          metricsByDate.set(key, []);
        }
        metricsByDate.get(key)!.push(session);
      }
    });

    const results: DailyMetrics[] = [];
    for (const [date] of metricsByDate) {
      results.push(await this.getDailyMetrics(salonId, date));
    }

    return results;
  }

  static async getServiceProfitability(salonId: string, startDate: string, endDate: string) {
    const sessions = await queryDocuments('sessions', [
      firebaseConstraints.where('salonId', '==', salonId),
      firebaseConstraints.where('status', '==', 'completed'),
    ]) as Session[];

    const serviceMetrics = new Map<string, {
      revenue: number;
      materialCost: number;
      count: number;
    }>();

    sessions.forEach(session => {
      if (session.date >= startDate && session.date <= endDate) {
        session.services.forEach(service => {
          const existing = serviceMetrics.get(service.serviceId) || {
            revenue: 0,
            materialCost: 0,
            count: 0,
          };

          const materialCost = session.materialsUsed
            .filter(m => m.usedAt >= session.startTime && (!session.endTime || m.usedAt <= session.endTime))
            .reduce((sum, m) => sum + m.cost, 0);

          serviceMetrics.set(service.serviceId, {
            revenue: existing.revenue + service.price,
            materialCost: existing.materialCost + materialCost,
            count: existing.count + 1,
          });
        });
      }
    });

    return Array.from(serviceMetrics.entries()).map(([serviceId, data]) => ({
      serviceId,
      ...data,
      profit: data.revenue - data.materialCost,
      profitMargin: ((data.revenue - data.materialCost) / data.revenue) * 100,
      averageProfit: (data.revenue - data.materialCost) / data.count,
    }));
  }

  static async getStaffPerformance(salonId: string, month: string) {
    const sessions = await queryDocuments('sessions', [
      firebaseConstraints.where('salonId', '==', salonId),
      firebaseConstraints.where('status', '==', 'completed'),
    ]) as Session[];

    const staffStats = new Map<string, {
      servicesCompleted: number;
      revenue: number;
      earnings: number;
    }>();

    sessions.forEach(session => {
      if (session.date.startsWith(month)) {
        session.services.forEach(service => {
          service.assignedStaff.forEach(staffId => {
            const existing = staffStats.get(staffId) || {
              servicesCompleted: 0,
              revenue: 0,
              earnings: 0,
            };

            staffStats.set(staffId, {
              servicesCompleted: existing.servicesCompleted + 1,
              revenue: existing.revenue + service.price,
              earnings: existing.earnings + (service.price * 0.2),
            });
          });
        });
      }
    });

    return Array.from(staffStats.entries()).map(([staffId, data]) => ({
      staffId,
      ...data,
    }));
  }
}
