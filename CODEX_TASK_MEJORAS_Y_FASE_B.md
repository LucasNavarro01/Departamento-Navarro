# CODEX TASK — Correcciones de diseño/accesibilidad + Fase B (Login + Fidelidad)

## Contexto (leer primero)
Leé `AGENTS.md`. Sitio del **Departamento Navarro** (Malargüe, Argentina). Stack: HTML/CSS/JS vanilla (`index.html`, `admin.html`), Vercel Serverless Functions en `/api`, Supabase (REST con `SUPABASE_SERVICE_KEY`). Sin frameworks ni build steps ni dependencias npm nuevas. **Todos los archivos deben guardarse en UTF-8.** Mensajes de UI y comentarios en español.

Esta tarea tiene **dos partes**: primero corregís lo que ya está implementado (Parte 1) y después desarrollás la Fase B (Parte 2). Hacelas en ese orden.

---

# PARTE 1 — Correcciones a la implementación actual

## 1.1 — Arreglar caracteres rotos (mojibake) · prioridad alta
Hay símbolos que quedaron como `?`. Reemplazar por el carácter correcto y **guardar en UTF-8**:

- `admin.html` línea ~252: botón "Mes anterior" → usar `‹` (o `←`) como texto visible.
- `admin.html` línea ~253: botón "Mes siguiente" → usar `›` (o `→`).
- `admin.html` línea ~386: botón de quitar comodidad → usar `✕`.
- `admin.html` línea ~543: status → `✓ Calendario actualizado`.
- Revisá **todo** `admin.html` e `index.html` por más casos (buscá `?` sospechosos dentro de strings JS, `aria-label`, y textos). En `index.html` el texto del precio quedó `por noche ? segun cantidad de huespedes`: debe ser `por noche · según cantidad de huéspedes`.
- Verificá tildes y `ñ` en todos los textos nuevos (huéspedes, según, mínimo, capacidad, etc.).

## 1.2 — Bug de zona horaria en el calendario del admin · prioridad alta
En `admin.html`, `toDateKey()` usa `date.toISOString().slice(0,10)`, que convierte a **UTC**. En Argentina (UTC−3), cerca de medianoche el "hoy" y las claves de fecha pueden quedar corridos un día. Reemplazar por una función que arme la clave desde los componentes **locales**:

```js
function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
```

Revisar que `addDays`, el resaltado de "hoy" y la selección de rangos sigan funcionando con este cambio.

## 1.3 — Consistencia de precios y mínimo de noches · prioridad media
- En `index.html` hay textos hardcodeados que contradicen la config: línea ~511 `Estadía mínima · 2 noches` y línea ~484 "sea de 2 noches". Hacer que `applySiteConfig()` actualice el valor de estadía mínima desde la config (en vez de quedar fijo), y ajustar el texto para que no quede contradictorio.
- Simplificar el mínimo de noches: usar **un solo** `min_nights_low` como mínimo predeterminado + las reglas por fecha de `calendar_rules` para casos puntuales. Eliminar la lógica de temporada `min_nights_high` de `index.html` (línea ~989) y el kludge en `admin.html` `saveSection` que guarda `min_nights_high = min_nights_low`. Si preferís conservar temporada alta/baja, entonces exponé **ambos** campos en el tab Precios del admin; no dejes un campo fantasma.

## 1.4 — Accesibilidad (WCAG AA) en `admin.html` · prioridad alta
- **Tabs accesibles:** a cada `.tab` agregarle `role="tab"`, `aria-selected="true|false"`, `aria-controls="<id-seccion>"` y `id`. A cada `.section` agregarle `role="tabpanel"` y `aria-labelledby` apuntando al tab. Implementar navegación por teclado: flechas izquierda/derecha mueven el foco entre tabs (roving `tabindex`), Enter/Espacio activan.
- **Foco visible en TODOS los interactivos:** hoy solo los `input` tienen estilo de foco. Agregar una regla global, por ejemplo:
  ```css
  button:focus-visible, .tab:focus-visible, .calendar-day:focus-visible, .segmented button:focus-visible, a:focus-visible {
    outline: 3px solid var(--terracotta); outline-offset: 2px;
  }
  ```
