# Salon Pro - Project Guide

> Living document. Updated as the project evolves. This is the source of truth for architecture decisions, known issues, UX patterns, and development standards.
>
> **Workflow rule**: When fixing a bug or completing a task, mark it `[x]` in Section 8 (Issue Tracker) and/or Section 11 (Development Phases) with the date. When discovering new issues during development, add them to the appropriate priority level in Section 8. This keeps the guide accurate without a separate tracking tool.

---

## 1. Project Identity

**What**: SaaS web app for beauty salon management (appointments, sessions/trabajos, inventory, payments, staff commissions)
**Who uses it**: Salon owners, managers, and stylists — often non-technical, aged 30-65, currently tracking everything on paper or WhatsApp
**Core principle**: Must feel easier than pen and paper. If it takes more steps than writing it down, we failed.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router), React 19 |
| Language | TypeScript (strict, no `any`) |
| Auth + DB | Firebase (Auth, Firestore) — client SDK only |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Dates | date-fns |
| Hosting | Vercel |

---

## 3. Architecture

```
UI (pages/components)
  -> Hooks (useAuth, useAsync, useNotification)
    -> Services (sessionService, appointmentService, etc.)
    -> Repositories (clientRepository, serviceRepository, etc.)
      -> Firebase (db.ts generic CRUD)
```

- **Pages**: `src/app/(app)/[page]/page.tsx` — each is a client component
- **Components**: `src/components/` — reusable (Button, Input, Select, Card, Modal, Table, Alert, Layout, SearchableSelect, RoleGuard)
- **Repositories**: `src/lib/repositories/` — data access layer per entity (client, service, staff, product)
- **Services**: `src/lib/services/` — business logic (sessions, appointments, analytics, commissions, inventory)
- **Hooks**: `src/hooks/` — auth state, async data fetching, real-time subscriptions, notifications
- **Text**: `src/config/text.es.ts` — ALL Spanish UI strings centralized
- **Roles**: `src/lib/auth/roles.ts` — permission matrix per role

### Data Isolation
Every Firestore document has a `salonId` field. All queries MUST filter by salonId. This enables multi-tenant.

### Firestore Query Pattern
Compound queries with `where` + `orderBy` require composite indexes in Firebase Console. To avoid this, all repositories sort client-side after fetching. Do NOT add `orderBy` to Firestore queries.

---

## 4. Roles & Auth Flow

| Role | Created by | Can do |
|------|-----------|--------|
| **Admin** | Manually in Firebase Console (Auth + Firestore), or by another Admin via `/users` | Everything. Manage users, settings, all salons |
| **Manager** | Admin creates via `/users` page | Sessions, payments, appointments, clients, reports |
| **Staff** | Admin creates via `/users` page | View own sessions, log materials, see own earnings |
| **Client** | Added as record in `/clients` page | NOT a login account. Identified by phone number |

**Critical**: When admin creates users, we use a secondary Firebase app instance (`secondaryAuth`) so the admin session is NOT replaced. See `src/lib/firebase/config.ts`.

---

## 5. UX Design Principles

Learned from successful salon software (Fresha, GlossGenius, Booksy, Square Appointments):

### P1: Tap-First, Type-Last
Non-technical users hate typing. Every input that can be a tap (dropdown, button, list selection) MUST be a tap. Text inputs only for: names, notes, prices.

**Bad**: Text input "Enter client ID"
**Good**: Searchable dropdown showing client names, recent clients first

### P2: 3-Tap Rule
Every common action should complete in 3 taps or fewer:
- Book appointment: Select client -> Select service+staff -> Confirm
- Checkout: Tap checkout -> Tap payment method -> Done
- Add walk-in: Tap "Walk-in" -> Select service -> Assign staff

### P3: Progressive Disclosure
Show the minimum. Let users drill in for details. Don't overwhelm with all fields at once. Example: material entry only appears when user clicks "+ Agregar Material".

### P4: Smart Defaults
- New appointment defaults to today + next available slot
- Returning client pre-selects their usual service
- Checkout auto-calculates total from services
- Service price auto-fills but is editable per session

### P5: Forgiveness Over Prevention
Let users act quickly. Provide undo instead of "Are you sure?" dialogs for non-destructive actions. Only confirm for deletes.

### P6: Visual Status Communication
| Color | Meaning |
|-------|---------|
| Green | Completed, active, confirmed |
| Blue | In progress, info |
| Orange/Yellow | Pending, warning |
| Red | Cancelled, error, low stock |
| Gray | Inactive, available, empty |

