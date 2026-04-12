# Project Rules - Beauty Salon SaaS

## Workflow

* Issue tracking lives in `PROJECT_GUIDE.md` Section 8
* When fixing a bug or completing a task: mark it `[x]` with the date in PROJECT_GUIDE.md
* When discovering new issues: add them to the appropriate priority level in Section 8
* Development phases tracked in PROJECT_GUIDE.md Section 11
* **After completing a batch of working changes (build passes), commit and push to GitHub.** Do not accumulate large uncommitted diffs across sessions.

## Stack

* Next.js 15 (App Router), React 19, TypeScript strict
* Firebase (Auth, Firestore) — client-side SDK only
* Tailwind CSS for styling
* Lucide React for icons, date-fns for dates
* Deployed on Vercel

## Language

* All UI text in Spanish via `src/config/text.es.ts`
* Code (variables, comments, commits) in English

## Architecture

* Clean architecture: UI → Hooks → Repositories/Services → Firebase
* Repository pattern for data access (`src/lib/repositories/`)
* Business logic in services (`src/lib/services/`)
* Reusable UI components (`src/components/`)
* Custom hooks for auth, async data, real-time sync, notifications (`src/hooks/`)
* Role-based permissions via `src/lib/auth/roles.ts`
* Real-time sync via `useRealtime` hook for multi-user pages (sessions, dashboard, my-work)
* One-shot fetching via `useAsync` hook for reference data (clients, services, staff, products)

## Roles & Auth

* 3 login roles: Admin, Manager, Staff
* Admins created in Firebase Console or by another Admin via `/users` page
* Managers and Staff created by Admin via `/users` page
* User creation uses `secondaryAuth` to avoid logging out the current admin
* Clients are records only (no login) — identified by phone number
* Auth page is login-only, no self-registration
* `useAuth` hook uses real-time `onSnapshot` listener on the user document — NOT a one-shot fetch. This ensures `salonId` changes (e.g., multi-location switch) propagate instantly without page reload

## Code Style

* TypeScript strictly — avoid `any`
* Clear naming conventions
* Small, readable functions
* All new UI text goes through `text.es.ts` — no hardcoded Spanish strings

## UX Rules

* Mobile-first design
* Minimize user input — prefer buttons over typing
* Avoid complex forms
* Optimize for non-technical users (salon staff)
* System must feel easier than WhatsApp and paper tracking
* Date display: always `dd/mm/yyyy` format for Bolivian users — use `fmtDate()` helper, never show raw `YYYY-MM-DD`
* Touch targets: minimum 44px on mobile for all interactive elements (buttons, links, icons)
* Mobile keyboard: add `pb-16 sm:pb-0` on modal/form content so buttons stay reachable when virtual keyboard opens
* Android decimal input: `<Input type="number">` must handle comma→period via `onBeforeInput` (already built into `Input` component)
* Admin-only destructive actions: void/cancel sessions, edit/delete expenses — always gate with role check
* Button style consistency: use the same variant/size for equivalent actions across all pages (e.g., all "new item" buttons should match)

## Business Logic

* Sessions are called "Atenciones" in the UI (renamed from "Trabajos" in P4-LOW)
* Multi-service sessions (services added dynamically)
* Staff assignment per service, not per session
* Material usage tied to a service, with stock auto-deduction
* Commission model (INTERNAL only, never shown to client): (service price - material buy cost) * 50% — deduct materials FIRST, then apply commission rate
* Client-facing total: service price ONLY — materials are internal cost tracking, NOT charged to the client separately
* Materials tracked for: (1) stock deduction, (2) internal commission deduction from staff earnings — never shown on client receipt or client payment total
* **CRITICAL**: `totalAmount` = sum of service prices ONLY. Materials are NEVER added to client-facing totals, receipts, or payment calculations
* Service price is editable per session (non-standard pricing)
* Multiple payment methods (cash, card, QR, transfer)
* Split payments supported (multiple people, multiple methods per session)
* Split payment rounding: `Math.floor(remaining/count * 100) / 100` — last person gets remainder to avoid penny errors
* Cash payments show change calculator
* Cancel/void: set status `cancelled` + restore stock + void payments (never delete documents)
* Cancelled trabajos are audit trail — always soft-delete, never hard-delete sessions
* Loyalty points: `closeSession()` awards points. Use `loyaltyPointsAwarded` boolean flag on session document to prevent duplication on reopen→close cycles
* Staff deletion: query all salon sessions to verify staff has no `assignedStaff` references before allowing delete
* When editing materials on an existing service: restore old materials' stock BEFORE deducting new materials' stock
* Material duplicate filtering: when multiple material rows exist, each row's product dropdown must exclude products already selected in other rows (filter by `productId`)
* Payroll payment tracking: `payrollPayments` collection records per-service payment refs (`sessionId__serviceItemId__staffId`). Reports page uses these to exclude already-paid work from new period calculations