- **Días del calendario:** cada `.calendar-day` (que ya es `<button>`) debe tener un `aria-label` descriptivo, ej: `"3 de julio de 2026, cerrado, $30.000 por noche, mínimo 1 noche"`. El estado "cerrado"/"seleccionado" no debe depender **solo del color**: "cerrado" ya tiene tachado + texto "Cerrado" (ok); a "seleccionado" agregarle un indicador no cromático (ej: un `✓` o un borde marcado) y `aria-pressed`.
- **Contraste:** `.calendar-day.muted { opacity:.38 }` probablemente no cumple contraste de texto. Subir a un gris legible (o usar `color: var(--muted)` con opacidad ≥ .6). Verificar que el texto de `.day-meta` (.78rem) sea legible.
- **Targets táctiles:** el botón de quitar chip (22px) y los `?`/`✕` deben ser ≥ 24px (idealmente 44px de área clickeable).
- **Status como live region:** los `.status` deben tener `aria-live="polite"` para que el lector anuncie "Guardado".
- **Calendario responsive:** hoy `.calendar-grid` fuerza `min-width:720px` → scroll horizontal en celular. El dueño puede administrar desde el teléfono, así que en pantallas chicas reducí el tamaño de celda y la metadata (mostrar solo número de día + estado, ocultar precio/min con un `@media`) para que el mes entre sin scroll horizontal. La usabilidad en mobile es obligatoria.

## 1.5 — Presupuesto en vivo en el formulario de reserva · prioridad alta (FUNCIONAL)
Hoy el precio por huésped y por fecha se calcula en el backend pero **el huésped no ve ningún precio** antes de enviar. Hay que mostrarlo en vivo.

1. Crear endpoint **`GET /api/quote?checkin=YYYY-MM-DD&checkout=YYYY-MM-DD&guests=N`** que reutilice la lógica de `calculateStay` de `api/reservations.js` (extraer esa lógica a `api/_lib/pricing.js` para no duplicar) y devuelva:
   ```json
   { "nights": 4, "nightlyRates": [30000,30000,35000,35000], "subtotal": 130000,
     "minNights": 2, "meetsMinNights": true, "guests": 2 }
   ```
   Público (sin contraseña). Validar fechas; si faltan, 400.
2. En `index.html`, cuando el usuario tenga fechas (Flatpickr) y huéspedes seleccionados, llamar a `/api/quote` y mostrar un **desglose**: noches × tarifa, subtotal, y un aviso si no cumple el mínimo de noches (deshabilitando el envío en ese caso). Mantener el flujo de contacto por WhatsApp, pero ahora el mensaje de WhatsApp debe incluir el resumen (fechas, huéspedes, total estimado).
3. Dejar el desglose preparado para que la Parte 2 le agregue una línea de **descuento** cuando el usuario esté logueado.

## 1.6 — Verificación Parte 1
- [ ] No quedan caracteres `?` fuera de lugar; tildes y `ñ` correctas; archivos en UTF-8.
- [ ] El calendario marca el día correcto en horario argentino.
- [ ] El admin es navegable por teclado con foco visible; tabs con ARIA; calendario usable en mobile.
- [ ] El formulario público muestra un presupuesto en vivo y valida el mínimo de noches.

---

# PARTE 2 — Fase B: Login opcional + Descuentos por fidelidad

## Objetivo
Un huésped puede **opcionalmente** iniciar sesión y obtener un descuento en su **próxima** reserva según cuántas estadías directas completó. El login NO es obligatorio: sin sesión se reserva igual al precio normal.

## Modelo de descuento (decidido)
- Se cuenta por **estadías directas completadas** (no por noches), porque coincide con el modelo del negocio y es transparente.
- Una estadía cuenta solo si: `source = 'direct'` **y** `status = 'completed'` (check-out cumplido). No suman las reservas de Booking/Airbnb ni las pendientes.
- El descuento aplica a la **próxima** reserva, nunca a la actual.
- Tabla de niveles (tope 18% para proteger margen):

  | Estadías directas completadas | Descuento próxima reserva | Nivel |
  |---|---|---|
  | 0 | 0% (precio normal) | Nuevo |
  | 1 | 10% | Recurrente |
  | 2 | 15% | Frecuente |
  | 3 o más | 18% | Embajador |

## 2.1 — Ajustar la lógica de niveles
- Actualizar `api/_lib/coupons.js` → `getCouponTier(count)` a la tabla de arriba (1→10, 2→15, 3+→18; 0→0). Ajustar `next` para mostrar cuánto falta para el próximo nivel.
- El conteo (`count`) debe ser **estadías directas completadas** del usuario. Definir cómo se obtiene: contar `reservations` con `user_id = <usuario>`, `source='direct'`, `status='completed'`. Mantener `loyalty_profiles.reservation_count` como cache opcional, pero la fuente de verdad es el conteo de reservas completadas.

## 2.2 — Construir las páginas de auth (hoy son stubs)
Usar el backend de Supabase Auth que ya existe (`api/auth/*`, `api/_lib/auth.js`). Respetar la paleta/tipografía del sitio (terracotta/brown/cream, Playfair + Inter).

