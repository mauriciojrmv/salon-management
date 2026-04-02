'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardBody } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { Modal } from '@/components/Modal';
import { Toast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useNotification } from '@/hooks/useNotification';
import { ExpenseRepository } from '@/lib/repositories/expenseRepository';
import type { Expense, ExpenseCategory } from '@/types/models';
import { fmtBs, fmtDate, getBoliviaDate } from '@/lib/utils/helpers';
import ES from '@/config/text.es';

const categoryOptions: { value: ExpenseCategory; label: string }[] = [
  { value: 'rent', label: ES.expenses.catRent },
  { value: 'utilities', label: ES.expenses.catUtilities },
  { value: 'salaries', label: ES.expenses.catSalaries },
  { value: 'supplies', label: ES.expenses.catSupplies },
  { value: 'marketing', label: ES.expenses.catMarketing },
  { value: 'maintenance', label: ES.expenses.catMaintenance },
  { value: 'insurance', label: ES.expenses.catInsurance },
  { value: 'other', label: ES.expenses.catOther },
];

const categoryLabels: Record<string, string> = Object.fromEntries(categoryOptions.map((c) => [c.value, c.label]));

const categoryColors: Record<string, string> = {
  rent: 'bg-purple-100 text-purple-700',
  utilities: 'bg-blue-100 text-blue-700',
  salaries: 'bg-green-100 text-green-700',
  supplies: 'bg-yellow-100 text-yellow-700',
  marketing: 'bg-pink-100 text-pink-700',
  maintenance: 'bg-orange-100 text-orange-700',
  insurance: 'bg-indigo-100 text-indigo-700',
  other: 'bg-gray-100 text-gray-700',
};

const initialForm = {
  category: 'supplies' as ExpenseCategory,
  description: '',
  amount: 0,
  date: '',
  recurring: false,
  recurrenceType: '' as string,
  paidTo: '',
  paymentMethod: 'cash',
};

