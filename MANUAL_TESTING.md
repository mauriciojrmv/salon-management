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
| Admin | admin@salon.com | 21090411 |
| Manager | gerente@salon.com | 21090411 |
| Staff | trabajador@salon.com | 21090411 |

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
| 1.1 | Open the app on mobile — login screen renders correctly |Pass |Pass |Pass | Pass|
| 1.2 | Enter wrong email → error in Spanish (not raw Firebase) |Pass |Pass |Pass | Pass|
| 1.3 | Enter wrong password → error in Spanish |Pass |Pass |Pass | Pass|
| 1.4 | Enter correct credentials → redirects to dashboard/my-work |Pass |Pass |Pass | Pass|
| 1.5 | Logout from sidebar → returns to login |Pass |Pass |Pass | Pass|
| 1.6 | No self-registration option visible on login page |Pass |Pass |Pass | Pass|

---

## MODULE 2 — Navigation & Sidebar

| # | Action | Admin | Manager | Staff | Notes |
|---|--------|-------|---------|-------|-------|
| 2.1 | Mobile: hamburger opens sidebar drawer |Pass |Pass |Pass | Pass|
| 2.2 | Mobile: tapping a nav item closes the drawer |Pass |Pass |Pass | Pass|
| 2.3 | Desktop: sidebar collapses/expands with toggle |Pass |Pass |Pass | Pass|
| 2.4 | Sidebar shows 4 group labels: Operaciones, Mi Area, Gestion, Sistema |Pass |Pass |Pass | Pass| NEW: grouped nav |pass
| 2.5 | Group dividers/labels visible when sidebar expanded |Pass |Pass |Pass | Pass|
| 2.6 | Admin sees all sections including Sistema group |Pass |Pass |Pass | Pass|
| 2.7 | Manager does NOT see Sistema group (Recompensas, Sucursales, Usuarios) |Pass |Pass |Pass | Pass|
| 2.8 | Staff sees ONLY Mi Area group (Mis Atenciones, Mis Ganancias, Mis Reservas) + Panel |Pass |Pass |Pass | Pass|
| 2.9 | Salon switcher visible for Admin with multiple salons |Pass |Pass |Pass | Pass|
| 2.10 | Switch salon → data updates instantly (no page reload) |didnt test no secondary salon yet |

---

## MODULE 3 — Dashboard (Panel)

### 3A. Admin / Manager

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 3.1 | See daily KPIs: Ingresos, Atenciones, Clientes, Promedio |Pass |Pass |Pass | Pass|
| 3.2 | See retail KPIs: Ventas de Hoy (count), Total Ventas (amount) |Pass |Pass |Pass | Pass|
| 3.3 | See "Costo Materiales" metric — shows buy cost, not sell price |Pass |Pass |Pass | Pass|
| 3.4 | Tap "Hoy" → highlighted blue, loads today's data |Pass |Pass |Pass | Pass|
| 3.5 | Tap "Ayer" → loads yesterday's data |Pass |Pass |Pass | Pass|
| 3.6 | Change date manually → data updates |Pass |Pass |Pass | i would like a date range selector with dates with the format dd/mm/yy|
| 3.7 | "Cierre de Caja" shows totals by payment method (cash/card/QR/transfer) |Pass |Pass |Pass | Pass|
| 3.8 | Birthday alert appears if client has birthday today (pink card) |Pass |Pass |Pass | Pass|
| 3.9 | Low-stock alert appears if products below minimum (red banner) |Pass |Pass |Pass | Pass|
| 3.10 | "Atenciones de Hoy" table shows service names + assigned staff per row |Pass |Pass |Pass | Pass|
| 3.11 | Top Services and Top Staff sections visible |Pass |Pass |Pass | Pass|
| 3.12 | "Gastos del Día" card shows daily expense total (red) |Pass |Pass |Pass | Pass|
| 3.13 | "Balance Neto" card shows income minus expenses (green/red) |Pass |Pass |Pass | Pass|
| 3.14 | All dates display dd/mm/yyyy format (not YYYY-MM-DD) |Pass |Pass |Pass | Pass|

### 3B. Staff

| # | Action | Staff | Notes |
|---|--------|-------|-------|
| 3B.1 | Dashboard shows 3 staff-specific KPIs only (Completados, Comision, Mis Ingresos) |Pass |Pass |Pass | Pass|
| 3B.2 | "Cierre de Caja" NOT visible to staff |Pass |Pass |Pass | Pass|
| 3B.3 | Table shows ONLY sessions where I have assigned services |Pass |Pass |Pass | Pass|
| 3B.4 | Top Services / Top Staff NOT visible |Pass |Pass |Pass | Pass|

