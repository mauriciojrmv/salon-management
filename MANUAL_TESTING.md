# Manual Testing Guide — Salon Pro

**Version:** Post P4 fixes (All P5/P4 items resolved)
**Test date:** _______________
**Tester:** _______________
**Device:** _______________ (e.g., Samsung A32, iPhone 13, PC Chrome)
**Role tested:** [ ] Admin  [ ] Manager  [ ] Staff

---

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | michelleadmin@salon.com | 123456 |
| Manager | michellegerente@salon.com | 123456 |
| Staff | michelletrabajadora@salon.com | 123456 |

---

## How to use this file

- **Pass / Fail / Warn** — mark each step with the result
- **Pass** = worked correctly
- **Fail** = broken or incorrect behavior
- **Warn** = worked but with difficulty or confusion
- Fill in **Bug**, **Difficulty** and **Improvement** sections at the bottom
- Duplicate this file for each test round

---

## MODULE 1 — Login

| # | Action | Admin | Manager | Staff | Notes |
|---|--------|-------|---------|-------|-------|
| 1.1 | Open the app on mobile — login screen renders correctly | | | | |
| 1.2 | Enter wrong email → error in Spanish (not raw Firebase) | | | | |
| 1.3 | Enter wrong password → error in Spanish | | | | |
| 1.4 | Enter correct credentials → redirects to dashboard/my-work | | | | |
| 1.5 | Logout from sidebar → returns to login | | | | |
| 1.6 | No self-registration option visible on login page | | | | |

---

## MODULE 2 — Navigation & Sidebar

| # | Action | Admin | Manager | Staff | Notes |
|---|--------|-------|---------|-------|-------|
| 2.1 | Mobile: hamburger opens sidebar drawer | | | | |
| 2.2 | Mobile: tapping a nav item closes the drawer | | | | |
| 2.3 | Desktop: sidebar collapses/expands with toggle | | | | |
| 2.4 | Sidebar shows 4 group labels: Operaciones, Mi Area, Gestion, Sistema | | | | NEW: grouped nav |
| 2.5 | Group dividers/labels visible when sidebar expanded | | | | |
| 2.6 | Admin sees all sections including Sistema group | | | | |
| 2.7 | Manager does NOT see Sistema group (Recompensas, Sucursales, Usuarios) | | | | |
| 2.8 | Staff sees ONLY Mi Area group (Mis Atenciones, Mis Ganancias, Mis Reservas) + Panel | | | | |
| 2.9 | Salon switcher visible for Admin with multiple salons | | | | |
| 2.10 | Switch salon → data updates instantly (no page reload) | | | | Uses onSnapshot |

---

## MODULE 3 — Dashboard (Panel)

### 3A. Admin / Manager

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 3.1 | See daily KPIs: Ingresos, Atenciones, Clientes, Promedio | | | |
| 3.2 | See retail KPIs: Ventas de Hoy (count), Total Ventas (amount) | | | |
| 3.3 | See "Costo Materiales" metric — shows buy cost, not sell price | | | FIXED: was showing sell price |
| 3.4 | Tap "Hoy" → highlighted blue, loads today's data | | | Touch target >= 44px |
| 3.5 | Tap "Ayer" → loads yesterday's data | | | |
| 3.6 | Change date manually → data updates | | | |
| 3.7 | "Cierre de Caja" shows totals by payment method (cash/card/QR/transfer) | | | |
| 3.8 | Birthday alert appears if client has birthday today (pink card) | | | |
| 3.9 | Low-stock alert appears if products below minimum (red banner) | | | |
| 3.10 | "Atenciones de Hoy" table shows service names + assigned staff per row | | | |
| 3.11 | Top Services and Top Staff sections visible | | | |
| 3.12 | All dates display dd/mm/yyyy format (not YYYY-MM-DD) | | | FIXED |

### 3B. Staff

| # | Action | Staff | Notes |
|---|--------|-------|-------|
| 3B.1 | Dashboard shows 3 staff-specific KPIs only (Completados, Comision, Mis Ingresos) | | |
| 3B.2 | "Cierre de Caja" NOT visible to staff | | FIXED |
| 3B.3 | Table shows ONLY sessions where I have assigned services | | |
| 3B.4 | Top Services / Top Staff NOT visible | | |

---

## MODULE 4 — Atenciones (Sessions) — Main Flow

