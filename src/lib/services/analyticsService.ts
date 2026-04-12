import { queryDocuments, firebaseConstraints } from '@/lib/firebase/db';
import { Session, DailyMetrics, ServiceMetric, StaffMetric } from '@/types/models';
import { StaffRepository } from '@/lib/repositories/staffRepository';
import { ClientRepository } from '@/lib/repositories/clientRepository';
import { ServiceRepository } from '@/lib/repositories/serviceRepository';
import { ProductRepository } from '@/lib/repositories/productRepository';
import { PayrollPaymentRepository } from '@/lib/repositories/payrollPaymentRepository';
import { DEFAULT_COMMISSION_RATE } from '@/lib/utils/helpers';

export interface PayrollServiceDetail {
  date: string;
  clientName: string;
  serviceName: string;
  price: number;
  materialCost: number;
  commissionRate: number;
  commission: number;
}

export interface PayrollStaffEntry {
  staffId: string;
  staffName: string;
  servicesCompleted: number;
  revenue: number;
  materialCost: number;
  totalCommission: number;
  details: PayrollServiceDetail[];
  // Unpaid session/service refs covered by this entry, used to mark paid on payout
  unpaidSessionServiceIds: string[];
}

export class AnalyticsService {
  static async getDailyMetrics(salonId: string, date: string): Promise<DailyMetrics> {
    const sessions = await queryDocuments('sessions', [
      firebaseConstraints.where('salonId', '==', salonId),
      firebaseConstraints.where('date', '==', date),
      firebaseConstraints.where('status', '==', 'completed'),
    ]) as Session[];

    const products = await ProductRepository.getSalonProducts(salonId);
    const productCostMap = new Map(products.map(p => [p.id, p.cost]));

    const totalRevenue = sessions.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalTransactions = sessions.length;
    const uniqueClients = new Set(sessions.map(s => s.clientId)).size;

    // Calculate service metrics
    const serviceMap = new Map<string, { name: string; count: number; revenue: number; materialCost: number }>();
    sessions.forEach(session => {
      session.services.forEach(service => {
        const existing = serviceMap.get(service.serviceId) || { name: service.serviceName, count: 0, revenue: 0, materialCost: 0 };
        const matCost = (service.materialsUsed || []).reduce((sum, m) => sum + (productCostMap.get(m.productId) ?? 0) * m.quantity, 0);
        serviceMap.set(service.serviceId, {
          name: existing.name || service.serviceName,
          count: existing.count + 1,
          revenue: existing.revenue + service.price,
          materialCost: existing.materialCost + matCost,
        });
      });
    });

    const topServices: ServiceMetric[] = Array.from(serviceMap.entries()).map(([serviceId, data]) => ({
      serviceId,
      serviceName: data.name || serviceId,
      count: data.count,
      revenue: data.revenue,
      profitMargin: data.revenue > 0 ? ((data.revenue - data.materialCost) / data.revenue) * 100 : 0,
    }));

    // Load staff names for resolution
    const staffList = await StaffRepository.getSalonStaff(salonId);
    const staffNameMap = new Map(staffList.map(s => [s.id, `${s.firstName} ${s.lastName}`]));

    // Calculate staff metrics: commission = (service price - material buy cost) * rate
    const staffMap = new Map<string, { sessionsCompleted: number; earnings: number }>();
    sessions.forEach(session => {
      session.services.forEach(service => {
        const materialCost = (service.materialsUsed || []).reduce((sum, m) => sum + (productCostMap.get(m.productId) ?? 0) * m.quantity, 0);
        service.assignedStaff.forEach(staffId => {
          const existing = staffMap.get(staffId) || { sessionsCompleted: 0, earnings: 0 };
          const rate = service.commissionRate ?? DEFAULT_COMMISSION_RATE;
          const commission = (service.price - materialCost) * rate / 100;
          staffMap.set(staffId, {
            sessionsCompleted: existing.sessionsCompleted + 1,
            earnings: existing.earnings + Math.max(0, commission),
          });
        });
      });
    });

    const topStaff: StaffMetric[] = Array.from(staffMap.entries()).map(([staffId, data]) => ({
      staffId,
      staffName: staffNameMap.get(staffId) || staffId,
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
    const [sessions, products] = await Promise.all([
      queryDocuments('sessions', [
        firebaseConstraints.where('salonId', '==', salonId),
        firebaseConstraints.where('status', '==', 'completed'),
      ]) as Promise<Session[]>,
      ProductRepository.getSalonProducts(salonId),
    ]);
    const productCostMap = new Map(products.map(p => [p.id, p.cost]));

    const serviceMetrics = new Map<string, {
      serviceName: string;
      revenue: number;
      materialCost: number;
      payrollCost: number;
      count: number;
    }>();

    sessions.forEach(session => {
      if (session.date >= startDate && session.date <= endDate) {
        session.services.forEach(service => {
          const existing = serviceMetrics.get(service.serviceId) || {
            serviceName: service.serviceName,
            revenue: 0,
            materialCost: 0,
            payrollCost: 0,
            count: 0,
          };

          // Use actual buy cost from products, not stored sell price
          const materialCost = (service.materialsUsed || []).reduce((sum, m) => sum + (productCostMap.get(m.productId) ?? 0) * m.quantity, 0);

          // Staff commission per CLAUDE.md: (price - materialCost) * commissionRate%
          // Only counted when at least one staff is assigned
          const hasStaff = (service.assignedStaff?.length || 0) > 0;
          const rate = service.commissionRate || 0;
          const commissionBase = Math.max(0, service.price - materialCost);
          const payrollCost = hasStaff ? (commissionBase * rate) / 100 : 0;

          serviceMetrics.set(service.serviceId, {
            serviceName: existing.serviceName || service.serviceName,
            revenue: existing.revenue + service.price,
            materialCost: existing.materialCost + materialCost,
            payrollCost: existing.payrollCost + payrollCost,
            count: existing.count + 1,
          });
        });
      }
    });

    return Array.from(serviceMetrics.entries()).map(([serviceId, data]) => {
      const profit = data.revenue - data.materialCost - data.payrollCost;
      return {
        serviceId,
        serviceName: data.serviceName || serviceId,
        revenue: data.revenue,
        materialCost: data.materialCost,
        payrollCost: data.payrollCost,
        count: data.count,
        profit,
        profitMargin: data.revenue > 0 ? (profit / data.revenue) * 100 : 0,
        averageProfit: data.count > 0 ? profit / data.count : 0,
      };
    });
  }

  static async getStaffPerformance(salonId: string, month: string) {
    const [sessions, staffList, products] = await Promise.all([
      queryDocuments('sessions', [
        firebaseConstraints.where('salonId', '==', salonId),
        firebaseConstraints.where('status', '==', 'completed'),
      ]) as Promise<Session[]>,
      StaffRepository.getSalonStaff(salonId),
      ProductRepository.getSalonProducts(salonId),
    ]);

    const staffNameMap = new Map(staffList.map(s => [s.id, `${s.firstName} ${s.lastName}`]));
    const productCostMap = new Map(products.map(p => [p.id, p.cost]));

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

            const materialCost = (service.materialsUsed || []).reduce((sum, m) => sum + (productCostMap.get(m.productId) ?? 0) * m.quantity, 0);
            const rate = service.commissionRate ?? DEFAULT_COMMISSION_RATE;
            const commission = (service.price - materialCost) * rate / 100;
            staffStats.set(staffId, {
              servicesCompleted: existing.servicesCompleted + 1,
              revenue: existing.revenue + service.price,
              earnings: existing.earnings + Math.max(0, commission),
            });
          });
        });
      }
    });

    return Array.from(staffStats.entries()).map(([staffId, data]) => ({
      staffId,
      staffName: staffNameMap.get(staffId) || staffId,
      ...data,
    }));
  }

  static async getStaffPayroll(salonId: string, startDate: string, endDate: string): Promise<PayrollStaffEntry[]> {
    const [sessions, staffList, clients, products, paidRefs] = await Promise.all([
      queryDocuments('sessions', [
        firebaseConstraints.where('salonId', '==', salonId),
        firebaseConstraints.where('status', '==', 'completed'),
      ]) as Promise<Session[]>,
      StaffRepository.getSalonStaff(salonId),
      ClientRepository.getSalonClients(salonId),
      ProductRepository.getSalonProducts(salonId),
      PayrollPaymentRepository.getPaidServiceRefs(salonId),
    ]);

    const staffNameMap = new Map(staffList.map(s => [s.id, `${s.firstName} ${s.lastName}`]));
    const clientNameMap = new Map(clients.map(c => [c.id, `${c.firstName} ${c.lastName}`]));
    const productCostMap = new Map(products.map(p => [p.id, p.cost]));

    const staffPayroll = new Map<string, {
      servicesCompleted: number;
      revenue: number;
      materialCost: number;
      totalCommission: number;
      details: PayrollServiceDetail[];
      unpaidSessionServiceIds: string[];
    }>();

    sessions.forEach(session => {
      if (session.date >= startDate && session.date <= endDate) {
        session.services.forEach(service => {
          service.assignedStaff.forEach(staffId => {
            // Skip already-paid (session, service, staff) combos
            const ref = `${session.id}__${service.id}__${staffId}`;
            if (paidRefs.has(ref)) return;

            const existing = staffPayroll.get(staffId) || {
              servicesCompleted: 0,
              revenue: 0,
              materialCost: 0,
              totalCommission: 0,
              details: [],
              unpaidSessionServiceIds: [],
            };

            const matCost = (service.materialsUsed || []).reduce((sum, m) => sum + (productCostMap.get(m.productId) ?? 0) * m.quantity, 0);
            const rate = service.commissionRate ?? DEFAULT_COMMISSION_RATE;
            const commission = Math.max(0, (service.price - matCost) * rate / 100);

            existing.servicesCompleted += 1;
            existing.revenue += service.price;
            existing.materialCost += matCost;
            existing.totalCommission += commission;
            existing.details.push({
              date: session.date,
              clientName: clientNameMap.get(session.clientId) || '-',
              serviceName: service.serviceName,
              price: service.price,
              materialCost: matCost,
              commissionRate: rate,
              commission,
            });
            existing.unpaidSessionServiceIds.push(ref);

            staffPayroll.set(staffId, existing);
          });
        });
      }
    });

    return Array.from(staffPayroll.entries())
      .map(([staffId, data]) => ({
        staffId,
        staffName: staffNameMap.get(staffId) || staffId,
        ...data,
      }))
      .sort((a, b) => b.totalCommission - a.totalCommission);
  }
}
