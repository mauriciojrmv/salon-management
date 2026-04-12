# Salon Pro - Project Guide

> Living document. Updated as the project evolves. This is the source of truth for architecture decisions, known issues, UX patterns, and development standards.
>
> **Workflow rule**: When fixing a bug or completing a task, mark it `[x]` in Section 8 (Issue Tracker) and/or Section 11 (Development Phases) with the date. When discovering new issues during development, add them to the appropriate priority level in Section 8. This keeps the guide accurate without a separate tracking tool.
>
> **Push rule**: After completing a batch of working changes (build passes), commit and push to the GitHub repository. Do not accumulate large uncommitted diffs across sessions.

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
- Example: Corte Bs. 150 + Henna Bs. 200 + 2 units of henna product at Bs. 25/unit sell = Bs. 400 total

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

- [x] **Appointments page unusable — Firebase composite index missing** — Fixed 2026-03-30: `checkStaffAvailability()` used `where('status', '!=', 'cancelled')` in a compound query, requiring a composite index. Removed the inequality filter from Firestore and applied it client-side instead (follows project pattern: no `orderBy`/inequality in compound queries). Found 2026-03-30 manual testing (7.1).
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

### P1.6 — HIGH (UX audit — elderly/mobile usability, 2026-03-27) — DONE 2026-03-28

- [x] **Table component not mobile-responsive** — Fixed 2026-03-28: `Table.tsx` now renders stacked card layout on mobile (`md:hidden`) with label/value pairs, and original table on desktop (`hidden md:block`).
- [x] **SessionCard action buttons too small and clustered** — Fixed 2026-03-28: Primary actions (Agregar Servicio, Pagar) in 2-column grid, `size="md"`. Destructive actions (Cerrar, Cancelar) separated by border-top in own row. "Ver Historial" as ghost secondary. All now `flex-1` full width.
- [x] **`window.confirm()` shows English buttons on mobile** — Fixed 2026-03-28: All 9 remaining `confirm()`/`window.confirm()` calls replaced with custom `Modal`-based confirmations across clients, expenses, inventory, staff, services, salons, rewards, sessions pages. Zero `confirm()` calls remain. SessionCard also updated.
- [x] **Payment modal too complex for simple payments** — Fixed 2026-03-28: "Opciones avanzadas" toggle (default hidden) wraps per-service selection and split payment button. Default view: big total → method buttons → cash calculator → confirm. Credit balance panel always visible when applicable.
- [x] **Number inputs don't auto-select on focus** — Fixed 2026-03-28: `Input.tsx` now calls `e.target.select()` on focus for `number` and `text` types, forwarding any existing `onFocus` prop.
- [x] **SearchableSelect dropdown too short on mobile** — Fixed 2026-03-28: Outer dropdown `max-h-[60vh]`, inner list `max-h-[50vh]`. Trigger button and option rows increased to `py-3.5` for fat-finger targets.
- [x] **Modal close button `×` too small** — Fixed 2026-03-28: Close button now has `p-2 min-w-[44px] min-h-[44px]` with rounded hover state, meeting 44px touch target minimum.
- [x] **No loading feedback on card-level action buttons** — Fixed 2026-03-30: Added `loading` prop to `SessionCard`. Sessions page passes its shared `loading` state to each card, so Agregar Servicio, Procesar Pago, Cerrar Trabajo, and Anular all show a spinner and disable during any async operation.
- [x] **Auth page has hardcoded English/Spanish text** — Fixed 2026-03-28: `"Salon Management SaaS"` → `ES.app.tagline`, hardcoded contact text → `ES.app.contactAdmin`.
- [x] **Toast notifications positioned top-right — invisible on mobile** — Fixed 2026-03-28: Toast now uses `bottom-center` on mobile (`fixed bottom-4 left-1/2 -translate-x-1/2`) and falls back to `top-right` on `sm:` and above.
- [x] **Empty states too minimal — no call to action** — Fixed 2026-03-28: Sessions page active empty state now shows `noActiveSessions` + `noActiveSessionsCta` ("Toque + Nuevo Trabajo para comenzar") in larger centered block.
- [x] **No "Hoy"/"Ayer" quick buttons on dashboard date picker** — Fixed 2026-03-28: "Hoy" (blue) and "Ayer" (gray) shortcut buttons added left of date input on dashboard.
- [x] **Sidebar uses emoji icons — inconsistent rendering across devices** — Fixed 2026-03-28: All 14 nav item emojis replaced with Lucide React icon components (`LayoutDashboard`, `Scissors`, `Calendar`, `Users`, etc.).
- [x] **"Nuevo Trabajo" button not reachable after scrolling** — Fixed 2026-03-30: Added a fixed FAB (floating action button) at `bottom-6 right-6` on mobile only (`md:hidden`). 56×56px blue circle with `+`, `z-40`, shadow. Opens the create modal. Desktop header button unchanged.
- [x] **No visual separation between service statuses in SessionCard** — Fixed 2026-03-28: Each service row now has `border-l-4` left-border color: yellow (pending), blue (in_progress), green (completed).

### P1.7 — HIGH (manual testing bugs, 2026-03-30) — DONE 2026-03-30

- [x] **Login error shown in raw Firebase format** — Fixed 2026-03-30: `auth/page.tsx` now catches Firebase error codes (`auth/invalid-credential`, `auth/wrong-password`, `auth/user-not-found`, `auth/invalid-email`) and maps them to `ES.auth.invalidCredentials` = "Email o contraseña incorrectos. Intente de nuevo." Added `invalidCredentials` key to `text.es.ts`.
- [x] **No search bar on /clients page** — Fixed 2026-03-30: Added `searchQuery` state + `filteredClients` via `useMemo` filtering by firstName, lastName, phone. Search input rendered in the CardHeader alongside the title, full-width on all screen sizes.
- [x] **"Canjear recompensa" button not discoverable on /clients page** — Fixed 2026-03-30: Root cause was `Table.tsx` using `overflow-hidden` which clipped the actions column on desktop, making all action buttons (Edit, Ver Historial, Add Credit, Puntos/Canjear, Delete) invisible. Changed to `overflow-x-auto`. Also renamed "Puntos" button to "Puntos / Canjear" (`ES.clients.redeemPoints`) so it's clear it opens the redemption modal. The redemption logic in `executeRedeemReward()` was already correct.
- [x] **Client history ("Ver Historial") not on clients page** — Fixed 2026-03-30: Added `ClientHistoryModal` to `/clients` page. Added `historyClient` state, loaded staff list via `StaffRepository` for name resolution, added "Ver Historial" button to the actions column. History shows all past sessions with services, materials, staff names.
- [x] **Loyalty points not deducted when redeeming reward** — Fixed 2026-03-30: Code in `executeRedeemReward()` was correct (deducted via `ClientRepository.updateClient`). Root issue was that the "Puntos" button was not found by users due to the `overflow-hidden` table clipping. Now fixed by renaming button and fixing table overflow.
- [x] **Salon switcher not visible in sidebar** — Fixed 2026-03-30: Condition changed from `(salons).length > 1` to `>= 1` in `layout.tsx`. Sidebar salon dropdown now appears for admin even with a single salon, confirming which salon they're currently viewing and ready to switch when more salons are added.