---

## MODULE 4 — Atenciones (Sessions) — Main Flow

### 4A. Create new session

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 4.1 | Tap "+ Nueva Atencion" button |Pass |Pass |Pass | Pass|
| 4.2 | Client defaults to "Sin Cliente (Eventual)" — no extra tap needed |Pass |Pass |Pass | Pass|
| 4.3 | Can change to specific client via search dropdown (name or phone) |Pass |Pass |Pass | Pass|
| 4.4 | Tap "Nuevo cliente rapido" → form appears INLINE (no second modal) |Pass |Pass |Pass | Pass|
| 4.5 | Fill quick-client name → save → auto-selects new client |Pass |Pass |Pass | Pass|
| 4.6 | Tap "Volver" → returns to client selection |Pass |Pass |Pass | Pass|
| 4.7 | Confirm creation → active session card appears |Pass |Pass |Pass | Pass|

### 4B. Add service

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 4.8 | Tap "Agregar Servicio" on session card |Pass |Pass |Pass | Pass|
| 4.9 | Frequent services shown as suggestion chips (if client has history) |Pass |Pass |Pass | Pass|
| 4.10 | Category chips comfortable to tap (>= 44px) |Pass |Pass |Pass | Pass|
| 4.11 | Select service → price auto-fills |Pass |Pass |Pass | Pass|
| 4.12 | Change price manually |Pass |Pass |Pass | Pass|
| 4.13 | Assign staff from dropdown |Pass |Pass |Pass | Pass|
| 4.14 | Add material → select product, enter decimal qty (0.5) → cost calculates |Pass |Pass |Pass | Pass|
| 4.15 | Save service → appears on card with status badge |Pass |Pass |Pass | Pass|

### 4C. Service status

| # | Action | Admin | Manager | Staff | Notes |
|---|--------|-------|---------|-------|-------|
| 4.17 | Status badge colors: yellow=pending, blue=in-progress, green=completed |Pass |Pass |Pass | Pass|
| 4.18 | Tap status badge → advances state (Pendiente → En Progreso → Completado) |Pass |Pass |Pass | Pass|
| 4.19 | Status button shows hint text: "Toca para iniciar" / "Toca para completar" |Pass |Pass |Pass | Pass|
| 4.20 | Status button touch target >= 44px |Pass |Pass |Pass | Pass|

### 4D. Edit materials on existing service

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 4.21 | Tap "+ Mat." button on a service → edit materials modal opens |Pass |Pass |Pass | Pass|
| 4.22 | Existing materials pre-filled in the modal |Pass |Pass |Pass | Pass|
| 4.23 | Add/remove materials → save → stock adjusts correctly (old restored, new deducted) |Pass |Pass |Pass | Pass|

### 4E. Payment

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 4.24 | Tap "Procesar Pago" → modal shows big total |Pass |Pass |Pass | Pass|
| 4.25 | Total = sum of service prices ONLY (materials NOT included) |Pass |Pass |Pass | Pass|
| 4.26 | Select "Efectivo" → change calculator appears |Pass |Pass |Pass | Pass|
| 4.27 | Select "Tarjeta" / "QR" / "Transferencia" → no change calculator |Pass |Pass |Pass | Pass|
| 4.28 | Client credit balance shown if > 0 → "Aplicar Saldo" button |Pass |Pass |Pass | Pass|
| 4.29 | Client loyalty points shown if > 0 → info text to redeem from Clients |Pass | Pass | Should appear Aplicar Recompensa button or a way to select the recompensa if it is available|
| 4.30 | Tap "Opciones avanzadas" → split payment options appear |Pass |Pass |Pass | Pass|
| 4.31 | Split payment: amounts divide correctly, last person gets remainder |Pass |Pass |Pass | Pass|
| 4.32 | Confirm payment → session shows "Pagado" |Pass |Pass |Pass | we have a problem though, i have an account of lets say 500, the client payed 200 cash and we hit confirm pago. the session appears as full payed instead of having a saldo of 300|
| 4.33 | Loading spinner only on THIS card's buttons (not all cards) |Pass |Pass |Pass | Pass|

