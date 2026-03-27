# Project Rules - Beauty Salon SaaS

## Workflow

* Issue tracking lives in `PROJECT_GUIDE.md` Section 8
* When fixing a bug or completing a task: mark it `[x]` with the date in PROJECT_GUIDE.md
* When discovering new issues: add them to the appropriate priority level in Section 8
* Development phases tracked in PROJECT_GUIDE.md Section 11

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

## Business Logic

* Sessions are called "Trabajos" in the UI
* Multi-service sessions (services added dynamically)
* Staff assignment per service, not per session
* Material usage tied to a service, with stock auto-deduction
* Commission model (INTERNAL only, never shown to client): 50% of service price minus material buy cost
* Client-facing total: service price + material sell price (additive, NOT deducted)
* Service price is editable per session (non-standard pricing)
* Multiple payment methods (cash, card, QR, transfer)
* Split payments supported (multiple people, multiple methods per session)
* Cash payments show change calculator
* Cancel/void: set status `cancelled` + restore stock + void payments (never delete documents)
* Cancelled trabajos are audit trail — always soft-delete, never hard-delete sessions

## Inventory

* 3 tracking types: unit-based, measurable, service-cost
* Support approximate usage
* Auto-calculate cost
* Low-stock alerts

## Data Model

* All collections scoped by `salonId` (multi-tenant)
* Collections: users, salons, sessions, services, products, appointments
* Clients stored in `users` collection with `role: 'client'` — they don't have auth accounts
* Client phone is optional (walk-ins, one-timers, reservations for others) — uniqueness enforced when provided
* Clients searchable by name or phone number
* All optional fields must default to `''` (Firestore rejects `undefined`)

## Error Handling

* All pages MUST render `<Toast notifications={notifications} onDismiss={removeNotification} />` — never use `useNotification()` without rendering its output
* Destructure `notifications` and `removeNotification` alongside `success`/`error` from `useNotification()`
* Allow edits after completion
* Never block user workflow
* Log important actions to console

## Real-time Data

* Multi-user pages (sessions, dashboard, my-work) MUST use `useRealtime` hook — NOT `useAsync`
* `useRealtime` uses Firestore `onSnapshot` for instant sync across admin/staff/manager
* Reference data (clients, services, staff, products) uses `useAsync` (one-shot fetch, no real-time needed)
* When using `useRealtime`, do NOT call `refetch()` after mutations — data auto-updates via the subscription
* `subscribeToQuery()` in `db.ts` wraps `onSnapshot` for the real-time hook

## Performance

* Optimize Firestore queries (use where clauses, avoid full collection reads)
* Never use `orderBy` in compound Firestore queries — sort client-side instead (avoids composite index requirements)
* Avoid unnecessary re-renders
* Lazy load when possible

## Future Ready

* Multi-tenant architecture (salonId on every document)
* Role-based permissions matrix (extensible)
* API-ready structure (repositories abstract data access)