### 4A. Create new session

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 4.1 | Tap "+ Nueva Atencion" button | | | Renamed from "Trabajo" |
| 4.2 | Client search dropdown works (by name and phone) | | | |
| 4.3 | "Sin Cliente (Eventual)" option appears at start of list | | | |
| 4.4 | Tap "Nuevo cliente rapido" → form appears INLINE (no second modal) | | | FIXED: was nested modal |
| 4.5 | Fill quick-client name → save → auto-selects new client | | | |
| 4.6 | Tap "Volver" → returns to client selection | | | |
| 4.7 | Confirm creation → active session card appears | | | |

### 4B. Add service

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 4.8 | Tap "Agregar Servicio" on session card | | | |
| 4.9 | Frequent services shown as suggestion chips (if client has history) | | | |
| 4.10 | Category chips comfortable to tap (>= 44px) | | | |
| 4.11 | Select service → price auto-fills | | | |
| 4.12 | Change price manually | | | |
| 4.13 | Assign staff from dropdown | | | |
| 4.14 | Add material → select product, enter decimal qty (0.5) → cost calculates | | | |
| 4.15 | Comma input on Android converts to period automatically | | | FIXED: onBeforeInput |
| 4.16 | Save service → appears on card with status badge | | | |

### 4C. Service status

| # | Action | Admin | Manager | Staff | Notes |
|---|--------|-------|---------|-------|-------|
| 4.17 | Status badge colors: yellow=pending, blue=in-progress, green=completed | | | | |
| 4.18 | Tap status badge → advances state (Pendiente → En Progreso → Completado) | | | | |
| 4.19 | Status button shows hint text: "Toca para iniciar" / "Toca para completar" | | | | NEW |
| 4.20 | Status button touch target >= 44px | | | | FIXED |

### 4D. Edit materials on existing service

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 4.21 | Tap "+ Mat." button on a service → edit materials modal opens | | | |
| 4.22 | Existing materials pre-filled in the modal | | | |
| 4.23 | Add/remove materials → save → stock adjusts correctly (old restored, new deducted) | | | |

### 4E. Payment

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 4.24 | Tap "Procesar Pago" → modal shows big total | | | |
| 4.25 | Total = sum of service prices ONLY (materials NOT included) | | | CRITICAL rule |
| 4.26 | Select "Efectivo" → change calculator appears | | | |
| 4.27 | Select "Tarjeta" / "QR" / "Transferencia" → no change calculator | | | |
| 4.28 | Client credit balance shown if > 0 → "Aplicar Saldo" button | | | |
| 4.29 | Client loyalty points shown if > 0 → info text to redeem from Clients | | | NEW |
| 4.30 | Tap "Opciones avanzadas" → split payment options appear | | | |
| 4.31 | Split payment: amounts divide correctly, last person gets remainder | | | |
| 4.32 | Confirm payment → session shows "Pagado" | | | |
| 4.33 | Loading spinner only on THIS card's buttons (not all cards) | | | FIXED: per-session loading |

### 4F. Close session

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 4.34 | Tap "Cerrar Atencion" → short confirmation: "Cerrar esta atencion?" | | | FIXED: shortened text |
| 4.35 | Confirm → session moves to "Completados" section | | | |
| 4.36 | Completed sessions sorted most recent first | | | |
| 4.37 | Client stats updated (totalSpent, totalSessions, lastVisit, loyaltyPoints) | | | |
| 4.38 | Loyalty points awarded = floor(totalAmount / 50) | | | |
| 4.39 | Reopen then close again → loyalty points NOT duplicated | | | FIXED: loyaltyPointsAwarded flag |

### 4G. Receipt

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 4.40 | Tap "Ver Recibo" → receipt shows services, total, payment details | | | |
| 4.41 | Receipt does NOT show materials (internal only) | | | CRITICAL rule |
| 4.42 | Receipt dates show dd/mm/yyyy | | | FIXED |
| 4.43 | "Imprimir Recibo" → print window matches on-screen receipt styling | | | FIXED |
| 4.44 | "Compartir" → share/clipboard with plain-text receipt | | | |
| 4.45 | "WhatsApp" button appears if client has phone | | | |

### 4H. Cancel session (Admin only)

| # | Action | Admin | Manager | Staff | Notes |
|---|--------|-------|---------|-------|-------|
| 4.46 | "Anular" button visible ONLY for Admin role | | | | FIXED |
| 4.47 | Tap Anular → modal with reason field, short confirmation text | | | | |
| 4.48 | Submit without reason → error message | | | | |
| 4.49 | Submit with reason → session moves to cancelled, stock restored | | | | |
| 4.50 | Can cancel sessions from previous dates (date navigation) | | | | FIXED |

