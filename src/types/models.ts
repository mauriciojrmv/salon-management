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
  currency: 'USD' | 'EUR' | 'GBP' | 'INR' | 'BRL';
  timezone: string;
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

export interface BusinessHours {
  [day in DayOfWeek]: DaySchedule;
}

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

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
  role: 'admin' | 'staff' | 'client';
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

export type ServiceCategory = 'haircut' | 'coloring' | 'styling' | 'nails' | 'waxing' | 'skincare' | 'massage' | 'other';

// Session entity (visit)
export interface Session {
  id: string;
  salonId: string;
  clientId: string;
  date: string; // YYYY-MM-DD
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed' | 'cancelled';
  services: SessionService[];
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

export interface SessionService {
  id: string;
  serviceId: string;
  serviceName: string;
  price: number;
  assignedStaff: string[]; // Staff IDs
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'in_progress' | 'completed';
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

// Inventory entities
export interface Product {
  id: string;
  salonId: string;
  name: string;
  sku: string;
  category: ProductCategory;
  type: 'measurable' | 'unit' | 'service_cost';
  unit?: 'ml' | 'g' | 'l' | 'kg' | 'pieces' | 'sachets' | 'bottles';
  currentStock: number;
  minStock: number;
  maxStock: number;
  supplier?: string;
  cost: number; // Cost per unit/amount
  price: number; // Selling price
  expiryDate?: string;
  image?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductCategory = 'hair_products' | 'skincare' | 'wax' | 'nail_products' | 'tools' | 'supplies' | 'other';

export interface MaterialUsage {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  cost: number; // Total cost
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
  processedAt: Date;
  refundedAt?: Date;
  refundAmount?: number;
}

export type PaymentMethod = 'cash' | 'card' | 'qr_code' | 'transfer' | 'check';

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