### 4F. Close session

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 4.34 | Tap "Cerrar Atencion" → short confirmation: "Cerrar esta atencion?" |Pass |Pass |Pass | Pass|
| 4.35 | Confirm → session moves to "Completados" section |Pass |Pass |Pass | Pass|
| 4.36 | Completed sessions sorted most recent first |Pass |Pass |Pass | Pass|
| 4.37 | Client stats updated (totalSpent, totalSessions, lastVisit, loyaltyPoints) |Pass |Pass |Pass | Pass|
| 4.38 | Loyalty points awarded = floor(totalAmount / 50) |Pass |Pass |Pass | Pass|
| 4.39 | Reopen then close again → loyalty points NOT duplicated |Pass |Pass |Pass | Pass|

### 4G. Receipt

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 4.40 | Tap "Ver Recibo" → receipt shows services, total, payment details |Pass |Pass |Pass | Pass|
| 4.41 | Receipt does NOT show materials (internal only) |Pass |Pass |Pass | Pass|
| 4.42 | Receipt dates show dd/mm/yyyy |Pass |Pass |Pass | Pass|
| 4.43 | "Imprimir Recibo" → print window matches on-screen receipt styling |Pass |Pass |Pass | Pass|
| 4.44 | "Compartir" → share/clipboard with plain-text receipt |Pass |Pass |Pass | Pass|
| 4.45 | "WhatsApp" button appears if client has phone |Pass |Pass |Pass | Pass|

### 4H. Cancel session (Admin only)

| # | Action | Admin | Manager | Staff | Notes |
|---|--------|-------|---------|-------|-------|
| 4.46 | "Anular" button visible ONLY for Admin role |Pass |Pass |there should be anular session in completed sessions too only for admin | Pass|
| 4.47 | Tap Anular → modal with reason field, short confirmation text |Pass |Pass |Pass | Pass|
| 4.48 | Submit without reason → error message |Pass |Pass |Pass | Pass|
| 4.49 | Submit with reason → session moves to cancelled, stock restored |Pass |Pass |Pass | Pass|
| 4.50 | Can cancel sessions from previous dates (date navigation) |Pass |Pass |Pass | Pass|
agregar servicio should be available for gerente too, it should reopen the session when added a new work.
reabrir atencion button should be available for gerente too.

### 4I. Date navigation

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 4.51 | Hoy/Ayer buttons + date picker visible |Pass |Pass |Pass | Pass|
| 4.52 | Navigate to yesterday → see yesterday's sessions |Pass |not working not showing past sessions
| 4.53 | Navigate to any date → sessions load correctly |Pass |not working not showing past sessions
| 4.54 | Buttons have comfortable touch targets (>= 44px) |Pass |Pass |Pass | Pass|

---

## MODULE 5 — Staff: Mis Atenciones (My Work)

*Test with Staff account (michelletrabajadora@salon.com)*

| # | Action | Staff | Notes |
|---|--------|-------|-------|
| 5.1 | Enter "Mis Atenciones" — only services assigned to me appear |Pass |Pass |Pass | Pass|
| 5.2 | See status badge per service (Pendiente / En Progreso / Completado) |Pass |Pass |Pass | Pass|
| 5.3 | Tap "Iniciar" → status changes, hint text visible |Pass |Pass |Pass | Pass|
| 5.4 | Tap "Completar" → service marked done |Pass |Pass |Pass | Pass|
| 5.5 | "Atenciones Disponibles" section shows unassigned work |Pass |Pass |Pass | Pass|
| 5.6 | Tap "Tomar Atencion" → assigns to me |Pass |Pass |Pass | Pass|
| 5.7 | Tap "+ Material" → materials modal opens |Pass |Pass |when selecting more materials it doesnt show what previous materials i have used. if i want to add more it doesnt show | |
| 5.8 | Modal buttons visible when phone keyboard is open (scroll works) |Pass |Pass |Pass | Pass|
| 5.9 | Decimal input: comma on Android keyboard converts to period |Pass |Pass |Pass | Pass|
| 5.10 | Create new session from my-work → service dropdown filtered by my specialties |Pass |Pass |Pass | Pass|
| 5.11 | Staff CANNOT cancel sessions — button not visible |Pass |Pass |Pass | Pass|

---

## MODULE 5B — Staff: Mis Ganancias (My Earnings)

*Test with Staff account*