- **`login.html`:** botón "Continuar con Google" (Supabase OAuth, ya soportado) + opción email/magic link. Mensaje claro de que el login es **opcional** y para qué sirve (descuentos). Link de volver al sitio.
- **`auth-callback.html`:** procesa el retorno de Supabase (token en el hash/URL), crea la sesión vía `api/auth/session`, y redirige a `cuenta.html` (o a `reservar` si venía de reservar).
- **`cuenta.html`:** panel del huésped autenticado que muestre:
  - Nombre, nivel actual y **% de descuento** vigente.
  - Cuántas estadías lleva y **cuánto falta** para el próximo nivel (barra de progreso).
  - Su **código/etiqueta** de descuento (de `api/coupons/me`).
  - **Historial de reservas** (de `api/reservations/me`): fechas, estado, total.
  - Botón de cerrar sesión.
- `reservar.html` puede quedar como redirección a la sección `#reservas` del index, o eliminarse si no se usa.

## 2.3 — Integrar el descuento en el flujo público
- En `index.html`: detectar si hay sesión (consultar `api/me` o `api/coupons/me`). Si la hay, mostrar arriba un saludo ("Hola, {nombre} · {nivel}") y un link a la cuenta; si no, un link discreto "Iniciá sesión y obtené descuentos" (no intrusivo).
- En el **presupuesto en vivo** (de la Parte 1.5): si hay sesión con descuento > 0, agregar la línea de descuento y el total final. El `/api/quote` debe aceptar la sesión (cookie) y, si corresponde, devolver `discountPct`, `discountAmount` y `total`. **El descuento se calcula y valida en el backend**, nunca confiando en el cliente.
- Al crear la reserva (`POST /api/reservations`), persistir `discount_pct`, `discount_amount` y `total` (esos campos ya existen en el schema `loyalty-auth-schema.sql`) y asociar `user_id` si hay sesión.

## 2.4 — Marcar estadías como completadas (para que sumen al contador)
El descuento depende de tener reservas en estado `completed`. Agregar el mecanismo para que el dueño las marque:

- **Nuevo tab "Reservas" en `admin.html`** (autenticado con `ADMIN_PASSWORD`, mismo patrón): lista las reservas (`GET /api/reservations?password=...`, que ya existe) con fechas, huésped, estado y total. Botones para cambiar estado: **Confirmar** (`pending`→`confirmed`), **Completar** (`confirmed`→`completed`) y **Cancelar**.
- Crear el endpoint para actualizar estado, ej: `PATCH /api/reservations` o `POST /api/reservations/status` con `{ password, id, status }`, usando `restPatch` de `_lib/supabase.js`. Validar transiciones de estado.
- Al pasar a `completed`, el conteo de fidelidad del usuario sube automáticamente (porque 2.1 cuenta reservas completed). Si usás el cache `loyalty_profiles.reservation_count`, actualizalo acá.
- Esto además cierra un faltante de la Fase A: el dueño no tenía forma de ver/gestionar reservas.

## 2.5 — Reglas y seguridad
- El login es **opcional**: todo el flujo de reserva debe funcionar sin sesión, a precio normal.
- Nunca confiar en el cliente para el descuento: calcularlo y validarlo en el backend a partir de la sesión.
- No promocionar el descuento dentro de mensajes de Booking/Airbnb (solo en la web propia).
- Mantener accesibilidad (Parte 1) también en las páginas nuevas: foco visible, labels, contraste, navegable por teclado.

## 2.6 — Documentación
- Actualizar `AGENTS.md` y `README.md`: nuevas páginas (`login`, `cuenta`), endpoint `/api/quote`, modelo de descuento 10/15/18% por estadía completada, y el tab Reservas del admin. Aclarar variables de entorno necesarias para OAuth de Supabase (las que ya use `api/auth/*`).

## 2.7 — Criterios de aceptación (Fase B)
- [ ] Un huésped puede iniciar sesión con Google/email desde `login.html` y vuelve correctamente vía `auth-callback.html`.
- [ ] `cuenta.html` muestra nivel, % de descuento, progreso al próximo nivel e historial.
- [ ] Con sesión y ≥1 estadía completada, el presupuesto del index muestra el descuento (10/15/18%) y el total con el descuento aplicado, validado en backend.
- [ ] Sin sesión, todo funciona normal a precio lleno.
- [ ] El dueño puede confirmar/completar/cancelar reservas desde el nuevo tab "Reservas", y completar una estadía sube el nivel del huésped.
- [ ] Sin dependencias npm nuevas; estilo consistente; accesible; archivos en UTF-8.

## Restricciones generales
- No romper endpoints ni HTML existentes. Cambios mínimos y consistentes con el código actual.
- No hardcodear credenciales. Nada de frameworks ni build steps.
- Reutilizar helpers existentes (`_lib/http`, `_lib/supabase`, `_lib/auth`, `_lib/coupons`).
