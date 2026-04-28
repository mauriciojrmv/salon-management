import { ProductCategory, Session } from '@/types/models';

// Spanish labels for product categories. Single source of truth so the same
// label appears in /inventory, the materials picker, and any reports. Keep in
// sync with the ProductCategory type in models.ts.
export const productCategoryLabels: Record<ProductCategory, string> = {
  hair_products: 'Productos Capilares',
  hair_dye: 'Tintes',
  shampoo: 'Shampoos / Acondicionadores',
  treatment: 'Tratamientos',
  skincare: 'Cuidado de Piel',
  makeup: 'Maquillaje',
  wax: 'Cera',
  nail_products: 'Productos de Uñas',
  tools: 'Herramientas',
  accessories: 'Accesorios',
  supplies: 'Suministros',
  other: 'Otro',
};

// Compute the most-recently-used product IDs across a list of sessions, with
// optional staff filter for privacy. Used to populate the "Recientes" pinned
// section in the material picker so workers tap once instead of typing.
//
// staffFilter: if provided, only counts materials from services where this
// staff member is the primary assigned worker. Workers see their own recencies;
// admin/gerente passes undefined to see salon-wide recencies.
export function computeRecentProductIds(
  sessions: Session[],
  options: { staffFilter?: string; limit?: number } = {},
): string[] {
  const { staffFilter, limit = 6 } = options;
  // Map productId → most recent timestamp seen
  const lastSeen = new Map<string, number>();
  for (const session of sessions) {
    if (session.status === 'cancelled') continue;
    const baseTs = session.startTime instanceof Date
      ? session.startTime.getTime()
      : new Date(session.startTime as unknown as string).getTime() || 0;
    for (const svc of session.services || []) {
      if (staffFilter) {
        const primary = svc.assignedStaff?.[0];
        if (primary !== staffFilter) continue;
      }
      for (const m of svc.materialsUsed || []) {
        const prev = lastSeen.get(m.productId) || 0;
        if (baseTs > prev) lastSeen.set(m.productId, baseTs);
      }
    }
  }
  return Array.from(lastSeen.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([productId]) => productId);
}