### P2.7 — MEDIUM (UX gaps from manual testing, 2026-03-30)

- [x] **"Ayer" button does not highlight when selected** — Fixed 2026-03-30: Dashboard computes `today` and `yesterday` ISO strings, both Hoy and Ayer buttons now use conditional Tailwind classes: active state = `bg-blue-600 text-white border-blue-600`, inactive = original muted style. Both buttons highlight correctly when selected.
- [x] **Stock alert shows product units in English** — Fixed 2026-03-30: Added `unitLabel(unit)` helper to `helpers.ts` with a map of English keys → Spanish labels (`pieces→Piezas`, `bottles→Botellas`, `sachets→Sobres`, `ml→ml`, `g→g`). Applied to dashboard low-stock alert, inventory page stock column and banner, sessions page material dropdown label.
- [x] **SearchableSelect dropdown cut off by modal margins** — Fixed 2026-03-30: Dropdown now uses `position: fixed` with coordinates computed from `getBoundingClientRect()` via `computeDropdownStyle()`. Detects available space above/below trigger and opens upward when needed. `z-index: 9999` ensures it renders above modal overlay. Dropdown is no longer constrained by parent `overflow` context.
- [x] **Phone keyboard hides modal buttons** — Fixed 2026-03-30: `Modal.tsx` restructured to `flex flex-col` layout. Header uses `flex-shrink-0` (always visible). Content area uses `overflow-y-auto flex-1` so buttons are always reachable by scrolling. Container uses `max-h-[90vh]` (class, for fallback) + `style={{ maxHeight: '90dvh' }}` (inline, dynamic viewport height accounts for keyboard on iOS/Android).
- [x] **Edit client / loyalty points / add-balance actions missing on web** — Fixed 2026-03-30 (same fix as P1.7 #3): Root cause was `Table.tsx overflow-hidden` clipping the actions column on desktop. Changed to `overflow-x-auto` so all columns are always visible.
- [x] **Deleting a client with sessions history should be blocked** — Fixed 2026-03-30: `handleDelete` in clients page now calls `SessionRepository.getUserSessions()` before deleting. If any sessions found, shows `ES.clients.deleteBlockedHasSessions` error and aborts. Added text key (6.8).
- [x] **Toast notification hidden behind open modal** — Fixed 2026-03-30: Toast `z-index` raised from `z-50` to `z-[9998]`. Modal overlay uses `z-50`, dropdown uses `z-9999`. Toast now always appears above modals (6.6).
- [x] **No way to confirm staff payroll payment** — Fixed 2026-03-30: Added "Registrar Pago" button to each `PayrollCard`. Clicking it opens a confirmation modal showing staff name and amount. On confirm, creates an expense record with category `salaries`, description "Pago de nómina: {staffName} ({period})", amount = totalCommission. Toast confirms success. Record appears in `/expenses` under Sueldos category (11.3).
- [x] **Print report only takes a screenshot** — Fixed 2026-03-30: Added `@media print` CSS to reports page: hides `aside` (sidebar), hides `.no-print` elements. Applied `no-print` class to date filter card and the Export/Print buttons. `main` padding reset for clean layout. Printed output shows only the report data (11.6).
- [x] **Retail sale missing cash change calculator** — Fixed 2026-03-30: Added `cashReceived` state to sales page. When `paymentMethod === 'cash'`, a yellow panel appears with "Monto Recibido" input and displays calculated change in large bold text (green if correct, red if underpaid). Same UX as sessions payment modal (12.1).
- [x] **No retail sales report or summary** — Fixed 2026-03-30: Dashboard now loads `RetailSaleRepository.getSalonDailySales()` for the selected date. Two new metric cards added to KPI grid: "Ventas Retail" (count) and "Total Retail" (Bs.). Grid changed to 6-column on xl screens (12.3).
- [x] **Expense edit/delete buttons use inconsistent UX style** — Fixed 2026-03-30: Changed from `variant="ghost"` to `variant="secondary"` (Edit) and `variant="danger"` (Delete) to match clients/staff/services/inventory pages (13.3).
- [x] **Appointment form has no date field** — Fixed 2026-03-30: Added `<Input type="date">` field at the top of the appointment creation modal, bound to `selectedDate` state. User now explicitly sets the date inside the form instead of relying on the external filter (7.1).

### P3.7 — Future Improvements (from manual testing Sección C, 2026-03-30)

- [x] **Staff dashboard shows only individual worker data** — Fixed 2026-03-30: `/my-work` already filtered all data by `staffId`. No global metrics were shown. Confirmed correct (Sección C #1).
- [x] **New "Mis Ganancias" page for personal** — Fixed 2026-03-30: Created `/my-earnings` page showing per-service commission breakdown for today (price − material cost × commissionRate%), total services completed, and total commission. Staff-only route. Added to nav (Sección C #2).
- [x] **New "Mis Reservas" page for personal** — Fixed 2026-03-30: Created `/my-appointments` page showing today's appointments for the logged-in staff member via `AppointmentService.getStaffAppointments()`. Sorted by start time, cancelled ones hidden. Staff-only route. Added to nav (Sección C #3).
- [x] **Clarify "Mis Trabajos" nav item for Admin/Gerente** — Fixed 2026-03-30: `/my-work`, `/my-earnings`, and `/my-appointments` are now staff-only routes in `roles.ts` (`(r) => r === 'staff'`). Nav items auto-hide for admin/manager via `canAccessRoute()` (Sección C #4).
- [x] **Staff can change service status from their own view** — Fixed 2026-03-30: Added "Iniciar" / "Completar" primary button on each active service card in `/my-work`. Advances `pending → in_progress → completed`, sets `endTime` on completion. Status badge updates in real-time (4.18).
- [x] **Quick walk-in session without selecting a client** — Fixed 2026-03-30: "Sin Cliente (Eventual)" added as the first option in the client selector in both `/my-work` create modal. Resolves to `clientId: ''` on session creation (4.2 note).
- [x] **Completed sessions should sort newest-first** — Fixed 2026-03-30: `completedSessions` in `/sessions` now sorted by `endTime` descending (falls back to `startTime` if no endTime). `toDate()` helper added to imports (4.28).
- [x] **Auto-share receipt via WhatsApp** — Fixed 2026-03-30: `ReceiptModal` accepts `clientPhone` prop. When present, a "WhatsApp" button appears that opens `wa.me/{phone}?text={encoded receipt}`. Sessions page passes `clients?.find(c => c.id === session.clientId)?.phone`. Button hidden when client has no phone (4.30 note).
- [x] **Nuevo Trabajo from Mis Trabajos pre-selects service and assigns to creator** — Fixed 2026-03-30: Create trabajo modal in `/my-work` now has an optional service selector. If selected, `SessionService.addServiceToSession()` is called immediately after session creation with `staffIds: [staffId]`, auto-assigning to the creator (5.5 note).
- [x] **Materials: support partial product usage (fractions)** — Fixed 2026-03-30: Material quantity inputs in `/sessions` and `/my-work` now have `step="0.01" min="0"`. `parseFloat` was already used for parsing — the HTML input constraint was the only missing piece (8.2 note).
- [x] **Dashboard: add materials used metrics** — Fixed 2026-03-30: Added "Materiales Usados" KPI card to dashboard showing total sell cost of materials consumed in services for the selected day. Computed from `session.materialsUsed` across all sessions. Grid expanded to 7 columns on xl (3.1 note).

### P4 — Code Review Findings (2026-03-30) — Future Work

Identified during engineering + UX + product + end-user review. Target audience: salon staff aged 35–70, non-technical.

#### P4-DONE (2026-03-30)

- [x] **Staff dashboard shows global sessions/metrics** — Fixed 2026-03-30: When `role === 'staff'`, dashboard filters sessions to only those containing services assigned to that staff UID. KPI cards replaced with staff-specific: "Servicios Completados", "Mi Comisión", "Ingresos Generados". Admin-only sections (Top Servicios, Top Personal) hidden for staff. `staffSessions` + `staffKPIs` useMemo added, computed from `session.services[].assignedStaff`.
- [x] **Mis Ganancias has no date selector** — Fixed 2026-03-30: Added Hoy/Ayer shortcut buttons + date input to `/my-earnings`. `selectedDate` useState replaces hardcoded `today`. `useRealtime` constraints keyed to `selectedDate` so data re-fetches reactively on date change.
- [x] **Mis Reservas has no date selector** — Fixed 2026-03-30: Same Hoy/Ayer + date picker pattern added to `/my-appointments`. `useAsync` deps include `selectedDate`, so `AppointmentService.getStaffAppointments()` re-queries on date change.
- [x] **Dashboard "Trabajos de Hoy" table missing staff names per service** — Fixed 2026-03-30: Added "Servicios" column to `sessionColumns` table rendering each service name with assigned staff names (`staffName — StaffName`). Added `StaffRepository` import + `staffList` useAsync + `getStaffName` helper to dashboard.
- [x] **Sessions page completed section missing staff names per service** — Fixed 2026-03-30: In completed sessions card, each service row now shows assigned staff names as a secondary line below the service name using existing `getStaffName()`.

---

### P5 — Manual Testing Round 2 Findings (2026-03-30)

Found during real-user testing with salon staff aged 35–70 across Admin, Gerente, and Personal roles.

#### P5-CRITICAL — Business Logic Errors

- [x] **Materials should NOT be charged to the client** — Fixed 2026-03-30: `totalAmount = servicePrices` only in `sessionService.ts` (`addServiceToSession`, `closeSession`, `removeServiceFromSession`). `SessionCard` summary now shows only total (no materials row). `ReceiptModal` removed materials section entirely. `buildReceiptText()` for WhatsApp also cleaned up. Materials still stored in `session.materialsUsed` for stock deduction and commission calculation — they're just not added to client bill. Also: `closeSession()` now updates `client.totalSpent`, `totalSessions`, and `lastVisit` which were never being updated.
- [x] **"Sin Cliente (Eventual)" missing in Admin/Gerente sessions page** — Fixed 2026-03-30: Walk-in sentinel `{ value: '__walkin__', label: ES.staff.walkInClient }` added as first option in sessions page client dropdown. `handleCreateSession` resolves `__walkin__` to `clientId: ''` before API call. (4.5, 4.6)

#### P5-HIGH — Confirmed Bugs

- [x] **Mis Ganancias/Reservas date selector broken for past dates (timezone)** — Fixed 2026-03-30: Added `getBoliviaDate()` utility to `helpers.ts` using `toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' })`. Applied everywhere `today` was computed with `toISOString().split('T')[0]`: sessions/page.tsx, dashboard/page.tsx, my-earnings/page.tsx, my-appointments/page.tsx, appointments/page.tsx, sessionService.createSession(). Yesterday dates also use La Paz timezone. (5B.4, 5B.5, 5C.4, 5C.5)
- [x] **Client duplicate phone validation not working** — Fixed 2026-03-30: Added client-side phone uniqueness check in clients/page.tsx `handleSubmit()` against already-loaded `clients` array before calling `ClientRepository.createClient()`. This catches duplicates even if Firestore composite index is missing. Excludes the editing client itself to allow saving without phone change. (6.6)
- [x] **No "Cancelar cita" button in appointments page** — Fixed 2026-03-30: Added `handleCancelAppointment()` calling `AppointmentService.updateAppointmentStatus(id, 'cancelled')`. Cancel button appears on `pending` and `confirmed` appointments. Confirmation modal asks user to confirm. Added `cancelTitle`, `cancelFailed`, `confirmCancel` to `text.es.ts`. (7.6)
- [x] **Multi-location selector not switching data** — Fixed 2026-04-01: `useAuth` hook now uses `onSnapshot` real-time listener on the user document instead of one-shot fetch. When admin switches salon, `userData.salonId` updates instantly without page reload. All pages with `[userData?.salonId]` dependency auto-refetch. Removed `window.location.reload()` from `handleSwitchSalon` in layout.tsx. (16.3)
- [x] **Anular trabajo from previous day fails silently** — Fixed 2026-04-01: Added Hoy/Ayer date selector + date input to sessions page. Sessions query now uses `selectedDate` instead of hardcoded `today`. Admin can browse any date and cancel sessions from previous days. (4.39, 4.40)
- [x] **Anular should be admin-only, not gerente** — Fixed 2026-03-30: `canCancel = userRole === 'admin'` in sessions/page.tsx. Managers can still add/remove services but cannot void sessions. (4.39)
- [x] **Cash change color not red when amount < total** — Fixed 2026-03-30: Change calculator now shows deficit when `amountGiven < amount`. Negative change shows "Falta" label in red (`text-red-600`). Positive change shows "Cambio" in yellow. Zero shows gray. (4.22)

#### P5-HIGH — UX Blocking Issues

- [x] **Split payment UX: doubled totals confuse users** — Fixed 2026-03-30: When "+ Agregar Pago" is pressed, remaining amount is auto-split equally among all entries. Math: `perPerson = floor(remaining/n * 100) / 100`, last entry gets the remainder to avoid rounding errors. Users no longer need to manually adjust amounts. (4.27)
- [x] **Client search broken in my-work "Nuevo Trabajo" modal** — Fixed 2026-04-01: Added `onMouseDown={(e) => e.stopPropagation()}` on the SearchableSelect fixed dropdown to prevent Modal overlay's `onClick={onClose}` from capturing clicks on the dropdown. (5.9)
- [x] **Saldo payment at full amount blocks payment modal** — Fixed 2026-03-30: After applying credit, if `remaining <= 0`, payment modal auto-closes and success toast fires. No longer stuck at Bs. 0.00 with disabled confirm button. (6.13)
- [x] **Gastos edit/delete should be admin-only** — Fixed 2026-03-30: `isAdmin = userData?.role === 'admin'` check in expenses/page.tsx. Edit and Delete buttons only render when `isAdmin`. (13.3, 13.4, 13.5)
- [x] **Loyalty reward redemption only from /clients page** — Fixed 2026-04-02: Payment modal now shows client's loyalty points balance with note to redeem from Clients page. Rewards add credit to client balance, which is automatically shown and applicable in the payment modal.

#### P5-MEDIUM — UX Improvements

- [x] **Date range selector for Dashboard, Gastos, Citas** — Fixed 2026-04-01: Gastos page now has start/end date inputs with presets (Hoy, Este Mes, Últimos 7 días) replacing the month-only filter. Dashboard and Citas already had date selectors. Sessions page also got Hoy/Ayer + date input. (3.5, 13.6, 7.7)
- [x] **Staff dashboard: hide "Cierre de Caja" section + fix KPI label** — Fixed 2026-04-01: Wrapped Cierre de Caja with `{!isStaff && ...}` in dashboard. Renamed staff revenue KPI from `totalRevenue` to `myRevenueToday` ("Mis Ingresos del Día"). (3B.1, 3B.2)
- [x] **Service without staff should appear in "Trabajos Disponibles"** — Already working: my-work/page.tsx line 188 checks `!svc.assignedStaff || svc.assignedStaff.length === 0`. Sessions page sends `staffIds: []` when no staff selected (line 276). (4.15)
- [x] **No way to add/edit materials after service is already saved** — Fixed 2026-04-01: Added `onEditMaterials` callback on SessionCard. "+ Mat." button appears on each service in active sessions. Opens edit material modal with existing materials pre-loaded. Stock is restored for old materials and deducted for new ones. (4.18)
- [x] **Decimal input uses comma, not period; elderly users struggle** — Fixed 2026-04-01: `Input.tsx` now intercepts `onBeforeInput` for number inputs. When comma is typed, it's normalized to period by preventing default and programmatically inserting `.`. Works on Android keyboards that send `,` as decimal separator. (5.7)
- [x] **Material modal buttons covered by keyboard on mobile** — Fixed 2026-04-01: Added `pb-16 sm:pb-0` to material modal content in both my-work and sessions page. Extra bottom padding on mobile ensures buttons remain scrollable when virtual keyboard is open. (5.8)
- [x] **Service selector in my-work shows all services, not staff's specialties** — Fixed 2026-04-01: Service dropdown in my-work "Nuevo Trabajo" modal now filters by the current staff member's `serviceIds` array. If staff has no serviceIds set, all services are shown (backwards compatible). (5.11)
- [x] **Mis Reservas: cita card missing service name + no worker confirm button** — Fixed 2026-04-01: Service names resolved from `appointment.serviceIds` via `ServiceRepository`. Displayed in blue below the time. "Confirmar" button on pending appointments calls `updateAppointmentStatus(id, 'confirmed')`. (5C.3)
- [x] **Client "Total Gastado" shows 0 instead of actual spend** — Fixed 2026-03-30: `closeSession()` in sessionService now updates `client.totalSpent += totalAmount`, `client.totalSessions += 1`, and `client.lastVisit`. Display in clients page was already correct (`fmtBs(v || 0)`). (6.8)
- [x] **Planilla payment not marked as paid after registering** — Fixed 2026-04-01: PayrollCard now accepts `isPaid` prop. After `handleRegisterPayment`, staff ID is added to `paidStaffIds` Set state. Card shows green "Pagado" badge instead of "Registrar Pago" button. (11.5)
- [x] **Cannot delete staff with completed services** — Fixed 2026-04-01: `handleDeleteStaff` in staff/page.tsx now queries all salon sessions and checks if any service has the staff in `assignedStaff`. If found, shows error "No se puede eliminar: tiene trabajos registrados" and blocks deletion. (10.4)
- [x] **Appointment edit + worker notification on change** — Fixed 2026-04-01: Edit button on pending/confirmed appointments. Opens creation form pre-filled with existing data. `AppointmentService.updateAppointment()` method added. In-app worker notification deferred to future phase. (7, general)

#### P5-LOW — Polish & Timezone

- [x] **Timezone: use America/La_Paz (UTC-4) for all date display and date field writes** — Fixed 2026-03-30: Added `getBoliviaDate()` utility in `helpers.ts` using `toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' })`. Applied to sessions/page.tsx, dashboard/page.tsx, my-earnings/page.tsx, my-appointments/page.tsx, appointments/page.tsx, and sessionService.ts. (4.30, 4.40)
- [x] **Date format in UI should be dd/mm/yyyy** — Fixed 2026-04-01: Added `fmtDate()` helper to `helpers.ts` that converts YYYY-MM-DD to dd/mm/yyyy. Applied to: ReceiptModal (header + text receipt), ClientHistoryModal (session date), reports payroll detail, expenses list, clients lastVisit. (4.30)
- [x] **Print receipt format differs from on-screen receipt** — Fixed 2026-04-01: Print window styles updated to mirror Tailwind utility classes used in receipt div (text-center, text-xs/sm/lg, font-bold/semibold, text-gray-*, flex, justify-between, border-dashed). Uses system font instead of Courier. (4.32)
- [x] **Client list options buttons style inconsistency** — Verified 2026-04-01: Client list already uses `Button` component with consistent variant/size props (secondary for edit, ghost for history/credit/loyalty, danger for delete). Matches pattern used in inventory and services pages. No change needed. (6, general)
- [x] **Loyalty points duplicating on re-test** — Fixed 2026-04-01: `closeSession()` now checks `session.loyaltyPointsAwarded` flag before computing points. If already awarded, `pointsEarned = 0`. Flag is set on the session document when points are first awarded. Prevents duplication on reopen-and-close cycles. (6.11)

#### P4-HIGH — Bugs / Correctness

- [x] **Loyalty points not deducting on payment** — Fixed 2026-04-02: All non-discount reward types now add credit to client balance via `addCredit()`. Discount type records redemption for manual application. Descriptive success messages per type.
- [x] **Appointments module still requires Firebase composite index in production** — Verified 2026-04-02: All appointment queries use equality-only clauses (no `orderBy`), which Firestore handles with automatic single-field indexes. Fixed timezone bug in `getUpcomingAppointments()` — was using `toISOString()` instead of `getBoliviaDate()`.
- [x] **`loading` state in sessions/page.tsx is shared across all active SessionCards** — Fixed 2026-04-02: Added `loadingSessionId` state for per-card loading. Modal-based loading only affects the `activeSessionId` card. Inline operations (close, remove, status update) use `loadingSessionId`.
- [x] **"Materiales Usados" dashboard metric shows sell revenue, not cost** — Fixed 2026-04-02: Now loads all products and computes actual buy cost via `product.cost * quantity`. Renamed label to "Costo Materiales".

#### P4-MEDIUM — UX for non-technical users aged 35–70

- [x] **Touch targets below 44px minimum** — Fixed 2026-04-02: SessionCard remove-service ✕ button increased to `min-w-[44px] min-h-[44px]`. All Hoy/Ayer buttons increased to `px-4 py-2.5` across dashboard, sessions, my-earnings, my-appointments. Status buttons on SessionCard now `min-h-[44px]`.
- [x] **Low contrast gray text fails WCAG AA** — Fixed 2026-04-02: Replaced all `text-gray-400` with `text-gray-500` across 15 files (41 occurrences). Minimum contrast ratio now ~4.5:1 on white backgrounds.
- [x] **Sidebar navigation has no visual grouping** — Fixed 2026-04-02: Added 4 groups: Operaciones (daily), Mi Área (staff), Gestión (management), Sistema (admin). Section labels shown when sidebar expanded; dividers shown when collapsed.
- [x] **Nested modals confuse non-technical users** — Fixed 2026-04-02: Quick-client form now inline within Create Session modal using toggle state. "Volver" button returns to client select. No more stacked modals.
- [x] **Commission formula never explained to staff** — Fixed 2026-04-02: My-earnings page now shows formula per service: "(Bs. 80 - Bs. 10 mat.) × 50% = Bs. 35" with actual commission rate from service data.
- [x] **"Iniciar" / "Completar" status buttons lack context** — Fixed 2026-04-02: Status buttons now show two-line content: main label + small hint "Toca para iniciar" / "Toca para completar".
- [x] **`/my-appointments` page has no loading skeleton** — Fixed 2026-04-02: Added animated skeleton cards (3 placeholder cards with pulse animation) during loading state.

#### P4-LOW — Terminology & Polish

- [x] **"Trabajos" terminology may confuse new users** — Fixed 2026-04-02: Renamed all "Trabajo/Trabajos" to "Atención/Atenciones" throughout `text.es.ts`. Fixed feminine gender agreement (cerrada, creada, anulada, reabierta).
- [x] **Confirmation modal text too long for anxious users** — Fixed 2026-04-02: Shortened all confirmation dialogs to 1 sentence with clear consequence. E.g. "¿Anular esta atención? Se restaurará el inventario."
- [x] **Print report is a browser screenshot, not a formatted document** — Fixed 2026-04-02: Added print-only header with report title and date range (dd/mm/yyyy). Added `break-inside: avoid` for cleaner page breaks.
- [x] **"Materiales Usados" vs "Materiales Vendidos" — mixed framing** — Fixed 2026-04-02: Dashboard now shows "Costo Materiales" computed from actual product buy cost. Consistent with reports page cost-based framing.

#### P6 — Commission/Cost Fixes + UX Improvements (2026-04-02)

- [x] **Commission formula inverted** — Fixed 2026-04-02: Was `(price * rate%) - materialCost`, now `(price - materialCost) * rate%`. Fixed in `analyticsService.ts` (getDailyMetrics, getServiceProfitability, getStaffPerformance, getStaffPayroll), `my-earnings/page.tsx`, `dashboard/page.tsx`.
- [x] **Material cost using sell price instead of buy cost** — Fixed 2026-04-02: All `m.cost` (sell price stored in session) replaced with `productCostMap` lookup using `product.cost * quantity`. Fixed in analyticsService (all 4 methods), my-earnings, dashboard staff KPIs. `MaterialUsage.cost` field now stores buy cost.
- [x] **Material entry saving sell price instead of buy cost** — Fixed 2026-04-02: `sessions/page.tsx` and `my-work/page.tsx` material handlers changed from `product.price` to `product.cost` when building MaterialEntry. Dropdown secondary label changed from "P. Venta" to "Costo" showing buy cost.
- [x] **my-work totalAmount included material sell prices** — Fixed 2026-04-02: `totalAmount` was `servicePrices + materialSellPrices`. Now `totalAmount = servicePrices` only (materials are internal cost tracking).
- [x] **No staff edit/assign after service creation** — Fixed 2026-04-02: Added `onEditStaff` prop to `SessionCard.tsx`. Shows "+ Asignar Trabajador" button when no staff assigned, edit icon next to existing staff. Edit Staff modal with SearchableSelect in `sessions/page.tsx`.
- [x] **Product sales UX: no category filter or search** — Fixed 2026-04-02: Sales modal now has search bar + category filter tabs (pills). Products shown in 2-column grid with tap-to-add and inline +/− quantity controls. Payment/client/notes section appears only when cart has items.
- [x] **Dashboard missing daily expenses and net total** — Fixed 2026-04-02: Added `ExpenseRepository` daily fetch. Two new KPI cards: "Gastos del Día" (red) and "Balance Neto" (green/red) = `(serviceRevenue + retailSales) - expenses`.
- [x] **Modal UX inconsistency: action buttons scroll away on long modals** — Fixed 2026-04-02: Added optional `footer` prop to `Modal.tsx` — renders sticky bottom bar below scroll area. Applied to: sessions Add Service, Payment, Edit Materials, Edit Staff modals + sales modal. Buttons always visible.
- [x] **Sales page used custom overlay instead of Modal component** — Fixed 2026-04-02: Refactored to use `<Modal footer={...}>`. All 64+ modals now use the same base component.
- [x] **Sales: no client selection or loyalty points** — Fixed 2026-04-03: Sales modal now has client selection matching sessions pattern: "Sin Cliente (Eventual)" walk-in sentinel, inline quick-client creation form, loyalty points awarded on purchase (`floor(saleTotal / 50)`). Client stats (totalSpent) updated on sale.
- [x] **Client defaults to empty on new session/sale — extra tap required** — Fixed 2026-04-03: Both sessions and sales now default `clientId` to `'__walkin__'` (Sin Cliente Eventual). Eliminates one tap for the most common flow (walk-in). Users can still change to a specific client.

### P7 — Manual Testing Round 3 Findings (2026-04-11)

Found during second full manual testing pass by owner across Admin, Gerente, Trabajador roles. All modules passed except the items below.

#### P7-CRITICAL — Payment & Money Bugs

- [x] **Partial payment marks session as fully paid** — Fixed 2026-04-11: `SessionService.closeSession()` now throws `SESSION_UNPAID_BALANCE:<amount>` when `totalPaid < totalAmount`. Sessions page catches and shows a Spanish toast with the outstanding balance. `SessionCard` confirm-close modal also shows a red warning with the remaining amount and disables the close button until the session is fully paid.
- [x] **Payroll "Pagado" state leaks across days** — Fixed 2026-04-11: Added `payrollPayments` Firestore collection + `PayrollPaymentRepository`. Each payout records the exact `<sessionId>__<serviceItemId>__<staffId>` refs that were paid. `AnalyticsService.getStaffPayroll()` now fetches paid refs and excludes them, so adding new services on later days does not recompute against already-paid work. Reports page persists payout records (+ expense) instead of using session-only `paidStaffIds` state.

#### P7-HIGH — Role & Permission Gaps

- [x] **Gerente cannot add service to completed session / reopen** — Fixed 2026-04-11: Sessions page now uses a separate `canEditCompleted = admin || manager` flag for the completed-session edit actions (add service, reopen, add note, process remaining payment). `SessionService.addServiceToSession()` auto-reopens a completed session back to `active` when a new service is added.
- [x] **Anular missing on completed sessions** — Fixed 2026-04-11: Added admin-only "Anular" button to the completed-sessions edit action row, reusing the existing `cancelSessionId` modal.
- [x] **Gerente date navigation on sessions not loading past dates** — Fixed 2026-04-11: Root cause was `useRealtime` serializing QueryConstraint objects to `[object Object]`, so the key never changed on date switch and the subscription kept the original date filter. Refactored `useRealtime` to take an explicit `deps` array; updated all callers (sessions, dashboard, my-earnings, my-work) to pass `[salonId, date]`.
- [x] **Mis Ganancias/Reservas past dates not loading for staff** — Fixed 2026-04-11: Same root cause as above; `my-earnings` and `my-work` now pass `[salonId, selectedDate]` to `useRealtime`. `my-appointments` already used `useAsync` which correctly retriggers on dep change.
- [x] **Worker cannot confirm appointments from Mis Reservas** — Fixed 2026-04-11: Confirm button already rendered for pending appointments on my-appointments. Added "Iniciar" button (uses `ES.sessions.create`) on pending/confirmed appointments that calls `SessionService.createSession` + addServiceToSession for each service, marks the appointment completed, and routes to `/my-work`.
- [x] **Product deletion must be blocked if used/sold + admin-only** — Fixed 2026-04-11: `handleDeleteProduct` now queries `SessionRepository.getSalonSessions()` and `RetailSaleRepository.getSalonSales()` and blocks with `ES.inventory.cannotDeleteInUse` toast if the product appears in any `session.materialsUsed`, `service.materialsUsed`, or `sale.items`. Delete button only renders when `userData.role === 'admin'`.
- [x] **Service deletion should be admin-only** — Fixed 2026-04-11: Delete button in services table now gated by `userData?.role === 'admin'`.

#### P7-HIGH — Inventory / Session Bugs

- [x] **Material modal doesn't show already-used materials when adding more** — Fixed 2026-04-11: `my-work/page.tsx` material modal now mirrors admin edit-materials flow. New `openMaterialModal()` pre-loads existing `service.materialsUsed` into form rows (with `maxStock = current + already deducted`). `handleSaveMaterials` was rewritten to restore-then-deduct stock so workers can edit/remove existing rows safely instead of only appending.
- [x] **"Stock Bajo" badge requires page refresh to clear** — Fixed 2026-04-11: `inventory/page.tsx` no longer fetches `lowStockProducts` separately. It derives `lowStockProducts = products.filter(p => p.currentStock <= p.minStock)` from the same `productsData` source, so the alert updates instantly when `refetch()` runs after a stock edit.

#### P7-HIGH — Loyalty / Rewards UX

- [x] **No "Aplicar Recompensa" button in payment modal** — Fixed 2026-04-11: Payment modal in `sessions/page.tsx` now loads `LoyaltyRepository.getSalonRewards()` and renders an inline list of rewards the client can afford. Each affordable reward shows an "Aplicar" button that deducts points, records a `loyaltyTransaction`, and processes a `credit`-method payment for the discount value (`%` of remaining for `discount` type, `value` for credit/free types — capped at `sessionRemainingForPayment`). Closes the modal automatically when remaining hits zero. New i18n keys: `applyReward`, `rewardApplied`, `noAffordableRewards`.

#### P7-HIGH — Appointments & WhatsApp Integration

- [x] **Appointment end-time should auto-calculate from service duration** — Fixed 2026-04-11: `appointments/page.tsx` adds `calcEndTime()` helper and `updateStartTime`/`toggleService` wrappers. End time recomputes whenever start time or selected services change (sum of `service.duration` minutes added to start). Manual end-time edit still allowed for overrides.
- [x] **Worker confirmation flow on appointment create** — Fixed 2026-04-11: Worker `my-appointments/page.tsx` already lists pending appointments (in-app notification). Added Aceptar/Rechazar buttons; Aceptar marks `confirmed` and opens a `wa.me` link with a Spanish confirmation message to the client; Rechazar marks `cancelled` with `cancellationReason: 'Rechazado por personal'` and opens a WA decline message. New `whatsappUrl()` helper in `helpers.ts` (591 country prefix added when missing). Note: in-app push and admin re-notify require backend; current scope opens WhatsApp on the worker's device for manual send.
- [x] **WhatsApp 2-hour reminder** — Documented 2026-04-11 as needing backend infrastructure: this requires a scheduled job (Firebase Cloud Function with Cloud Scheduler) plus a WhatsApp Business API or Twilio integration. Not implementable in the current client-only architecture. Tracked for Phase 8 backend work.
- [x] **Dashboard start-appointment prompt for workers** — Fixed 2026-04-11: `my-work/page.tsx` loads the worker's appointments via `AppointmentService.getStaffAppointments()` and filters to `readyAppointments` (within 30 min of start, not completed/cancelled). Renders a blue banner above active services: "Atención lista para iniciar — [Client] · [time]" with a button that routes to `/my-appointments` where the existing `handleStartSession` flow creates the session.
- [x] **Cancel appointment → WhatsApp notifications** — Fixed 2026-04-11: `appointments/page.tsx` `handleCancelAppointment` now opens two `wa.me` links — one to the client and one to the assigned staff — with Spanish cancellation messages including the formatted date and time.
- [x] **Appointment calendar/date navigation needs day indicators** — Fixed 2026-04-11: `appointments/page.tsx` loads `getUpcomingAppointments(14)` and renders a 7-day strip below the date filter. Each day card shows weekday + day-of-month plus a count badge in the top-right corner when there are non-cancelled appointments scheduled. Tap to switch the selected date.

#### P7-MEDIUM — UX Polish

- [x] **Date range selector format dd/mm/yy** — Fixed 2026-04-11: Without rolling a custom date picker, added an inline `fmtDate(value)` caption (10px gray) under each date input on dashboard/reports/expenses so users always see the dd/mm/yyyy interpretation regardless of the browser's locale. The native date picker still handles selection.
- [x] **Client page action-button style inconsistent with Editar** — Fixed 2026-04-11: `clients/page.tsx` action column now uses `variant="secondary"` for Editar, Ver Historial, Add Credit, and Canjear buttons (was a mix of `secondary`/`ghost`). Delete remains `danger`.
- [x] **Inventory categories — full Spanish salon list** — Fixed 2026-04-11: Added `hair_dye`, `shampoo`, `treatment`, `makeup`, `accessories` to `ProductCategory` type, ES strings (`catHairDye`, `catShampoo`, `catTreatment`, `catMakeup`, `catAccessories`), and the `inventory/page.tsx` Select options.
- [x] **Services categories — full salon list** — Fixed 2026-04-11: Added `treatment`, `makeup`, `eyebrows`, `eyelashes`, `spa` to `ServiceCategory` type, ES strings, and the `services/page.tsx` `categoryOptions`/`categoryLabels`.
- [x] **Staff specialties — expand options** — Fixed 2026-04-11: Added `makeup_artist`, `eyebrow_specialist`, `lash_specialist`, `waxing_specialist`, `spa_therapist`, `hair_treatment_specialist` to `staff/page.tsx` `specialtyOptions` + ES labels.
- [x] **Expense category "Refrigerios"** — Fixed 2026-04-11: Added `refreshments` to `ExpenseCategory` type, `ES.expenses.catRefreshments = 'Refrigerios'`, and the `expenses/page.tsx` `categoryOptions` array.

#### P7-LOW — Verification

- [x] **Verify reports math after worker commission and material cost** — Fixed 2026-04-11: Audited `analyticsService.getServiceProfitability()` and found it was missing payroll/commission subtraction. Added `payrollCost` to the per-service metrics: `(price - materialCost) * commissionRate / 100` (only counted when staff is assigned), and changed `profit = revenue - materialCost - payrollCost`. Reports table now shows a "Comisiones" column and CSV export includes it. New ES string `reports.payrollCost`.
- [x] **Module 2.10 — multi-salon switch test pending** — Documented 2026-04-11 as a manual QA item: requires seeding a second salon document and verifying that `useAuth`'s `onSnapshot` listener on the user document propagates the `salonId` change to all pages without a reload. Code path is in place (`useAuth.ts` real-time listener) but needs interactive verification with multi-salon test data.

### P8 — Manual Testing Round P7 Findings (2026-04-11)

New issues discovered during comprehensive testing of P7 fixes across Admin, Gerente, Trabajador roles.

#### P8-HIGH — Payment & Session Bugs

- [x] **Partial cash payment blocked by strict validation** — Fixed 2026-04-11: `handleProcessPayment` overly strict check rejected partial payments (e.g., paying 100 of 300 in cash). Relaxed validation to only block overpayment; partial payments remain as pending balance.
- [x] **Cash payment UX: two confusing fields (Monto + Monto Recibido)** — Fixed 2026-04-11: Single-entry cash now uses one "Monto Recibido" field. If client gives more than remaining → shows "Cambio" inline. If less → shows "Falta" (partial, allowed). On submit, amount auto-caps at remaining balance so excess is just change, never overpayment. Split mode keeps existing two-field approach.
- [x] **Cancelled session doesn't refund loyalty points spent** — Fixed 2026-04-11: `cancelSession()` now reverses both redeemed and earned loyalty points, writes reversal transactions, and adjusts client.totalSpent/totalSessions for completed sessions.

#### P8-HIGH — Appointments & WhatsApp Flow Redesign

**Design principle**: Client only receives messages from the salon's official WhatsApp number. Workers never contact clients directly — they communicate internally with the salon.

**Required data**: Add `whatsappNumber` field to `Salon` model (the salon's official WA Business number). All client-facing wa.me links use this number.

**Correct flow**:
- Admin/Gerente creates appointment → system opens wa.me to CLIENT (from salon number) with confirmation details
- Worker sees appointment in /my-appointments → taps "Aceptar" → status becomes `confirmed` + opens wa.me to SALON number: "Confirmo asistencia para [Cliente] el [fecha] a las [hora]"
- Worker taps "Rechazar" → status becomes `cancelled` + opens wa.me to SALON number: "No puedo atender la cita de [Cliente] el [fecha]" → Admin reassigns or cancels and notifies client
- Admin/Gerente cancels appointment → opens wa.me to CLIENT (cancellation message) + in-app notification to worker (banner in /my-work)
- Future Phase 2: Cloud Function sends 2h reminder via WA Business API (requires backend)

**Tasks**:
- [x] **Add `whatsappNumber` to Salon model** — Fixed 2026-04-12: Added `whatsappNumber` field to Salon interface and salon edit/create form. Displayed on salon cards.
- [x] **Fix Worker "Aceptar" not updating status to Confirmada** — Fixed 2026-04-12: `updateAppointmentStatus` was already correct; added `refetch()` call so UI reflects instantly. N7.2.
- [x] **Worker "Aceptar" → wa.me to salon number (not client)** — Fixed 2026-04-12: Worker confirms → opens wa.me to `salon.whatsappNumber` with message "✅ Confirmo asistencia para [Cliente]...". Falls back to salon phone.
- [x] **Worker "Rechazar" → wa.me to salon number + instant page refresh** — Fixed 2026-04-12: Worker declines → opens wa.me to salon number with "❌ No puedo atender...". Added `refetch()` for instant UI update. N7.3.
- [x] **Admin/Gerente cancel appointment → wa.me to client only** — Fixed 2026-04-12: Removed staff WA popup from admin cancel flow. Staff see cancellations in-app. N6.2/N6.3.
- [x] **Remove all worker→client direct WA logic** — Fixed 2026-04-12: Both `handleConfirm` and `handleDecline` in my-appointments now target salon number, never client.

#### P8-MEDIUM — Inventory & Materials

- [x] **Material modal allows selecting already-added product** — Fixed 2026-04-12: Both add-service and edit-materials material dropdowns now filter out products already selected in other rows. N2.4.
- [x] **Material stock preview shows stale data** — Fixed 2026-04-12: Resolved by duplicate product filtering — same product can no longer appear in multiple rows within the same material list. N2.5.

#### P8-MEDIUM — UX Polish

- [x] **Date captions still showing mm/dd/yy in some pages/roles** — Fixed 2026-04-12: Appointments header now uses `fmtDate()`, reports period display uses `fmtDate()`, dashboard birthday display fixed from MM-DD to DD/MM. N9.1–N9.4.
- [x] **Inventory "Stock Bajo" badge doesn't refresh for workers** — Fixed 2026-04-12: Workers DO see stock alerts on dashboard (not role-gated). Added `selectedDate` dependency to product fetch so stock data refreshes when navigating between days. N3.2.
- [x] **Workers need appointment day indicators in My-Appointments** — Fixed 2026-04-12: Added 7-day date strip with count badges (matching admin appointments page). Uses new `getUpcomingStaffAppointments()`. N5.1.

#### P8-LOW — Dashboard Enhancements

- [x] **Dashboard "Atenciones de Hoy" cards should show service time** — Fixed 2026-04-12: Added "Hora" column to today's sessions table showing `startTime` formatted with Bolivia timezone.
- [x] **Reports analytics review needed** — Fixed 2026-04-12: Added total sessions count + average ticket card, reorganized summary to 3-column grid, added Staff Payroll Summary section showing per-staff commission breakdown (data was fetched but never displayed).

### P3 — LOW (future hardening)

- [x] **No confirmation dialogs for delete actions** — Fixed 2026-03-28: All `window.confirm()` calls replaced with custom `Modal` confirmations with Spanish buttons. Zero browser confirm dialogs remain.
- [x] **No date validation in `reports/page.tsx`** — Fixed 2026-03-27: Auto-swaps start/end dates if start > end. Shows orange warning message when dates are corrected. Reports use `validStartDate`/`validEndDate` computed from user input.
- [x] **No export/print for reports** — Fixed 2026-03-27: Added "Exportar CSV" button (downloads service profitability as CSV with headers) and "Imprimir" button (`window.print()`) to reports page header.
- [x] **No audit logging** — Fixed 2026-03-27: `auditLog()` function in SessionService logs structured `[AUDIT]` entries to console for: SESSION_CREATED, SERVICE_ADDED, PAYMENT_PROCESSED, SESSION_CLOSED, SESSION_CANCELLED, SERVICE_REMOVED, SESSION_REOPENED. Includes timestamp, IDs, amounts, and context.
- [x] **No appointment overlap/double-booking detection** — Fixed 2026-03-27: `AppointmentService.createAppointment()` now calls `checkStaffAvailability()` before creating. If staff has an overlapping appointment (time range intersection), throws `STAFF_DOUBLE_BOOKED` error shown as Spanish toast message.
- [x] **Unused model fields** — Verified 2026-03-27: `refundedAt`/`refundAmount` are used in `cancelSession()` when voiding payments. `reminderSent` is set on appointment creation — reserved for future reminder feature. No fields need removal.
- [x] **Payment receipt generation** — Fixed 2026-03-27: `ReceiptModal` component shows printable receipt with service list, materials, payment breakdown by method. "Imprimir Recibo" opens print window with receipt-style layout. "Compartir" uses Web Share API (or clipboard fallback) to share plain-text receipt. "Ver Recibo" button on completed sessions.
- [x] **Session edit after close** — Fixed 2026-03-27: Completed sessions now show expanded cards with service list, notes, and edit actions (admin/manager only). Three capabilities: (1) "Agregar Servicio" — adds forgotten services/materials to closed session via the same add-service modal, `addServiceToSession` has no status restriction; (2) "Procesar Pago" — shown when balance remains, payment block changed from `completed` to `cancelled` only; (3) "Agregar Nota" — timestamped correction notes appended to session via `SessionService.addSessionNote()`. All changes logged via `auditLog()`.
- [x] **Client birthday reminders / loyalty tracking** — Fixed 2026-03-27: Dashboard shows birthday alerts: today's birthdays with cake icon in pink card, upcoming week birthdays with date. Loyalty tiers based on `totalSessions`: Nuevo (<3), Regular (3-9), Frecuente (10-19), VIP (20+) with color-coded badges. Birthday detection uses `dateOfBirth` field (YYYY-MM-DD), compares month/day.
- [x] **Frequent client detection** — Fixed 2026-03-27: When opening add-service modal, client's past sessions are fetched and service frequency aggregated. Top 3 most-used services shown as suggestion chips in blue panel with count (e.g. "Corte (5x)"). Tapping a chip auto-selects the service and fills price. Panel hidden once a service is selected. Works for both active and completed sessions.
- [x] **Low-stock alert notification** — Fixed 2026-03-27: (1) Dashboard: red alert banner with product cards showing current vs min stock, "Agotado"/"Stock Bajo" badges. Uses `ProductRepository.getLowStockProducts()`. (2) Sessions page: yellow warning banner at top listing low-stock products when any exist. (3) Product dropdown in material selection shows warning icon for low-stock items.

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
- [x] **2026-03-26** — Material price labels clarified: renamed `costPerUnit` → `pricePerUnit`, dropdown shows "P. Venta: Bs. X/unit", material row shows price breakdown per unit.
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

### `window.confirm()` Shows English Buttons on Mobile
**Problem**: `confirm("¿Está seguro?")` shows Spanish message but browser-default "OK"/"Cancel" buttons in English. Non-technical Spanish-speaking users get confused.
**Solution**: Never use `window.confirm()`. Always use a custom `Modal`-based confirmation with explicit Spanish button labels ("Confirmar"/"Cancelar") and large touch targets (min 44px).

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

### Phase 3G (DONE) - Daily Close / Cierre de Caja
"Cierre de Caja" section on dashboard: payment totals by method (cash, card, QR, transfer) in color-coded cards, total collected, pending from active sessions. Real-time data.

### Phase 3H (DONE) - Appointment ↔ Trabajo Integration
One-tap "Iniciar Trabajo" from confirmed/pending appointments. Creates session pre-filled with client, adds services with staff, marks appointment completed. Double-booking detection via `checkStaffAvailability()`.

### Phase 4A (DONE) - Mobile-First Polish
Hamburger drawer on mobile (slide-in w-72 + overlay, auto-close on route change). Collapsible sidebar on desktop. Fixed top bar with hamburger button. Content area accounts for mobile top bar.

### Phase 4B (DONE) - Production Hardening
Payment receipt generation (print/share), client birthday reminders with loyalty tiers (Nuevo/Regular/Frecuente/VIP), frequent client detection (auto-suggest usual services), low-stock alert notifications on dashboard and sessions page. Audit logging, data export (CSV), confirmation dialogs, date validation — all completed.

### Phase 5A (DONE) - Multi-Location, Retail Sales, Expense Tracking
Multi-location: `/salons` admin page for CRUD salon management + sidebar salon switcher dropdown (updates user's salonId, reloads). Retail product sales: `/sales` POS page with product picker, quantity, payment method, stock auto-deduction, daily sales summary. Expense tracking: `/expenses` page with CRUD, 8 categories (rent/utilities/salaries/supplies/marketing/maintenance/insurance/other), month filter, category breakdown cards, recurring expense support.

### Phase 5B (DONE) - Loyalty Program
Loyalty rewards system: `/rewards` admin page to create/manage redeemable rewards (discount, free service, free product, credit). Clients auto-earn loyalty points on session close (1 point per Bs. 50 spent). Clients page shows loyalty points column, "Canjear" modal with available rewards list, transaction history. `LoyaltyRepository` for rewards CRUD and transaction logging. `Client.loyaltyPoints` field. Credit-type rewards auto-add to `creditBalance`.

### Phase 5C (DONE) - Currency Conversion to Bolivianos
Full system currency conversion from USD ($) to Bolivianos (Bs.). `CURRENCY_SYMBOL = 'Bs.'` and `fmtBs()` helper in `helpers.ts`. Updated all ~15 page and component files to use `Bs.` formatting via `fmtBs()`. Loyalty points rate changed to 1 point per Bs. 50 (`LOYALTY_POINTS_RATE = 50`). Default salon currency set to `'BOB'`. Receipt, reports, dashboard, sessions, sales, expenses, rewards, inventory, services, appointments, my-work, clients — all converted.

### Phase 6A (DONE) - Mobile UX Hardening
13 of 15 P1.6 issues resolved. Key fixes: `Table.tsx` mobile card layout, SessionCard 2-col button grid with destructive separation, all `window.confirm()` replaced with custom Spanish modals (9 files), payment modal "Opciones avanzadas" toggle, `Input.tsx` auto-select on focus, `SearchableSelect` `max-h-[60vh]`, `Modal` 44px close button, Toast bottom-center on mobile, sessions empty-state CTA, dashboard Hoy/Ayer shortcuts, Lucide icons in sidebar (14 items), service left-border status colors. 2 items deferred: loading feedback on card buttons, floating "Nuevo Trabajo" button.

### Phase 6B - Growth Features (Remaining)
> **Scope**: Online booking widget, WhatsApp reminders. See **Section 8** for future items.

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
      salons/page.tsx      # Multi-location salon management (admin only)
      sales/page.tsx       # Retail product sales POS
      expenses/page.tsx    # Expense tracking CRUD with categories
      rewards/page.tsx     # Loyalty rewards management (admin only)
  components/
    index.ts               # Barrel exports
    Button.tsx, Input.tsx, Select.tsx, Card.tsx,
    Modal.tsx, Table.tsx, Alert.tsx, Layout.tsx,
    SearchableSelect.tsx, RoleGuard.tsx,
    SessionCard.tsx, ClientHistoryModal.tsx,
    CategoryServicePicker.tsx, Toast.tsx,
    ReceiptModal.tsx
  hooks/
    index.ts, useAuth.ts, useAsync.ts, useNotification.ts, useRealtime.ts
  lib/
    firebase/config.ts, auth.ts, db.ts
    repositories/clientRepository.ts, serviceRepository.ts,
                  staffRepository.ts, productRepository.ts,
                  sessionRepository.ts, salonRepository.ts,
                  retailSaleRepository.ts, expenseRepository.ts,
                  loyaltyRepository.ts
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

*Last updated: 2026-03-30 | All phases through 6A done. P0/P1.7/P2.7/P3.7 all resolved. Staff flow has dedicated pages: /my-work, /my-earnings, /my-appointments. P4 added from engineering + UX + end-user review (35–70 age target). Manual testing round 2 in progress. See Section 8 for full issue tracker.*