### P7: Mobile-First Reality
- Large tap targets (min 44px, ideally 48px+)
- Primary actions in thumb zone (bottom of screen)
- Cards over tables on mobile
- Modals slide up from bottom on mobile, centered on desktop
- Salon workers often have wet/gloved hands

### P8: Names, Never IDs
Users must NEVER see database IDs. Always resolve to human-readable names. If a name lookup fails, show "Unknown" not the raw ID.

---

## 6. Spanish Language Rules

- ALL user-facing text goes through `src/config/text.es.ts`
- NO hardcoded Spanish strings in page files
- NO English strings in the UI (except brand name "Salon Pro")
- Code (variables, comments, git commits) stays in English
- When adding new features, add text keys FIRST, then reference them

**Known remaining hardcoded strings**:
- `inventory/page.tsx`: Category labels, type labels, unit labels in Select options
- `SearchableSelect.tsx`: "Sin resultados" placeholder
- `users/page.tsx`: "Acceso total" role description suffix

---

## 7. Session (Trabajo) Workflow

The core revenue flow. UI label is "Trabajos" (not "Sesiones").

### Flow
1. **Create Trabajo** — select client (SearchableSelect) or quick-create client
2. **Add Services** — select service (auto-fills price, editable) -> assign staff -> optionally add materials
3. **Materials** — progressive disclosure: pick product, enter quantity, cost auto-calculated. Stock auto-deducted from inventory
4. **Payment** — restaurant-style: big total, tap method (cash/card/QR/transfer), split between people/methods
5. **Close Trabajo** — marks as completed
6. **Cancel Trabajo** — for mistakes: voids session, restores stock, marks as cancelled (cannot be undone)

### Cancel / Void a Trabajo
Mistakes happen. Cancellation must:
- Set status to `cancelled` (NOT delete — we need audit trail)
- Restore deducted stock for all materials used
- Mark any payments as voided (money must be returned physically)
- Only Admin or Manager can cancel (staff cannot void their own work)
- Cancelled trabajos show in a separate section with strikethrough, not mixed with active/completed
- A reason field is required ("Error de captura", "Cliente canceló", etc.)

### Business Model (Revenue & Pricing)
- **Client pays**: service price + material selling price
- **Session totalAmount** = sum of service prices + sum of material selling prices
- Materials are sold to client at retail/selling price (`product.price`), NOT at cost (`product.cost`)
- Example: Corte $20 + Henna $60 + 2 units of henna product at $3/unit sell = $86 total

### Commission Model (Internal — NOT shown to client)
- Base: 50% of service price
- Material deduction: cost of materials used (at buy price, NOT sell price)
- Formula: `commission = (servicePrice * 0.5) - totalMaterialCost`
- Commission is an internal metric for staff payroll — NOT displayed on client-facing session summary
- Shown only in staff dashboard and reports

---

## 8. Issue Tracker & Technical Debt

> **Rule**: When fixing an issue, mark it `[x]` here with the date. When adding new issues found during development, append them to the appropriate priority section. This is the living tracker — keep it current.

### P0 — CRITICAL (affects money / data integrity)

- [x] **No way to cancel/void a Trabajo created by mistake** — Fixed 2026-03-27: `SessionService.cancelSession()` sets status `cancelled`, restores stock via batch, voids payments (marks as refunded), requires reason. Cancel button on SessionCard (admin/manager only). Cancel reason modal with confirmation. Cancelled sessions shown in separate gray section with strikethrough and reason displayed.
- [x] **No remove service from active Trabajo** — Fixed 2026-03-27: `SessionService.removeServiceFromSession()` removes service, restores stock for that service's materials, recalculates totalAmount. ✕ button per service on SessionCard (admin/manager only), with confirmation prompt.
- [x] **Reports don't show staff payroll (what to pay each person)** — Fixed 2026-03-27: `AnalyticsService.getStaffPayroll()` returns per-staff data with service-level detail. Reports page redesigned with: (1) PayrollCard per staff member showing revenue, material deduction, commission earned, and large "Total a Pagar" number; (2) expandable detail table with date, client, service, price, materials, commission per row; (3) summary cards: Total Revenue, Total Payroll, Total Materials, Salon Profit (revenue - materials - payroll). Old basic staff table replaced.
- [x] **`session.totalAmount` excludes material selling price** — Fixed 2026-03-26.
- [x] **Material cost shows buy price instead of sell price at runtime** — Fixed 2026-03-26.
- [x] **Commission rate inconsistency** — Fixed 2026-03-26.
- [x] **`recordMaterialUsage()` writes blank data** — Fixed 2026-03-26.
- [x] **Stock deduction not atomic** — Fixed 2026-03-26.
- [x] **Payments allowed on closed sessions** — Fixed 2026-03-26.

