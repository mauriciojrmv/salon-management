# Manual Testing Guide — Salon Pro

**Versión:** Post Phase 6A
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
| 1.1 | Abrir la app en el celular | | |
| 1.2 | Ver pantalla de login — ¿se ve bien en el celular? | | |
| 1.3 | Ingresar email incorrecto → debe mostrar error en español | | |
| 1.4 | Ingresar contraseña incorrecta → debe mostrar error | | |
| 1.5 | Ingresar credenciales correctas → debe redirigir al panel | | |
| 1.6 | Cerrar sesión desde el menú lateral | | |

---

## MÓDULO 2 — Navegación

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 2.1 | Abrir menú hamburger en celular | | |
| 2.2 | Todos los íconos del menú se ven correctamente (sin cuadrados vacíos) | | |
| 2.3 | Navegar a cada sección — el menú se cierra automáticamente | | |
| 2.4 | En desktop: el menú lateral se puede colapsar | | |

---

## MÓDULO 3 — Panel (Dashboard)

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 3.1 | Ver métricas del día (ingresos, transacciones) | | |
| 3.2 | Tocar botón "Hoy" → carga datos de hoy | | |
| 3.3 | Tocar botón "Ayer" → carga datos de ayer | | |
| 3.4 | Cambiar fecha manualmente → datos actualizan | | |
| 3.5 | Ver tabla de trabajos — ¿se ve como tarjetas en celular? | | |
| 3.6 | Ver sección "Cierre de Caja" con totales por método | | |
| 3.7 | Si hay cumpleaños hoy → aparece alerta rosada | | |
| 3.8 | Si hay stock bajo → aparece alerta roja | | |

---

## MÓDULO 4 — Trabajos (Sesiones) — FLUJO PRINCIPAL

### 4A. Crear nuevo trabajo

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 4.1 | Tocar "+ Nuevo Trabajo" | | |
| 4.2 | Buscar cliente por nombre — lista desplegable grande (no cortada) | | |
| 4.3 | Buscar cliente por teléfono | | |
| 4.4 | Tocar "Agregar cliente rápido" → llenar nombre y guardar | | |
| 4.5 | Confirmar creación → aparece tarjeta de trabajo activo | | |

### 4B. Agregar servicio

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 4.6 | Tocar "Agregar Servicio" en la tarjeta | | |
| 4.7 | Ver chips de categoría (Corte, Color, etc.) — tamaño cómodo para tocar | | |
| 4.8 | Seleccionar categoría → ver lista de servicios de esa categoría | | |
| 4.9 | Seleccionar servicio → precio se llena automáticamente | | |
| 4.10 | Tocar el campo de precio → se selecciona solo (sin borrar a mano) | | |
| 4.11 | Cambiar precio manualmente | | |
| 4.12 | Asignar personal | | |
| 4.13 | Agregar material — tocar "+ Agregar Material" | | |
| 4.14 | Seleccionar producto, cambiar cantidad → precio se calcula solo | | |
| 4.15 | Ver resumen: Servicios + Materiales = Total | | |
| 4.16 | Guardar servicio → aparece en la tarjeta | | |

### 4C. Estado del servicio

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 4.17 | Ver borde de color en cada servicio (amarillo=pendiente, azul=en progreso, verde=completado) | | |
| 4.18 | Tocar badge de estado → avanza al siguiente (Pendiente → En Progreso → Completado) | | |

### 4D. Cobrar

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 4.19 | Tocar "Pagar" → ver modal con total grande | | |
| 4.20 | Tocar "Efectivo" → cash calculator aparece (monto recibido → cambio) | | |
| 4.21 | Tocar "Tarjeta" → desaparece calculadora de cambio | | |
| 4.22 | Tocar "QR" → confirmar pago | | |
| 4.23 | Confirmar pago → aparece como "Pagado" en la tarjeta | | |
| 4.24 | Tocar "Opciones avanzadas" → aparece opción de pago dividido | | |
| 4.25 | Pago dividido: agregar segunda persona, asignar monto y método | | |

### 4E. Cerrar trabajo

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 4.26 | Tocar "Cerrar Trabajo" → aparece modal de confirmación en español | | |
| 4.27 | Tocar "Cancelar" en el modal → trabajo no se cierra | | |
| 4.28 | Confirmar cierre → trabajo pasa a sección "Completados" | | |
| 4.29 | Ver recibo → tocar "Ver Recibo" → aparece recibo correcto | | |
| 4.30 | Imprimir o compartir recibo | | |

### 4F. Cancelar trabajo (Solo Admin/Gerente)

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 4.31 | Tocar "Anular" → aparece modal con campo de motivo | | |
| 4.32 | Intentar anular sin escribir motivo → debe mostrar error | | |
| 4.33 | Anular con motivo → trabajo pasa a sección de cancelados (tachado) | | |
| 4.34 | Verificar que el stock se restauró en inventario | | |