### 4I. Date navigation

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 4.51 | Hoy/Ayer buttons + date picker visible | | | |
| 4.52 | Navigate to yesterday → see yesterday's sessions | | | |
| 4.53 | Navigate to any date → sessions load correctly | | | |
| 4.54 | Buttons have comfortable touch targets (>= 44px) | | | FIXED |

---

## MODULE 5 — Staff: Mis Atenciones (My Work)

*Test with Staff account (michelletrabajadora@salon.com)*

| # | Action | Staff | Notes |
|---|--------|-------|-------|
| 5.1 | Enter "Mis Atenciones" — only services assigned to me appear | | Renamed from "Mis Trabajos" |
| 5.2 | See status badge per service (Pendiente / En Progreso / Completado) | | |
| 5.3 | Tap "Iniciar" → status changes, hint text visible | | |
| 5.4 | Tap "Completar" → service marked done | | |
| 5.5 | "Atenciones Disponibles" section shows unassigned work | | |
| 5.6 | Tap "Tomar Atencion" → assigns to me | | |
| 5.7 | Tap "+ Material" → materials modal opens | | |
| 5.8 | Modal buttons visible when phone keyboard is open (scroll works) | | FIXED: pb-16 |
| 5.9 | Decimal input: comma on Android keyboard converts to period | | FIXED |
| 5.10 | Create new session from my-work → service dropdown filtered by my specialties | | FIXED |
| 5.11 | Staff CANNOT cancel sessions — button not visible | | |

---

## MODULE 5B — Staff: Mis Ganancias (My Earnings)

*Test with Staff account*

| # | Action | Staff | Notes |
|---|--------|-------|-------|
| 5B.1 | Enter "Mis Ganancias" from sidebar | | |
| 5B.2 | Date selector: Hoy/Ayer buttons + date picker | | |
| 5B.3 | See completed service count for selected date | | |
| 5B.4 | See commission total for selected date | | |
| 5B.5 | Per-service breakdown shows formula: (Bs. X - Bs. Y mat.) x Z% = Bs. W | | NEW: commission explained |
| 5B.6 | Total row at bottom of list | | |
| 5B.7 | No completed services → "Sin servicios completados" message | | |

---

## MODULE 5C — Staff: Mis Reservas (My Appointments)

*Test with Staff account*

| # | Action | Staff | Notes |
|---|--------|-------|-------|
| 5C.1 | Enter "Mis Reservas" from sidebar | | |
| 5C.2 | Loading shows skeleton animation (not blank white page) | | NEW |
| 5C.3 | Date selector: Hoy/Ayer buttons + date picker | | |
| 5C.4 | See only appointments assigned to me | | |
| 5C.5 | Service names shown per appointment (in blue text) | | FIXED |
| 5C.6 | Confirm button on pending appointments | | |
| 5C.7 | Appointments sorted by start time | | |
| 5C.8 | Status badges: Pendiente, Confirmada, etc. | | |
| 5C.9 | Cancelled appointments NOT shown | | |

---

## MODULE 6 — Clients

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 6.1 | See client list — readable on mobile | | | |
| 6.2 | Search by name | | | |
| 6.3 | Search by phone | | | |
| 6.4 | Create client with phone | | | |
| 6.5 | Create client without phone (walk-in) | | | |
| 6.6 | Create client with duplicate phone → error in Spanish | | | |
| 6.7 | Edit client → modal appears | | | |
| 6.8 | Delete client with sessions → blocked with error message | | | |
| 6.9 | Delete client without sessions → confirmation modal | | | |
| 6.10 | See loyalty points + tier badge per client | | | |
| 6.11 | Tap "Canjear Puntos" → loyalty modal with rewards + history | | | |
| 6.12 | Redeem reward → points deducted, credit added to balance | | | FIXED |
| 6.13 | Success message: credit-type shows "saldo agregado", discount shows "aplicar manualmente" | | | NEW |
| 6.14 | See session history per client (dates in dd/mm/yyyy) | | | FIXED |
| 6.15 | Add credit/advance payment → balance updates | | | |
| 6.16 | All action buttons same consistent style | | | FIXED |

---

## MODULE 7 — Appointments (Citas)

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 7.1 | Create appointment — select client, service, staff, date, time | | | |
| 7.2 | Double-booking same staff → error in Spanish | | | |
| 7.3 | Confirm pending appointment | | | |
| 7.4 | Edit appointment (change date/time/staff) | | | |
| 7.5 | "Iniciar Atencion" on confirmed appointment → creates pre-filled session | | | |
| 7.6 | Cancel appointment | | | |
| 7.7 | Date navigation works correctly | | | |

