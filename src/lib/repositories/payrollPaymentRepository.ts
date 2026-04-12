import { addDocument, queryDocuments, firebaseConstraints } from '@/lib/firebase/db';

export interface PayrollPaymentRecord {
  id: string;
  salonId: string;
  staffId: string;
  staffName: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  paidSessionServiceIds: string[]; // "<sessionId>__<serviceItemId>"
  paidAt: Date;
  paidBy: string;
  expenseId?: string;
}

export interface CreatePayrollPaymentRequest {
  salonId: string;
  staffId: string;
  staffName: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  paidSessionServiceIds: string[];
  paidBy: string;
  expenseId?: string;
}

export class PayrollPaymentRepository {
  static async createPayment(data: CreatePayrollPaymentRequest): Promise<string> {
    return await addDocument('payrollPayments', {
      salonId: data.salonId,
      staffId: data.staffId,
      staffName: data.staffName,
      amount: data.amount,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      paidSessionServiceIds: data.paidSessionServiceIds,
      paidAt: new Date(),
      paidBy: data.paidBy,
      expenseId: data.expenseId || '',
    });
  }

  static async getSalonPayments(salonId: string): Promise<PayrollPaymentRecord[]> {
    const results = await queryDocuments('payrollPayments', [
      firebaseConstraints.where('salonId', '==', salonId),
    ]) as PayrollPaymentRecord[];
    return results.sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
  }

  static async getPaidServiceRefs(salonId: string): Promise<Set<string>> {
    const all = await this.getSalonPayments(salonId);
    const refs = new Set<string>();
    all.forEach((p) => (p.paidSessionServiceIds || []).forEach((r) => refs.add(r)));
    return refs;
  }
}
