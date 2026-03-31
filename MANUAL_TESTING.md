# Manual Testing Guide — Salon Pro

**Versión:** Post Phase 6A + P3.7 fixes (Round 2)
**Fecha de prueba:** _______________
**Tester:** _______________
**Dispositivo:** _______________  (ej: Samsung A32, iPhone 13, PC Chrome)
**Rol probado:** [ ] Admin  [ ] Gerente  [ ] Personal

---

## Cómo usar este archivo

- **✅ / ❌ / ⚠️** — marca cada paso con el resultado
- **✅** = funcionó correctamente
- **❌** = falló o comportamiento incorrecto
- **⚠️** = funcionó pero con dificultad o confusión
- Llena las secciones **Bug**, **Dificultad** y **Mejora** al final
- Un archivo por sesión de prueba — duplica el archivo para cada ronda

---

## MÓDULO 1 — Inicio de Sesión

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 1.1 | Abrir la app en el celular | ✅| ✅|✅
| 1.2 | Ver pantalla de login — ¿se ve bien en el celular? | ✅|✅ |✅
| 1.3 | Ingresar email incorrecto → debe mostrar error en español (no Firebase crudo) | ✅| ✅|✅
| 1.4 | Ingresar contraseña incorrecta → debe mostrar error en español | ✅| ✅|✅
| 1.5 | Ingresar credenciales correctas → debe redirigir al panel |✅ |✅ |✅
| 1.6 | Cerrar sesión desde el menú lateral |✅ |✅ |✅

---

## MÓDULO 2 — Navegación

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 2.1 | Abrir menú hamburger en celular |✅ |✅ |✅
| 2.2 | Todos los íconos del menú se ven correctamente (sin cuadrados vacíos) |✅ |✅ |✅
| 2.3 | Navegar a cada sección — el menú se cierra automáticamente | ✅| ✅|✅
| 2.4 | En desktop: el menú lateral se puede colapsar | ✅| ✅|✅
| 2.5 | Admin/Gerente NO ven "Mis Trabajos", "Mis Ganancias", "Mis Reservas" en el menú | ✅| ✅|✅
| 2.6 | Personal NO ve "Dashboard", "Reportes", "Gastos", etc. en el menú |✅ | ✅|✅
| 2.7 | Personal SÍ ve "Mis Trabajos", "Mis Ganancias", "Mis Reservas" |✅ |✅ |✅
| 2.8 | Selector de sucursal visible en el menú para admin con al menos 1 salón |✅ |✅ |✅

---

## MÓDULO 3 — Panel (Dashboard)

### 3A. Admin / Gerente

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 3.1 | Ver métricas del día — ingresos, transacciones, clientes, promedio | ✅|✅ |✅
| 3.2 | Ver nuevas métricas: "Ventas de hoy" (cantidad), "Total Vendido" (monto), "Materiales Usados" |✅ |✅ |✅
| 3.3 | Tocar botón "Hoy" → se resalta en azul y carga datos de hoy |✅ |✅ |✅
| 3.4 | Tocar botón "Ayer" → se resalta en azul y carga datos de ayer |✅ |✅ |✅
| 3.5 | Cambiar fecha manualmente → datos actualizan |✅ |⚠️ | i want this to be able to gather data as from a range of dates.
| 3.6 | Ver sección "Cierre de Caja" con totales por método de pago |✅ |✅ |✅
| 3.7 | Si hay cumpleaños hoy → aparece alerta rosada con nombre del cliente |✅ | ✅|✅
| 3.8 | Si hay stock bajo → aparece alerta roja con nombres de productos y unidades en español |✅ |✅ |✅
| 3.9 | Tabla "Trabajos de Hoy" → cada fila muestra columna "Servicios" con nombre del servicio y personal asignado (ej: "Corte — Ana García") |✅ |✅ |✅
| 3.10 | Ver sección "Top Servicios" y "Top Personal" para Admin/Gerente |✅ |✅ |✅