## Inventory

* 3 tracking types: unit-based, measurable, service-cost
* Support approximate usage
* Auto-calculate cost
* Low-stock alerts

## WhatsApp Integration

* 3-Channel Model: Client↔Salon (official number), Worker→Salon (internal), System→Staff (in-app)
* `Salon.whatsappNumber` field stores the salon's official WA Business number for all client-facing messages
* Workers NEVER contact clients directly — they message the salon number, admin handles client communication
* `whatsappUrl(phone, message)` helper in `helpers.ts` builds `wa.me` links, auto-adds Bolivia `591` prefix for 8-digit numbers
* Admin/Gerente cancel appointment → wa.me opens to CLIENT only
* Worker accepts/rejects appointment → wa.me opens to SALON number (not client)
* Future Phase 2: Cloud Function + WA Business API for automated reminders (not implementable in client-only architecture)

## Data Model

* All collections scoped by `salonId` (multi-tenant)
* Collections: users, salons, sessions, services, products, appointments, payrollPayments, retailSales, expenses, loyaltyTransactions
* Clients stored in `users` collection with `role: 'client'` — they don't have auth accounts
* Client phone is optional (walk-ins, one-timers, reservations for others) — uniqueness enforced when provided
* Clients searchable by name or phone number
* All optional fields must default to `''` (Firestore rejects `undefined`)
* Phone uniqueness: check client-side against loaded clients array as fallback — Firestore composite indexes may not exist
* `closeSession()` MUST update client stats (totalSpent, totalSessions, lastVisit, loyaltyPoints) — don't forget side effects
* `cancelSession()` MUST reverse both earned and redeemed loyalty points, write reversal transactions, and adjust client.totalSpent/totalSessions
* `Salon` model has `whatsappNumber` field for the salon's official WA number — displayed on salon cards, used in all client-facing wa.me links

## Error Handling

* All pages MUST render `<Toast notifications={notifications} onDismiss={removeNotification} />` — never use `useNotification()` without rendering its output
* Destructure `notifications` and `removeNotification` alongside `success`/`error` from `useNotification()`
* Allow edits after completion
* Never block user workflow
* Log important actions to console

## Real-time Data

* Multi-user pages (sessions, dashboard, my-work, my-earnings) MUST use `useRealtime` hook — NOT `useAsync`
* `useRealtime` uses Firestore `onSnapshot` for instant sync across admin/staff/manager
* **CRITICAL**: `useRealtime` takes an explicit `deps` array (4th parameter) — pass `[salonId, selectedDate]` or similar values that should retrigger the subscription. Firebase QueryConstraint objects don't serialize their internal values, so the hook cannot detect changes from constraint identity alone
* Reference data (clients, services, staff, products) uses `useAsync` (one-shot fetch, no real-time needed)
* When using `useRealtime`, do NOT call `refetch()` after mutations — data auto-updates via the subscription
* `subscribeToQuery()` in `db.ts` wraps `onSnapshot` for the real-time hook
* `useAuth` also uses `onSnapshot` on the user document for real-time salonId propagation
* Appointments currently use `useAsync` (one-shot fetch) — status changes by workers do NOT sync to admin/gerente in real-time (known issue P9)

## Utility Helpers (`src/lib/utils/helpers.ts`)

