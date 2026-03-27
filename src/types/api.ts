// Form and API request types
import { Client, Service, Staff, Session, Appointment, Product, Payment } from './models';

export interface CreateClientRequest {
  firstName: string;
  lastName?: string;
  email?: string;
  phone: string;
  dateOfBirth?: string;
  gender?: string;
  notes?: string;
}

export interface UpdateClientRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  notes?: string;
}

export interface CreateStaffRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  specialty?: string;
  skills: { serviceId: string; proficiency: 'beginner' | 'intermediate' | 'expert' }[];
  commissionType: 'percentage' | 'fixed';
  commissionValue: number;
}

export interface CreateServiceRequest {
  name: string;
  description: string;
  category: string;
  price: number;
  duration: number;
}

export interface CreateSessionRequest {
  salonId: string;
  clientId: string;
  date: string;
  startTime: Date;
}

export interface AddServiceToSessionRequest {
  sessionId: string;
  serviceId: string;
  serviceName: string;
  price: number;
  staffIds: string[];
  materials?: { productId: string; productName: string; quantity: number; unit: string; cost: number }[];
}

export interface RecordMaterialUsageRequest {
  sessionId: string;
  productId: string;
  quantity: number;
}

export interface ProcessPaymentRequest {
  sessionId: string;
  amount: number;
  method: string;
  serviceIds?: string[]; // Which service items this payment covers
}

export interface CreateAppointmentRequest {
  salonId: string;
  clientId: string;
  serviceIds: string[];
  staffId: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  notes?: string;
}

export interface CreateProductRequest {
  name: string;
  sku: string;
  category: string;
  type: 'measurable' | 'unit' | 'service_cost';
  unit?: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  cost: number;
  price: number;
  supplier?: string;
}

export interface CreateRetailSaleRequest {
  salonId: string;
  clientId?: string;
  items: { productId: string; productName: string; quantity: number; unitPrice: number; total: number }[];
  totalAmount: number;
  paymentMethod: string;
  soldBy: string;
  notes?: string;
}

export interface CreateExpenseRequest {
  salonId: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  recurring: boolean;
  recurrenceType?: string;
  paidTo?: string;
  paymentMethod?: string;
  createdBy: string;
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
