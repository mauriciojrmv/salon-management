// Salon entity
export interface Salon {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  currency: 'BOB' | 'USD' | 'EUR' | 'GBP' | 'INR' | 'BRL';
  timezone: string;
  whatsappNumber?: string; // Official salon WA Business number for client-facing messages
  logo?: string;
  createdAt: Date;
  updatedAt: Date;
  owner: string; // User ID
  isActive: boolean;
  settings: {
    businessHours: BusinessHours;
    taxRate: number; // percentage
    autoBackup: boolean;
  };
}

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export type BusinessHours = {
  [day in DayOfWeek]: DaySchedule;
}

export interface DaySchedule {
  isOpen: boolean;
  openTime: string; // HH:mm
  closeTime: string; // HH:mm
}

// User entity
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'staff' | 'client';
  salonId: string;
  phone: string;
  profileImage?: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

// Staff entity (extends User)
export interface Staff extends User {
  role: 'staff';
  skills: Skill[];
  commissionConfig: CommissionConfig;
  availability: StaffAvailability[];
  totalEarnings: number;
  bankDetails?: BankDetails;
}

export interface Skill {
  serviceId: string;
  proficiency: 'beginner' | 'intermediate' | 'expert';
  yearsOfExperience: number;
}

export interface CommissionConfig {
  type: 'percentage' | 'fixed';
  value: number; // percentage (0-100) or fixed amount
  services?: Record<string, number>; // service-specific overrides
}

export interface BankDetails {
  accountHolder: string;
  accountNumber: string;
  bankName: string;
  routingNumber?: string;
  swiftCode?: string;
}

export interface StaffAvailability {
  date: string; // YYYY-MM-DD
  dayOfWeek: DayOfWeek;
  isAvailable: boolean;
  slots?: TimeSlot[];
}

export interface TimeSlot {
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  isBooked: boolean;
}

// Client entity
export interface Client extends User {
  role: 'client';
  phone: string;
  email: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  notes?: string;
  totalSpent: number;
  lastVisit?: Date;
  totalSessions: number;
  creditBalance?: number; // Advance payment / saldo a favor
  loyaltyPoints?: number; // Points earned from services/purchases
  preferences?: ClientPreferences;
}

export interface ClientPreferences {
  favoriteServices: string[]; // Service IDs
  preferredStaff?: string[]; // Staff IDs
  allergies?: string[];
  skinType?: string;
  hairType?: string;
}

// Service entity
export interface Service {
  id: string;
  salonId: string;
  name: string;
  description: string;
  category: ServiceCategory;
  price: number;
  duration: number; // minutes
  image?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  materialsUsed?: MaterialUsage[]; // Default materials
}

export type ServiceCategory =
  | 'haircut'
  | 'coloring'
  | 'styling'
  | 'treatment'
  | 'nails'
  | 'waxing'
  | 'skincare'
  | 'makeup'
  | 'eyebrows'
  | 'eyelashes'
  | 'massage'
  | 'spa'
  | 'other';

export interface SessionRetailItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number; // sell price
  total: number;
}

