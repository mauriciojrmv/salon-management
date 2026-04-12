# Manual Testing Guide — Salon Pro

**Version:** Post P8 fixes (WhatsApp flow redesign, material dedup, date formats, dashboard/reports)
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
- Fill in **Bug** and **Improvement** sections at the bottom

---

# ROUND P8 — Verify Recent Fixes

## T1 — WhatsApp Flow Redesign (Salon Number)

**Prerequisite:** Go to Sucursales → edit your salon → add a WhatsApp number in the new field.

| # | Action | Role | Expected | Result | Notes |
|---|--------|------|----------|--------|-------|
| T1.1 | Edit salon → see new "Numero WhatsApp del Salon" field | Admin | Field visible with hint text |pass |pass |pass.
| T1.2 | Save salon with WA number → shown on salon card as "WA: 7XXXXXXX" | Admin | Green WA label on card |pass |pass |pass.
| T1.3 | Worker: Mis Reservas → tap "Aceptar" on pending appointment | Staff | Status becomes Confirmada, wa.me opens to SALON number (not client) with "Confirmo asistencia para [Cliente]..." |pass |pass |working needs to be synced all pages admin/gerente/worker, currently need to manually update. also there needs to be in admin/gerente the notification that we need to send the whatsapp to the client of aceptar if we havent sent it yet
| T1.4 | Worker: Mis Reservas → tap "Rechazar" on pending appointment | Staff | Status becomes Cancelada, wa.me opens to SALON number with "No puedo atender la cita de [Cliente]...", list refreshes instantly |pass |pass |working needs to be synced all pages admin/gerente/worker, currently needs to be manually updated. also there needs to be in admin/gerente the notification that we need to send the whatsapp to the client of rechazar if we havent sent it yet
| T1.5 | Admin: Citas → cancel an appointment (client has phone) | Admin | wa.me opens to CLIENT only — NO second tab to staff |pass |pass |pass.
| T1.6 | Admin: Citas → cancel an appointment (client without phone) | Admin | No wa.me tab opens at all |pass |pass |pass.
| T1.7 | Worker Aceptar/Rechazar → confirmed the WA message is NOT addressed to the client's phone | Staff | wa.me URL uses salon number, not client number |pass |pass |pass.

## T2 — Worker My-Appointments: Date Strip & Refresh

| # | Action | Role | Expected | Result | Notes |
|---|--------|------|----------|--------|-------|
| T2.1 | Open Mis Reservas → 7-day date strip visible (like admin appointments page) | Staff | Strip with day names, numbers, and count badges |pass |pass |pass.
| T2.2 | Day with appointments shows blue count badge | Staff | Badge with number in corner |pass |pass |pass.
| T2.3 | Tap a day → appointments list updates | Staff | Different day's appointments load |pass |pass |pass.
| T2.4 | Cancelled appointments NOT counted in badges | Staff | Only pending/confirmed count |pass |pass |pass.
| T2.5 | After Aceptar/Rechazar → list refreshes without page reload | Staff | Instant UI update |pass |pass |working locally for the person making the change, not affecting other users like gerente/admin yet, needs to be fixed.

## T3 — Material Modal: Duplicate Product Filtering

| # | Action | Role | Expected | Result | Notes |
|---|--------|------|----------|--------|-------|
| T3.1 | Add service → add material row → select product A | Admin | Product A selected |pass |pass |pass.
| T3.2 | Add second material row → product A should NOT appear in dropdown | Admin | Product A filtered out |fail |fail |for worker the product a is appearing in the dropdown.
| T3.3 | Remove first row (product A) → add new row → product A reappears | Admin | Product A available again |pass |pass |pass.
| T3.4 | Edit materials modal (existing service) → same filtering applies | Admin | Already-selected products hidden from other rows |pass |pass |stock each time we edit product adding product the stock enuntiating increases instead of reducing, weird interaction.

## T4 — Date Format Fixes

| # | Action | Role | Expected | Result | Notes |
|---|--------|------|----------|--------|-------|
| T4.1 | Appointments page → header "Citas para" shows dd/mm/yyyy (not YYYY-MM-DD) | Admin | e.g., "Citas para 12/04/2026" |pass |pass |pass.
| T4.2 | Reports page → period subtitle shows dd/mm/yyyy | Admin | e.g., "13/03/2026 — 12/04/2026" |pass |pass |pass.
| T4.3 | Dashboard → birthday section shows DD/MM (not MM-DD) | Admin | e.g., "Maria Lopez — 15/06" |pass |pass |pass.
| T4.4 | Dashboard date caption below picker shows dd/mm/yyyy | Admin | Small gray text below date input |pass |pass |pass.
| T4.5 | Reports date captions below pickers show dd/mm/yyyy | Admin | Small gray text below each date input |pass |pass |pass.
| T4.6 | Expenses date captions show dd/mm/yyyy | Admin | Small gray text below date inputs |pass |pass |pass.

the problem i am noticing with dates is the filter that is in mm/dd/yy i would like it to be in format dd/mm/yy too if possible for all.

## T5 — Dashboard: Session Time Column

| # | Action | Role | Expected | Result | Notes |
|---|--------|------|----------|--------|-------|
| T5.1 | Dashboard "Atenciones de Hoy" table → new "Hora" column visible | Admin | Time column between Client and Services |pass |pass |pass.
| T5.2 | Time shows HH:MM format (Bolivia timezone) | Admin | e.g., "14:30" |pass |pass |pass.
| T5.3 | Staff dashboard also shows time column | Staff | Same column visible |pass |pass |pass.