---

## MODULE 8 — Inventory

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 8.1 | See product list with stock levels | | | |
| 8.2 | Units shown in Spanish (Piezas, Botellas, Sobres, ml, g) | | | |
| 8.3 | Create product with cost price and sell price | | | |
| 8.4 | Edit min stock level | | | |
| 8.5 | Low stock → "Stock Bajo" badge | | | |
| 8.6 | Delete product → confirmation in Spanish | | | |

---

## MODULE 9 — Services

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 9.1 | See service list with prices in Bs. | | | |
| 9.2 | Create service with category and price | | | |
| 9.3 | Edit service | | | |
| 9.4 | Delete service → confirmation in Spanish | | | |

---

## MODULE 10 — Staff Management (Admin only)

| # | Action | Admin | Notes |
|---|--------|-------|-------|
| 10.1 | See staff list | | |
| 10.2 | Create new staff member | | |
| 10.3 | Assign specialties (services they perform) | | |
| 10.4 | Delete staff with sessions → blocked with error message | | FIXED |
| 10.5 | Delete staff without sessions → confirmation modal | | |

---

## MODULE 11 — Reports (Admin/Manager only)

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 11.1 | Select date range | | | |
| 11.2 | See service profitability report | | | |
| 11.3 | See payroll per staff — amount to pay each | | | |
| 11.4 | "Registrar Pago" → confirmation, records as salary expense | | | |
| 11.5 | Paid staff shows "Pagado" badge (no duplicate register button) | | | FIXED |
| 11.6 | Summary totals: Ingresos, Planilla, Materiales, Ganancia Salon | | | |
| 11.7 | Export CSV works | | | |
| 11.8 | Print → clean layout with title + date range header, no sidebar | | | FIXED: print header |

---

## MODULE 12 — Retail Sales

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 12.1 | Create product sale at counter | | | |
| 12.2 | Cash → change calculator appears | | | |
| 12.3 | Enter amount given → shows change | | | |
| 12.4 | Stock deducted on confirm | | | |
| 12.5 | Daily sales summary shown on page | | | |
| 12.6 | Dashboard retail KPIs match | | | |

---

## MODULE 13 — Expenses (Gastos)

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 13.1 | Register expense with category and amount | | | |
| 13.2 | See expense breakdown by category | | | |
| 13.3 | Edit/Delete buttons visible ONLY for Admin | | | FIXED |
| 13.4 | Date range filter works (Hoy, Este Mes, Ultimos 7 dias, custom) | | | FIXED |
| 13.5 | Delete expense → confirmation in Spanish | | | |

---

## MODULE 14 — Loyalty Program (Admin only)

| # | Action | Admin | Notes |
|---|--------|-------|-------|
| 14.1 | Create reward (discount, free service, credit) | | |
| 14.2 | Close a session → client earns points automatically | | |
| 14.3 | Points = floor(totalAmount / 50) | | |
| 14.4 | Reopen + close session → points NOT awarded again | | FIXED: loyaltyPointsAwarded flag |
| 14.5 | Redeem reward from Clients page → credit added to balance | | FIXED |
| 14.6 | Credit balance usable as payment method in session payment modal | | |

---

## MODULE 15 — Users (Admin only)

| # | Action | Admin | Notes |
|---|--------|-------|-------|
| 15.1 | Create new Manager → correct access | | |
| 15.2 | Create new Staff → limited access (only sees Mi Area) | | |
| 15.3 | Admin session NOT lost when creating user (uses secondaryAuth) | | |

---

## MODULE 16 — Multi-Location (Admin only)

| # | Action | Admin | Notes |
|---|--------|-------|-------|
| 16.1 | See/create salons at /salons | | |
| 16.2 | Salon switcher visible in sidebar | | |
| 16.3 | Switch salon → all data updates instantly (no page reload) | | FIXED: useAuth onSnapshot |

---

## CROSS-CUTTING — UX & Accessibility

