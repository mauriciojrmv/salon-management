import { addDocument, updateDocument, getDocument, queryDocuments, firebaseConstraints } from '@/lib/firebase/db';
import { Product } from '@/types/models';
import { CreateProductRequest } from '@/types/api';

export class ProductRepository {
  static async createProduct(salonId: string, data: CreateProductRequest): Promise<string> {
    if (!data.name || !data.currentStock === undefined) {
      throw new Error('Missing required fields');
    }

    const productId = await addDocument('products', {
      ...data,
      salonId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return productId;
  }

  static async getProduct(productId: string): Promise<Product | null> {
    return await getDocument('products', productId) as Product | null;
  }

  static async updateProduct(productId: string, data: Partial<Product>): Promise<void> {
    await updateDocument('products', productId, {
      ...data,
      updatedAt: new Date(),
    });
  }

  static async deleteProduct(productId: string): Promise<void> {
    await updateDocument('products', productId, {
      isActive: false,
      updatedAt: new Date(),
    });
  }

  static async getSalonProducts(salonId: string): Promise<Product[]> {
    return await queryDocuments('products', [
      firebaseConstraints.where('salonId', '==', salonId),
      firebaseConstraints.where('isActive', '==', true),
      firebaseConstraints.orderBy('createdAt', 'desc'),
    ]) as Product[];
  }

  static async getLowStockProducts(salonId: string): Promise<Product[]> {
    const products = await this.getSalonProducts(salonId);
    return products.filter((p) => p.currentStock <= p.minStock);
  }

  static async getProductsByCategory(salonId: string, category: string): Promise<Product[]> {
    return await queryDocuments('products', [
      firebaseConstraints.where('salonId', '==', salonId),
      firebaseConstraints.where('category', '==', category),
      firebaseConstraints.where('isActive', '==', true),
    ]) as Product[];
  }

  static async updateStock(productId: string, quantity: number): Promise<void> {
    const product = await this.getProduct(productId);
    if (!product) throw new Error('Product not found');

    const newStock = product.currentStock - quantity;
    if (newStock < 0) throw new Error('Insufficient stock');

    await this.updateProduct(productId, {
      currentStock: newStock,
    });
  }

  static async restockProduct(productId: string, quantity: number): Promise<void> {
    const product = await this.getProduct(productId);
    if (!product) throw new Error('Product not found');

    const newStock = product.currentStock + quantity;
    await this.updateProduct(productId, {
      currentStock: newStock,
    });
  }

  static async getInventoryValue(salonId: string): Promise<number> {
    const products = await this.getSalonProducts(salonId);
    return products.reduce((total, p) => total + p.currentStock * p.cost, 0);
  }
}
