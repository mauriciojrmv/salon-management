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

#### P4-HIGH — Bugs / Correctness

- [ ] **Loyalty points not deducting on payment** — When a client redeems a reward, the discount is not reflected in the session payment total and `loyaltyPoints` is not decremented. `executeRedeemReward()` logic in `/clients` is correct but the deduction path in payment processing is missing. Must deduct from client's `loyaltyPoints` and apply discount from salon's commission share (not from staff commission). (14.4 from manual testing)
- [ ] **Appointments module still requires Firebase composite index in production** — `AppointmentService.getStaffAppointments()` queries by `salonId` + `staffId` + `appointmentDate` — three equality clauses which Firestore allows, but the appointments list page may still have other compound queries. Verify all appointment queries in production and create any missing indexes. Entire module is unusable until confirmed. (7.1 from manual testing)
- [ ] **`loading` state in sessions/page.tsx is shared across all active SessionCards** — A single `loading` boolean disables ALL card buttons when any one card's async operation is running. Should be `Record<string, boolean>` keyed by `session.id` so only the card being operated on is locked.
- [ ] **"Materiales Usados" dashboard metric shows sell revenue, not cost** — `materialsConsumed` is computed from `session.materialsUsed[].cost` which stores the client-facing sell price, not the salon's buy cost. Label is misleading. Either rename to "Materiales Vendidos (ingresos)" or compute actual cost from `product.costPrice` instead.

#### P4-MEDIUM — UX for non-technical users aged 35–70

- [ ] **Touch targets below 44px minimum** — Two confirmed violations: (1) SessionCard remove-service ✕ button: `min-w-[36px] min-h-[36px]` — increase to `min-w-[44px] min-h-[44px]`. (2) Dashboard Hoy/Ayer buttons: `px-3 py-2 text-sm` ≈ 38px tall — increase padding to `py-2.5` or `py-3`.
- [ ] **Low contrast gray text fails WCAG AA** — `text-gray-400` (contrast ~3:1) and `text-gray-500` (~4.5:1 borderline) used on white backgrounds throughout for timestamps, secondary labels, empty states. Replace with `text-gray-600` minimum across all components. Key files: `SessionCard.tsx` line 100, `Dashboard` line 241, `Toast.tsx` line 36.
- [ ] **Sidebar navigation has no visual grouping** — 16 flat items with no separation. Should group into 3 sections: (1) Operaciones diarias: Trabajos, Citas, Clientes, Ventas; (2) Gestión: Inventario, Servicios, Personal, Gastos, Reportes; (3) Sistema: Sucursales, Usuarios, Recompensas. Use a subtle divider + small section label.
- [ ] **Nested modals confuse non-technical users** — "Nuevo Trabajo" → "Nuevo Cliente Rápido" creates two stacked modals with no clear back navigation. Inline the quick-client form as an expandable section within the main modal instead of a second modal.
- [ ] **Commission formula never explained to staff** — "Mis Ganancias" shows a number with no explanation of how it was calculated. Add a small info line per service: "Bs. 80 servicio - Bs. 10 materiales × 50% = Bs. 35". Staff distrust unexplained numbers.
- [ ] **"Iniciar" / "Completar" status buttons lack context** — New staff don't know these buttons change the service state. Add a subtle subtitle or tooltip: "Toca para marcar En Progreso" / "Toca para marcar Completado".
- [ ] **`/my-appointments` page has no loading skeleton** — Page shows blank white while `useAsync` fetches appointments. Add a loading state (`ES.actions.loading`) consistent with other pages.

#### P4-LOW — Terminology & Polish

- [ ] **"Trabajos" terminology may confuse new users** — Consider renaming to "Atenciones" or "Servicios del Día" in the nav and page titles. "Trabajo" has a construction/labor connotation. Low risk change — only affects `text.es.ts` nav/sessions keys and one page title.
- [ ] **Confirmation modal text too long for anxious users** — "Esta acción no se puede deshacer" combined with long explanations causes some users to either skip reading entirely or panic. Shorten to 1 sentence + a clear consequence. E.g. "¿Anular este trabajo? Se restaurará el stock." rather than the current multi-sentence version.
- [ ] **Print report is a browser screenshot, not a formatted document** — `window.print()` captures the entire page including nav remnants. Already has `@media print` CSS hiding sidebar and filter card, but the result is still a raw page dump. Consider generating a dedicated print layout with salon name, date range header, and clean table-only output.
- [ ] **"Materiales Usados" vs "Materiales Vendidos" — mixed framing** — Dashboard mixes material sell revenue with operational metrics. Clarify throughout the app: materials used in services are a revenue line (charged to client), not a cost line. The reports page already separates this correctly; dashboard should match.

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