### 3B. Personal (rol staff)

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 3B.1 | Entrar al dashboard con cuenta Personal — NO ver métricas del salón completo |✅ |⚠️ | we are still seeing ingresos totales, section cierre de caja should not appear to staff, and should be able to select data from a range of dates too.
| 3B.2 | Ver 3 tarjetas de KPI: "Servicios Completados", "Mi Comisión", ingresos propios |⚠️ |⚠️ | We are seeing completados hoy, comision del dia, ingresos totales.
| 3B.3 | Tabla "Trabajos de Hoy" muestra SOLO los trabajos donde yo tengo servicios asignados |✅ |✅ |✅
| 3B.4 | NO ver secciones "Top Servicios" ni "Top Personal" | ✅|✅ |✅

---

## MÓDULO 4 — Trabajos (Sesiones) — FLUJO PRINCIPAL

### 4A. Crear nuevo trabajo

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 4.1 | Tocar "+ Nuevo Trabajo" |✅ |✅ |✅
| 4.2 | El dropdown de cliente se abre hacia arriba si está cerca del fondo (no cortado por modal) |✅ | ✅|✅
| 4.3 | Buscar cliente por nombre — lista desplegable funciona correctamente |✅ | ✅|✅
| 4.4 | Buscar cliente por teléfono |✅ |✅ |✅
| 4.5 | Opción "Sin Cliente (Eventual)" aparece al inicio de la lista de clientes |❌ |❌ | No Sin cliente (Eventual ) option.
| 4.6 | Seleccionar "Sin Cliente (Eventual)" → trabajo se crea sin clientId | ⚠️|⚠️ | 4.5 didnt pass test so this cant be done.
| 4.7 | Tocar "Nuevo cliente" → llenar nombre y guardar |✅ |✅ |✅
| 4.8 | Confirmar creación → aparece tarjeta de trabajo activo |✅ |✅ |✅

### 4B. Agregar servicio

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 4.9 | Tocar "Agregar Servicio" en la tarjeta |✅ | ✅|✅
| 4.10 | Ver chips de categoría — tamaño cómodo para tocar |✅ | ✅|✅
| 4.11 | Seleccionar categoría → ver lista de servicios | ✅| ✅|✅
| 4.12 | Seleccionar servicio → precio se llena automáticamente |✅ | ✅|✅
| 4.13 | Tocar el campo de precio → se selecciona solo (sin borrar a mano) | ✅|✅ ✅|
| 4.14 | Cambiar precio manualmente |✅ |✅ |✅
| 4.15 | Asignar personal — dropdown no cortado por márgenes del modal |✅ |⚠️ | if i add a service without selecting a personal, it should appear in Trabajos Disponibles of the workers, but they are not appearing.
| 4.16 | Agregar material → seleccionar producto, ingresar cantidad decimal (ej: 0.5) → precio se calcula |✅ |⚠️ | the agregar material is not following the rule that it 
| 4.17 | Guardar servicio → aparece en la tarjeta |✅ |✅ |✅
| 4.18 | Editar material de servicio registrado |❌ |⚠️ | there is no way to add material if the service has been added by mistake without selecting material.

we are having a problem with the material. the material should not be accounted at the total of the payment it should included in the service. it should not appear in the payment of the client. we have our own rules for this cost deduction with the workers.

### 4C. Estado del servicio

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 4.18 | Ver borde/badge de color en cada servicio (amarillo=pendiente, azul=en progreso, verde=completado) | ✅| ✅|✅
| 4.19 | Tocar badge de estado como Admin/Gerente → avanza Pendiente → En Progreso → Completado | ✅| ✅|✅

### 4D. Cobrar

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 4.20 | Tocar "Procesar Pago" → ver modal con total grande |✅ | ✅|✅
| 4.21 | Tocar "Efectivo" → aparece calculadora de cambio (monto recibido → cambio) |✅ |✅ |✅
| 4.22 | Ingresar monto menor al total → cambio aparece en rojo |✅ |❌ |it is not appearing in red
| 4.23 | Tocar "Tarjeta" → desaparece calculadora de cambio |✅ |✅ |✅
| 4.24 | Tocar "QR" → confirmar pago |✅ |✅ |✅
| 4.25 | Confirmar pago → aparece como "Pagado" en la tarjeta | ✅|✅ | ✅
| 4.26 | Tocar "Opciones avanzadas" → aparece opción de pago dividido | ✅|✅ |✅
| 4.27 | Pago dividido: agregar segunda persona, asignar monto y método |✅ |⚠️ | the old personal tried doing split payment the monto appears for example 60  they place in efectivo section monto recibido 30 and other person to pay 30 in qr, the resumen shows this: Persona 1 — Efectivo
Bs. 60.00
Persona 2 — Código QR
Bs. 30.00
Total
Bs. 90.00