| # | Action | Staff | Notes |
|---|--------|-------|-------|
| 5B.1 | Enter "Mis Ganancias" from sidebar |Pass |Pass |Pass | Pass|
| 5B.2 | Date selector: Hoy/Ayer buttons + date picker |Pass |Pass |Pass | Pass|
| 5B.3 | See completed service count for selected date |error | error not showing previous dates information
| 5B.4 | See commission total for selected date |error | not showing information from previous dates |
| 5B.5 | Per-service breakdown shows formula: (Bs. X - Bs. Y mat.) x Z% = Bs. W |Pass |Pass |Pass | Pass|
| 5B.6 | Total row at bottom of list |Pass |Pass |Pass | Pass|
| 5B.7 | No completed services → "Sin servicios completados" message |Pass |Pass |Pass | Pass|

---

## MODULE 5C — Staff: Mis Reservas (My Appointments)

*Test with Staff account*

| # | Action | Staff | Notes |
|---|--------|-------|-------|
| 5C.1 | Enter "Mis Reservas" from sidebar |Pass |Pass |Pass | Pass|
| 5C.2 | Loading shows skeleton animation (not blank white page) |Pass |Pass |Pass | Pass|
| 5C.3 | Date selector: Hoy/Ayer buttons + date picker |Pass |Pass |Pass | Pass|
| 5C.4 | See only appointments assigned to me |Pass |Pass |Pass | Pass|
| 5C.5 | Service names shown per appointment (in blue text) |Pass |Pass |Pass | Pass|
| 5C.6 | Confirm button on pending appointments |error | not showing a confirm button for not confirmed appointments, at the moment it only appears in admin/gerente should appear in worker page too | should be able to start the work too for session like its working for admin/gerente.    when created an appointment an automatic message should be sent via whatsapp to the worker for her to confirm it or not. it should tell us if it was approved by him or not.
| 5C.7 | Appointments sorted by start time |Pass |Pass |Pass | Pass|
| 5C.8 | Status badges: Pendiente, Confirmada, etc. |Pass |Pass |Pass | Pass|
| 5C.9 | Cancelled appointments NOT shown |Pass |Pass |Pass | Pass|

---

## MODULE 6 — Clients

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 6.1 | See client list — readable on mobile |Pass |Pass |Pass | Pass|
| 6.2 | Search by name |Pass |Pass |Pass | Pass|
| 6.3 | Search by phone |Pass |Pass |Pass | Pass|
| 6.4 | Create client with phone |Pass |Pass |Pass | Pass|
| 6.5 | Create client without phone (walk-in) |Pass |Pass |Pass | Pass|
| 6.6 | Create client with duplicate phone → error in Spanish |Pass |Pass |Pass | Pass|
| 6.7 | Edit client → modal appears |Pass |Pass |Pass | Pass|
| 6.8 | Delete client with sessions → blocked with error message |Pass |Pass |Pass | Pass|
| 6.9 | Delete client without sessions → confirmation modal |Pass |Pass |Pass | Pass|
| 6.10 | See loyalty points + tier badge per client |Pass |Pass |Pass | Pass|
| 6.11 | Tap "Canjear Puntos" → loyalty modal with rewards + history |Pass |Pass |Pass | Pass|
| 6.12 | Redeem reward → points deducted, credit added to balance |Pass |Pass |Pass | Pass|
| 6.13 | Success message: credit-type shows "saldo agregado", discount shows "aplicar manualmente" |Pass |Pass |Pass | Pass|
| 6.14 | See session history per client (dates in dd/mm/yyyy) |Pass |Pass |Pass | Pass|
| 6.15 | Add credit/advance payment → balance updates |Pass |Pass |Pass | Pass|
| 6.16 | All action buttons same consistent style ||Pass |Pass |Pass | action buttons dont have same style as editar button in admin and in manager|

---

## MODULE 7 — Appointments (Citas)

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 7.1 | Create appointment — select client, service, staff, date, time |Pass |Pass |Pass | hora fin should be automatically applied based of the duration of the service/s. also when creating the appointment there should be a popup sent for the assigned worker to confirm if it accepts the date. after the worker accepts the date we should automatically send a whatsapp confirmation message to the client and the worker as reminder of the date.|
| 7.2 | Double-booking same staff → error in Spanish |Pass |Pass |Pass | Pass|
| 7.3 | Confirm pending appointment |Pass |Pass |Pass | Pass|
| 7.4 | Edit appointment (change date/time/staff) |Pass |Pass |Pass | if an appointment is edited we have to notify with a popup to the worker and reconfirm the date, if the worker accepts the new date a message should be sent with new dates via whatsapp to the worker and the client as reminder.|
| 7.5 | "Iniciar Atencion" on confirmed appointment → creates pre-filled session |Pass |Pass |Pass | we should have a 2 hour notice message via whatsapp to the client and the worker as reminders of the date scheduled. also we must have a message for the worker to start the atencion in the main dashboard, maybe she forgets and starts a new service instead of activating the reservation.|
| 7.6 | Cancel appointment |Pass |Pass |Pass | a message should be sent via whatsapp automatically to the worker and client that the reservation is canceled|
| 7.7 | Date navigation works correctly |Pass |Pass |Pass | our date navigation should have indicators of days that have reservations.|

