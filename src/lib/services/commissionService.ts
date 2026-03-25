// Commission and earnings calculation
import { Staff, Session, Payment } from '@/types/models';

export class CommissionCalculator {
  static calculateServiceCommission(
    servicePrice: number,
    staff: Staff
  ): number {
    if (!staff.commissionConfig) return 0;

    const { type, value } = staff.commissionConfig;

    if (type === 'percentage') {
      return (servicePrice * value) / 100;
    } else {
      return value; // Fixed amount
    }
  }

  static calculateSessionCommissions(
    session: Session,
    staffMap: Map<string, Staff>
  ): Map<string, number> {
    const commissions = new Map<string, number>();

    session.services.forEach((service) => {
      service.assignedStaff.forEach((staffId) => {
        const staff = staffMap.get(staffId);
        if (staff) {
          const commission = this.calculateServiceCommission(service.price, staff);
          const current = commissions.get(staffId) || 0;
          commissions.set(staffId, current + commission);
        }
      });
    });

    return commissions;
  }

  static calculateSessionTotal(session: Session): {
    subtotal: number;
    tax: number;
    total: number;
  } {
    const subtotal = session.services.reduce((sum, s) => sum + s.price, 0);
    const tax = subtotal * 0.1; // 10% tax - change as needed
    const total = subtotal + tax - (session.discount || 0);

    return { subtotal, tax, total };
  }

  static calculateDailyEarnings(
    staffId: string,
    sessions: Session[],
    staffMap: Map<string, Staff>
  ): number {
    let totalEarnings = 0;

    sessions.forEach((session) => {
      if (session.status === 'completed') {
        const commissions = this.calculateSessionCommissions(session, staffMap);
        const staffEarning = commissions.get(staffId) || 0;
        totalEarnings += staffEarning;
      }
    });

    return totalEarnings;
  }

  static getPaymentStatus(session: Session): {
    paid: number;
    remaining: number;
    percentage: number;
  } {
    const total = this.calculateSessionTotal(session).total;
    const paid = session.payments
      .filter((p) => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);

    const remaining = total - paid;
    const percentage = total > 0 ? (paid / total) * 100 : 0;

    return { paid, remaining, percentage };
  }
}