i tried to make them understand that they have to edit monto section when splitting but they dont get it. we have to find a solution for this part.

### 4E. Cerrar trabajo

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 4.28 | Tocar "Cerrar Trabajo" → aparece modal de confirmación en español |✅ |✅ |✅
| 4.29 | Confirmar cierre → trabajo pasa a sección "Completados" |✅ |✅ |✅
| 4.30 | Los completados aparecen ordenados del más reciente al más antiguo |✅ |⚠️ | currently dont know what timezone we are using but we need to use timezone of la paz. and the date format dd/mm/yy 
| 4.31 | Ver recibo → tocar "Ver Recibo" → aparece recibo correcto |✅ |⚠️ | the recibo is summarizing service + material. it should only show services, total, detalle pago pagado. materials used should not be listed here since this is for the client only. 
| 4.32 | Tocar "Imprimir Recibo" → abre ventana de impresión |✅ |⚠️ | the impresion format is not the same as of ver recibo
| 4.33 | Tocar "Compartir" → abre menú compartir del sistema (o copia al portapapeles) |✅ | ✅|✅
| 4.34 | Si el cliente tiene teléfono → aparece botón "WhatsApp" en el recibo |✅ |✅ |✅
| 4.35 | Tocar "WhatsApp" → abre WhatsApp con el recibo pre-llenado en el chat del cliente |✅ |⚠️ | same as ver recibo the client is receiving a wrong price its only services and maybe venta de productos listed here. materials used should not be listed here at all
| 4.36 | Si el cliente NO tiene teléfono → botón WhatsApp NO aparece |✅ |✅ |✅
| 4.37b | En la sección "Completados" cada servicio muestra el nombre del personal asignado debajo del nombre del servicio |✅ |✅ |✅

### 4F. Cancelar trabajo (Solo Admin/Gerente)

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 4.37 | Tocar "Anular" → aparece modal con campo de motivo |✅ |✅ |✅
| 4.38 | Intentar anular sin escribir motivo → debe mostrar error |✅ | ✅|✅
| 4.39 | Anular con motivo → trabajo pasa a sección de cancelados (tachado) |✅ | ⚠️| we had an issue nulling a work from the day before the work doesnt appear nulled.
| 4.40 | Verificar que el stock se restauró en inventario |✅ |⚠️ |stock didnt restored in a work from a previous date. we have a problem with region probably

this anular trabajo should be available to admin role only

---

## MÓDULO 5 — Personal en "Mis Trabajos"

*(Probar con cuenta de Personal)*

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 5.1 | Entrar a "Mis Trabajos" — solo aparecen servicios asignados a mí |✅ | ✅|✅
| 5.2 | Ver badge de estado (Pendiente / En Progreso / Completado) en cada servicio | ✅| ✅|✅
| 5.3 | Tocar "Iniciar" → servicio cambia a En Progreso | ✅|✅ |✅
| 5.4 | Tocar "Completar" → servicio cambia a Completado y desaparece de activos |✅ |✅ |✅
| 5.5 | Ver sección "Trabajos Disponibles" (sin asignar) — tocar "Tomar Trabajo" |✅ |✅ |✅
| 5.6 | Tocar "+ Material" → modal de materiales |✅ |✅ |✅
| 5.7 | En modal de materiales: ingresar cantidad decimal (ej: 0.5) → funciona | ✅|⚠️ | . is not working it is accepting , value   also old people find difficult the usage of decimals how can this be fixed acting as a ux ui designer
| 5.8 | En celular: botones Cancelar/Guardar del modal visibles al tener teclado abierto (scroll) |⚠️ |⚠️ | not visible they are covered by the numeric keyboard
| 5.9 | Crear nuevo trabajo desde "Mis Trabajos" → aparece selector de cliente Y selector de servicio | ✅|⚠️ | the search is kinda bugged cant search by number, neither by name. when you start writing the list dissapears.
| 5.10 | Seleccionar "Sin Cliente (Eventual)" → trabajo se crea sin clientId |✅ |✅ |✅
| 5.11 | Seleccionar servicio en la creación → se agrega al trabajo y queda asignado a mí |✅ |⚠️ | it is showing all available services, not the ones the worker does, its kinda clustered for the worker to see all the services here.
| 5.12 | Personal NO puede anular trabajos — botón no aparece |✅ |✅ |✅
| 5.13 | Ver historial de cliente desde tarjeta de trabajo | ✅| ✅|✅

