import { addDocument, updateDocument, getDocument, queryDocuments, firebaseConstraints } from '@/lib/firebase/db';
import { Product, ProductUsageHistory } from '@/types/models';
import { CreateProductRequest } from '@/types/api';
import { toDate } from '@/lib/utils/helpers';

export class InventoryService {
  static async createProduct(salonId: string, data: CreateProductRequest): Promise<string> {
    const productId = await addDocument('products', {
      ...data,
      salonId,
      isActive: true,
    });
    return productId;
  }

  static async getProduct(productId: string): Promise<Product | null> {
    return await getDocument('products', productId) as Product | null;
  }

  static async updateProduct(productId: string, data: Partial<Product>): Promise<void> {
    await updateDocument('products', productId, data);
  }

  static async updateStock(productId: string, quantity: number): Promise<void> {
    const product = await this.getProduct(productId);
    if (!product) throw new Error('Product not found');

    const newStock = product.currentStock - quantity;
    if (newStock < 0) throw new Error('Insufficient stock');

    await updateDocument('products', productId, {
      currentStock: newStock,
    });

    // Log usage
    await this.logUsage(productId, quantity, product.unit || '', product.cost * quantity);
  }

  static async restockProduct(productId: string, quantity: number, cost: number): Promise<void> {
    const product = await this.getProduct(productId);
    if (!product) throw new Error('Product not found');

    const newStock = product.currentStock + quantity;
    await updateDocument('products', productId, {
      currentStock: newStock,
    });

    // Log restock
    await addDocument('product_usage_history', {
      productId,
      quantity: -quantity, // negative to indicate restock
      unit: product.unit,
      cost: -cost,
      usedAt: new Date(),
      usedBy: 'restock',
    });
  }

  static async getSalonProducts(salonId: string): Promise<Product[]> {
    return await queryDocuments('products', [
      firebaseConstraints.where('salonId', '==', salonId),
      firebaseConstraints.where('isActive', '==', true),
    ]) as Product[];
  }

  static async getLowStockProducts(salonId: string): Promise<Product[]> {
    const products = await this.getSalonProducts(salonId);
    return products.filter(p => p.currentStock <= p.minStock);
  }

  static async getProductsByCategory(salonId: string, category: string): Promise<Product[]> {
    return await queryDocuments('products', [
      firebaseConstraints.where('salonId', '==', salonId),
      firebaseConstraints.where('category', '==', category),
      firebaseConstraints.where('isActive', '==', true),
    ]) as Product[];
  }

  private static async logUsage(productId: string, quantity: number, unit: string, cost: number): Promise<void> {
    await addDocument('product_usage_history', {
      productId,
      quantity,
      unit,
      cost,
      usedAt: new Date(),
    });
  }

  static async getUsageHistory(salonId: string, days = 30): Promise<ProductUsageHistory[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const results = await queryDocuments('product_usage_history', [
      firebaseConstraints.where('usedAt', '>=', startDate),
    ]) as ProductUsageHistory[];

    return results.sort((a, b) => toDate(b.usedAt).getTime() - toDate(a.usedAt).getTime());
  }

  static async getInventoryValue(salonId: string): Promise<number> {
    const products = await this.getSalonProducts(salonId);
    return products.reduce((total, p) => total + (p.currentStock * p.cost), 0);
  }

  static async calculateMaterialCost(salonId: string, dateRange: [Date, Date]): Promise<number> {
    const history = await this.getUsageHistory(salonId, 30);
    return history
      .filter(h => {
        const d = toDate(h.usedAt);
        return d >= dateRange[0] && d <= dateRange[1];
      })
      .reduce((total, h) => total + h.cost, 0);
  }
}