| # | Check | Pass/Fail | Notes |
|---|-------|-----------|-------|
| UX.1 | All text in Spanish (no English strings in UI) | | |
| UX.2 | All dates display dd/mm/yyyy (not YYYY-MM-DD) | | FIXED |
| UX.3 | All amounts display "Bs. X.XX" format | | |
| UX.4 | Touch targets >= 44px on mobile (buttons, links, icons) | | FIXED |
| UX.5 | Text contrast: no light gray text on white (min text-gray-500) | | FIXED |
| UX.6 | Modal buttons reachable when phone keyboard open | | FIXED: pb-16 |
| UX.7 | Decimal comma input works on Android | | FIXED |
| UX.8 | Toast notifications appear and auto-dismiss | | |
| UX.9 | No raw Firebase/English error messages shown to user | | |
| UX.10 | Terminology uses "Atencion/Atenciones" (not "Trabajo/Trabajos") | | CHANGED |

---

## ROLE PERMISSION MATRIX

Verify each role sees and can do ONLY what's allowed:

| Function | Admin | Manager | Staff |
|----------|-------|---------|-------|
| See Dashboard (full KPIs) | Yes | Yes | No (staff KPIs only) |
| See Atenciones (all) | Yes | Yes | No |
| Create/Close Atenciones | Yes | Yes | Yes (from my-work) |
| Cancel Atenciones | Yes | No | No |
| See Reports | Yes | Yes | No |
| Manage Clients | Yes | Yes | No |
| Manage Inventory | Yes | Yes | No |
| Manage Services | Yes | Yes | No |
| Manage Staff | Yes | No | No |
| Manage Users | Yes | No | No |
| See/Edit Expenses | Yes | Yes (view only) | No |
| See Retail Sales | Yes | Yes | No |
| See Rewards | Yes | No | No |
| See Salons | Yes | No | No |
| Mis Atenciones | No | No | Yes |
| Mis Ganancias | No | No | Yes |
| Mis Reservas | No | No | Yes |

**Note any role seeing something it shouldn't:**
```
Observation: _______________________________________________
```

---

---

# SECTION A — BUG REPORTS

*Fill one per bug found. Copy the block and paste as many times as needed.*

---

### BUG #___

```
MODULE:        (e.g., Atenciones, Clients, Payment)
SCREEN/URL:    (e.g., /sessions, /clients)
DEVICE:        (e.g., Samsung A32 Android 13)
ROLE:          (Admin / Manager / Staff)

STEPS:
1.
2.
3.

EXPECTED:

ACTUAL:

REPEATABLE:    [ ] Always  [ ] Sometimes  [ ] Once

SCREENSHOT:    (photo or description)

SEVERITY:      [ ] Blocker (could not continue)
               [ ] Important (continued with problems)
               [ ] Minor (visual or text detail)
```

---

### BUG #___

```
MODULE:
SCREEN/URL:
DEVICE:
ROLE:

STEPS:
1.
2.
3.

EXPECTED:

ACTUAL:

REPEATABLE:    [ ] Always  [ ] Sometimes  [ ] Once

SCREENSHOT:

SEVERITY:      [ ] Blocker  [ ] Important  [ ] Minor
```

---

---

# SECTION B — USABILITY DIFFICULTIES

*For when something works but was hard or confusing. Not a bug, but not great either.*

---

### DIFFICULTY #___

```
MODULE:
SCREEN/URL:
DEVICE:
ROLE:

WHAT I WAS TRYING TO DO:

WHAT WAS DIFFICULT OR CONFUSING:

SUGGESTION:
```

---

### DIFFICULTY #___

```
MODULE:
SCREEN/URL:
DEVICE:
ROLE:

WHAT I WAS TRYING TO DO:

WHAT WAS DIFFICULT OR CONFUSING:

SUGGESTION:
```

---

---

# SECTION C — SUGGESTED IMPROVEMENTS

*Ideas to make the system easier or more useful. Not bugs.*

---

### IMPROVEMENT #___

```
MODULE:
SCREEN/URL:

WHAT WOULD IMPROVE:

WHY IT WOULD BE USEFUL:

SUGGESTED PRIORITY:  [ ] High  [ ] Medium  [ ] Low
```

---

### IMPROVEMENT #___

```
MODULE:
SCREEN/URL:

WHAT WOULD IMPROVE:

WHY IT WOULD BE USEFUL:

SUGGESTED PRIORITY:  [ ] High  [ ] Medium  [ ] Low
```

---

---

# FINAL SUMMARY

**Total modules tested:** ___ / 16 + UX cross-cutting

**Result count:**
- Pass: ___
- Fail: ___
- Warn: ___

**Bugs found:** ___
**Usability difficulties:** ___
**Improvements suggested:** ___

**Is the system ready for daily use?**
[ ] Yes, no changes needed
[ ] Yes, with minor bugs fixed
[ ] No, there are blocking issues

**General comment:**
```
_______________________________________________
_______________________________________________
```
