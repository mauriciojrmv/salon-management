// Staff skill helpers. `serviceIds` is an informal array on the Staff record
// set in /staff page (see staffRepository.createStaff). It's not in the typed
// Staff model, so we use a minimal structural type everywhere.

export type StaffWithSkills = { serviceIds?: string[] } | null | undefined;

// Backward-compat default: an empty serviceIds array means "admin hasn't
// configured skills yet" — treat as all-skilled so existing salons don't
// suddenly see empty screens. /my-work surfaces a banner to nudge admin to set it.
export function hasConfiguredSkills(staff: StaffWithSkills): boolean {
  return !!staff && (staff.serviceIds || []).length > 0;
}

export function canDoService(staff: StaffWithSkills, serviceId: string): boolean {
  if (!staff) return false;
  const ids = staff.serviceIds || [];
  if (ids.length === 0) return true;
  return ids.includes(serviceId);
}

export function canDoAny(staff: StaffWithSkills, serviceIds: string[]): boolean {
  if (!staff || serviceIds.length === 0) return false;
  const ids = staff.serviceIds || [];
  if (ids.length === 0) return true;
  return serviceIds.some((id) => ids.includes(id));
}