---

## MÓDULO 5 — Personal en "Mis Trabajos"

*(Probar con cuenta de Personal)*

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 5.1 | Entrar a "Mis Trabajos" | | |
| 5.2 | Ver servicios asignados a mí | | |
| 5.3 | Tomar un trabajo disponible sin asignar — tocar "Tomar Trabajo" | | |
| 5.4 | Agregar material desde "Mis Trabajos" | | |
| 5.5 | Crear nuevo trabajo desde "Mis Trabajos" | | |
| 5.6 | Personal NO puede anular trabajos — botón no aparece | | |
| 5.7 | Ver historial de cliente desde tarjeta de trabajo | | |

---

## MÓDULO 6 — Clientes

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 6.1 | Ver lista de clientes en celular — ¿tarjetas o tabla legible? | | |
| 6.2 | Buscar cliente por nombre | | |
| 6.3 | Buscar cliente por teléfono | | |
| 6.4 | Crear nuevo cliente con teléfono | | |
| 6.5 | Crear cliente sin teléfono (walk-in) | | |
| 6.6 | Intentar crear cliente con teléfono duplicado → error en español | | |
| 6.7 | Editar cliente | | |
| 6.8 | Eliminar cliente → aparece modal de confirmación en español | | |
| 6.9 | Ver puntos de lealtad del cliente | | |
| 6.10 | Canjear recompensa — tocar "Canjear" → modal con lista de recompensas | | |
| 6.11 | Ver historial de trabajos del cliente | | |

---

## MÓDULO 7 — Citas

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 7.1 | Crear nueva cita — seleccionar cliente, servicio, personal, fecha/hora | | |
| 7.2 | Intentar agendar con personal ya ocupado → debe mostrar error de conflicto | | |
| 7.3 | Confirmar cita pendiente | | |
| 7.4 | Tocar "Iniciar Trabajo" en cita confirmada → crea trabajo pre-llenado | | |
| 7.5 | Cancelar cita | | |

---

## MÓDULO 8 — Inventario

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 8.1 | Ver lista de productos | | |
| 8.2 | Crear nuevo producto con precio de costo y precio de venta | | |
| 8.3 | Editar stock mínimo | | |
| 8.4 | Producto con stock bajo → aparece con badge "Stock Bajo" | | |
| 8.5 | Eliminar producto → modal de confirmación en español | | |

---

## MÓDULO 9 — Servicios

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 9.1 | Ver lista de servicios con precios en Bs. | | |
| 9.2 | Crear nuevo servicio con categoría y precio | | |
| 9.3 | Editar servicio | | |
| 9.4 | Eliminar servicio → modal de confirmación en español | | |

---

## MÓDULO 10 — Personal (Staff)

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 10.1 | Ver lista de personal | | |
| 10.2 | Crear nuevo miembro de personal | | |
| 10.3 | Asignar especialidades (servicios que realiza) | | |
| 10.4 | Eliminar personal → modal de confirmación en español | | |

---

## MÓDULO 11 — Reportes (Solo Admin/Gerente)

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 11.1 | Seleccionar rango de fechas | | |
| 11.2 | Ver reporte de rentabilidad por servicio | | |
| 11.3 | Ver planilla de pagos por personal (cuánto pagarle a cada uno) | | |
| 11.4 | Ver totales: Ingresos, Planilla, Materiales, Ganancia del Salón | | |
| 11.5 | Exportar CSV | | |
| 11.6 | Imprimir reporte | | |

---

## MÓDULO 12 — Ventas (Retail)

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 12.1 | Crear venta de producto al mostrador | | |
| 12.2 | Stock se descuenta automáticamente | | |
| 12.3 | Ver resumen de ventas del día | | |

---

## MÓDULO 13 — Gastos

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 13.1 | Registrar gasto con categoría y monto en Bs. | | |
| 13.2 | Ver desglose de gastos por categoría | | |
| 13.3 | Eliminar gasto → modal de confirmación | | |
| 13.4 | Filtrar por mes | | |

---

## MÓDULO 14 — Programa de Lealtad (Solo Admin)

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 14.1 | Crear recompensa (descuento, servicio gratis, crédito) | | |
| 14.2 | Cerrar un trabajo → cliente acumula puntos automáticamente | | |
| 14.3 | Verificar que puntos = total / 50 (redondeado) | | |
| 14.4 | Canjear recompensa para cliente → puntos se descuentan | | |

---

## MÓDULO 15 — Usuarios (Solo Admin)

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 15.1 | Crear nuevo gerente → recibe acceso correcto | | |
| 15.2 | Crear nuevo personal → acceso limitado correcto | | |
| 15.3 | Admin no pierde su sesión al crear usuario | | |

---

## MÓDULO 16 — Multi-Sucursal (Solo Admin)