---

## MODULE 8 — Inventory

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 8.1 | See product list with stock levels |Pass |Pass |Pass | we need more categories in create new item and edit item i need a full category list in spanish|
| 8.2 | Units shown in Spanish (Piezas, Botellas, Sobres, ml, g) |Pass |Pass |Pass | Pass|
| 8.3 | Create product with cost price and sell price |Pass |Pass |Pass | Pass|
| 8.4 | Edit min stock level |Pass |Pass |Pass | Pass|
| 8.5 | Low stock → "Stock Bajo" badge |Pass |Pass |Pass | doesnt dissapear after editing a stock item. must refresh page to fix this.|
| 8.6 | Delete product → confirmation in Spanish |Pass |Pass |Pass | should not be able to delete items if the item has been used in a service or sold. also only admin should have the option to delete products|

---

## MODULE 9 — Services

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 9.1 | See service list with prices in Bs. |Pass |Pass |Pass | Pass|
| 9.2 | Create service with category and price |Pass |Pass |Pass | we need full categories for the salon for example where is maquillaje and others our salon has complete services. |
| 9.3 | Edit service |Pass |Pass |Pass | Pass|
| 9.4 | Delete service → confirmation in Spanish |Pass |Pass |Pass | only admin should be able to delete services.|

---

## MODULE 10 — Staff Management (Admin only)

| # | Action | Admin | Notes |
|---|--------|-------|-------|
| 10.1 | See staff list |Pass |Pass |Pass | Pass|
| 10.2 | Create new staff member |Pass |Pass |Pass | we still need more especialidad, add more especialidad options in create new staff and edit.|
| 10.3 | Assign specialties (services they perform) |Pass |Pass |Pass | Pass|
| 10.4 | Delete staff with sessions → blocked with error message |Pass |Pass |Pass | Pass|
| 10.5 | Delete staff without sessions → confirmation modal |Pass |Pass |Pass | Pass|

---

## MODULE 11 — Reports (Admin/Manager only)

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 11.1 | Select date range |Pass |Pass |Pass | the date range selector i like more like dd/mm/yy|
| 11.2 | See service profitability report |Pass |Pass |Pass | is the math correct after deduction of payment of workers and material cost?|
| 11.3 | See payroll per staff — amount to pay each |Pass |Pass |Pass | Pass|
| 11.4 | "Registrar Pago" → confirmation, records as salary expense |Pass |Pass |Pass | Pass|
| 11.5 | Paid staff shows "Pagado" badge (no duplicate register button) |Pass |fail |fail | it shows pagado. but if i add a new service the next day the new total to pay the worker updates with the previous works that have been paid already making an incorrect new to pay. it should be a new thing. maybe report should only have reports per say and the payments should be done in a new page called pagos? it should work like its working up until now but with the mentioned fixes|
| 11.6 | Summary totals: Ingresos, Planilla, Materiales, Ganancia Salon |Pass |Pass |Pass | Pass|
| 11.7 | Export CSV works |Pass |Pass |Pass | Pass|
| 11.8 | Print → clean layout with title + date range header, no sidebar |Pass |Pass |Pass | Pass|

---

## MODULE 12 — Retail Sales

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 12.1 | Open sale modal → client defaults to "Sin Cliente (Eventual)" |Pass |Pass |Pass | Pass|
| 12.2 | Search/select specific client from dropdown |Pass |Pass |Pass | Pass|
| 12.3 | Tap "Nuevo cliente rápido" → inline form appears (no nested modal) |Pass |Pass |Pass | Pass|
| 12.4 | Category filter pills shown for product list |Pass |Pass |Pass | Pass|
| 12.5 | Search bar filters products by name |Pass |Pass |Pass | Pass|
| 12.6 | Tap product → adds to cart with +/− quantity controls |Pass |Pass |Pass | Pass|
| 12.7 | Cash → change calculator appears |Pass |Pass |Pass | Pass|
| 12.8 | Enter amount given → shows change |Pass |Pass |Pass | Pass|
| 12.9 | Stock deducted on confirm |Pass |Pass |Pass | Pass|
| 12.10 | Loyalty points awarded to client on purchase (floor(total/50)) |Pass |Pass |Pass | Pass|
| 12.11 | Daily sales summary shown on page |Pass |Pass |Pass | Pass|
| 12.12 | Dashboard retail KPIs match |Pass |Pass |Pass | Pass|

