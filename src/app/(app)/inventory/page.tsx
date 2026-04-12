'use client';

import React, { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { Modal } from '@/components/Modal';
import { Table, TableColumn } from '@/components/Table';
import { Toast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useNotification } from '@/hooks/useNotification';
import { ProductRepository } from '@/lib/repositories/productRepository';
import { SessionRepository } from '@/lib/repositories/sessionRepository';
import { RetailSaleRepository } from '@/lib/repositories/retailSaleRepository';
import { Product, ProductCategory } from '@/types/models';
import { fmtBs, unitLabel } from '@/lib/utils/helpers';
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
};

export default function InventoryPage() {
  const { userData } = useAuth();
  const { notifications, removeNotification, success, error } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({ ...initialFormData });
  const [loading, setLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: productsData, refetch, loading: productsLoading } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ProductRepository.getSalonProducts(userData.salonId);
  }, [userData?.salonId]);

  const products = productsData || [];

  const lowStockProducts = products.filter((p) => p.currentStock <= p.minStock);

  const resetForm = () => {
    setFormData({ ...initialFormData });
    setEditingProduct(null);
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
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSaveProduct = async () => {
    if (!formData.name || !userData?.salonId) {
      error(ES.messages.fillRequiredFields);
      return;
    }

    setLoading(true);
    try {
      const productData = {
        name: formData.name,
        sku: formData.sku,
        category: formData.category,
        type: formData.type,
        unit: formData.type !== 'service_cost' ? formData.unit as Product['unit'] : undefined,
        currentStock: formData.currentStock,
        minStock: formData.minStock,
        maxStock: formData.maxStock,
        cost: formData.cost,
        price: formData.price,
      };

      if (editingProduct) {
        await ProductRepository.updateProduct(editingProduct.id, productData);
        success(ES.inventory.updated);
      } else {
        await ProductRepository.createProduct(userData.salonId, productData);
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
    { key: 'category', label: ES.inventory.category },
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
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{ES.inventory.title}</h1>
        <Button onClick={openCreateModal} size="lg">
          {ES.inventory.add}
        </Button>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <Card className="bg-red-50 border border-red-200">
          <CardBody>
            <p className="font-semibold text-red-900 mb-3">
              ⚠️ {lowStockProducts.length} {ES.inventory.lowStock}
            </p>
            <div className="space-y-2">
              {lowStockProducts.map((product) => (
                <div key={product.id} className="text-sm text-red-800">
                  {product.name}: {product.currentStock} {unitLabel(product.unit)} (min: {product.minStock})
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Products Table */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">{ES.inventory.allProducts}</h2>
        </CardHeader>
        <CardBody>
          <Table
            columns={productColumns}
            data={products}
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
          <Input
            label={ES.inventory.name}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            maxLength={50}
          />
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
            options={[
              { value: 'hair_products', label: ES.inventory.catHairProducts },
              { value: 'hair_dye', label: ES.inventory.catHairDye },
              { value: 'shampoo', label: ES.inventory.catShampoo },
              { value: 'treatment', label: ES.inventory.catTreatment },
              { value: 'skincare', label: ES.inventory.catSkincare },
              { value: 'makeup', label: ES.inventory.catMakeup },
              { value: 'wax', label: ES.inventory.catWax },
              { value: 'nail_products', label: ES.inventory.catNailProducts },
              { value: 'tools', label: ES.inventory.catTools },
              { value: 'accessories', label: ES.inventory.catAccessories },
              { value: 'supplies', label: ES.inventory.catSupplies },
              { value: 'other', label: ES.inventory.catOther },
            ]}
            required
          />
          <Select
            label={ES.inventory.type}
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as 'unit' | 'measurable' | 'service_cost' })}
            options={[
              { value: 'unit', label: ES.inventory.typeUnit },
              { value: 'measurable', label: ES.inventory.typeMeasurable },
              { value: 'service_cost', label: ES.inventory.typeServiceCost },
            ]}
            required
          />
          {formData.type !== 'service_cost' && (
            <Select
              label={ES.inventory.unit}
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              options={[
                { value: 'pieces', label: ES.inventory.unitPieces },
                { value: 'ml', label: ES.inventory.unitMl },
                { value: 'g', label: ES.inventory.unitG },
                { value: 'bottles', label: ES.inventory.unitBottles },
                { value: 'sachets', label: ES.inventory.unitSachets },
              ]}
              required
            />
          )}
          <Input
            label={ES.inventory.currentStock}
            type="number"
            value={formData.currentStock}
            onChange={(e) => setFormData({ ...formData, currentStock: parseFloat(e.target.value) })}
            required
            min={0}
          />
          <Input
            label={ES.inventory.minStock}
            type="number"
            value={formData.minStock}
            onChange={(e) => setFormData({ ...formData, minStock: parseFloat(e.target.value) })}
            required
            min={0}
          />
          <Input
            label={ES.inventory.maxStock}
            type="number"
            value={formData.maxStock}
            onChange={(e) => setFormData({ ...formData, maxStock: parseFloat(e.target.value) })}
            required
            min={0}
          />
          <Input
            label={ES.inventory.costPerUnit}
            type="number"
            value={formData.cost}
            onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) })}
            required
            min={0}
          />
          <Input
            label={ES.inventory.sellingPrice}
            type="number"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
            required
            min={0}
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={closeModal}>
              {ES.actions.cancel}
            </Button>
            <Button onClick={handleSaveProduct} loading={loading}>
              {editingProduct ? ES.actions.save : ES.inventory.add}
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
    </div>
  );
}
