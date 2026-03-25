// Form and API request types
import { Client, Service, Staff, Session, Appointment, Product, Payment } from './models';

export interface CreateClientRequest {
  firstName: string;
  lastName: string;
  email: string;
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
  clientId: string;
  date: string;
  startTime: Date;
}

export interface AddServiceToSessionRequest {
  sessionId: string;
  serviceId: string;
  staffIds: string[];
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
}

export interface CreateAppointmentRequest {
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