---

## MODULE 13 — Expenses (Gastos)

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| 13.1 | Register expense with category and amount |Pass |Pass |Pass | add category refrigerios|
| 13.2 | See expense breakdown by category |Pass |Pass |Pass | Pass|
| 13.3 | Edit/Delete buttons visible ONLY for Admin |Pass |Pass |Pass | Pass|
| 13.4 | Date range filter works (Hoy, Este Mes, Ultimos 7 dias, custom) |Pass |Pass |Pass | i would like the date selector like dd/mm/yy|
| 13.5 | Delete expense → confirmation in Spanish |Pass |Pass |Pass | Pass|

---

## MODULE 14 — Loyalty Program (Admin only)

| # | Action | Admin | Notes |
|---|--------|-------|-------|
| 14.1 | Create reward (discount, free service, credit) |Pass |Pass |Pass | Pass|
| 14.2 | Close a session → client earns points automatically |Pass |Pass |Pass | Pass|
| 14.3 | Points = floor(totalAmount / 50) |Pass |Pass |Pass | Pass|
| 14.4 | Reopen + close session → points NOT awarded again |Pass |Pass |Pass | Pass|
| 14.5 | Redeem reward from Clients page → credit added to balance |Pass |Pass |Pass | Pass|
| 14.6 | Credit balance usable as payment method in session payment modal |Pass |Pass |Pass | Pass|

---

## MODULE 15 — Users (Admin only)

| # | Action | Admin | Notes |
|---|--------|-------|-------|
| 15.1 | Create new Manager → correct access |Pass |Pass |Pass | Pass|
| 15.2 | Create new Staff → limited access (only sees Mi Area) |Pass |Pass |Pass | Pass|
| 15.3 | Admin session NOT lost when creating user (uses secondaryAuth) |Pass |Pass |Pass | Pass|

---

## MODULE 16 — Multi-Location (Admin only)

| # | Action | Admin | Notes |
|---|--------|-------|-------|
| 16.1 | See/create salons at /salons |Pass |Pass |Pass | Pass|
| 16.2 | Salon switcher visible in sidebar |Pass |Pass |Pass | Pass|
| 16.3 | Switch salon → all data updates instantly (no page reload) |Pass |Pass |Pass | Pass|

---

## CROSS-CUTTING — UX & Accessibility

| # | Check | Pass/Fail | Notes |
|---|-------|-----------|-------|
| UX.1 | All text in Spanish (no English strings in UI) |Pass |Pass |Pass |
| UX.2 | All dates display dd/mm/yyyy (not YYYY-MM-DD) |Pass |Pass |some date selectors are in mm/dd/yy |
| UX.3 | All amounts display "Bs. X.XX" format |Pass |Pass |Pass |
| UX.4 | Touch targets >= 44px on mobile (buttons, links, icons) |Pass |Pass |Pass |
| UX.5 | Text contrast: no light gray text on white (min text-gray-500) |Pass |Pass |Pass |
| UX.6 | Modal buttons reachable when phone keyboard open |Pass |Pass |Pass |
| UX.7 | Decimal comma input works on Android |Pass |Pass |Pass |
| UX.8 | Toast notifications appear and auto-dismiss |Pass |Pass |Pass |
| UX.9 | No raw Firebase/English error messages shown to user |Pass |Pass |Pass |
| UX.10 | Terminology uses "Atencion/Atenciones" (not "Trabajo/Trabajos") |Pass |Pass |Pass |

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

# NEW ROUND — P7 Appointments/WhatsApp, UX Polish & Verification (2026-04-11)

*Only test the items below in this round. Skip modules already marked Pass in the earlier round unless you suspect regression.*

## N1 — Payment modal: Aplicar Recompensa (from previous batch, still verify)