## T6 — Dashboard: Stock Bajo Refresh for Workers

| # | Action | Role | Expected | Result | Notes |
|---|--------|------|----------|--------|-------|
| T6.1 | Worker sees low-stock red banner on dashboard (if products below minimum) | Staff | Red banner with product names |pass |pass |pass.
| T6.2 | Change day selector → stock data refreshes (picks up changes from other sessions) | Staff | Banner updates |pass |pass |pass.

## T7 — Reports: Analytics Enhancements

| # | Action | Role | Expected | Result | Notes |
|---|--------|------|----------|--------|-------|
| T7.1 | Reports page shows "Atenciones" card with session count | Admin | Number of sessions in period |pass |pass |pass.
| T7.2 | Same card shows "Transaccion Promedio" (avg ticket) | Admin | Revenue / sessions |pass |pass |pass.
| T7.3 | "Desempeno del Personal" section visible below profitability table | Admin | Staff names with service count, revenue, and commission |pass |pass |pass.
| T7.4 | Staff with zero services in period → not shown (or shows 0) | Admin | Clean display |pass |pass |pass.
| T7.5 | Summary cards: Ingresos, Atenciones, Ganancia Salon, Nomina, Materiales — all present | Admin | 5 summary cards |pass |pass |pass.

in reports would like to have a report of payments of workers, detailing their works done with date and time. it should be able to share via whatsapp with the worker for clarity.

## T8 — Cash Payment UX (Prior P8 Fix)

| # | Action | Role | Expected | Result | Notes |
|---|--------|------|----------|--------|-------|
| T8.1 | Single cash payment → field labeled "Monto Recibido" (not "Monto") | Admin | Label says "Monto Recibido" |pass |pass |pass.
| T8.2 | Enter amount > remaining → shows green "Cambio" with difference | Admin | e.g., Remaining 300, enter 500 → Cambio Bs. 200 |pass |pass |pass.
| T8.3 | Enter amount < remaining → shows orange "Falta" with difference | Admin | e.g., Remaining 300, enter 100 → Falta Bs. 200 |pass |pass |pass.
| T8.4 | Confirm with amount > remaining → records remaining as payment (excess is change) | Admin | Payment = 300, not 500 |pass |pass |pass.
| T8.5 | Confirm with amount < remaining → records partial payment, leaves pending balance | Admin | Payment = 100, pending = 200 |pass |pass |pass.
| T8.6 | Split mode (multiple entries) → old two-field behavior preserved | Admin | Monto + Monto Recibido fields |pass |pass |pass.

## T9 — Loyalty Points Refund on Cancel

| # | Action | Role | Expected | Result | Notes |
|---|--------|------|----------|--------|-------|
| T9.1 | Close a session → client earns loyalty points | Admin | Points increase |pass |pass |pass.
| T9.2 | Cancel the same session → loyalty points reversed | Admin | Points decrease back |pass |pass |pass.
| T9.3 | Client totalSpent and totalSessions also adjusted on cancel | Admin | Stats decrease |pass |pass |pass.

---

# RESOLVED BUGS — Fixed in P9 (2026-04-12)

| # | Issue | Resolution |
|---|-------|------------|
| B1 | Manager past sessions not loading | Already fixed in P7 — `useRealtime` deps array retriggers on date change |
| B2 | Staff Mis Ganancias past dates empty | Already fixed in P7 — `useRealtime` with `selectedDate` dep |
| B3 | Inventory Stock Bajo badge stale after edit | Already fixed in P7 — derived from `products.filter()`, recomputes on refetch |

# P9 FIXES APPLIED (2026-04-12)

- Appointments now use `useRealtime` — syncs across admin/gerente/worker instantly
- Admin sees "📲 Avisar Cliente" / "📲 Avisar Cancelación" buttons on appointments after worker acts
- Material duplicate filtering now works for worker role (my-work page)
- Stock cache refreshed after material add/edit operations (prevents stale maxStock)
- Worker payment report shows date + time columns
- Pagos page has "📲 WhatsApp" button to share payment summary with worker

---

# OPEN FEATURE REQUESTS — Future Work

| # | Feature | Priority | Notes |
|---|---------|----------|-------|
| F6 | Phase 2 WhatsApp: auto-notification to worker on appointment creation/edit | Future | Requires WA Business API |
| F7 | Phase 2 WhatsApp: 2-hour reminder to client and worker before appointment | Future | Requires Cloud Function |
| F8 | Dashboard date range selector with dd/mm/yy format | Low | Browser limitation — fmtDate() captions already added |
| F9 | Client page: action button style consistency (Editar vs other actions) | Low | From 6.16 |

---

# BUG REPORT TEMPLATE

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
SEVERITY:      [ ] Blocker  [ ] Important  [ ] Minor
```

---

# IMPROVEMENT TEMPLATE

### IMPROVEMENT #___

```
MODULE:
SCREEN/URL:

WHAT WOULD IMPROVE:

WHY IT WOULD BE USEFUL:

SUGGESTED PRIORITY:  [ ] High  [ ] Medium  [ ] Low
```

---

# FINAL SUMMARY

**Total sections tested:** ___ / 9 (T1–T9)

**Result count:**
- Pass: ___
- Fail: ___
- Warn: ___

**Open bugs remaining:** 3 (B1–B3)
**Feature requests:** 9 (F1–F9)

**Is the system ready for daily use?**
[ ] Yes, no changes needed
[ ] Yes, with minor bugs fixed
[ ] No, there are blocking issues

**General comment:**
```
_______________________________________________
```
