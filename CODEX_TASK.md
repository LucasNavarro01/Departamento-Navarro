# CODEX TASK — Fase 2: Sincronización de Calendarios

## Contexto
Sitio web estático (index.html) de un departamento de alojamiento temporal en Malargüe, Argentina.
Deployado en Vercel. El sitio ya tiene una sección de reservas con un formulario de contacto.
Necesitamos agregar disponibilidad real sincronizada desde Booking.com y Airbnb via iCal.

## Stack
- Frontend: HTML/CSS/JS puro (sin frameworks, sin bundler)
- Backend: Vercel Serverless Functions (Node.js)
- Librería iCal: `node-ical` (ya en package.json)
- Calendar UI: Flatpickr (cargar desde CDN, sin npm)

---

## TAREA 1 — Crear `api/availability.js`

Crear el archivo `/api/availability.js` con el siguiente comportamiento:

```javascript
// Vercel serverless function
// GET /api/availability
// Respuesta: { blockedDates: ["2025-07-15", "2025-07-16", ...] }

// Variables de entorno requeridas (configurar en Vercel Dashboard):
//   BOOKING_ICAL_URL  → URL .ics exportada desde Booking.com
//   AIRBNB_ICAL_URL   → URL .ics exportada desde Airbnb (puede estar vacía)

// Comportamiento:
// 1. Leer BOOKING_ICAL_URL y AIRBNB_ICAL_URL desde process.env
// 2. Hacer fetch de cada URL que esté definida (ignorar las vacías)
// 3. Parsear el contenido iCal con node-ical (usar ical.sync.parseICS o async)
// 4. Extraer todos los eventos con status !== 'CANCELLED'
// 5. Para cada evento, generar todas las fechas individuales entre DTSTART y DTEND
// 6. Unir ambas listas, eliminar duplicados
// 7. Devolver JSON: { blockedDates: ["YYYY-MM-DD", ...], updatedAt: ISO_TIMESTAMP }
// 8. Header Cache-Control: public, max-age=900 (15 minutos)
// 9. Si ambas URLs están vacías o hay error, devolver { blockedDates: [], error: "mensaje" }
// 10. CORS headers ya están configurados en vercel.json
```

**Importante:** No bloquear DTEND — en iCal la fecha de checkout no cuenta como ocupada.

---

## TAREA 2 — Modificar `index.html`

Buscar la sección `<section id="reservas">` y hacer los siguientes cambios:

### 2a. Agregar Flatpickr en el `<head>`
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">
<script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/themes/airbnb.css">
```

### 2b. Reemplazar los inputs de fecha del formulario
Buscar los inputs de fecha existentes en el formulario de reservas y reemplazarlos por:
```html
<div class="fg date-range-wrap">
  <label>Fechas de estadía</label>
  <input type="text" id="date-range" placeholder="Seleccioná llegada — salida" readonly />
  <input type="hidden" id="checkin-hidden" name="checkin" />
  <input type="hidden" id="checkout-hidden" name="checkout" />
</div>
```

### 2c. Agregar bloque de disponibilidad antes del formulario
Dentro de `.res-grid`, antes del `<form>`, agregar:
```html
<div class="availability-status" id="avail-status">
  <span class="avail-dot loading"></span>
  <span class="avail-text">Cargando disponibilidad...</span>
</div>
```

### 2d. Agregar estilos en el `<style>` existente
```css
.availability-status { display:flex; align-items:center; gap:.5rem; margin-bottom:1rem; font-size:.85rem; }
.avail-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.avail-dot.loading { background:#C8960C; animation: pulse 1s infinite; }
.avail-dot.ok { background:#2D6A4F; }
.avail-dot.error { background:#C67B5C; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
.flatpickr-day.blocked { background:#FECACA !important; color:#991B1B !important; cursor:not-allowed; }
.flatpickr-day.blocked:hover { background:#FCA5A5 !important; }
```

### 2e. Agregar script al final del `<body>` (antes del cierre `</body>`)
```javascript
// Availability calendar
(async function initCalendar() {
  const statusEl = document.getElementById('avail-status');
  const dotEl = statusEl?.querySelector('.avail-dot');
  const textEl = statusEl?.querySelector('.avail-text');
  let blockedDates = [];

  try {
    const res = await fetch('/api/availability');
    const data = await res.json();
    blockedDates = data.blockedDates || [];
    if (dotEl) { dotEl.className = 'avail-dot ok'; }
    if (textEl) { textEl.textContent = blockedDates.length > 0
      ? 'Calendario actualizado — fechas en rojo no disponibles'
      : 'Todas las fechas disponibles'; }
  } catch (e) {
    if (dotEl) { dotEl.className = 'avail-dot error'; }
    if (textEl) { textEl.textContent = 'No se pudo cargar el calendario'; }
  }

  const input = document.getElementById('date-range');
  if (!input) return;

  flatpickr(input, {
    mode: 'range',
    minDate: 'today',
    dateFormat: 'd/m/Y',
    locale: 'es',
    disable: blockedDates,
    onDayCreate: function(dObj, dStr, fp, dayElem) {
      const dateStr = dayElem.dateObj.toISOString().split('T')[0];
      if (blockedDates.includes(dateStr)) {
        dayElem.classList.add('blocked');
      }
    },
    onChange: function(selectedDates) {
      if (selectedDates.length === 2) {
        const fmt = d => d.toISOString().split('T')[0];
        document.getElementById('checkin-hidden').value = fmt(selectedDates[0]);
        document.getElementById('checkout-hidden').value = fmt(selectedDates[1]);
      }
    }
  });
})();
```

---

## TAREA 3 — Agregar locale español de Flatpickr

En el mismo `<head>`, después de cargar flatpickr.min.js, agregar:
```html
<script src="https://cdn.jsdelivr.net/npm/flatpickr/dist/l10n/es.js"></script>
```

---

## Variables de entorno a configurar en Vercel

Después de hacer el deploy, el usuario debe ir a:
**Vercel Dashboard → departamento-navarro → Settings → Environment Variables**

Y agregar:
| Key | Value |
|-----|-------|
| `BOOKING_ICAL_URL` | URL .ics de Booking.com |
| `AIRBNB_ICAL_URL` | URL .ics de Airbnb (dejar vacío si no aplica) |

---

## Resultado esperado

- `/api/availability` responde con JSON de fechas bloqueadas
- El formulario de reservas muestra un date-range-picker
- Las fechas ocupadas en Booking o Airbnb aparecen bloqueadas en rojo
- Se actualiza automáticamente con cada deploy (cache 15 min)
- Si no hay env vars configuradas, el calendario igual funciona (muestra todo disponible)

## Commits sugeridos
```
feat: add Vercel serverless function for iCal calendar sync
feat: integrate Flatpickr availability calendar in booking form
```