| # | Action | Admin | Manager | Staff | Notes |
|---|--------|-------|---------|-------|-------|
| N1.1 | Client with redeemable points: open payment modal on an active session → amber "Puntos" card lists affordable rewards |Pass |Pass |Pass | Pass|
| N1.2 | Tap "Aplicar" on a reward → points deducted from client, transaction logged, remaining balance decreases |Pass |Pass |Pass | Pass|
| N1.3 | Reward covers full remaining → modal closes automatically |Pass |Pass |Pass | Pass|
| N1.4 | Client with zero points → no rewards card shown |Pass |Pass |Pass | Pass|
| N1.5 | Client with points but none affordable → "Sin recompensas disponibles" message |Pass |Pass |Pass | Pass|

## N2 — My-Work: material modal pre-load

| # | Action | Admin | Manager | Staff | Notes |
|---|--------|-------|---------|-------|-------|
| N2.1 | As worker, open "+ Material" on a service that already has materials → existing rows are pre-loaded (not empty) |Pass |Pass |Pass | Pass|
| N2.2 | Edit quantity of an existing row and save → stock correctly adjusted (old restored, new deducted) |Pass |Pass |Pass | Pass|
| N2.3 | Remove an existing row and save → removed material's stock is restored |Pass |Pass |Pass | Pass|
| N2.4 | Add a new row alongside existing rows and save → all changes persist correctly |Pass |Pass |Pass | there is a problem it is allowing me add a row of an already added item, it shouldnt be available to select|
| N2.5 | Exceed available stock (current + restored) → error toast blocks save |Pass |Pass |Pass | it is showing me previous info of the stock, not appling current used stock, although its not saved in database we should take in mind the stock we are using if we want to add more. it even shows more than is stock in the preview but thankfully it wont allow to add if not found in db|

## N3 — Inventory: Stock Bajo badge refresh

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| N3.1 | Create/edit a product with `currentStock <= minStock` → red "Stock Bajo" alert appears |Pass |Pass |Pass | Pass|
| N3.2 | Edit the same product and set stock above minimum → alert updates **without a page refresh** |Pass |Pass |Pass | the page is not refreshing for workers. should it?|
| N3.3 | Add another low-stock product → count updates live |Pass |Pass |Pass | Pass|

## N4 — Appointments: end-time auto-calc

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| N4.1 | Open "Nueva Cita" → select a service with duration 30 min, start 09:00 → end auto-sets to 09:30 |Pass |Pass |Pass | Pass|
| N4.2 | Add a second service (60 min) → end updates to 10:30 |Pass |Pass |Pass | Pass|
| N4.3 | Change start time to 10:00 → end updates to 11:30 |Pass |Pass |Pass | Pass|
| N4.4 | Unselect a service → end time recalculates |Pass |Pass |Pass | Pass|
| N4.5 | Manually edit end time after auto-calc → manual value is kept until next change |Pass |Pass |Pass | Pass|

## N5 — Appointments: date strip with indicators

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| N5.1 | Appointments page shows a 7-day strip below the date filter |Pass |Pass |Pass | we need to add this indicators and appointments for worker too in its own way for them to see currently having problem with the ux of appointments of workers|
| N5.2 | Days with reservations show a blue count badge (e.g. "3") in the corner |Pass |Pass |Pass | Pass|
| N5.3 | Tapping a day card selects that date and reloads the list |Pass |Pass |Pass | Pass|
| N5.4 | Selected day is highlighted in blue |Pass |Pass |Pass | Pass|
| N5.5 | Cancelled appointments are NOT counted in the badge |Pass |Pass |Pass | Pass|

## N6 — Appointments: cancel → WhatsApp

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| N6.1 | Cancel an appointment with a client who has a phone → wa.me tab opens with Spanish cancellation message |Pass |Pass |Pass | Pass|
| N6.2 | Same appointment also opens a second wa.me tab addressed to the assigned staff |fail |fail |fail | didnt sent message to the staff|
| N6.3 | Cancel appointment for client without a phone → no wa.me tab for client but staff tab still opens |fail |fail |fail | didnt sent message to staff

## N7 — My-Appointments: worker accept/decline

