'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { Modal } from '@/components/Modal';
import { Table, TableColumn } from '@/components/Table';
import { Toast } from '@/components/Toast';
import { DuplicateHint } from '@/components/DuplicateHint';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useNotification } from '@/hooks/useNotification';
import { ProductRepository } from '@/lib/repositories/productRepository';
import { SessionRepository } from '@/lib/repositories/sessionRepository';
import { RetailSaleRepository } from '@/lib/repositories/retailSaleRepository';
import { StaffRepository } from '@/lib/repositories/staffRepository';
import { InventoryWithdrawalRepository } from '@/lib/repositories/inventoryWithdrawalRepository';
import { SearchableSelect } from '@/components/SearchableSelect';
import { deleteField } from 'firebase/firestore';
import { Product, ProductCategory } from '@/types/models';
import { fmtBs, unitLabel, getBoliviaDate } from '@/lib/utils/helpers';
import { findSimilarByName } from '@/lib/utils/fuzzy';
import ES from '@/config/text.es';

const initialFormData = {
  name: '',
  sku: '',
  category: 'hair_products' as ProductCategory,
  type: 'unit' as 'unit' | 'measurable' | 'service_cost',
  unit: 'pieces',
  currentStock: 0,
  minStock: 5,
  maxStock: 100,
  cost: 0,
  price: 0,
  packageNote: '',
  imprecise: false,
  defaultUsage: 0,
};

// Spanish labels for product categories — used both in the form Select and
// the products table render. Source of truth for category translation.
const categoryLabels: Record<ProductCategory, string> = {
  hair_products: 'Productos Capilares',
  hair_dye: 'Tintes',
  shampoo: 'Shampoos / Acondicionadores',
  treatment: 'Tratamientos',
  skincare: 'Cuidado de Piel',
  makeup: 'Maquillaje',
  wax: 'Cera',
  nail_products: 'Productos de Uñas',
  tools: 'Herramientas',
  accessories: 'Accesorios',
  supplies: 'Suministros',
  other: 'Otro',
};

// Unit options grouped by tracking type. Measurable products consume fractional
// amounts (ml/g/l/kg); countable products are tracked in integer counts.
const measurableUnits = [
  { value: 'ml', label: 'Mililitros (ml)' },
  { value: 'g', label: 'Gramos (g)' },
  { value: 'l', label: 'Litros (l)' },
  { value: 'kg', label: 'Kilos (kg)' },
];
const countableUnits = [
  { value: 'pieces', label: 'Piezas' },
  { value: 'tubes', label: 'Tubos' },
  { value: 'bottles', label: 'Frascos' },
  { value: 'sachets', label: 'Sobres' },
  { value: 'pairs', label: 'Pares' },
  { value: 'kits', label: 'Kits' },
];