### P0.5 — CRITICAL UX (affects all users)

- [x] **Notifications never rendered (silent errors)** — Fixed 2026-03-26: `useNotification()` was used in every page but NO component rendered the notifications. All Firestore errors, validation failures, and success messages were silently swallowed. Created `Toast` component (`src/components/Toast.tsx`) and added `<Toast>` rendering to all 9 pages + auth. Errors are now visible as color-coded toast alerts (top-right, auto-dismiss).
- [x] **Sessions not syncing in real-time across users** — Fixed 2026-03-26: admin adds service/materials but staff doesn't see it reflected. Created `useRealtime` hook (`src/hooks/useRealtime.ts`) using Firestore `onSnapshot`. Applied to sessions page, my-work, and dashboard. All users now see instant updates without manual refresh. Prevents data inconsistencies from concurrent edits.
- [x] **Commission shown in add-service modal (client-facing confusion)** — Fixed 2026-03-26: removed commission preview from add-service summary. Now shows: Servicios + Materiales (additive with +$) = Total. Commission is internal-only, never shown in client-facing views.
- [x] **Payment modal hard to use for non-technical/elderly users** — Fixed 2026-03-26: redesigned to restaurant-style with large total display (4xl font), icon-based payment method buttons (💵💳📱🏦), centered amount inputs, big split button with person emoji, numbered split entries with inline payer name input.