---

## MÓDULO 5B — Mis Ganancias

*(Probar con cuenta de Personal)*

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 5B.1 | Entrar a "Mis Ganancias" desde el menú |✅ |✅ |✅
| 5B.2 | Ver selector de fecha: botones "Hoy" y "Ayer" + campo de fecha |✅ |✅ |✅
| 5B.3 | Tocar "Hoy" → se resalta en azul, carga datos de hoy | ✅|✅ |✅
| 5B.4 | Tocar "Ayer" → carga datos de ayer | ✅| ❌| data from yesterday isnt showing
| 5B.5 | Cambiar fecha manualmente → datos actualizan | ✅|❌ | data isnt showing also it should be a date range selector
| 5B.6 | Ver cantidad de servicios completados para la fecha seleccionada |✅ |⚠️ | ayer and date selector isnt working
| 5B.7 | Ver comisión total para la fecha seleccionada |✅ |⚠️ | ayer and date selector isnt working
| 5B.8 | Ver desglose por servicio: nombre, precio, deducción material, comisión |✅ | ✅|✅
| 5B.9 | Ver fila de total al fondo de la lista |✅ |✅ |✅
| 5B.10 | Sin servicios completados → mensaje "Sin servicios completados hoy" |✅ |✅ |✅

---

## MÓDULO 5C — Mis Reservas

*(Probar con cuenta de Personal)*

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 5C.1 | Entrar a "Mis Reservas" desde el menú | ✅|✅ |✅
| 5C.2 | Ver selector de fecha: botones "Hoy" y "Ayer" + campo de fecha |✅ | ✅|✅
| 5C.3 | Tocar "Hoy" → se resalta en azul, carga citas de hoy |✅ | ⚠️| doesnt show what service it is. also there should be a button to confirm the reservation from the worker side. also we should have a notification system when a reservation is due to respond from the worker side.
| 5C.4 | Tocar "Ayer" → carga citas de ayer |✅ |⚠️ | ayer and date selector isnt working
| 5C.5 | Cambiar fecha manualmente → lista de citas actualiza |✅ |⚠️ | ayer and date selector isnt working also there is no indicator neither in the manual date selector of on due reservations.
| 5C.6 | Ver solo las citas asignadas a mí para la fecha seleccionada |✅ |⚠️ | ayer and date selector isnt working
| 5C.7 | Citas ordenadas por hora de inicio | ✅|✅ |✅
| 5C.8 | Ver badge de estado por cita (Pendiente, Confirmada, etc.) |✅ |✅ |✅
| 5C.9 | Citas canceladas NO aparecen en la lista |✅ |✅ |✅
| 5C.10 | Sin citas → mensaje "Sin reservas para hoy" |✅ |✅ |✅
---

