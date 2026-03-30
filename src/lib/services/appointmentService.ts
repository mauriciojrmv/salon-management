import { addDocument, updateDocument, getDocument, queryDocuments, firebaseConstraints, deleteDocument } from '@/lib/firebase/db';
import { Appointment } from '@/types/models';
import { CreateAppointmentRequest } from '@/types/api';

export class AppointmentService {
  static async createAppointment(data: CreateAppointmentRequest): Promise<string> {
    // Check for double-booking
    if (data.staffId) {
      const isAvailable = await this.checkStaffAvailability(
        data.staffId,
        data.appointmentDate,
        data.startTime,
        data.endTime
      );
      if (!isAvailable) {
        throw new Error('STAFF_DOUBLE_BOOKED');
      }
    }

    const appointmentId = await addDocument('appointments', {
      ...data,
      status: 'pending',
      reminderSent: false,
    });
    return appointmentId;
  }

  static async getAppointment(appointmentId: string): Promise<Appointment | null> {
    return await getDocument('appointments', appointmentId) as Appointment | null;
  }

  static async updateAppointmentStatus(appointmentId: string, status: Appointment['status']): Promise<void> {
    await updateDocument('appointments', appointmentId, { status });
  }

  static async cancelAppointment(appointmentId: string, reason: string): Promise<void> {
    await updateDocument('appointments', appointmentId, {
      status: 'cancelled',
      cancellationReason: reason,
    });
  }

  static async confirmAppointment(appointmentId: string): Promise<void> {
    await updateDocument('appointments', appointmentId, {
      status: 'confirmed',
    });
  }

  static async getClientAppointments(salonId: string, clientId: string): Promise<Appointment[]> {
    const results = await queryDocuments('appointments', [
      firebaseConstraints.where('salonId', '==', salonId),
      firebaseConstraints.where('clientId', '==', clientId),
    ]) as Appointment[];
    return results.sort((a, b) => {
      return new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime();
    });
  }

  static async getStaffAppointments(salonId: string, staffId: string, date: string): Promise<Appointment[]> {
    return await queryDocuments('appointments', [
      firebaseConstraints.where('salonId', '==', salonId),
      firebaseConstraints.where('staffId', '==', staffId),
      firebaseConstraints.where('appointmentDate', '==', date),
    ]) as Appointment[];
  }

  static async getSalonAppointments(salonId: string, date: string): Promise<Appointment[]> {
    return await queryDocuments('appointments', [
      firebaseConstraints.where('salonId', '==', salonId),
      firebaseConstraints.where('appointmentDate', '==', date),
    ]) as Appointment[];
  }

  static async getUpcomingAppointments(salonId: string, days = 7): Promise<Appointment[]> {
    const today = new Date().toISOString().split('T')[0];
    const future = new Date();
    future.setDate(future.getDate() + days);
    const futureDate = future.toISOString().split('T')[0];

    return await queryDocuments('appointments', [
      firebaseConstraints.where('salonId', '==', salonId),
      firebaseConstraints.where('status', '==', 'pending'),
    ]) as Appointment[];
  }

  static async checkStaffAvailability(
    staffId: string,
    date: string,
    startTime: string,
    endTime: string
  ): Promise<boolean> {
    const appointments = (await queryDocuments('appointments', [
      firebaseConstraints.where('staffId', '==', staffId),
      firebaseConstraints.where('appointmentDate', '==', date),
    ]) as Appointment[]).filter(apt => apt.status !== 'cancelled');

    return !appointments.some(apt => {
      const overlaps = !(endTime <= apt.startTime || startTime >= apt.endTime);
      return overlaps;
    });
  }
}
