import { addDocument, updateDocument, deleteDocument, getDocument, queryDocuments, firebaseConstraints } from '@/lib/firebase/db';
import { Expense } from '@/types/models';
import { CreateExpenseRequest } from '@/types/api';

export class ExpenseRepository {
  static async createExpense(data: CreateExpenseRequest): Promise<string> {
    return await addDocument('expenses', {
      salonId: data.salonId,
      category: data.category,
      description: data.description,
      amount: data.amount,
      date: data.date,
      recurring: data.recurring,
      recurrenceType: data.recurrenceType || '',
      paidTo: data.paidTo || '',
      paymentMethod: data.paymentMethod || '',
      createdBy: data.createdBy,
    });
  }

  static async getExpense(expenseId: string): Promise<Expense | null> {
    return await getDocument('expenses', expenseId) as Expense | null;
  }

  static async updateExpense(expenseId: string, data: Partial<Expense>): Promise<void> {
    await updateDocument('expenses', expenseId, data as Record<string, unknown>);
  }

  static async deleteExpense(expenseId: string): Promise<void> {
    await deleteDocument('expenses', expenseId);
  }

  static async getSalonExpenses(salonId: string): Promise<Expense[]> {
    const results = await queryDocuments('expenses', [
      firebaseConstraints.where('salonId', '==', salonId),
    ]) as Expense[];
    // Sort by date descending
    return results.sort((a, b) => b.date.localeCompare(a.date));
  }

  static async getSalonExpensesByDateRange(salonId: string, startDate: string, endDate: string): Promise<Expense[]> {
    const all = await this.getSalonExpenses(salonId);
    return all.filter((e) => e.date >= startDate && e.date <= endDate);
  }
}
