// Firestore returns Timestamp objects, not Date. This safely converts any date-like value.
export function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate(); // Firestore Timestamp
  }
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return new Date();
}

// Sort helper for Firestore documents by createdAt (handles Date, Timestamp, or string)
export function sortByCreatedAtDesc<T extends { createdAt: unknown }>(a: T, b: T): number {
  return toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime();
}

// Returns today's date in YYYY-MM-DD format in Bolivia timezone (UTC-4)
// Critical: Bolivia is UTC-4; using ISO string would return the wrong date after 8PM local time
export function getBoliviaDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
}

// Date utilities
export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(date: Date | string): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

export function getDayOfWeek(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

// Currency utilities
export const CURRENCY_SYMBOL = 'Bs.';
export const LOYALTY_POINTS_RATE = 50; // 1 point per X currency units

export function formatCurrency(amount: number): string {
  return `Bs. ${amount.toFixed(2)}`;
}

// Short formatter for inline use in JSX templates
export function fmtBs(amount: number): string {
  return `Bs. ${amount.toFixed(2)}`;
}

// Validation utilities
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

// Time utilities
export function getTimeSlots(startTime: string, endTime: string, duration: number): string[] {
  const slots: string[] = [];
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  let currentTime = startHour * 60 + startMin;
  const endTimeTotal = endHour * 60 + endMin;

  while (currentTime + duration <= endTimeTotal) {
    const hour = Math.floor(currentTime / 60);
    const minute = currentTime % 60;
    slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
    currentTime += duration;
  }

  return slots;
}

export function calculateDuration(startTime: Date, endTime: Date): number {
  return Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
}

// Unit label map: translates stored English keys to Spanish display labels
const UNIT_LABEL_MAP: Record<string, string> = {
  pieces: 'Piezas',
  ml: 'ml',
  g: 'g',
  bottles: 'Botellas',
  sachets: 'Sobres',
};

export function unitLabel(unit: string | undefined): string {
  if (!unit) return 'un';
  return UNIT_LABEL_MAP[unit] || unit;
}

// Business constants
export const DEFAULT_COMMISSION_RATE = 50; // 50% default commission

// Calculation utilities
export function calculateCommission(amount: number, commissionType: string, commissionValue: number): number {
  if (commissionType === 'percentage') {
    return (amount * commissionValue) / 100;
  }
  return commissionValue;
}

export function calculateTax(amount: number, taxRate: number): number {
  return (amount * taxRate) / 100;
}

export function calculateProfit(revenue: number, cost: number): number {
  return revenue - cost;
}

export function calculateProfitMargin(revenue: number, cost: number): number {
  if (revenue === 0) return 0;
  return ((revenue - cost) / revenue) * 100;
}

// String utilities
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function toCamelCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase());
}

// Array utilities
export function groupBy<T>(arr: T[], key: keyof T): Map<any, T[]> {
  const map = new Map<any, T[]>();
  arr.forEach((item) => {
    const groupKey = item[key];
    if (!map.has(groupKey)) {
      map.set(groupKey, []);
    }
    map.get(groupKey)!.push(item);
  });
  return map;
}

export function sumBy<T>(arr: T[], key: keyof T): number {
  return arr.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
}

export function averageBy<T>(arr: T[], key: keyof T): number {
  if (arr.length === 0) return 0;
  return sumBy(arr, key) / arr.length;
}