## MÓDULO 6 — Clientes

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 6.1 | Ver lista de clientes en celular — tarjetas legibles |✅ |✅ |✅
| 6.2 | Buscar cliente por nombre — barra de búsqueda en el encabezado |✅ |✅ |✅
| 6.3 | Buscar cliente por teléfono — misma barra |✅ |✅ |✅
| 6.4 | Crear nuevo cliente con teléfono |✅ | ✅|✅
| 6.5 | Crear cliente sin teléfono (walk-in) |✅ |✅ |✅
| 6.6 | Intentar crear cliente con teléfono duplicado → error en español |✅ |❌ | the client was created succesfully it shouldnt have been created.
| 6.7 | Editar cliente → modal de edición aparece en web y móvil | ✅| ✅|✅
| 6.8 | Intentar eliminar cliente con trabajos → aparece error bloqueante (no se puede eliminar) |✅ |⚠️ | working but in total gastado doesnt show the cliente spendings
| 6.9 | Eliminar cliente sin trabajos → modal de confirmación en español |✅ | ✅|✅
| 6.10 | Ver puntos de lealtad del cliente en web y móvil |✅ |✅ |✅
| 6.11 | Tocar "Puntos / Canjear" → modal de canje de recompensas |✅ | ⚠️ | the points are duplicating from testings of reediting the work, dont know how the canjear puntos work. it should be able to be applied in the trabajos procesar pagos section.
| 6.12 | Ver historial de trabajos del cliente en web y móvil | ✅|✅ |✅
| 6.13 | Agregar saldo aparece en web y móvil |✅ | ✅| we have a problem in the cobro if the client has saldo and it covers the full payment the pago goes to 0 and cant proceed with the payment. they have to get out of the modal manually cause they cant proceed with the payment. another question the payment by saldo doesnt show up in the earnings of the day but the worker still gets its pay right? since the pay up had been made another day.

the options buttons dont follow the same style of the oher lists. also cant visually see the full list with options in the web page.

---

## MÓDULO 7 — Citas

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 7.1 | Crear nueva cita — seleccionar cliente, servicio, personal, fecha y hora | ✅|✅ |✅
| 7.2 | El campo de fecha aparece dentro del modal de creación |✅ |✅ | the date selected is the date that apeears in the fecha 
| 7.3 | Intentar agendar con personal ya ocupado → error de conflicto en español | ✅|✅ |✅
| 7.4 | Confirmar cita pendiente |✅ |✅ |✅
| 7.5 | Tocar "Iniciar Trabajo" en cita confirmada → crea trabajo pre-llenado |✅ |✅ |✅
| 7.6 | Cancelar cita |❌ |❌ | no cancelar cita button
| 7.7 | Ver selector de fecha: botones "Hoy" y "Ayer" + campo de fecha |✅ | ✅| there is no hoy, there is no ayer, and the date selector should be a range date selector here too.

there should be a way to edit the reservation here too if the client changed its mind, and a alert should be sent to the assigned worker about the change for confirmation.

---

## MÓDULO 8 — Inventario

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 8.1 | Ver lista de productos |✅ |✅ |✅
| 8.2 | Ver unidades en español (Piezas, Botellas, Sobres, ml, g) — no en inglés |✅ |✅ |✅
| 8.3 | Crear nuevo producto con precio de costo y precio de venta |✅ |✅ |✅
| 8.4 | Editar stock mínimo | ✅|✅ |✅
| 8.5 | Producto con stock bajo → aparece con badge "Stock Bajo" |✅ |✅ |✅
| 8.6 | Eliminar producto → modal de confirmación en español |✅ |✅ |✅

---

## MÓDULO 9 — Servicios

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 9.1 | Ver lista de servicios con precios en Bs. |✅ | ✅|✅
| 9.2 | Crear nuevo servicio con categoría y precio |✅ |✅ |✅
| 9.3 | Editar servicio |✅ |✅ |✅
| 9.4 | Eliminar servicio → modal de confirmación en español | ✅|✅ |✅

---

## MÓDULO 10 — Personal (Solo Admin)

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 10.1 | Ver lista de personal |✅ |✅ |✅
| 10.2 | Crear nuevo miembro de personal |✅ |✅ |✅
| 10.3 | Asignar especialidades (servicios que realiza) |✅ |✅ |✅
| 10.4 | Eliminar personal → modal de confirmación en español |✅ |⚠️ |should not be able to delete a personal if this has services done.

---