| # | Acción | Resultado | Notas |
|---|--------|-----------|-------|
| 16.1 | Ver/crear sucursales en `/salons` | | |
| 16.2 | Cambiar de sucursal desde el selector del menú | | |
| 16.3 | Datos cambian al cambiar de sucursal | | |

---

## PRUEBAS DE ROLES — Matriz de Permisos

Verificar que cada rol VE y PUEDE hacer solo lo que le corresponde:

| Función | Admin | Gerente | Personal |
|---------|-------|---------|----------|
| Ver Dashboard | ✓ | ✓ | ✗ |
| Crear/Cerrar Trabajos | ✓ | ✓ | ✓ |
| Anular Trabajos | ✓ | ✓ | ✗ |
| Ver Reportes | ✓ | ✓ | ✗ |
| Gestionar Clientes | ✓ | ✓ | Solo ver |
| Gestionar Inventario | ✓ | ✓ | Solo ver |
| Gestionar Servicios | ✓ | ✓ | ✗ |
| Gestionar Personal | ✓ | ✗ | ✗ |
| Gestionar Usuarios | ✓ | ✗ | ✗ |
| Ver Gastos | ✓ | ✓ | ✗ |
| Ver Ventas Retail | ✓ | ✓ | ✗ |
| Ver Recompensas | ✓ | ✗ | ✗ |
| Ver Sucursales | ✓ | ✗ | ✗ |

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
QUIÉN LO REPORTA:   (ej: estilista 52 años, dueña del salón)
MÓDULO/PANTALLA:
DISPOSITIVO:

QUÉ INTENTABA HACER:

DÓNDE SE CONFUNDIÓ O QUÉ LE COSTÓ:

CUÁNTO TIEMPO LE TOMÓ (aprox):

TUVO QUE PEDIR AYUDA:  [ ] Sí  [ ] No

LO QUE DIJO EXACTAMENTE (si aplica):

NIVEL DE FRUSTRACIÓN:  [ ] Leve  [ ] Moderado  [ ] Mucho
```

---

### DIFICULTAD #___

```
QUIÉN LO REPORTA:
MÓDULO/PANTALLA:
DISPOSITIVO:

QUÉ INTENTABA HACER:

DÓNDE SE CONFUNDIÓ O QUÉ LE COSTÓ:

CUÁNTO TIEMPO LE TOMÓ (aprox):

TUVO QUE PEDIR AYUDA:  [ ] Sí  [ ] No

LO QUE DIJO EXACTAMENTE (si aplica):

NIVEL DE FRUSTRACIÓN:  [ ] Leve  [ ] Moderado  [ ] Mucho
```

---

---

# ✨ SECCIÓN C — MEJORAS SUGERIDAS

*Para funcionalidades nuevas o cambios que mejorarían la experiencia.*

---

### MEJORA #___

```
QUIÉN LO SUGIERE:    (rol y perfil)
MÓDULO/PANTALLA:
PRIORIDAD ESTIMADA:  [ ] Necesaria ya  [ ] Sería útil  [ ] Algún día

QUÉ QUIERE:
(en sus propias palabras)

POR QUÉ LO NECESITA:
(qué problema resuelve hoy con papel/WhatsApp/otro sistema)

CON QUÉ FRECUENCIA LO USARÍA:
[ ] Diario  [ ] Semanal  [ ] Raro

NOTAS ADICIONALES:
```

---

### MEJORA #___

```
QUIÉN LO SUGIERE:
MÓDULO/PANTALLA:
PRIORIDAD ESTIMADA:  [ ] Necesaria ya  [ ] Sería útil  [ ] Algún día

QUÉ QUIERE:

POR QUÉ LO NECESITA:

CON QUÉ FRECUENCIA LO USARÍA:
[ ] Diario  [ ] Semanal  [ ] Raro

NOTAS ADICIONALES:
```

---

---

# 📊 RESUMEN DE LA SESIÓN

*Completar al final de cada ronda de pruebas.*

```
Fecha:               _______________
Duración total:      _______________
Probado por:         _______________
Dispositivos usados: _______________

Módulos completados al 100%:
[ ] 1-Login    [ ] 2-Nav    [ ] 3-Dashboard  [ ] 4-Trabajos
[ ] 5-MyWork   [ ] 6-Clientes  [ ] 7-Citas   [ ] 8-Inventario
[ ] 9-Servicios [ ] 10-Personal [ ] 11-Reportes [ ] 12-Ventas
[ ] 13-Gastos  [ ] 14-Lealtad  [ ] 15-Usuarios [ ] 16-Sucursales

Bugs encontrados:         ___ (Bloqueantes: ___ / Importantes: ___ / Menores: ___)
Dificultades reportadas:  ___
Mejoras sugeridas:        ___

Evaluación general del sistema:
[ ] 😊 Fácil de usar   [ ] 😐 Aceptable   [ ] 😞 Difícil de usar

Comentario libre:
_______________________________________________________________
_______________________________________________________________
```