### P1 — HIGH (incorrect behavior / data bugs)
- [x] **SessionCard summary labels wrong** — Fixed 2026-03-26: redesigned summary. Shows: "Servicios" (service subtotal) → "Materiales" (sell price total, additive) → "Total" (services + materials) → "Pagado"/"Restante". Commission removed from client-facing view (kept only in add-service modal for staff reference).
- [x] **Staff cannot create own Trabajo from `/my-work`** — Fixed 2026-03-26: added "Nuevo Trabajo" button to `/my-work` header. Staff can select client (SearchableSelect) or quick-create client, then create session. Large touch targets, mobile-first.
- [x] **User creation needs testing** — Verified 2026-03-27: code review confirms `secondaryAuth` pattern is correct. `createUserWithoutSignIn()` creates Firebase Auth account via secondary app instance (doesn't affect admin session), then creates Firestore user document with correct salonId. Signout from secondary app after creation is handled.
- [x] **Commission rate not stored per-session** — Fixed 2026-03-26: `commissionRate` field added to `SessionServiceItem`.
- [x] **`inventoryService.getUsageHistory()` ignores `days` param** — Fixed 2026-03-26: uses `where('usedAt', '>=', startDate)`.
- [x] **Date type inconsistency** — Fixed 2026-03-26: `toDate()` and `sortByCreatedAtDesc()` utilities.
- [x] **Analytics never resolves service/staff names** — Fixed 2026-03-26.
- [x] **`useAsync` infinite refetch risk** — Fixed 2026-03-26: fn stored in ref.
- [x] **Material price label ambiguous** — Fixed 2026-03-26: renamed to `pricePerUnit`/`totalPrice`.
- [x] **Staff availability not tracked** — Fixed 2026-03-26: busy badge in staff dropdown.

### P1.5 — HIGH (UX / feature gaps reported by user 2026-03-26)

- [x] **No timestamp on services in Trabajos** — ~~Services didn't show when performed~~. Fixed 2026-03-26: `SessionCard` now displays `startTime` next to each service name using `toDate()` with `es-ES` locale formatting.
- [x] **No client service history** — ~~Stylists couldn't see past services~~. Fixed 2026-03-26: `ClientHistoryModal` component shows all past sessions with services, materials (tint formulas), staff, and notes. Accessible via "Ver Historial" button on each active SessionCard.
- [x] **Phone required for all clients** — ~~Walk-ins and one-timers blocked by required phone~~. Fixed 2026-03-26: phone now optional in both clients page and quick-create flow. Phone uniqueness enforced when provided (throws `PHONE_EXISTS` with Spanish error message). Reservations can be made for people without phone.
- [x] **Service category selection not mobile-friendly** — ~~SearchableSelect with grouped headers not optimal for mobile~~. Fixed 2026-03-26: new `CategoryServicePicker` component. Two-step selection: category chips grid (2 columns, large touch targets) → service list within category. Back button to return. Replaces SearchableSelect for service selection in sessions page.
- [x] **Staff Dashboard (Trabajador view)** — Fixed 2026-03-26: new `/my-work` route. Shows: (1) "Mis Servicios Activos" — staff's assigned services with client name, time, materials, and quick "+ Material" button; (2) "Trabajos Disponibles" — unassigned services with one-tap "Tomar Trabajo" self-assign; (3) "Completados Hoy" — today's completed work summary. Includes client history modal access. Mobile-first layout with large touch targets, max-w-lg centered, minimal typing required.

### P2 — MEDIUM (UX gaps / payment system)

- [x] **Cash change calculator** — Fixed 2026-03-26: when payment method is "Efectivo", a yellow panel shows "Monto Recibido" input and calculates "Cambio" in large bold text.
- [x] **Split payment by method** — Fixed 2026-03-26: "+ Agregar Pago" button adds multiple payment entries to a single session. Each entry has its own amount and method (cash/card/QR/transfer). Summary shows all entries before confirming. All entries processed sequentially via `SessionService.processPayment()`.
- [x] **Split payment between people** — Fixed 2026-03-26: when multiple payment entries exist, each shows a "Nota (quién paga)" field for recording who is paying (e.g., "Papá", "amiga"). Displayed in payment summary.
- [x] **Per-service payment selection** — Fixed 2026-03-27: When a session has multiple services, the payment modal shows checkboxes to select which services to pay for. Toggling services recalculates the amount. `Payment.serviceIds` field tracks which services each payment covers. Works with split payments.
- [x] **Advance payment** — Fixed 2026-03-27: `Client.creditBalance` field tracks advance payments (saldo a favor). Clients page has "Agregar Saldo" button with modal to add credit. Payment modal shows green credit panel when client has balance, with one-tap "Usar Saldo" button that deducts from client credit and creates a payment with method `credit`. `ClientRepository.addCredit()` and `deductCredit()` manage the balance.
- [x] **`any` types reduced in core files** — Fixed 2026-03-26.
- [x] **No `SessionRepository`** — Fixed 2026-03-26.
- [x] **`sessions/page.tsx` is 700+ lines** — Fixed 2026-03-26: extracted `SessionCard`.
- [x] **Hardcoded Spanish on users page** — Fixed 2026-03-26.
- [x] **`useNotification` timeout leak** — Fixed 2026-03-26.
- [x] **`RoleGuard` flashes empty** — Fixed 2026-03-26.
- [x] **Permission matrix contradiction** — Fixed 2026-03-26.
- [x] **Hardcoded Spanish in inventory** — Fixed 2026-03-26.
- [x] **Hardcoded "Sin resultados"** — Fixed 2026-03-26.
- [x] **Material uses cost price not selling price** — Fixed 2026-03-26 (code fix, runtime issue in P0).
- [x] **Staff not filtered by service** — Fixed 2026-03-26.
- [x] **Service list not grouped** — Fixed 2026-03-26.
- [x] **SKU is required** — Fixed 2026-03-26.

### P2.5 — MEDIUM-HIGH (daily operations gaps)

- [x] **Sidebar doesn't collapse on mobile** — Fixed 2026-03-27: Replaced single sidebar with responsive layout. Mobile: fixed top bar with hamburger button + slide-in drawer (w-72) with overlay backdrop, auto-closes on route change. Desktop: collapsible sidebar (w-64/w-20). Content area uses `pt-14 md:pt-0` to account for mobile top bar.
- [x] **No "Reabrir Trabajo"** — Fixed 2026-03-27: `SessionService.reopenSession()` sets status back to `active` and clears `endTime`. "Reabrir Trabajo" button shown on completed sessions (admin/manager only) with confirmation prompt.
- [x] **No daily close / end-of-day summary** — Fixed 2026-03-27: "Cierre de Caja" section added to dashboard. Shows payment totals by method (Efectivo, Tarjeta, QR, Transferencia) in color-coded cards, total collected, and pending collection from active sessions. Uses real-time session data.
- [x] **Appointment → Trabajo conversion** — Fixed 2026-03-27: "Iniciar Trabajo" button on confirmed/pending appointments. Creates session pre-filled with client, adds each service with assigned staff, marks appointment as completed. One-tap conversion.
- [x] **No service status progression** — Fixed 2026-03-27: `SessionService.updateServiceStatus()` updates individual service status. SessionCard shows tappable status badges (Pendiente → En Progreso → Completado) with arrow indicator. Tap to advance to next status. Color-coded: yellow (pending), blue (in_progress), green (completed).

### P3 — LOW (future hardening)

- [x] **No confirmation dialogs for delete actions** — Verified 2026-03-27: All delete actions (clients, services, staff, inventory, cancel session, remove service) already have `window.confirm()` dialogs with Spanish messages.
- [x] **No date validation in `reports/page.tsx`** — Fixed 2026-03-27: Auto-swaps start/end dates if start > end. Shows orange warning message when dates are corrected. Reports use `validStartDate`/`validEndDate` computed from user input.
- [x] **No export/print for reports** — Fixed 2026-03-27: Added "Exportar CSV" button (downloads service profitability as CSV with headers) and "Imprimir" button (`window.print()`) to reports page header.
- [x] **No audit logging** — Fixed 2026-03-27: `auditLog()` function in SessionService logs structured `[AUDIT]` entries to console for: SESSION_CREATED, SERVICE_ADDED, PAYMENT_PROCESSED, SESSION_CLOSED, SESSION_CANCELLED, SERVICE_REMOVED, SESSION_REOPENED. Includes timestamp, IDs, amounts, and context.
- [x] **No appointment overlap/double-booking detection** — Fixed 2026-03-27: `AppointmentService.createAppointment()` now calls `checkStaffAvailability()` before creating. If staff has an overlapping appointment (time range intersection), throws `STAFF_DOUBLE_BOOKED` error shown as Spanish toast message.
- [x] **Unused model fields** — Verified 2026-03-27: `refundedAt`/`refundAmount` are used in `cancelSession()` when voiding payments. `reminderSent` is set on appointment creation — reserved for future reminder feature. No fields need removal.
- [ ] Payment receipt generation (printable/shareable summary for client)
- [ ] Session edit after close (allow adding forgotten materials/corrections)
- [ ] Client birthday reminders / loyalty tracking
- [ ] Frequent client detection (auto-suggest "usual service")
- [ ] Low-stock alert notification (not just badge — active alert when product runs out mid-day)

### RESOLVED

- [x] **2026-03-26** — Commission rate inconsistency: unified 50% vs 20% via `DEFAULT_COMMISSION_RATE` constant. Analytics now matches session page.
- [x] **2026-03-26** — Dead `recordMaterialUsage()` removed from sessionService. Was writing blank data, never called.
- [x] **2026-03-26** — Payment guards added: blocked payments on closed sessions, zero amounts, and overpayment.
- [x] **2026-03-26** — Division-by-zero guard added to `analyticsService.getServiceProfitability()`.
- [x] **2026-03-26** — Stock deduction now atomic via `batchUpdate()` using Firestore `writeBatch`.
- [x] **2026-03-26** — `useAsync` stabilized: fn stored in ref, deps default to `[]` instead of `[execute]`.
- [x] **2026-03-26** — Analytics resolves service/staff names. Material cost attribution fixed to use per-service data.
- [x] **2026-03-26** — `inventoryService.getUsageHistory()` now uses Firestore `where('usedAt', '>=')` date filter.
- [x] **2026-03-26** — Commission rate snapshotted per-session via `commissionRate` on `SessionServiceItem`.
- [x] **2026-03-26** — `useNotification` timeout leak fixed: timeouts tracked in ref, cleared on remove.
- [x] **2026-03-26** — `RoleGuard` shows spinner instead of null during auth load.
- [x] **2026-03-26** — Permission matrix: manager gets `canManageServices/Products: true`, removed hack.
- [x] **2026-03-26** — Inventory hardcoded Spanish moved to `text.es.ts` (categories, types, units).
- [x] **2026-03-26** — `SearchableSelect` uses `ES.app.noResults`, supports grouped options with sticky headers.
- [x] **2026-03-26** — Material deduction uses selling price (`product.price`) not cost price.
- [x] **2026-03-26** — Staff dropdown filtered by selected service's `serviceIds`.
- [x] **2026-03-26** — Services grouped by category in session add-service dropdown.
- [x] **2026-03-26** — SKU made optional in inventory form.
- [x] **2026-03-26** — `db.ts` data params typed as `Record<string, unknown>` (was `any`).
- [x] **2026-03-26** — Date type inconsistency: `toDate()` + `sortByCreatedAtDesc()` utilities replace all `instanceof Date` patterns across 6 files.
- [x] **2026-03-26** — `SessionRepository` created. `SessionService` now follows repository pattern like all other entities.
- [x] **2026-03-26** — `SessionCard` extracted to `src/components/SessionCard.tsx`. Sessions page reduced from 758 to ~625 lines.
- [x] **2026-03-26** — Users page hardcoded Spanish moved to `ES.users` keys (`accessDeniedUsers`, role descriptions).
- [x] **2026-03-26** — Material price labels clarified: renamed `costPerUnit` → `pricePerUnit`, dropdown shows "P. Venta: $X/unit", material row shows price breakdown per unit.
- [x] **2026-03-26** — Service timestamps added to `SessionCard`: each service shows its `startTime` in HH:MM format (es-ES locale).
- [x] **2026-03-26** — Client service history: `ClientHistoryModal` shows all past sessions with services, materials, staff, and notes. Accessible via "Ver Historial" button on active SessionCard.
- [x] **2026-03-26** — Phone made optional for clients (walk-ins, one-timers, reservations for others). Phone uniqueness enforced when provided.
- [x] **2026-03-26** — Client search works by name AND phone number (SearchableSelect already matches against `secondary` field).
- [x] **2026-03-26** — Staff availability: busy badge ("⏳ Ocupado/a") shown in staff dropdown, derived from active session assignments.
- [x] **2026-03-26** — `CategoryServicePicker` component replaces SearchableSelect for service selection. Two-step mobile-first picker: category chips → service list.
- [x] **2026-03-26** — Staff Dashboard `/my-work`: personal view with my active services, available/unassigned work (self-assign), completed today, quick material logging, client history access. Mobile-first, large touch targets.
- [x] **2026-03-26** — `session.totalAmount` now includes material sell prices: `servicePrices + materialSellPrices`. Fixed in `sessionService.ts` (addService, closeSession) and `my-work/page.tsx` (handleSaveMaterials).
- [x] **2026-03-26** — SessionCard summary redesigned: "Servicios" → "Materiales" (additive, sell price) → "Total" → "Pagado"/"Restante". Commission removed from client-facing view.
- [x] **2026-03-26** — Staff can create own Trabajo from `/my-work`: "Nuevo Trabajo" button with client selection + quick-create client modal.
- [x] **2026-03-26** — Payment modal redesigned: cash change calculator (yellow panel, "Monto Recibido" → "Cambio"), split payments by method ("+ Agregar Pago"), payer notes for split between people.
- [x] **2026-03-26** — `Toast` component created and wired into all 9 pages + auth. `useNotification()` was called everywhere but nothing rendered the notifications — all errors were silent. Now shows color-coded toasts with auto-dismiss.
- [x] **2026-03-26** — Real-time session sync via `useRealtime` hook (Firestore `onSnapshot`). Sessions page, my-work, and dashboard now auto-update across all users. `subscribeToQuery()` added to `db.ts`. Prevents data inconsistencies from concurrent admin/staff edits.
- [x] **2026-03-26** — Commission removed from add-service summary. Shows Servicios + Materiales (with + sign, additive) = Total. Commission is internal metric only.
- [x] **2026-03-26** — Payment modal redesigned restaurant-style: 4xl total, emoji icon method buttons, centered amount inputs, 👥 split button, numbered entries with inline payer names.

---

## 9. Common Pitfalls (Avoid Repeating)

### Firebase Auth Session Swap
**Problem**: `createUserWithEmailAndPassword()` automatically signs in as the new user, logging out the admin.
**Solution**: Always use `secondaryAuth` (from `config.ts`) when creating users on behalf of someone else. Never use the primary `auth` instance for user creation in the admin panel.

### Firestore Compound Query Indexes
**Problem**: Compound queries with `where` + `where` + `orderBy` need composite indexes created manually in Firebase Console. App silently fails.
**Solution**: All repositories removed `orderBy` from queries and sort client-side in JavaScript. Never add `orderBy` to multi-field queries.

### Firestore Rejects `undefined` Values
**Problem**: `setDoc()` / `addDocument()` throws if any field value is `undefined`.
**Solution**: Default all optional fields to `''` (empty string) or `0` before writing. Never pass raw optional form data without defaulting.

### TypeScript Build Failures
**Problem**: Build fails with type mismatches after adding new roles, categories, or union types.
**Solution**: When adding a new value to a union type (e.g., adding 'manager' to role), search ALL files that reference that type and update them. Use `npx next build` to verify before committing.

### `.next/trace` Lock File
**Problem**: Build fails with EPERM on `.next/trace` when dev server is running.
**Solution**: Stop `npm run dev` before running `npx next build`. If stuck, `rm -rf .next/cache` and retry.

### HMR Double Initialization
**Problem**: Hot module reload re-initializes Firebase app, causing "app already exists" error.
**Solution**: Guard with `getApps().find()` before `initializeApp()`. See `src/lib/firebase/config.ts`.

### Silent Notification Bug
**Problem**: `useNotification()` creates state but no component renders it. All errors silently swallowed.
**Solution**: Every page that uses `useNotification()` MUST render `<Toast notifications={notifications} onDismiss={removeNotification} />`. Destructure `notifications` and `removeNotification` alongside `success`/`error`.

### Multi-User Data Inconsistency
**Problem**: Admin adds service, staff doesn't see it. Or both edit the same session simultaneously = last write wins.
**Solution**: Use `useRealtime` (Firestore `onSnapshot`) for session data on pages where multiple users interact (sessions, my-work, dashboard). Reference data (clients, services, products, staff) is fine with `useAsync` since it changes rarely and by single users.

---

## 10. Component Patterns

### Creating a New Page
```tsx
'use client';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useRealtime } from '@/hooks/useRealtime'; // for multi-user data
import { useNotification } from '@/hooks/useNotification';
import { Toast } from '@/components/Toast';
import { firebaseConstraints } from '@/lib/firebase/db';
import ES from '@/config/text.es';

export default function PageName() {
  const { userData } = useAuth();
  const { notifications, removeNotification, success, error } = useNotification();

  // Real-time data (sessions, shared state — auto-syncs across users)
  const constraints = useMemo(() => [
    firebaseConstraints.where('salonId', '==', userData?.salonId || ''),
  ], [userData?.salonId]);
  const { data: liveItems } = useRealtime<Item>('collection', constraints, !!userData?.salonId);

  // One-shot data (reference data — clients, services, products)
  const { data, loading, refetch } = useAsync(async () => {
    if (!userData?.salonId) return [];
    return Repository.getItems(userData.salonId);
  }, [userData?.salonId]);

  return (
    <div>
      <Toast notifications={notifications} onDismiss={removeNotification} />
      {/* ... rest of page */}
    </div>
  );
}
```

### Form Pattern
- Always validate required fields before submit
- Use `setLoading(true)` during async operations
- Show `success()` or `error()` notifications
- Call `refetch()` after successful create/update/delete
- Reset form state after successful submit
- Default all optional fields to `''` to avoid Firestore undefined errors

### Repository Pattern
```tsx
export class EntityRepository {
  static async create(salonId: string, data: Partial<Entity>): Promise<string> {
    return addDocument('collection', { ...data, salonId });
  }
  static async getAll(salonId: string): Promise<Entity[]> {
    const results = await queryDocuments('collection', [
      firebaseConstraints.where('salonId', '==', salonId),
      // NO orderBy — sort client-side
    ]) as unknown as Entity[];
    return results.sort((a, b) => /* client-side sort */);
  }
}
```

---

## 11. Development Phases (History + Roadmap)

> **Rule**: This section is a LOG of completed work + a ROADMAP for future work. It does NOT duplicate Section 8. Completed phases are collapsed summaries. Future phases describe SCOPE and CONTEXT only — the actual task checklist lives in **Section 8** under the matching priority level.

### Phase 1 (DONE) - Foundation
Project scaffolding, types, Firebase config, UI component library, basic page structure, Vercel deployment.

### Phase 2 (DONE) - Firebase Integration
Repository pattern, full CRUD for all entities, Spanish UI config, role permissions, commission service, RoleGuard.

### Phase 3A (DONE) - Core Workflow
SearchableSelect, complete session workflow (create → services → staff → materials → payment → close), edit/delete for all entities, role-based routing, quick client creation, staff specialties, material tracking, editable prices, user management.

### Phase 3B (DONE) - UX Polish & Code Quality
Service grouping by category, staff filtering by service, selling price for materials, SKU optional, Spanish string cleanup, TypeScript cleanup, Firestore timestamp handling, SessionRepository, SessionCard extraction.

### Phase 3C (DONE) - Staff Experience & Client History
Staff dashboard (`/my-work`), self-assign to trabajo, quick material logging, client service history modal, staff availability tracking, service timestamps, CategoryServicePicker, phone optional for clients, staff can create own trabajo.

### Phase 3D (DONE) - Money Fixes & Payment System
Fixed `totalAmount` calculation, material sell price display, SessionCard summary redesign, cash change calculator, split payments (by method + between people), Toast notifications, real-time sync (`useRealtime`), commission removed from client views, restaurant-style payment modal.

### Phase 3E (DONE) - Cancel/Edit & Error Recovery
Cancel trabajo with stock restore + payment voiding + reason field. Remove service from active trabajo with stock restore. Cancel button and ✕ per-service (admin/manager only). Cancelled sessions shown in gray section with strikethrough.

### Phase 3F (DONE) - Staff Payroll Report
`AnalyticsService.getStaffPayroll()` with per-staff PayrollCard: revenue, materials, commission, expandable service-level detail table (date, client, service, price, materials, commission). Summary cards: Total Revenue, Total Payroll, Total Materials, Salon Profit.

### Phase 3G - Daily Close / Cierre de Caja
> **Scope**: End-of-day summary by payment method, cash reconciliation, optional day-close lock. See **Section 8 → P2.5** for task checklist.
> **Why**: Every salon counts cash at end of day. No way to see "how much cash should be in the drawer?"

### Phase 3H - Appointment ↔ Trabajo Integration
> **Scope**: One-tap "Iniciar Trabajo" from confirmed appointment, auto-status sync, no-show handling. See **Section 8 → P2.5** for task checklist.
> **Why**: Appointments and Trabajos are completely disconnected. Staff manually recreates trabajo info.

### Phase 4A - Mobile-First Polish
> **Scope**: Hamburger drawer, bottom action bar, swipe gestures, 48px touch targets, pull-to-refresh. See **Section 8 → P2.5** for task checklist.
> **Why**: Salon workers use phones with wet hands, standing up, between clients.

### Phase 4B - Production Hardening
> **Scope**: Offline support, push notifications, audit logging, data export, validation, confirmation dialogs. See **Section 8 → P3** for task checklist.

### Phase 5 - Growth Features
> **Scope**: Online booking widget, WhatsApp reminders, multi-location, loyalty program, retail product sales, expense tracking. See **Section 8 → P3** for task checklist.

---

## 12. File Reference

```
src/
  app/
    page.tsx               # Home redirect
    layout.tsx             # Root layout with metadata
    globals.css            # Global styles
    auth/page.tsx          # Login only (no registration)
    (app)/
      layout.tsx           # Sidebar nav, role-based visibility, RoleGuard
      dashboard/page.tsx   # KPI cards, today's trabajos table
      sessions/page.tsx    # Trabajo workflow (create, add services, materials, payment, close)
      appointments/page.tsx # Booking management + quick client creation
      clients/page.tsx     # Client records (phone-based), full CRUD
      services/page.tsx    # Service catalog CRUD, Spanish category labels
      staff/page.tsx       # Staff CRUD + specialty + multi-service assignment
      inventory/page.tsx   # Products, stock, low-stock alerts, full CRUD
      reports/page.tsx     # Analytics, profitability, staff performance
      users/page.tsx       # Admin-only user management (admin/manager/staff creation)
      my-work/page.tsx     # Staff dashboard (own services, self-assign, materials)
  components/
    index.ts               # Barrel exports
    Button.tsx, Input.tsx, Select.tsx, Card.tsx,
    Modal.tsx, Table.tsx, Alert.tsx, Layout.tsx,
    SearchableSelect.tsx, RoleGuard.tsx,
    SessionCard.tsx, ClientHistoryModal.tsx,
    CategoryServicePicker.tsx, Toast.tsx
  hooks/
    index.ts, useAuth.ts, useAsync.ts, useNotification.ts, useRealtime.ts
  lib/
    firebase/config.ts, auth.ts, db.ts
    repositories/clientRepository.ts, serviceRepository.ts,
                  staffRepository.ts, productRepository.ts,
                  sessionRepository.ts
    services/index.ts, sessionService.ts, appointmentService.ts,
             inventoryService.ts, analyticsService.ts,
             commissionService.ts
    auth/roles.ts
    utils/helpers.ts
  config/text.es.ts
  types/models.ts, api.ts
```

---

## 13. Testing Accounts

| Role | How to Create | Test With |
|------|--------------|-----------|
| Admin | Firebase Console: Auth + Firestore document, or via `/users` page by another admin | Full access, create other users |
| Manager | Admin creates via `/users` page | Sessions, payments, clients |
| Staff | Admin creates via `/users` page | Own sessions only, material logging |

---

*Last updated: 2026-03-27 | Phase 3E + 3F done (cancel/edit trabajo, staff payroll report). All P0 items resolved. Next: P1 user creation testing, P2.5 items (mobile sidebar, reopen trabajo, cierre de caja). See Section 8 for full issue tracker.*
