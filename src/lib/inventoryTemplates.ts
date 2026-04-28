import { ProductCategory } from '@/types/models';

// Pre-filled product templates for first-time setup. Each template captures the
// shape of a *typical* Bolivian salon item so admin doesn't have to figure out
// type/unit/imprecise/defaultUsage from scratch. After picking a template the
// admin only edits name + cost in 90% of cases.
//
// Defaults err on the side of "easy to fix later" — minStock/maxStock are
// conservative starting points, currentStock is 0 (admin enters real value
// during the first stock-take).

export interface InventoryTemplateFormData {
  name: string;
  sku: string;
  category: ProductCategory;
  type: 'unit' | 'measurable' | 'service_cost';
  unit: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  cost: number;
  price: number;
  packageNote: string;
  imprecise: boolean;
  defaultUsage: number;
}

export interface InventoryTemplate {
  id: string;
  emoji: string;
  title: string;
  hint: string;
  formData: InventoryTemplateFormData;
}

export const inventoryTemplates: InventoryTemplate[] = [
  {
    id: 'tinte',
    emoji: '🎨',
    title: 'Tinte capilar',
    hint: 'Medido en gramos · ~30g por aplicación',
    formData: {
      name: '',
      sku: '',
      category: 'hair_dye',
      type: 'measurable',
      unit: 'g',
      currentStock: 0,
      minStock: 1,
      maxStock: 10,
      cost: 0,
      price: 0,
      packageNote: 'Tubo de 60g',
      imprecise: false,
      defaultUsage: 0,
    },
  },
  {
    id: 'peroxido',
    emoji: '🧪',
    title: 'Peróxido / Oxidante',
    hint: 'Medido en ml · viene en frascos grandes',
    formData: {
      name: '',
      sku: '',
      category: 'hair_dye',
      type: 'measurable',
      unit: 'ml',
      currentStock: 0,
      minStock: 250,
      maxStock: 2000,
      cost: 0,
      price: 0,
      packageNote: 'Frasco de 1L',
      imprecise: false,
      defaultUsage: 0,
    },
  },
  {
    id: 'shampoo',
    emoji: '🧴',
    title: 'Shampoo',
    hint: 'Medido en ml · uso interno',
    formData: {
      name: '',
      sku: '',
      category: 'shampoo',
      type: 'measurable',
      unit: 'ml',
      currentStock: 0,
      minStock: 200,
      maxStock: 2000,
      cost: 0,
      price: 0,
      packageNote: 'Frasco de 1L',
      imprecise: false,
      defaultUsage: 0,
    },
  },
  {
    id: 'tratamiento',
    emoji: '💆',
    title: 'Tratamiento / Mascarilla',
    hint: 'Medido en gramos o ml',
    formData: {
      name: '',
      sku: '',
      category: 'treatment',
      type: 'measurable',
      unit: 'g',
      currentStock: 0,
      minStock: 200,
      maxStock: 1500,
      cost: 0,
      price: 0,
      packageNote: 'Pote de 500g',
      imprecise: false,
      defaultUsage: 0,
    },
  },
  {
    id: 'shine',
    emoji: '✨',
    title: 'Shine / Líquido planchado',
    hint: 'Marcar uso · ~5ml por planchado',
    formData: {
      name: '',
      sku: '',
      category: 'hair_products',
      type: 'measurable',
      unit: 'ml',
      currentStock: 0,
      minStock: 50,
      maxStock: 500,
      cost: 0,
      price: 0,
      packageNote: 'Frasco de 200ml',
      imprecise: true,
      defaultUsage: 5,
    },
  },
  {
    id: 'cera_rostro',
    emoji: '💧',
    title: 'Cera rostro',
    hint: 'Sin stock fijo · costo por uso',
    formData: {
      name: '',
      sku: '',
      category: 'wax',
      type: 'service_cost',
      unit: '',
      currentStock: 0,
      minStock: 0,
      maxStock: 0,
      cost: 10,
      price: 0,
      packageNote: '',
      imprecise: true,
      defaultUsage: 1,
    },
  },
  {
    id: 'hojillas',
    emoji: '🪒',
    title: 'Hojillas',
    hint: 'Por unidades · admin las entrega al trabajador',
    formData: {
      name: '',
      sku: '',
      category: 'supplies',
      type: 'unit',
      unit: 'pieces',
      currentStock: 0,
      minStock: 10,
      maxStock: 100,
      cost: 0,
      price: 0,
      packageNote: 'Caja de 50',
      imprecise: false,
      defaultUsage: 0,
    },
  },
  {
    id: 'algodon',
    emoji: '☁️',
    title: 'Algodón',
    hint: 'Por unidades · uso interno',
    formData: {
      name: '',
      sku: '',
      category: 'supplies',
      type: 'unit',
      unit: 'pieces',
      currentStock: 0,
      minStock: 50,
      maxStock: 500,
      cost: 0,
      price: 0,
      packageNote: 'Bolsa',
      imprecise: false,
      defaultUsage: 0,
    },
  },
  {
    id: 'guantes',
    emoji: '🧤',
    title: 'Guantes',
    hint: 'Por unidades (en pares)',
    formData: {
      name: '',
      sku: '',
      category: 'supplies',
      type: 'unit',
      unit: 'pairs',
      currentStock: 0,
      minStock: 10,
      maxStock: 100,
      cost: 0,
      price: 0,
      packageNote: 'Caja de 100 pares',
      imprecise: false,
      defaultUsage: 0,
    },
  },
  {
    id: 'esmalte',
    emoji: '💅',
    title: 'Esmalte de uñas',
    hint: 'Frasco completo · contado por unidad',
    formData: {
      name: '',
      sku: '',
      category: 'nail_products',
      type: 'unit',
      unit: 'bottles',
      currentStock: 0,
      minStock: 2,
      maxStock: 20,
      cost: 0,
      price: 0,
      packageNote: 'Frasco de 15ml',
      imprecise: false,
      defaultUsage: 0,
    },
  },
];

// When admin picks a category, we suggest the most common type/unit pairing
// for that category. Used to auto-fill the form so they don't stare at the
// abstract "type" question for products that have an obvious answer.
export const categoryDefaults: Partial<Record<ProductCategory, Partial<InventoryTemplateFormData>>> = {
  hair_dye: { type: 'measurable', unit: 'g', minStock: 1, maxStock: 10 },
  shampoo: { type: 'measurable', unit: 'ml', minStock: 200, maxStock: 2000 },
  treatment: { type: 'measurable', unit: 'g', minStock: 200, maxStock: 1500 },
  hair_products: { type: 'measurable', unit: 'ml', minStock: 50, maxStock: 500 },
  skincare: { type: 'measurable', unit: 'ml', minStock: 50, maxStock: 500 },
  makeup: { type: 'unit', unit: 'pieces', minStock: 1, maxStock: 10 },
  wax: { type: 'service_cost', unit: '', minStock: 0, maxStock: 0 },
  nail_products: { type: 'unit', unit: 'bottles', minStock: 2, maxStock: 20 },
  tools: { type: 'unit', unit: 'pieces', minStock: 1, maxStock: 10 },
  accessories: { type: 'unit', unit: 'pieces', minStock: 5, maxStock: 50 },
  supplies: { type: 'unit', unit: 'pieces', minStock: 10, maxStock: 100 },
  other: { type: 'unit', unit: 'pieces', minStock: 1, maxStock: 10 },
};