export default function InventoryPage() {
  const { userData } = useAuth();
  const { notifications, removeNotification, success, error } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({ ...initialFormData });
  const [loading, setLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmCreateAnyway, setConfirmCreateAnyway] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({ productId: '', quantity: 1, takenBy: '', note: '' });
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);

  const { data: productsData, refetch, loading: productsLoading } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ProductRepository.getSalonProducts(userData.salonId);
  }, [userData?.salonId]);

  const { data: staffList } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return StaffRepository.getSalonStaff(userData.salonId);
  }, [userData?.salonId]);

  const { data: recentWithdrawals, refetch: refetchWithdrawals } = useAsync(async () => {
    if (!userData?.salonId) return [];
    const fromDate = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
    })();
    return InventoryWithdrawalRepository.getRecentWithdrawals(userData.salonId, fromDate);
  }, [userData?.salonId]);

  const products = productsData || [];

  const lowStockProducts = products.filter((p) => p.currentStock <= p.minStock);

  const [searchQuery, setSearchQuery] = useState('');
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q),
    );
  }, [products, searchQuery]);

  // Live duplicate detection as admin types — excludes the item being edited.
  const similarProducts = useMemo(() => {
    return findSimilarByName(formData.name, products, {
      excludeId: editingProduct?.id,
    }).map((p) => ({ id: p.id, name: p.name, secondary: `${p.currentStock} ${unitLabel(p.unit)} · ${fmtBs(p.cost)}` }));
  }, [formData.name, products, editingProduct?.id]);

  const pickExistingProduct = (id: string) => {
    const p = products.find((x) => x.id === id);
    if (p) openEditModal(p);
  };

  // Deep-link: /inventory?edit=<productId> opens the edit modal immediately.
  // Used by the dashboard's low-stock alert so admins can fix stock in one tap.
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId || !products.length) return;
    const product = products.find((p) => p.id === editId);
    if (product) {
      openEditModal(product);
      router.replace('/inventory');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, products.length]);

  const resetForm = () => {
    setFormData({ ...initialFormData });
    setEditingProduct(null);
  };

  const openWithdrawModal = () => {
    setWithdrawForm({ productId: '', quantity: 1, takenBy: '', note: '' });
    setWithdrawOpen(true);
  };

  const handleWithdraw = async () => {
    if (!userData?.salonId || !userData?.id) return;
    if (!withdrawForm.productId) {
      error(ES.inventory.withdrawSelectProduct);
      return;
    }
    const product = products.find((p) => p.id === withdrawForm.productId);
    if (!product) return;
    const qty = Number(withdrawForm.quantity) || 0;
    if (qty <= 0) {
      error(ES.messages.fillRequiredFields);
      return;
    }
    const isServiceCost = product.type === 'service_cost';
    if (!isServiceCost && qty > product.currentStock) {
      error(ES.inventory.withdrawNoStock);
      return;
    }
    setWithdrawSubmitting(true);
    try {
      const staffMatch = staffList?.find((s) => s.id === withdrawForm.takenBy);
      await InventoryWithdrawalRepository.create({
        salonId: userData.salonId,
        productId: product.id,
        productName: product.name,
        quantity: qty,
        unit: product.unit || (isServiceCost ? 'uso' : 'ud'),
        cost: product.cost * qty,
        ...(staffMatch ? { takenBy: staffMatch.id, takenByName: `${staffMatch.firstName} ${staffMatch.lastName}` } : {}),
        ...(withdrawForm.note ? { note: withdrawForm.note } : {}),
        createdBy: userData.id,
      });
      // Service-cost products have no real stock so we skip the decrement.
      if (!isServiceCost) {
        await ProductRepository.updateStock(product.id, qty);
      }
      success(ES.inventory.withdrawSuccess);
      setWithdrawOpen(false);
      refetch();
      refetchWithdrawals();
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku,
      category: product.category,
      type: product.type,
      unit: product.unit || 'pieces',
      currentStock: product.currentStock,
      minStock: product.minStock,
      maxStock: product.maxStock,
      cost: product.cost,
      price: product.price,
      packageNote: product.packageNote || '',
      imprecise: product.imprecise === true,
      defaultUsage: product.defaultUsage || 0,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSaveProduct = async (force = false) => {
    if (!formData.name || !userData?.salonId) {
      error(ES.messages.fillRequiredFields);
      return;
    }

    // Soft-confirm: warn on create if similar-named product already exists.
    if (!editingProduct && !force && similarProducts.length > 0) {
      setConfirmCreateAnyway(true);
      return;
    }

    setLoading(true);
    try {
      // Firestore rejects writes with undefined values. For service_cost products
      // we omit the unit field entirely on create, and use deleteField() on edit
      // to clear any leftover unit from a previous type. For unit/measurable we
      // include the chosen unit normally.
      const isServiceCost = formData.type === 'service_cost';
      const productData: Record<string, unknown> = {
        name: formData.name,
        sku: formData.sku,
        category: formData.category,
        type: formData.type,
        packageNote: formData.packageNote || '',
        imprecise: formData.imprecise === true,
        // Only meaningful when imprecise=true. Stored as 0 otherwise so existing
        // products without this field don't break the type contract.
        defaultUsage: formData.imprecise ? Number(formData.defaultUsage) || 0 : 0,
        currentStock: formData.currentStock,
        minStock: formData.minStock,
        maxStock: formData.maxStock,
        cost: formData.cost,
        price: formData.price,
      };
      if (!isServiceCost) {
        productData.unit = formData.unit;
      } else if (editingProduct?.unit) {
        productData.unit = deleteField();
      }

      if (editingProduct) {
        await ProductRepository.updateProduct(editingProduct.id, productData as Partial<Product>);
        success(ES.inventory.updated);
      } else {
        await ProductRepository.createProduct(userData.salonId, productData as Omit<Product, 'id' | 'salonId' | 'isActive' | 'createdAt' | 'updatedAt'>);
        success(ES.actions.success);
      }

      closeModal();
      refetch();
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!userData?.salonId) return;
    try {
      // Block deletion if product is referenced in any session or retail sale
      const [sessions, sales] = await Promise.all([
        SessionRepository.getSalonSessions(userData.salonId),
        RetailSaleRepository.getSalonSales(userData.salonId),
      ]);
      const usedInSession = sessions.some((s) =>
        (s.materialsUsed || []).some((m) => m.productId === id) ||
        (s.services || []).some((svc) => (svc.materialsUsed || []).some((m) => m.productId === id))
      );
      const usedInSale = sales.some((s) => (s.items || []).some((i) => i.productId === id));
      if (usedInSession || usedInSale) {
        error(ES.inventory.cannotDeleteInUse);
        setConfirmDeleteId(null);
        return;
      }
      await ProductRepository.deleteProduct(id);
      success(ES.inventory.deleted);
      setConfirmDeleteId(null);
      refetch();
    } catch (err) {
      error(err instanceof Error ? err.message : ES.messages.operationFailed);
    }
  };

  const productColumns: TableColumn<Product>[] = [
    { key: 'name', label: ES.inventory.name },
    { key: 'sku', label: ES.inventory.sku },
    { key: 'category', label: ES.inventory.category, render: (v) => categoryLabels[v as ProductCategory] || (v as string) },
    {
      key: 'currentStock',
      label: ES.inventory.stock,
      render: (value, item) => (
        <span
          className={
            value <= item.minStock
              ? 'text-red-600 font-semibold'
              : 'text-green-600 font-semibold'
          }
        >
          {value} {unitLabel(item.unit)}
        </span>
      ),
    },
    { key: 'cost', label: ES.inventory.cost, render: (v) => fmtBs(Number(v)) },
    { key: 'price', label: ES.inventory.price, render: (v) => fmtBs(Number(v)) },
    {
      key: 'id',
      label: ES.actions.edit,
      render: (_value, item) => (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openEditModal(item)}
          >
            {ES.actions.edit}
          </Button>
          {userData?.role === 'admin' && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmDeleteId(item.id)}
            >
              {ES.actions.delete}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <Toast notifications={notifications} onDismiss={removeNotification} />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-3xl font-bold text-gray-900">{ES.inventory.title}</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={openWithdrawModal} size="lg">
            {ES.inventory.withdraw}
          </Button>
          <Button onClick={openCreateModal} size="lg">
            {ES.inventory.add}
          </Button>
        </div>
      </div>

      {/* Low Stock Alert — each row opens the edit modal for that product */}
      {lowStockProducts.length > 0 && (
        <Card className="bg-red-50 border border-red-200">
          <CardBody>
            <p className="font-semibold text-red-900 mb-3">
              ⚠️ {lowStockProducts.length} {ES.inventory.lowStock}
            </p>
            <div className="space-y-1.5">
              {lowStockProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => openEditModal(product)}
                  className="w-full text-left bg-white hover:bg-red-100 active:bg-red-200 border border-red-100 rounded-lg px-3 py-2 min-h-[44px] transition-colors flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                    <p className="text-xs text-red-700">
                      {product.currentStock} {unitLabel(product.unit)} / min {product.minStock}
                    </p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${product.currentStock === 0 ? 'bg-red-200 text-red-800' : 'bg-yellow-100 text-yellow-700'}`}>
                    {product.currentStock === 0 ? ES.stockAlert.outOfStock : ES.stockAlert.lowStock}
                  </span>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Products Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900 shrink-0">{ES.inventory.allProducts}</h2>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={ES.inventory.search}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </CardHeader>
        <CardBody>
          <Table
            columns={productColumns}
            data={filteredProducts}
            rowKey="id"
            loading={productsLoading}
            emptyMessage={ES.inventory.noProducts}
          />
        </CardBody>
      </Card>

      {/* Add/Edit Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingProduct ? ES.inventory.editProduct : ES.inventory.add}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <Input
              label={ES.inventory.name}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              maxLength={50}
            />
            <DuplicateHint
              kind="product"
              matches={editingProduct ? [] : similarProducts}
              onPick={pickExistingProduct}
            />
          </div>
          <Input
            label={ES.inventory.sku}
            value={formData.sku}
            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
            maxLength={20}
          />
          <Select
            label={ES.inventory.category}
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value as ProductCategory })}
            options={(Object.keys(categoryLabels) as ProductCategory[]).map((k) => ({ value: k, label: categoryLabels[k] }))}
            required
          />
          {/* Tracking type — drives which units are valid + helper text below */}
          <div>
            <Select
              label={ES.inventory.typeHelperLabel}
              value={formData.type}
              onChange={(e) => {
                const newType = e.target.value as 'unit' | 'measurable' | 'service_cost';
                // When switching tracking type, reset to a sensible default unit so we
                // don't end up with e.g. type=measurable + unit=pieces.
                let nextUnit = formData.unit;
                if (newType === 'measurable' && !measurableUnits.some((u) => u.value === formData.unit)) nextUnit = 'ml';
                if (newType === 'unit' && !countableUnits.some((u) => u.value === formData.unit)) nextUnit = 'pieces';
                setFormData({ ...formData, type: newType, unit: nextUnit });
              }}
              options={[
                { value: 'unit', label: ES.inventory.typeUnit },
                { value: 'measurable', label: ES.inventory.typeMeasurable },
                { value: 'service_cost', label: ES.inventory.typeServiceCost },
              ]}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.type === 'unit' && ES.inventory.typeUnitHint}
              {formData.type === 'measurable' && ES.inventory.typeMeasurableHint}
              {formData.type === 'service_cost' && ES.inventory.typeServiceCostHint}
            </p>
          </div>
          {formData.type !== 'service_cost' && (
            <Select
              label={ES.inventory.unit}
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              options={formData.type === 'measurable' ? measurableUnits : countableUnits}
              required
            />
          )}
          {/* Optional presentation note — useful for items repackaged by staff */}
          {formData.type !== 'service_cost' && (
            <div>
              <Input
                label={ES.inventory.packageNote}
                value={formData.packageNote}
                onChange={(e) => setFormData({ ...formData, packageNote: e.target.value })}
                placeholder={ES.inventory.packageNotePlaceholder}
                maxLength={120}
              />
              <p className="text-xs text-gray-500 mt-1">{ES.inventory.packageNoteHelp}</p>
            </div>
          )}
          {/* Imprecise mode — single-tap "Marcar uso" for products workers can't measure (shine, sprays) */}
          {formData.type === 'measurable' && (
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.imprecise}
                  onChange={(e) => setFormData({ ...formData, imprecise: e.target.checked })}
                  className="mt-0.5 w-4 h-4 text-blue-600 rounded"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900">{ES.inventory.impreciseLabel}</span>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{ES.inventory.impreciseHelp}</p>
                </div>
              </label>
              {formData.imprecise && (
                <div className="mt-3 ml-6">
                  <Input
                    label={`${ES.inventory.defaultUsageLabel} (${formData.unit})`}
                    type="number"
                    value={formData.defaultUsage}
                    onChange={(e) => setFormData({ ...formData, defaultUsage: parseFloat(e.target.value) || 0 })}
                    min={0}
                    step="0.01"
                  />
                  <p className="text-xs text-gray-500 mt-1">{ES.inventory.defaultUsageHelp}</p>
                </div>
              )}
            </div>
          )}
          {/* Stock fields are meaningless for "Sin stock fijo" — hide them */}
          {formData.type !== 'service_cost' && (
            <>
              <Input
                label={ES.inventory.currentStock}
                type="number"
                value={formData.currentStock}
                onChange={(e) => setFormData({ ...formData, currentStock: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                required
                min={0}
                step="any"
              />
              <Input
                label={ES.inventory.minStock}
                type="number"
                value={formData.minStock}
                onChange={(e) => setFormData({ ...formData, minStock: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                required
                min={0}
                step="any"
              />
              <Input
                label={ES.inventory.maxStock}
                type="number"
                value={formData.maxStock}
                onChange={(e) => setFormData({ ...formData, maxStock: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                required
                min={0}
                step="any"
              />
            </>
          )}
          {formData.type === 'service_cost' && (
            <p className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-2.5">
              {ES.inventory.serviceCostNoStock}
            </p>
          )}
          <div>
            <Input
              label={formData.type === 'service_cost' ? ES.inventory.costPerUse : ES.inventory.costPerUnit}
              type="number"
              value={formData.cost}
              onChange={(e) => setFormData({ ...formData, cost: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
              required
              min={0}
              step="any"
            />
            {formData.type === 'service_cost' && (
              <p className="text-xs text-gray-500 mt-1">{ES.inventory.costPerUseHint}</p>
            )}
          </div>
          <Input
            label={ES.inventory.sellingPrice}
            type="number"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
            required
            min={0}
            step="any"
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={closeModal}>
              {ES.actions.cancel}
            </Button>
            <Button onClick={() => handleSaveProduct()} loading={loading}>
              {editingProduct ? ES.actions.save : ES.inventory.add}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Duplicate soft-confirm */}
      <Modal
        isOpen={confirmCreateAnyway}
        onClose={() => setConfirmCreateAnyway(false)}
        title={ES.duplicateHint.confirmTitle}
        size="sm"
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">{ES.duplicateHint.confirmCreateAnyway}</p>
          <div className="flex flex-wrap gap-1.5">
            {similarProducts.map((m) => (
              <span key={m.id} className="text-xs px-2 py-1 bg-amber-50 border border-amber-200 rounded-md text-amber-900">{m.name}</span>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setConfirmCreateAnyway(false)}>
              {ES.duplicateHint.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmCreateAnyway(false);
                handleSaveProduct(true);
              }}
            >
              {ES.duplicateHint.createAnyway}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        title={ES.inventory.deleteConfirm}
      >
        <div className="space-y-4">
          <p className="text-gray-700">Esta acción no se puede deshacer.</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setConfirmDeleteId(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => confirmDeleteId && handleDeleteProduct(confirmDeleteId)}>
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Out-of-session inventory withdrawal */}
      <Modal
        isOpen={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        title={ES.inventory.withdrawTitle}
      >
        <div className="space-y-4 pb-16 sm:pb-0">
          <p className="text-xs text-gray-600">{ES.inventory.withdrawSubtitle}</p>
          <SearchableSelect
            label={ES.inventory.withdrawProduct}
            options={products.map((p) => ({
              value: p.id,
              label: p.name,
              secondary: p.type === 'service_cost'
                ? `${fmtBs(p.cost)} / uso`
                : `${p.currentStock} ${unitLabel(p.unit)} · ${fmtBs(p.cost)}`,
            }))}
            value={withdrawForm.productId}
            onChange={(v) => setWithdrawForm({ ...withdrawForm, productId: v })}
            placeholder={ES.actions.search}
            required
          />
          {(() => {
            const p = products.find((x) => x.id === withdrawForm.productId);
            if (!p) return null;
            const totalCost = p.cost * (Number(withdrawForm.quantity) || 0);
            return (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm space-y-1">
                <p className="text-gray-700">
                  {p.type === 'service_cost'
                    ? <>Sin stock fijo · {fmtBs(p.cost)} / uso</>
                    : <>Stock actual: <span className="font-semibold">{p.currentStock} {unitLabel(p.unit)}</span></>}
                </p>
                <p className="text-gray-700">Costo total: <span className="font-semibold">{fmtBs(totalCost)}</span></p>
              </div>
            );
          })()}
          <Input
            label={`${ES.inventory.withdrawQuantity}${(() => {
              const p = products.find((x) => x.id === withdrawForm.productId);
              return p ? ` (${unitLabel(p.unit) || 'uso'})` : '';
            })()}`}
            type="number"
            value={withdrawForm.quantity}
            onChange={(e) => setWithdrawForm({ ...withdrawForm, quantity: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
            required
            min={0}
            step="any"
          />
          <SearchableSelect
            label={ES.inventory.withdrawTakenBy}
            options={[
              { value: '', label: ES.inventory.withdrawNoStaff },
              ...((staffList || []).map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }))),
            ]}
            value={withdrawForm.takenBy}
            onChange={(v) => setWithdrawForm({ ...withdrawForm, takenBy: v })}
            placeholder={ES.actions.search}
          />
          <Input
            label={ES.inventory.withdrawNote}
            value={withdrawForm.note}
            onChange={(e) => setWithdrawForm({ ...withdrawForm, note: e.target.value })}
            placeholder={ES.inventory.withdrawNotePlaceholder}
          />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1 py-3" onClick={() => setWithdrawOpen(false)}>
              {ES.actions.cancel}
            </Button>
            <Button className="flex-1 py-3" onClick={handleWithdraw} loading={withdrawSubmitting}>
              {ES.inventory.withdrawSubmit}
            </Button>
          </div>

          {recentWithdrawals && recentWithdrawals.length > 0 && (
            <div className="pt-4 border-t border-gray-200">
              <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">{ES.inventory.withdrawHistoryTitle}</p>
              <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                {recentWithdrawals.slice(0, 10).map((w) => {
                  const ts = w.createdAt instanceof Date ? w.createdAt : new Date(w.createdAt as unknown as string);
                  const dateLabel = ts.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', timeZone: 'America/La_Paz' });
                  return (
                    <li key={w.id} className="text-xs flex items-start justify-between gap-2 py-1">
                      <div className="min-w-0 flex-1">
                        <p className="text-gray-900 truncate">
                          <span className="font-medium">{w.productName}</span> · {w.quantity} {unitLabel(w.unit)}
                        </p>
                        <p className="text-gray-500 truncate">
                          {dateLabel}{w.takenByName ? ` · ${w.takenByName}` : ''}{w.note ? ` · ${w.note}` : ''}
                        </p>
                      </div>
                      <span className="text-gray-700 shrink-0">{fmtBs(w.cost)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
