'use client';

import React, { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { Modal } from '@/components/Modal';
import { Table, TableColumn } from '@/components/Table';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useNotification } from '@/hooks/useNotification';
import { ProductRepository } from '@/lib/repositories/productRepository';
import { Product } from '@/types/models';
import ES from '@/config/text.es';

export default function InventoryPage() {
  const { userData } = useAuth();
  const { success, error } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: 'hair_products' as const,
    type: 'unit' as 'unit' | 'measurable' | 'service_cost',
    unit: 'pieces',
    currentStock: 0,
    minStock: 5,
    maxStock: 100,
    cost: 0,
    price: 0,
  });
  const [loading, setLoading] = useState(false);

  const { data: productsData, refetch, loading: productsLoading } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ProductRepository.getSalonProducts(userData.salonId);
  }, [userData?.salonId]);

  const products = productsData || [];

  const { data: lowStockData } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return ProductRepository.getLowStockProducts(userData.salonId);
  }, [userData?.salonId]);

  const lowStockProducts = lowStockData || [];

  const handleCreateProduct = async () => {
    if (!formData.name || !userData?.salonId) {
      error(ES.messages.fillRequiredFields);
      return;
    }

    setLoading(true);
    try {
      await ProductRepository.createProduct(userData.salonId, {
        name: formData.name,
        sku: formData.sku,
        category: formData.category,
        type: formData.type,
        unit: formData.type !== 'service_cost' ? formData.unit : undefined,
        currentStock: formData.currentStock,
        minStock: formData.minStock,
        maxStock: formData.maxStock,
        cost: formData.cost,
        price: formData.price,
      });
      success(ES.actions.success);
      setIsModalOpen(false);
      setFormData({
        name: '',
        sku: '',
        category: 'hair_products',
        type: 'unit',
        unit: 'pieces',
        currentStock: 0,
        minStock: 5,
        maxStock: 100,
        cost: 0,
        price: 0,
      });
      refetch();
    } catch (err) {
      error(err instanceof Error ? err.message : 'Falló al crear el producto');
    } finally {
      setLoading(false);
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
          {value} {item.unit || 'un'}
        </span>
      ),
    },
    { key: 'cost', label: ES.inventory.cost, render: (v) => `$${v?.toFixed(2)}` },
    { key: 'price', label: ES.inventory.price, render: (v) => `$${v?.toFixed(2)}` },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{ES.inventory.title}</h1>
        <Button onClick={() => setIsModalOpen(true)} size="lg">
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
                  {product.name}: {product.currentStock} {product.unit || 'un'} (min: {product.minStock})
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

      {/* Add Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={ES.inventory.add}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label={ES.inventory.name}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label={ES.inventory.sku}
            value={formData.sku}
            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
            required
          />
          <Select
            label={ES.inventory.category}
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
            options={[
              { value: 'hair_products', label: 'Productos Capilares' },
              { value: 'skincare', label: 'Cuidado de Piel' },
              { value: 'wax', label: 'Cera' },
              { value: 'nail_products', label: 'Productos de Uñas' },
              { value: 'tools', label: 'Herramientas' },
              { value: 'supplies', label: 'Suministros' },
            ]}
            required
          />
          <Select
            label="Tipo"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
            options={[
              { value: 'unit', label: 'Por Unidad' },
              { value: 'measurable', label: 'Medible (ml/g)' },
              { value: 'service_cost', label: 'Costo de Servicio' },
            ]}
            required
          />
          {formData.type !== 'service_cost' && (
            <Select
              label="Unidad"
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              options={[
                { value: 'pieces', label: 'Piezas' },
                { value: 'ml', label: 'Mililitros' },
                { value: 'g', label: 'Gramos' },
                { value: 'bottles', label: 'Botellas' },
                { value: 'sachets', label: 'Sobres' },
              ]}
              required
            />
          )}
          <Input
            label={`${ES.inventory.stock} (${ES.actions.loading})`}
            type="number"
            value={formData.currentStock}
            onChange={(e) => setFormData({ ...formData, currentStock: parseFloat(e.target.value) })}
            required
          />
          <Input
            label="Stock Mínimo"
            type="number"
            value={formData.minStock}
            onChange={(e) => setFormData({ ...formData, minStock: parseFloat(e.target.value) })}
            required
          />
          <Input
            label="Stock Máximo"
            type="number"
            value={formData.maxStock}
            onChange={(e) => setFormData({ ...formData, maxStock: parseFloat(e.target.value) })}
            required
          />
          <Input
            label={`${ES.inventory.cost} por Unidad`}
            type="number"
            value={formData.cost}
            onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) })}
            required
          />
          <Input
            label={`${ES.inventory.price} de Venta`}
            type="number"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
            required
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              {ES.actions.cancel}
            </Button>
            <Button onClick={handleCreateProduct} loading={loading}>
              {ES.inventory.add}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