## MÓDULO 11 — Reportes (Solo Admin/Gerente)

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 11.1 | Seleccionar rango de fechas |✅ |✅ |✅
| 11.2 | Ver reporte de rentabilidad por servicio | ✅| ✅|✅
| 11.3 | Ver planilla de pagos por personal — monto a pagar a cada uno |✅ |✅ |✅
| 11.4 | Tocar "Registrar Pago" en una tarjeta de planilla → modal de confirmación |✅ |✅ |✅
| 11.5 | Confirmar pago → se registra como gasto en categoría "salarios" |✅ |⚠️ | it reflects the payment in gastos in categoria salarios. but the payment that just have been payed doesnt appears payed in reports. it should appear as payed. and a new payment should start for the new payment.   also there should be a payments page for the worker to show its payments? or do we do it in mis ganancias. act as a ux ui designer to solve this.
| 11.6 | Ver totales resumen: Ingresos, Planilla, Materiales, Ganancia del Salón |✅ |✅ |✅
| 11.7 | Exportar CSV de rentabilidad por servicio |✅ |✅ |✅
| 11.8 | Imprimir reporte → menú lateral y filtros se ocultan, solo queda el contenido |✅ |✅ |✅

---

## MÓDULO 12 — Ventas (Retail)

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 12.1 | Crear venta de producto al mostrador | ✅| ✅|✅
| 12.2 | Seleccionar método de pago: Efectivo → aparece calculadora de cambio | ✅| ✅|✅
| 12.3 | Ingresar monto recibido → muestra cambio a devolver |✅ |✅ |✅
| 12.4 | Stock se descuenta automáticamente al confirmar venta |✅ | ✅|✅
| 12.5 | Ver resumen de ventas del día en la página de ventas |✅ |✅ |✅
| 12.6 | Ver total de ventas retail en el Dashboard (tarjeta "Ventas Retail") | ✅|✅ |✅

---

## MÓDULO 13 — Gastos

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 13.1 | Registrar gasto con categoría y monto en Bs. |✅ |✅ |✅
| 13.2 | Ver desglose de gastos por categoría |✅ | ✅|✅
| 13.3 | Botón Editar → estilo secundario (gris), visible y clicable |✅ |⚠️ | should be only available for admin
| 13.4 | Botón Eliminar → estilo danger (rojo), visible y clicable |✅ |⚠️ |should be only available for admin
| 13.5 | Eliminar gasto → modal de confirmación en español |✅ |⚠️ |should be only available for admin
| 13.6 | Filtrar por mes |✅ |⚠️ | should be able to filter by range of dates

---

## MÓDULO 14 — Programa de Lealtad (Solo Admin)

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 14.1 | Crear recompensa (descuento, servicio gratis, crédito) | ✅|✅ |✅
| 14.2 | Cerrar un trabajo → cliente acumula puntos automáticamente |✅ | ✅|✅
| 14.3 | Verificar que puntos = total / 50 (redondeado) |✅ |✅ |✅
| 14.4 | Canjear recompensa para cliente desde la página de Clientes → puntos se descuentan |✅ |⚠️ | should be able to canjear recompensa from the payment section so the client doesnt forget.

---

## MÓDULO 15 — Usuarios (Solo Admin)

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 15.1 | Crear nuevo gerente → recibe acceso correcto |✅ |✅ |✅
| 15.2 | Crear nuevo personal → acceso limitado correcto (solo ve Mis Trabajos, etc.) |✅ |✅ |✅
| 15.3 | Admin no pierde su sesión al crear usuario | ✅| ✅|✅

---

## MÓDULO 16 — Multi-Sucursal (Solo Admin)

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 16.1 | Ver/crear sucursales en `/salons` |✅ |✅ |✅
| 16.2 | Selector de sucursal visible en el menú lateral (aparece si admin tiene ≥1 salón) |✅ | ✅|✅
| 16.3 | Cambiar de sucursal desde el selector → datos cambian al salón seleccionado |❌ | ❌|not working.

---

## PRUEBAS DE ROLES — Matriz de Permisos

Verificar que cada rol VE y PUEDE hacer solo lo que le corresponde:

| Función | Admin | Gerente | Personal |
|---------|-------|---------|----------|
| Ver Dashboard | ✓ | ✓ | ✗ |
| Ver Trabajos (todos) | ✓ | ✓ | ✗ |
| Crear/Cerrar Trabajos | ✓ | ✓ | ✓ |
| Anular Trabajos | ✓ | ✓ | ✗ |
| Ver Reportes | ✓ | ✓ | ✗ |
| Gestionar Clientes | ✓ | ✓ | ✗ |
| Gestionar Inventario | ✓ | ✓ | ✗ |
| Gestionar Servicios | ✓ | ✓ | ✗ |
| Gestionar Personal | ✓ | ✗ | ✗ |
| Gestionar Usuarios | ✓ | ✗ | ✗ |
| Ver Gastos | ✓ | ✓ | ✗ |
| Ver Ventas Retail | ✓ | ✓ | ✗ |
| Ver Recompensas | ✓ | ✗ | ✗ |
| Ver Sucursales | ✓ | ✗ | ✗ |
| Mis Trabajos | ✗ | ✗ | ✓ |
| Mis Ganancias | ✗ | ✗ | ✓ |
| Mis Reservas | ✗ | ✗ | ✓ |

**Anotar si algún rol ve algo que NO debería:**
```
Observación: _______________________________________________
```

---

---

# 🐛 SECCIÓN A — REPORTE DE BUGS

*Llenar uno por bug encontrado. Copiar el bloque y pegar tantas veces como sea necesario.*

---

### BUG #___

```
MÓDULO:        (ej: Trabajos, Clientes, Pago)
PANTALLA/URL:  (ej: /sessions, /clients)
DISPOSITIVO:   (ej: Samsung A32 Android 13)
ROL:           (Admin / Gerente / Personal)

QUÉ HICE:
1.
2.
3.

QUÉ ESPERABA QUE PASARA:

QUÉ PASÓ EN REALIDAD:

¿SE REPITE?:   [ ] Siempre  [ ] A veces  [ ] Solo una vez

CAPTURA:       (foto o descripción de lo que se veía en pantalla)

SEVERIDAD:     [ ] Bloqueante (no pude continuar)
               [ ] Importante (pude continuar pero con problemas)
               [ ] Menor (detalle visual o de texto)
```

---

### BUG #___

```
MÓDULO:
PANTALLA/URL:
DISPOSITIVO:
ROL:

QUÉ HICE:
1.
2.
3.

QUÉ ESPERABA QUE PASARA:

QUÉ PASÓ EN REALIDAD:

¿SE REPITE?:   [ ] Siempre  [ ] A veces  [ ] Solo una vez

CAPTURA:

SEVERIDAD:     [ ] Bloqueante  [ ] Importante  [ ] Menor
```

---

---

# 😤 SECCIÓN B — DIFICULTADES DE USO

*Para cuando algo funciona pero costó trabajo o causó confusión. No es un bug, pero tampoco está bien.*

---

### DIFICULTAD #___

```
MÓDULO:
PANTALLA/URL:
DISPOSITIVO:
ROL:

QUÉ INTENTABA HACER:

QUÉ FUE DIFÍCIL O CONFUSO:

SUGERENCIA:
```

---

### DIFICULTAD #___

```
MÓDULO:
PANTALLA/URL:
DISPOSITIVO:
ROL:

QUÉ INTENTABA HACER:

QUÉ FUE DIFÍCIL O CONFUSO:

SUGERENCIA:
```

---

---

# 💡 SECCIÓN C — MEJORAS SUGERIDAS

*Ideas para hacer el sistema más fácil o útil. No son bugs.*

---

### MEJORA #___

```
MÓDULO:
PANTALLA/URL:

QUÉ MEJORARÍA:

POR QUÉ SERÍA ÚTIL:

PRIORIDAD SUGERIDA:  [ ] Alta  [ ] Media  [ ] Baja
```

---

### MEJORA #___

```
MÓDULO:
PANTALLA/URL:

QUÉ MEJORARÍA:

POR QUÉ SERÍA ÚTIL:

PRIORIDAD SUGERIDA:  [ ] Alta  [ ] Media  [ ] Baja
```

---

---

# 📊 RESUMEN FINAL

**Total de módulos probados:** ___ / 16

**Conteo de resultados:**
- ✅ Pasaron: ___
- ❌ Fallaron: ___
- ⚠️ Con dificultad: ___

**Bugs encontrados:** ___
**Dificultades de uso:** ___
**Mejoras sugeridas:** ___

**¿El sistema está listo para uso diario?**
[ ] Sí, sin cambios
[ ] Sí, con los bugs menores corregidos
[ ] No, hay problemas bloqueantes

**Comentario general:**
```
_______________________________________________
_______________________________________________
```
