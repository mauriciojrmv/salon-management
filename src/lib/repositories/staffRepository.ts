import { addDocument, updateDocument, getDocument, queryDocuments, deleteDocument, firebaseConstraints } from '@/lib/firebase/db';
import { Staff } from '@/types/models';
import { CreateStaffRequest } from '@/types/api';

export class StaffRepository {
  static async createStaff(salonId: string, data: CreateStaffRequest): Promise<string> {
    if (!data.firstName || !data.email) {
      throw new Error('Missing required fields');
    }

    const staffId = await addDocument('users', {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      role: 'staff',
      salonId,
      skills: data.skills || [],
      commissionConfig: {
        type: data.commissionType || 'percentage',
        value: data.commissionValue || 0,
      },
      totalEarnings: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return staffId;
  }

  static async getStaff(staffId: string): Promise<Staff | null> {
    return await getDocument('users', staffId) as Staff | null;
  }

  static async updateStaff(staffId: string, data: Partial<Staff>): Promise<void> {
    await updateDocument('users', staffId, {
      ...data,
      updatedAt: new Date(),
    });
  }

  static async deleteStaff(staffId: string): Promise<void> {
    await updateDocument('users', staffId, {
      isActive: false,
      updatedAt: new Date(),
    });
  }

  static async getSalonStaff(salonId: string): Promise<Staff[]> {
    return await queryDocuments('users', [
      firebaseConstraints.where('salonId', '==', salonId),
      firebaseConstraints.where('role', '==', 'staff'),
      firebaseConstraints.where('isActive', '==', true),
      firebaseConstraints.orderBy('createdAt', 'desc'),
    ]) as Staff[];
  }

  static async getStaffBySkill(salonId: string, serviceId: string): Promise<Staff[]> {
    const staff = await this.getSalonStaff(salonId);
    return staff.filter((s) =>
      s.skills?.some((skill) => skill.serviceId === serviceId)
    );
  }

  static async updateStaffCommission(
    staffId: string,
    commissionType: 'percentage' | 'fixed',
    value: number
  ): Promise<void> {
    await updateDocument('users', staffId, {
      commissionConfig: {
        type: commissionType,
        value,
      },
      updatedAt: new Date(),
    });
  }

  static async addSkill(
    staffId: string,
    serviceId: string,
    proficiency: 'beginner' | 'intermediate' | 'expert'
  ): Promise<void> {
    const staff = await this.getStaff(staffId);
    if (!staff) throw new Error('Staff not found');

    const skills = staff.skills || [];
    const existingSkill = skills.find((s) => s.serviceId === serviceId);

    if (!existingSkill) {
      skills.push({
        serviceId,
        proficiency,
        yearsOfExperience: 0,
      });

      await updateDocument('users', staffId, {
        skills,
        updatedAt: new Date(),
      });
    }
  }
}