| # | Action | Staff | Notes |
|---|--------|-------|-------|
| N7.1 | Pending appointment card shows both "Aceptar" and "Rechazar" buttons |Pass |Pass | Pass|
| N7.2 | Tap Aceptar → status becomes Confirmada, WA tab opens with confirmation to client |fail |fail | it isnt becoming confirmada, and the phone of the worker should not be sending a whatsapp message to the client. it should be sending a message to the salons number at most affirming the atendance, after the worker confirms it should be the salon whatsapp the one responsible to send the message of confirmation. as an ui ux developer check this flow so it works appropiatlely
| N7.3 | Tap Rechazar → status becomes Cancelada, WA tab opens with decline message to client |Pass |Pass | appears a tab same problem like before and the page isnt reloading instantaneusly after this is done.|
| N7.4 | Confirmed appointments no longer show Aceptar/Rechazar (only "Iniciar") | | |

## N8 — My-Work: ready-to-start appointment banner

| # | Action | Staff | Notes |
|---|--------|-------|-------|
| N8.1 | With an appointment assigned to me at a time within the next 30 min → blue banner "Atención lista para iniciar" appears above My Active Services |Pass |Pass | Pass|
| N8.2 | Tapping "Iniciar Atención" routes to /my-appointments |Pass |Pass | Pass|
| N8.3 | Banner hides once the appointment is marked completed (session created) |Pass |Pass | Pass|
| N8.4 | Banner does not show for appointments more than 30 min in the future |Pass |Pass | Pass|

## N9 — UX: date input captions

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| N9.1 | Dashboard date input shows a small dd/mm/yyyy caption below the native picker | |fail |Pass | still showing format mm/dd/yy fix this and other selectors, even in workers|
| N9.2 | Reports start/end date inputs show dd/mm/yyyy captions |fail |Pass | still showing format mm/dd/yy fix this and other selectors, even in workers|
| N9.3 | Expenses filter start/end date inputs show dd/mm/yyyy captions |fail |Pass | still showing format mm/dd/yy fix this and other selectors, even in workers|
| N9.4 | Changing a date updates the caption live |fail |Pass | still showing format mm/dd/yy fix this and other selectors, even in workers|

## N10 — UX: Client page button consistency

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| N10.1 | In Clientes table: Editar, Ver Historial, Add Credit, Canjear buttons all share the same secondary variant and size |Pass |Pass | Pass|
| N10.2 | Eliminar button remains danger (red) |Pass |Pass | Pass|

## N11 — Expanded categories & specialties

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| N11.1 | Inventario → create/edit product: category dropdown includes Tintes, Shampoos/Acondicionadores, Tratamientos, Maquillaje, Accesorios |Pass |Pass | Pass|
| N11.2 | Servicios → create/edit service: category dropdown includes Tratamiento Capilar, Maquillaje, Cejas, Pestañas, Spa |Pass |Pass | Pass|
| N11.3 | Personal → create/edit staff: especialidad dropdown includes Maquillador/a, Especialista en Cejas/Pestañas/Depilación, Terapeuta Spa, Especialista en Tratamientos Capilares |Pass |Pass | Pass|
| N11.4 | Gastos → category dropdown includes Refrigerios |Pass |Pass | Pass|
| N11.5 | Saving a product/service/staff/expense with one of the new values persists correctly and shows the new label when viewed |Pass |Pass | Pass|

## N12 — Reports: profitability math with commissions

| # | Action | Admin | Manager | Notes |
|---|--------|-------|---------|-------|
| N12.1 | Reports → "Rentabilidad por Servicio" table shows a new "Comisiones" column |Pass |Pass | Pass|
| N12.2 | For a service with assigned staff and commissionRate 50: Comisiones = (revenue − material cost) × 50% |Pass |Pass | Pass|
| N12.3 | Ganancia = Ingresos − Costo Materiales − Comisiones (verify on one row) |Pass |Pass | Pass|
| N12.4 | Service without assigned staff shows Comisiones = Bs. 0.00 |Pass |Pass | Pass|
| N12.5 | Export CSV → file contains a "Comisiones" column with matching values |Pass |Pass | Pass|

## N13 — Multi-salon switch (requires seeded second salon)

| # | Action | Admin | Notes |
|---|--------|-------|-------|
| N13.1 | Second salon exists → salon switcher appears in sidebar |Pass |Pass | Pass|
| N13.2 | Switch to salon 2 → Clients/Services/Inventory lists update within 1–2 seconds without a full page reload |Pass |Pass | Pass|
| N13.3 | Dashboard KPIs reflect salon 2's data after switch |Pass |Pass | Pass|
| N13.4 | Switch back to salon 1 → data restored |Pass |Pass | Pass|


## other things to change

in panel for panel dashboard atenciones de hoy for admin/gerente/worker should specify time of the service too.

in reports check the analitics we are presenting. what do we need here.
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