export interface Session {
  id: string;
  salonId: string;
  clientId: string;
  date: string; // YYYY-MM-DD
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed' | 'cancelled';
  origin?: 'cola' | 'appointment' | 'walkin';
  waitingListEntryId?: string;
  services: SessionServiceItem[];
  retailItems?: SessionRetailItem[];
  notes?: string;
  totalAmount: number;
  tax: number;
  discount?: number;
  payments: Payment[];
  materialsUsed: MaterialUsage[];
  staffNotes?: Record<string, string>; // staff-specific notes
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionServiceItem {
  id: string;
  serviceId: string;
  serviceName: string;
  price: number;
  commissionRate: number; // Snapshot of commission % at time of service (e.g. 50)
  assignedStaff: string[]; // Staff IDs
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'in_progress' | 'paused' | 'completed';
  pausedAt?: Date;
  materialsUsed: MaterialUsage[];
  notes?: string;
}

// Appointment entity
export interface Appointment {
  id: string;
  salonId: string;
  clientId: string;
  serviceIds: string[];
  staffId: string;
  appointmentDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  status: 'pending' | 'confirmed' | 'no_show' | 'cancelled' | 'completed';
  notes?: string;
  reminderSent: boolean;
  reminderSentAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServicePreference {
  serviceId: string;
  preferredStaffId: string; // empty = any worker
  preferredStaffName: string;
}

// Waiting list entry — walk-in queue for busy days
export interface WaitingListEntry {
  id: string;
  salonId: string;
  clientId: string; // empty for walk-in
  walkInName: string; // fallback when no client record
  phone: string; // optional contact
  serviceIds: string[];
  serviceNames: string[]; // snapshot for display
  servicePreferences: ServicePreference[]; // per-service worker preference
  preferredStaffId: string; // legacy/global — empty = any worker
  preferredStaffName: string;
  arrivalTime: Date;
  date: string; // YYYY-MM-DD
  status: 'waiting' | 'taken' | 'cancelled' | 'skipped';
  notes: string;
  order: number; // for manual reorder, defaults to arrivalTime epoch ms
  createdBy: string;
  callAttempts?: number; // how many times we've tried to call this client
  lastCallAt?: Date;
  takenAt?: Date;
  takenSessionId?: string;
  cancelledAt?: Date;
  cancellationReason?: string;
}

// Inventory entities
export interface Product {
  id: string;
  salonId: string;
  name: string;
  sku: string;
  category: ProductCategory;
  type: 'measurable' | 'unit' | 'service_cost';
  // Measurable units (ml/g/l/kg) consume a fractional amount per use.
  // Countable units (pieces/tubes/pairs/bottles/sachets/kits) consume integer counts.
  unit?: 'ml' | 'g' | 'l' | 'kg' | 'pieces' | 'sachets' | 'bottles' | 'tubes' | 'pairs' | 'kits';
  currentStock: number;
  minStock: number;
  maxStock: number;
  supplier?: string;
  cost: number; // Cost per unit/amount
  price: number; // Selling price
  expiryDate?: string;
  image?: string;
  // Free-text presentation note shown on the material picker — useful for items
  // bought in bulk and repackaged into sachets/small bottles by the staff.
  // Example: "Frasco de 1kg, repartido en sobres de 50g".
  packageNote?: string;
  // "Use without measure" mode for items workers can't reasonably measure
  // (shine, sprays, gotas de vitaminas). When true, the material picker hides
  // the numeric quantity stepper and shows a single "Marcar uso" button that
  // deducts `defaultUsage` per tap. Admin recalibrates `defaultUsage` from the
  // gap between actual stock and total uses logged.
  imprecise?: boolean;
  defaultUsage?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductCategory =
  | 'hair_products'
  | 'hair_dye'
  | 'shampoo'
  | 'treatment'
  | 'skincare'
  | 'makeup'
  | 'wax'
  | 'nail_products'
  | 'tools'
  | 'accessories'
  | 'supplies'
  | 'other';

export interface MaterialUsage {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  cost: number; // Total buy cost (product.cost * quantity)
  usedAt: Date;
}

export interface ProductUsageHistory {
  id: string;
  salonId: string;
  productId: string;
  sessionId?: string;
  appointmentId?: string;
  quantity: number;
  unit: string;
  cost: number;
  usedAt: Date;
  usedBy: string; // Staff ID
}

// Out-of-session inventory withdrawal — items handed to staff (blades, cotton,
// etc.) that aren't tied to a specific service. Decrements stock and records
// who took it for accountability + cost tracking.
export interface InventoryWithdrawal {
  id: string;
  salonId: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  cost: number; // Total buy cost at withdrawal time (product.cost * quantity)
  takenBy?: string; // Staff ID receiving the item, optional
  takenByName?: string; // Snapshot of staff display name
  note?: string;
  createdBy: string; // User ID who logged the withdrawal
  createdAt: Date;
}

// Payment entity
export interface Payment {
  id: string;
  salonId: string;
  sessionId: string;
  amount: number;
  method: PaymentMethod;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  transactionId?: string;
  notes?: string;
  serviceIds?: string[]; // Which service items this payment covers (per-service payment)
  processedAt: Date;
  refundedAt?: Date;
  refundAmount?: number;
}

export type PaymentMethod = 'cash' | 'card' | 'qr_code' | 'transfer' | 'check' | 'credit';

// Loyalty Reward (redeemable with points)
export interface LoyaltyReward {
  id: string;
  salonId: string;
  name: string;
  description: string;
  pointsCost: number;
  type: 'discount' | 'free_service' | 'free_product' | 'credit';
  value: number; // discount %, free service price, product value, or credit amount
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Loyalty Transaction (points earned or redeemed)
export interface LoyaltyTransaction {
  id: string;
  salonId: string;
  clientId: string;
  type: 'earned' | 'redeemed';
  points: number;
  description: string;
  sessionId?: string;
  rewardId?: string;
  createdAt: Date;
}

// Retail Sale (direct product sale to client, no service)
export interface RetailSale {
  id: string;
  salonId: string;
  clientId?: string; // optional — walk-in sales
  items: RetailSaleItem[];
  totalAmount: number;
  payment: {
    method: PaymentMethod;
    amount: number;
    status: 'completed' | 'refunded';
  };
  notes?: string;
  soldBy: string; // staff/admin user ID
  createdAt: Date;
  updatedAt: Date;
}

export interface RetailSaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number; // selling price
  total: number;
}

// Expense tracking
export interface Expense {
  id: string;
  salonId: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  recurring: boolean;
  recurrenceType?: 'monthly' | 'weekly';
  paidTo?: string; // vendor/payee
  paymentMethod?: PaymentMethod;
  receipt?: string; // URL or reference
  createdBy: string; // user ID
  createdAt: Date;
  updatedAt: Date;
}

export type ExpenseCategory = 'rent' | 'utilities' | 'salaries' | 'supplies' | 'marketing' | 'maintenance' | 'insurance' | 'refreshments' | 'other';

// Staff Commission Report
export interface CommissionReport {
  id: string;
  salonId: string;
  staffId: string;
  month: string; // YYYY-MM
  totalEarnings: number;
  totalServices: number;
  breakdown: CommissionBreakdown[];
  isPaid: boolean;
  paidAt?: Date;
  paidAmount?: number;
}

export interface CommissionBreakdown {
  serviceId: string;
  serviceName: string;
  count: number;
  totalEarnings: number;
}

// Analytics / Dashboard
export interface DailyMetrics {
  salonId: string;
  date: string; // YYYY-MM-DD
  totalRevenue: number;
  totalTransactions: number;
  totalClients: number;
  totalSessions: number;
  averageTransactionValue: number;
  topServices: ServiceMetric[];
  topStaff: StaffMetric[];
}

export interface ServiceMetric {
  serviceId: string;
  serviceName: string;
  count: number;
  revenue: number;
  profitMargin: number;
}

export interface StaffMetric {
  staffId: string;
  staffName: string;
  sessionsCompleted: number;
  earnings: number;
  rating?: number;
}
