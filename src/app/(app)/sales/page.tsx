'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardBody } from '@/components/Card';
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
import { toDate, fmtBs, getBoliviaDate, LOYALTY_POINTS_RATE } from '@/lib/utils/helpers';
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
  const [clientId, setClientId] = useState('__walkin__');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<SaleItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productCategory, setProductCategory] = useState<string>('all');
  const [isQuickClientOpen, setIsQuickClientOpen] = useState(false);
  const [quickClient, setQuickClient] = useState({ firstName: '', lastName: '', phone: '' });

  const today = useMemo(() => getBoliviaDate(), []);

  const { data: products } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ProductRepository.getSalonProducts(userData.salonId);
  }, [userData?.salonId]);

  const { data: clients, refetch: refetchClients } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ClientRepository.getSalonClients(userData.salonId);
  }, [userData?.salonId]);

  const { data: todaySales, refetch: refetchSales } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return RetailSaleRepository.getSalonDailySales(userData.salonId, today);
  }, [userData?.salonId, today]);

  const categoryLabels: Record<string, string> = {
    hair_products: ES.inventory.catHairProducts,
    skincare: ES.inventory.catSkincare,
    wax: ES.inventory.catWax,
    nail_products: ES.inventory.catNailProducts,
    tools: ES.inventory.catTools,
    supplies: ES.inventory.catSupplies,
    other: ES.inventory.catOther,
  };

  const filteredProducts = useMemo(() => {
    let list = products || [];
    if (productCategory !== 'all') {
      list = list.filter((p) => p.category === productCategory);
    }
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [products, productCategory, productSearch]);

  // Categories that exist in product data
  const availableCategories = useMemo(() => {
    const cats = new Set((products || []).map((p) => p.category));
    return Array.from(cats);
  }, [products]);

  const clientOptions = [
    { value: '__walkin__', label: ES.staff.walkInClient, secondary: '' },
    ...(clients || []).map((c) => ({
      value: c.id,
      label: `${c.firstName} ${c.lastName}`,
      secondary: c.phone,
    })),
  ];

  const getClientName = (id: string) => {
    const c = clients?.find((x) => x.id === id);
    return c ? `${c.firstName} ${c.lastName}` : ES.retail.walkIn;
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

  const handleQuickCreateClient = async () => {
    if (!quickClient.firstName || !userData?.salonId) {
      error(ES.messages.fillRequiredFields);
      return;
    }
    setLoading(true);
    try {
      const newClientId = await ClientRepository.createClient(userData.salonId, {
        firstName: quickClient.firstName,
        lastName: quickClient.lastName,
        phone: quickClient.phone || '',
      });
      success(ES.clients.clientCreated);
      setClientId(newClientId);
      setIsQuickClientOpen(false);
      setQuickClient({ firstName: '', lastName: '', phone: '' });
      refetchClients();
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  const saleTotal = items.reduce((sum, item) => sum + item.total, 0);

  const handleSubmit = async () => {
    if (!clientId) {
      error(ES.messages.fillRequiredFields);
      return;
    }
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

    const resolvedClientId = clientId === '__walkin__' ? '' : clientId;

    setLoading(true);
    try {
      // Create sale record
      await RetailSaleRepository.createSale({
        salonId: userData?.salonId || '',
        clientId: resolvedClientId || undefined,
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

      // Award loyalty points to registered clients
      if (resolvedClientId && saleTotal > 0) {
        const pointsEarned = Math.floor(saleTotal / LOYALTY_POINTS_RATE);
        if (pointsEarned > 0) {
          const client = clients?.find((c) => c.id === resolvedClientId);
          if (client) {
            await ClientRepository.updateClient(resolvedClientId, {
              loyaltyPoints: (client.loyaltyPoints || 0) + pointsEarned,
              totalSpent: (client.totalSpent || 0) + saleTotal,
            });
          }
        }
      }

      success(ES.retail.saleCreated);
      setIsModalOpen(false);
      setItems([]);
      setClientId('__walkin__');
      setNotes('');
      setPaymentMethod('cash');
      setCashReceived(0);
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
        <Button onClick={() => { setItems([]); setProductSearch(''); setProductCategory('all'); setClientId('__walkin__'); setIsQuickClientOpen(false); setIsModalOpen(true); }} size="lg">
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
                {sale.notes && <p className="text-xs text-gray-500 mt-1 italic">{sale.notes}</p>}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* New Sale Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={ES.retail.create}
        size="lg"
        footer={
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-gray-500">{ES.retail.total} ({items.length} {ES.retail.items})</p>
              <p className="text-xl font-bold text-gray-900">{fmtBs(saleTotal)}</p>
            </div>
            <Button onClick={handleSubmit} loading={loading} className="px-6 py-3" disabled={items.length === 0 || !clientId}>
              {ES.retail.create}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {/* Client selection — walk-in + quick create, same as sessions */}
          {!isQuickClientOpen ? (
            <div>
              <SearchableSelect
                label={ES.retail.selectClient}
                options={clientOptions}
                value={clientId}
                onChange={setClientId}
                placeholder={ES.actions.search}
                required
              />
              <button
                type="button"
                onClick={() => { setIsQuickClientOpen(true); setQuickClient({ firstName: '', lastName: '', phone: '' }); }}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium mt-1"
              >
                {ES.clients.addQuick}
              </button>
            </div>
          ) : (
            <div className="space-y-3 bg-gray-50 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-700">{ES.clients.quickAddTitle}</p>
              <Input
                label={ES.clients.name}
                value={quickClient.firstName}
                onChange={(e) => setQuickClient({ ...quickClient, firstName: e.target.value })}
                required
              />
              <Input
                label={ES.clients.lastName}
                value={quickClient.lastName}
                onChange={(e) => setQuickClient({ ...quickClient, lastName: e.target.value })}
              />
              <Input
                label={ES.clients.phoneOptional}
                type="tel"
                value={quickClient.phone}
                onChange={(e) => setQuickClient({ ...quickClient, phone: e.target.value })}
              />
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setIsQuickClientOpen(false)}>
                  {ES.actions.back}
                </Button>
                <Button size="sm" onClick={handleQuickCreateClient} loading={loading}>
                  {ES.actions.save}
                </Button>
              </div>
            </div>
          )}

          {/* Search + categories */}
          <input
            type="text"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            placeholder={ES.actions.search + '...'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              type="button"
              onClick={() => setProductCategory('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                productCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {ES.inventory.allProducts}
            </button>
            {availableCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setProductCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  productCategory === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {categoryLabels[cat] || cat}
              </button>
            ))}
          </div>

          {/* Product grid — 2 columns, tap to add */}
          <div className="grid grid-cols-2 gap-2">
            {filteredProducts.length === 0 ? (
              <p className="col-span-2 text-sm text-gray-400 text-center py-6">{ES.retail.noSales}</p>
            ) : (
              filteredProducts.map((p) => {
                const cartIdx = items.findIndex((i) => i.productId === p.id);
                const inCart = cartIdx >= 0;
                const cartItem = inCart ? items[cartIdx] : null;
                return (
                  <div
                    key={p.id}
                    className={`border rounded-lg p-2.5 transition-colors ${
                      inCart ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!inCart) {
                          setItems([...items, { productId: p.id, productName: p.name, quantity: 1, unitPrice: p.price, total: p.price, maxStock: p.currentStock }]);
                        }
                      }}
                      className="w-full text-left"
                    >
                      <p className="text-sm font-medium text-gray-900 leading-tight truncate">{p.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{fmtBs(p.price)} · {p.currentStock} {p.unit || 'un'}</p>
                    </button>
                    {inCart && cartItem && (
                      <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-blue-200">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (cartItem.quantity <= 1) {
                                handleRemoveItem(cartIdx);
                              } else {
                                handleItemQuantityChange(cartIdx, cartItem.quantity - 1);
                              }
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-300 text-gray-600 text-sm font-bold"
                          >
                            {cartItem.quantity <= 1 ? '✕' : '−'}
                          </button>
                          <span className="w-8 text-center text-sm font-bold text-blue-700">{cartItem.quantity}</span>
                          <button
                            type="button"
                            onClick={() => handleItemQuantityChange(cartIdx, cartItem.quantity + 1)}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-sm font-bold text-blue-700">{fmtBs(cartItem.total)}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Payment + options — only when cart has items */}
          {items.length > 0 && (
            <div className="space-y-3 pt-1">
              {/* Payment method */}
              <div className="grid grid-cols-4 gap-1.5">
                {(['cash', 'card', 'qr_code', 'transfer'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`py-2 rounded-lg border-2 text-xs font-medium transition-all ${
                      paymentMethod === m
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {methodLabels[m]}
                  </button>
                ))}
              </div>

              {/* Cash change calculator */}
              {paymentMethod === 'cash' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-3">
                  <div className="flex-1">
                    <Input
                      label={ES.payments.amountGiven}
                      type="number"
                      value={cashReceived || ''}
                      onChange={(e) => setCashReceived(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  {cashReceived > 0 && (
                    <div className="text-right">
                      <p className="text-[10px] text-yellow-700">{ES.payments.change}</p>
                      <p className={`text-lg font-bold ${cashReceived >= saleTotal ? 'text-green-700' : 'text-red-600'}`}>
                        {fmtBs(Math.max(0, cashReceived - saleTotal))}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={ES.retail.notes}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
