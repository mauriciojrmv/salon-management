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
import { InventoryService } from '@/lib/services/inventoryService';
import { Product } from '@/types/models';

export default function InventoryPage() {
  const { userData } = useAuth();
  const { success, error } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: 'hair_products',
    type: 'unit' as const,
    unit: 'pieces',
    currentStock: 0,
    minStock: 5,
    maxStock: 100,
    cost: 0,
    price: 0,
  });
  const [loading, setLoading] = useState(false);

  const { data: products, refetch } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return InventoryService.getSalonProducts(userData.salonId);
  }, [userData?.salonId]);

  const { data: lowStockProducts } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return InventoryService.getLowStockProducts(userData.salonId);
  }, [userData?.salonId]);

  const handleCreateProduct = async () => {
    if (!formData.name || !userData?.salonId) {
      error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      await InventoryService.createProduct(userData.salonId, formData);
      success('Product created successfully');
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
      error(err instanceof Error ? err.message : 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  const productColumns: TableColumn<Product>[] = [
    { key: 'name', label: 'Product Name' },
    { key: 'sku', label: 'SKU' },
    { key: 'category', label: 'Category' },
    {
      key: 'currentStock',
      label: 'Stock',
      render: (value, item) => (
        <span
          className={
            value <= item.minStock
              ? 'text-red-600 font-semibold'
              : 'text-green-600 font-semibold'
          }
        >
          {value} {item.unit}
        </span>
      ),
    },
    { key: 'cost', label: 'Cost', render: (v) => `$${v?.toFixed(2)}` },
    { key: 'price', label: 'Price', render: (v) => `$${v?.toFixed(2)}` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
        <Button onClick={() => setIsModalOpen(true)} size="lg">
          + Add Product
        </Button>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts && lowStockProducts.length > 0 && (
        <Card className="bg-red-50 border border-red-200">
          <CardBody>
            <p className="font-semibold text-red-900 mb-3">
              ⚠️ {lowStockProducts.length} products below minimum stock
            </p>
            <div className="space-y-2">
              {lowStockProducts.map((product) => (
                <div key={product.id} className="text-sm text-red-800">
                  {product.name}: {product.currentStock} {product.unit} (min: {product.minStock})
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Products Table */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">All Products</h2>
        </CardHeader>
        <CardBody>
          <Table
            columns={productColumns}
            data={products || []}
            rowKey="id"
            emptyMessage="No products yet"
          />
        </CardBody>
      </Card>

      {/* Add Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Product"
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Product Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="SKU"
            value={formData.sku}
            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
            required
          />
          <Select
            label="Category"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
            options={[
              { value: 'hair_products', label: 'Hair Products' },
              { value: 'skincare', label: 'Skincare' },
              { value: 'wax', label: 'Wax' },
              { value: 'nail_products', label: 'Nail Products' },
              { value: 'tools', label: 'Tools' },
              { value: 'supplies', label: 'Supplies' },
            ]}
            required
          />
          <Select
            label="Type"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
            options={[
              { value: 'unit', label: 'Unit-based' },
              { value: 'measurable', label: 'Measurable (ml/g)' },
              { value: 'service_cost', label: 'Service Cost' },
            ]}
            required
          />
          {formData.type !== 'service_cost' && (
            <Select
              label="Unit"
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              options={[
                { value: 'pieces', label: 'Pieces' },
                { value: 'ml', label: 'Milliliters' },
                { value: 'g', label: 'Grams' },
                { value: 'bottles', label: 'Bottles' },
                { value: 'sachets', label: 'Sachets' },
              ]}
              required
            />
          )}
          <Input
            label="Current Stock"
            type="number"
            value={formData.currentStock}
            onChange={(e) => setFormData({ ...formData, currentStock: parseFloat(e.target.value) })}
            required
          />
          <Input
            label="Minimum Stock"
            type="number"
            value={formData.minStock}
            onChange={(e) => setFormData({ ...formData, minStock: parseFloat(e.target.value) })}
            required
          />
          <Input
            label="Maximum Stock"
            type="number"
            value={formData.maxStock}
            onChange={(e) => setFormData({ ...formData, maxStock: parseFloat(e.target.value) })}
            required
          />
          <Input
            label="Cost per Unit"
            type="number"
            value={formData.cost}
            onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) })}
            required
          />
          <Input
            label="Selling Price"
            type="number"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
            required
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProduct} loading={loading}>
              Add Product
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