export default function ExpensesPage() {
  const { user, userData } = useAuth();
  const isAdmin = userData?.role === 'admin';
  const { notifications, removeNotification, success, error } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  // Date range filter with presets
  const today = useMemo(() => getBoliviaDate(), []);
  const [filterStart, setFilterStart] = useState(() => today.slice(0, 7) + '-01');
  const [filterEnd, setFilterEnd] = useState(() => today);
  const [confirmDeleteExpenseId, setConfirmDeleteExpenseId] = useState<string | null>(null);

  const { data: expenses, refetch } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ExpenseRepository.getSalonExpenses(userData.salonId);
  }, [userData?.salonId]);

  // Filter by date range
  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    return expenses.filter((e) => e.date >= filterStart && e.date <= filterEnd);
  }, [expenses, filterStart, filterEnd]);

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Group by category for summary
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    filteredExpenses.forEach((e) => {
      totals[e.category] = (totals[e.category] || 0) + e.amount;
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [filteredExpenses]);

  const resetForm = () => {
    setFormData({ ...initialForm, date: getBoliviaDate() });
    setEditingExpense(null);
  };

  const openCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      date: expense.date,
      recurring: expense.recurring,
      recurrenceType: expense.recurrenceType || '',
      paidTo: expense.paidTo || '',
      paymentMethod: expense.paymentMethod || 'cash',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.description.trim() || formData.amount <= 0) {
      error(ES.messages.fillRequiredFields);
      return;
    }
    setLoading(true);
    try {
      if (editingExpense) {
        await ExpenseRepository.updateExpense(editingExpense.id, {
          category: formData.category,
          description: formData.description,
          amount: formData.amount,
          date: formData.date,
          recurring: formData.recurring,
          recurrenceType: (formData.recurrenceType || undefined) as 'monthly' | 'weekly' | undefined,
          paidTo: formData.paidTo,
          paymentMethod: formData.paymentMethod as Expense['paymentMethod'],
        });
        success(ES.expenses.updated);
      } else {
        await ExpenseRepository.createExpense({
          salonId: userData?.salonId || '',
          category: formData.category,
          description: formData.description,
          amount: formData.amount,
          date: formData.date,
          recurring: formData.recurring,
          recurrenceType: formData.recurrenceType || undefined,
          paidTo: formData.paidTo,
          paymentMethod: formData.paymentMethod,
          createdBy: user?.uid || '',
        });
        success(ES.expenses.created);
      }
      setIsModalOpen(false);
      resetForm();
      refetch();
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (expenseId: string) => {
    try {
      await ExpenseRepository.deleteExpense(expenseId);
      success(ES.expenses.deleted);
      refetch();
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    }
  };

  const methodLabels: Record<string, string> = {
    cash: ES.payments.cash,
    card: ES.payments.card,
    qr_code: ES.payments.qrCode,
    transfer: ES.payments.transfer,
  };

  return (
    <div className="space-y-6 p-6">
      <Toast notifications={notifications} onDismiss={removeNotification} />
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{ES.expenses.title}</h1>
        <Button onClick={openCreate} size="lg">{ES.expenses.add}</Button>
      </div>

      {/* Date range filter + presets + total */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => { setFilterStart(today); setFilterEnd(today); }}
            className={`px-3 py-2 text-sm border rounded-lg font-medium transition-colors ${filterStart === today && filterEnd === today ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}>
            Hoy
          </button>
          <button type="button" onClick={() => { const s = today.slice(0, 7) + '-01'; setFilterStart(s); setFilterEnd(today); }}
            className={`px-3 py-2 text-sm border rounded-lg font-medium transition-colors ${filterStart === today.slice(0, 7) + '-01' && filterEnd === today ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'}`}>
            {ES.expenses.thisMonth}
          </button>
          <button type="button" onClick={() => { const d = new Date(); d.setDate(d.getDate() - 7); setFilterStart(d.toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' })); setFilterEnd(today); }}
            className="px-3 py-2 text-sm border rounded-lg font-medium bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 transition-colors">
            {ES.expenses.last7Days}
          </button>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{ES.expenses.from}</label>
            <input type="date" value={filterStart} onChange={(e) => setFilterStart(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{ES.expenses.to}</label>
            <input type="date" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <Card className="flex-1">
            <CardBody>
              <p className="text-gray-600 text-sm font-medium">{ES.expenses.totalExpenses}</p>
              <p className="text-2xl font-bold text-red-600">{fmtBs(totalExpenses)}</p>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Category breakdown */}
      {categoryTotals.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {categoryTotals.map(([cat, total]) => (
            <div key={cat} className={`rounded-lg p-3 text-center ${categoryColors[cat] || 'bg-gray-100 text-gray-700'}`}>
              <p className="text-xs font-medium">{categoryLabels[cat] || cat}</p>
              <p className="text-lg font-bold">Bs. {total.toFixed(2)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Expenses list */}
      {filteredExpenses.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-center text-gray-500 py-4">{ES.expenses.noExpenses}</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredExpenses.map((expense) => (
            <Card key={expense.id}>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors[expense.category] || 'bg-gray-100'}`}>
                        {categoryLabels[expense.category] || expense.category}
                      </span>
                      {expense.recurring && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
                          {expense.recurrenceType === 'monthly' ? ES.expenses.recurrenceMonthly : ES.expenses.recurrenceWeekly}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">{fmtDate(expense.date)}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate">{expense.description}</p>
                    {expense.paidTo && <p className="text-xs text-gray-500">{expense.paidTo}</p>}
                  </div>
                  <div className="text-right ml-3">
                    <p className="text-lg font-bold text-red-600">Bs. {expense.amount.toFixed(2)}</p>
                    <p className="text-xs text-gray-400">{methodLabels[expense.paymentMethod || ''] || ''}</p>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
                    <Button size="sm" variant="secondary" onClick={() => openEdit(expense)}>
                      {ES.actions.edit}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => setConfirmDeleteExpenseId(expense.id)}>
                      {ES.actions.delete}
                    </Button>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Confirm Delete Expense Modal */}
      <Modal
        isOpen={!!confirmDeleteExpenseId}
        onClose={() => setConfirmDeleteExpenseId(null)}
        title={ES.actions.delete}
      >
        <div className="space-y-4">
          <p className="text-gray-700">{ES.expenses.deleteConfirm}</p>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setConfirmDeleteExpenseId(null)}>
              {ES.actions.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const id = confirmDeleteExpenseId!;
                setConfirmDeleteExpenseId(null);
                handleDelete(id);
              }}
            >
              {ES.actions.delete}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingExpense ? ES.expenses.editExpense : ES.expenses.create}>
        <div className="space-y-4">
          <Select
            label={ES.expenses.category}
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value as ExpenseCategory })}
            options={categoryOptions}
          />
          <Input
            label={ES.expenses.description}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Ej: Alquiler local mes de marzo"
            required
          />
          <Input
            label={ES.expenses.amount}
            type="number"
            value={formData.amount || ''}
            onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
            required
          />
          <Input
            label={ES.expenses.date}
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />
          <Input
            label={ES.expenses.paidTo}
            value={formData.paidTo}
            onChange={(e) => setFormData({ ...formData, paidTo: e.target.value })}
            placeholder="Ej: Inmobiliaria XYZ"
          />

          {/* Payment method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{ES.expenses.paymentMethod}</label>
            <div className="grid grid-cols-4 gap-2">
              {(['cash', 'card', 'qr_code', 'transfer'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setFormData({ ...formData, paymentMethod: m })}
                  className={`py-2 px-3 rounded-lg border-2 text-xs font-medium transition-all ${
                    formData.paymentMethod === m
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {methodLabels[m]}
                </button>
              ))}
            </div>
          </div>

          {/* Recurring toggle */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.recurring}
                onChange={(e) => setFormData({ ...formData, recurring: e.target.checked, recurrenceType: e.target.checked ? 'monthly' : '' })}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700">{ES.expenses.recurring}</span>
            </label>
            {formData.recurring && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, recurrenceType: 'monthly' })}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border ${formData.recurrenceType === 'monthly' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                >
                  {ES.expenses.recurrenceMonthly}
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, recurrenceType: 'weekly' })}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border ${formData.recurrenceType === 'weekly' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                >
                  {ES.expenses.recurrenceWeekly}
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              {ES.actions.cancel}
            </Button>
            <Button onClick={handleSubmit} loading={loading}>
              {editingExpense ? ES.actions.update : ES.actions.create}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
