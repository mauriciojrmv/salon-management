'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { Toast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useNotification } from '@/hooks/useNotification';
import { ProductRepository } from '@/lib/repositories/productRepository';
import { ClientRepository } from '@/lib/repositories/clientRepository';
import { RetailSaleRepository } from '@/lib/repositories/retailSaleRepository';
import { batchUpdate } from '@/lib/firebase/db';
import type { RetailSale } from '@/types/models';
import { toDate, fmtBs } from '@/lib/utils/helpers';
import ES from '@/config/text.es';

interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  maxStock: number;
}

export default function SalesPage() {
  const { user, userData } = useAuth();
  const { notifications, removeNotification, success, error } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clientId, setClientId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<SaleItem[]>([]);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const { data: products } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ProductRepository.getSalonProducts(userData.salonId);
  }, [userData?.salonId]);

  const { data: clients } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ClientRepository.getSalonClients(userData.salonId);
  }, [userData?.salonId]);

  const { data: todaySales, refetch: refetchSales } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return RetailSaleRepository.getSalonDailySales(userData.salonId, today);
  }, [userData?.salonId, today]);

  const productOptions = (products || []).map((p) => ({
    value: p.id,
    label: p.name,
    secondary: `Bs. ${p.price} · Stock: ${p.currentStock} ${p.unit || 'un'}`,
  }));

  const clientOptions = (clients || []).map((c) => ({
    value: c.id,
    label: `${c.firstName} ${c.lastName}`,
    secondary: c.phone,
  }));

  const getClientName = (id: string) => {
    const c = clients?.find((x) => x.id === id);
    return c ? `${c.firstName} ${c.lastName}` : ES.retail.walkIn;
  };

  const handleAddItem = () => {
    setItems([...items, { productId: '', productName: '', quantity: 1, unitPrice: 0, total: 0, maxStock: 0 }]);
  };

  const handleItemProductSelect = (index: number, productId: string) => {
    const product = products?.find((p) => p.id === productId);
    if (!product) return;
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      productId,
      productName: product.name,
      unitPrice: product.price,
      total: product.price * updated[index].quantity,
      maxStock: product.currentStock,
    };
    setItems(updated);
  };

  const handleItemQuantityChange = (index: number, qty: number) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      quantity: qty,
      total: updated[index].unitPrice * qty,
    };
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const saleTotal = items.reduce((sum, item) => sum + item.total, 0);

  const handleSubmit = async () => {
    const validItems = items.filter((item) => item.productId && item.quantity > 0);
    if (validItems.length === 0) {
      error(ES.messages.fillRequiredFields);
      return;
    }

    // Check stock
    for (const item of validItems) {
      if (item.quantity > item.maxStock) {
        error(`${item.productName}: stock insuficiente (${item.maxStock})`);
        return;
      }
    }

    setLoading(true);
    try {
      // Create sale record
      await RetailSaleRepository.createSale({
        salonId: userData?.salonId || '',
        clientId: clientId || undefined,
        items: validItems.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
        totalAmount: saleTotal,
        paymentMethod,
        soldBy: user?.uid || '',
        notes,
      });

      // Deduct stock atomically
      const stockUpdates = await Promise.all(
        validItems.map(async (item) => {
          const product = await ProductRepository.getProduct(item.productId);
          if (!product) throw new Error(`Product not found: ${item.productName}`);
          return {
            collection: 'products',
            docId: item.productId,
            data: { currentStock: product.currentStock - item.quantity } as Record<string, unknown>,
          };
        })
      );
      await batchUpdate(stockUpdates);

      success(ES.retail.saleCreated);
      setIsModalOpen(false);
      setItems([]);
      setClientId('');
      setNotes('');
      setPaymentMethod('cash');
      refetchSales();
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  const methodLabels: Record<string, string> = {
    cash: ES.payments.cash,
    card: ES.payments.card,
    qr_code: ES.payments.qrCode,
    transfer: ES.payments.transfer,
  };

  const dailyTotal = (todaySales || []).reduce((sum, s) => sum + s.totalAmount, 0);

  return (
    <div className="space-y-6 p-6">
      <Toast notifications={notifications} onDismiss={removeNotification} />
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{ES.retail.title}</h1>
        <Button onClick={() => { setItems([{ productId: '', productName: '', quantity: 1, unitPrice: 0, total: 0, maxStock: 0 }]); setIsModalOpen(true); }} size="lg">
          {ES.retail.new}
        </Button>
      </div>

      {/* Daily summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardBody>
            <p className="text-gray-600 text-sm font-medium mb-1">{ES.retail.todaySales}</p>
            <p className="text-2xl font-bold text-gray-900">{(todaySales || []).length}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-gray-600 text-sm font-medium mb-1">{ES.retail.totalSales}</p>
            <p className="text-2xl font-bold text-gray-900">Bs. {dailyTotal.toFixed(2)}</p>
          </CardBody>
        </Card>
      </div>

      {/* Today's sales list */}
      {(todaySales || []).length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-center text-gray-500 py-4">{ES.retail.noSales}</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {(todaySales || []).map((sale: RetailSale) => (
            <Card key={sale.id}>
              <CardBody>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-gray-900">
                      {sale.clientId ? getClientName(sale.clientId) : ES.retail.walkIn}
                    </p>
                    <p className="text-xs text-gray-500">
                      {toDate(sale.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      {' · '}{methodLabels[sale.payment?.method] || sale.payment?.method}
                    </p>
                  </div>
                  <span className="text-lg font-bold text-gray-900">Bs. {sale.totalAmount.toFixed(2)}</span>
                </div>
                <div className="space-y-1">
                  {(sale.items || []).map((item, i) => (
                    <div key={i} className="flex justify-between text-sm text-gray-600">
                      <span>{item.productName} x{item.quantity}</span>
                      <span>Bs. {item.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                {sale.notes && <p className="text-xs text-gray-400 mt-1 italic">{sale.notes}</p>}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* New Sale Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={ES.retail.create} size="lg">
        <div className="space-y-4">
          {/* Client (optional) */}
          <SearchableSelect
            label={ES.retail.selectClient}
            options={clientOptions}
            value={clientId}
            onChange={setClientId}
            placeholder={ES.actions.search}
          />

          {/* Sale items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">{ES.retail.title}</label>
              <button type="button" onClick={handleAddItem} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                {ES.retail.addItem}
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <SearchableSelect
                    label=""
                    options={productOptions}
                    value={item.productId}
                    onChange={(v) => handleItemProductSelect(idx, v)}
                    placeholder={ES.retail.product}
                  />
                  <div className="flex gap-3 items-end">
                    <div className="w-24">
                      <Input
                        label={ES.retail.quantity}
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemQuantityChange(idx, parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="flex-1 text-right pb-3">
                      <p className="text-xs text-gray-400">Bs. {item.unitPrice.toFixed(2)} c/u</p>
                      <p className="text-sm font-semibold">Bs. {item.total.toFixed(2)}</p>
                    </div>
                    <button type="button" onClick={() => handleRemoveItem(idx)} className="text-red-500 hover:text-red-700 text-xs pb-3">
                      {ES.retail.removeItem}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{ES.retail.paymentMethod}</label>
            <div className="grid grid-cols-4 gap-2">
              {(['cash', 'card', 'qr_code', 'transfer'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={`py-2 px-3 rounded-lg border-2 text-xs font-medium transition-all ${
                    paymentMethod === m
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {methodLabels[m]}
                </button>
              ))}
            </div>
          </div>

          <Input
            label={ES.retail.notes}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder=""
          />

          {/* Total */}
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-sm text-gray-500">{ES.retail.total}</p>
            <p className="text-3xl font-bold text-gray-900">Bs. {saleTotal.toFixed(2)}</p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              {ES.actions.cancel}
            </Button>
            <Button onClick={handleSubmit} loading={loading}>
              {ES.retail.create}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