* `toDate(value)` — safely converts Firestore Timestamps, Date objects, strings, or numbers to JS Date. Use instead of `instanceof Date` checks
* `sortByCreatedAtDesc(a, b)` — sort helper for Firestore documents by `createdAt` field
* `getBoliviaDate()` — returns today's YYYY-MM-DD in Bolivia timezone (UTC-4)
* `fmtDate(dateStr)` — converts YYYY-MM-DD to dd/mm/yyyy for display
* `fmtBs(amount)` — formats a number as Bolivian currency "Bs. X.XX"
* `whatsappUrl(phone, message)` — builds wa.me link with Bolivia 591 prefix auto-added for 8-digit numbers
* `unitLabel(unit)` — maps English unit keys to Spanish labels (pieces→Piezas, bottles→Botellas, etc.)

## Timezone

* Bolivia is UTC-4. **ALWAYS** use `getBoliviaDate()` for the current date — NEVER `new Date().toISOString().split('T')[0]` which returns UTC and gives the wrong date after 8PM Bolivia time
* `getBoliviaDate()` uses `toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' })` → `YYYY-MM-DD`
* Any page that shows "today's" data (sessions, dashboard, my-work, my-earnings, expenses) must use `getBoliviaDate()`
* Date display: always `dd/mm/yyyy` via `fmtDate()` helper — browser `<input type="date">` uses locale format (not controllable), so add `fmtDate()` caption below each date input as a visual aid

## Components — Known Gotchas

* `SearchableSelect` dropdown in modals: uses `position: fixed` + `z-index: 9999` with `computeDropdownStyle()` that detects available space above/below via `getBoundingClientRect()`. The dropdown div MUST have `onMouseDown stopPropagation` to prevent Modal overlay's `onClick={onClose}` from capturing clicks
* `Input` component has built-in comma→period normalization for `type="number"` via `onBeforeInput` — do not reimplement. Also auto-selects text on focus for number and text types
* Loading states should be per-item (e.g., per-SessionCard via `loadingSessionId`), not a single shared boolean for the whole page — prevents UI flickering on unrelated cards
* Print/receipt output must match on-screen styling — use matching CSS utility classes in print stylesheets. Reports page has `@media print` CSS hiding sidebar + no-print elements
* `Modal` component supports optional `footer` prop — renders a sticky bottom bar below the scroll area. Use for action buttons on complex/long modals (payment, add service, materials, sales). Confirmation dialogs (sm) don't need it. All modals MUST use the `<Modal>` component — no custom overlays
* `Modal` uses `flex flex-col` layout with `max-h: 90dvh` for mobile keyboard safety. Content area scrolls, header and footer stay fixed
* Date strip pattern: 7-day horizontal scroll buttons with count badges — used in appointments page and my-appointments page. Shows weekday + day number + count badge for non-cancelled appointments

## Performance

* Optimize Firestore queries (use where clauses, avoid full collection reads)
* Never use `orderBy` in compound Firestore queries — sort client-side instead (avoids composite index requirements)
* Never use inequality filters (`!=`, `<`, `>`) in compound Firestore queries — filter client-side instead
* Avoid unnecessary re-renders
* Lazy load when possible
* `useRealtime` stores constraints in a ref to avoid re-subscribing on every render — only `deps` array triggers re-subscription

## Staff-Specific Pages

* `/my-work` — Staff's active services, available/unassigned work (self-assign), completed today. Uses `useRealtime` for live sync
* `/my-earnings` — Per-service commission breakdown with formula display. Uses `useRealtime` with `selectedDate` dep
* `/my-appointments` — Staff's appointments with 7-day date strip, accept/reject flow targeting salon WA number. Uses `useAsync`
* All three routes are staff-only in `roles.ts` — auto-hidden from admin/manager nav via `canAccessRoute()`
* `/pagos` — Payroll payment page (in development). Tracks which services have been paid to avoid double-counting

## Sidebar Navigation

* 4 groups: Operaciones (daily), Mi Área (staff-only), Gestión (management), Sistema (admin)
* Uses Lucide React icons (no emojis)
* Mobile: fixed top bar + slide-in drawer (w-72) with overlay, auto-closes on route change
* Desktop: collapsible sidebar (w-64 expanded, w-20 collapsed)
* Salon switcher dropdown visible for admin even with single salon

## Future Ready

* Multi-tenant architecture (salonId on every document)
* Role-based permissions matrix (extensible)
* API-ready structure (repositories abstract data access)
