# CODEX TASK — Reservas directas + Exportación de calendario iCal

## Contexto
Leer AGENTS.md antes de empezar.
Esta tarea cierra el loop de sincronización bidireccional de calendarios:
- Fase 2 (ya implementada): Booking/Airbnb → web (el sitio lee sus iCal y bloquea fechas)
- Esta tarea: web → Booking/Airbnb (las reservas directas del sitio se exportan como iCal
  y Booking + Airbnb las importan automáticamente para bloquear esas fechas allá también)

## Prerequisito — Crear tabla en Supabase (ejecutar manualmente una sola vez)

Ir a Supabase → SQL Editor → ejecutar:

```sql
create table reservations (
  id uuid default gen_random_uuid() primary key,
  checkin date not null,
  checkout date not null,
  guest_name text not null,
  guest_email text,
  guest_phone text,
  num_guests integer default 1,
  message text,
  source text default 'direct',  -- 'direct' | 'booking' | 'airbnb'
  status text default 'pending',  -- 'pending' | 'confirmed' | 'cancelled'
  created_at timestamptz default now()
);

alter table reservations enable row level security;

-- Solo el service_role puede leer y escribir reservas
create policy "Service full access"
  on reservations for all
  using (auth.role() = 'service_role');

-- Índices para consultas frecuentes
create index on reservations (checkin, checkout);
create index on reservations (status);
```

---

## TAREA 1 — Crear `api/reservations.js`

### POST /api/reservations — Crear una reserva nueva

```
Body: {
  checkin: "2025-08-10",       // YYYY-MM-DD
  checkout: "2025-08-14",
  guest_name: "Juan Pérez",
  guest_email: "juan@email.com",
  guest_phone: "+5492604123456",
  num_guests: 2,
  message: "Llegamos a las 15hs"
}

Respuesta éxito: { ok: true, id: "uuid", message: "Reserva recibida" }
Respuesta error: { ok: false, error: "descripción del error" }
```

**Validaciones:**
- `checkin`, `checkout` y `guest_name` son obligatorios — si faltan: 400
- `checkout` debe ser posterior a `checkin` — si no: 400
- Verificar que no haya conflicto con reservas existentes en esas fechas:
  - SELECT de reservations donde status != 'cancelled' y hay overlap con el rango pedido
  - Si hay overlap: 409, `{ ok: false, error: "Las fechas seleccionadas no están disponibles" }`
- Usar `SUPABASE_SERVICE_KEY` para el insert
- Después de insertar, enviar notificación al propietario (ver Tarea 3)

### GET /api/reservations — Listar reservas (protegido con ADMIN_PASSWORD)

```
Query params: ?password=xxx&month=2025-08 (opcional)
Respuesta: { reservations: [...] }
```
- Verificar password contra `process.env.ADMIN_PASSWORD`
- Si no hay `month`, devolver las próximas 90 días
- Si hay `month` (formato YYYY-MM), filtrar por ese mes

---

## TAREA 2 — Crear `api/calendar.ics`

### GET /api/calendar.ics — Exportar reservas como iCal estándar (RFC 5545)

```
Content-Type: text/calendar; charset=utf-8
Cache-Control: public, max-age=3600 (1 hora)
```

**Comportamiento:**
1. Leer todas las reservas con `status = 'confirmed'` desde Supabase (usar SUPABASE_SERVICE_KEY)
2. Generar el archivo iCal con el siguiente formato:

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Departamento Navarro//Malargue AR//ES
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Departamento Navarro - Reservas
X-WR-CALDESC:Reservas directas del Departamento Navarro en Malargüe
REFRESH-INTERVAL;VALUE=DURATION:PT1H

(un bloque VEVENT por cada reserva)

BEGIN:VEVENT
UID:{reservation.id}@departamento-navarro.vercel.app
DTSTART;VALUE=DATE:{checkin en formato YYYYMMDD}
DTEND;VALUE=DATE:{checkout en formato YYYYMMDD}
SUMMARY:Reservado
DESCRIPTION:Reserva directa
STATUS:CONFIRMED
TRANSP:OPAQUE
END:VEVENT

END:VCALENDAR
```

**Notas importantes:**
- `DTEND` debe ser el día del checkout (Booking y Airbnb lo interpretan como "hasta ese día")
- `SUMMARY` debe ser genérico ("Reservado") para no exponer datos del huésped en plataformas externas
- Si Supabase falla, devolver un iCal mínimo válido con VCALENDAR vacío (no un error HTTP)
- No incluir reservas con status 'cancelled'

---

## TAREA 3 — Crear `api/notify.js` (helper interno)

Función interna (no expuesta como endpoint público) que envía un email/WhatsApp al propietario cuando llega una reserva nueva.

Por ahora implementar solo el email vía **Resend** (https://resend.com — free tier: 3000 emails/mes):

```javascript
// api/_notify.js  (el underscore indica que NO es un endpoint público en Vercel)
// Exportar: async function notifyOwner(reservation) { ... }

// Si RESEND_API_KEY no está configurada, loggear y retornar sin error
// Email destino: leer de env var OWNER_EMAIL
// Asunto: "Nueva reserva — {guest_name} · {checkin} al {checkout}"
// Cuerpo HTML simple con los datos de la reserva
```

Agregar a las variables de entorno requeridas:
- `RESEND_API_KEY` — API key de Resend (registrarse en resend.com)
- `OWNER_EMAIL` — email del propietario para recibir notificaciones

Agregar a package.json: `"resend": "^3.0.0"`

---

## TAREA 4 — Modificar `index.html`

### 4a. Actualizar el formulario de reservas
El formulario actual envía los datos pero no los guarda en ningún lado. Conectarlo a `/api/reservations`:

```javascript
// Reemplazar el handler del formulario existente por:
reservationForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  const btn = this.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  const body = {
    checkin: document.getElementById('checkin-hidden')?.value || '',
    checkout: document.getElementById('checkout-hidden')?.value || '',
    guest_name: this.querySelector('[name="nombre"]')?.value || '',
    guest_email: this.querySelector('[name="email"]')?.value || '',
    guest_phone: this.querySelector('[name="telefono"]')?.value || '',
    num_guests: parseInt(this.querySelector('[name="personas"]')?.value) || 1,
    message: this.querySelector('textarea')?.value || ''
  };

  try {
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (data.ok) {
      // Mostrar el estado de éxito que ya existe en el HTML
      document.getElementById('form-success')?.style.setProperty('display', 'flex');
      this.style.display = 'none';
    } else {
      alert(data.error || 'Hubo un problema. Por favor intentá de nuevo.');
      btn.disabled = false;
      btn.textContent = 'Enviar consulta →';
    }
  } catch {
    alert('Error de conexión. Por favor intentá de nuevo.');
    btn.disabled = false;
    btn.textContent = 'Enviar consulta →';
  }
});
```

### 4b. Agregar atributos `name` a los campos del formulario
Verificar que los inputs del formulario tengan los atributos `name` correctos:
- Campo nombre del huésped → `name="nombre"`
- Campo email → `name="email"`
- Campo teléfono → `name="telefono"`
- Campo cantidad de personas → `name="personas"`

---

## TAREA 5 — Instrucciones para el propietario (agregar a admin.html)

En el panel `/admin`, agregar una sección "📅 Sincronización de calendarios" con las instrucciones para configurar la importación en cada plataforma:

```html
<!-- Sección de instrucciones iCal export -->
<div class="admin-section">
  <h3>📅 Tu URL de calendario para exportar</h3>
  <p>Compartí esta URL con Booking.com y Airbnb para que bloqueen automáticamente
     las reservas que recibís por esta web:</p>
  <div class="ical-url-box">
    <code id="ical-url">https://TU-DOMINIO.vercel.app/api/calendar.ics</code>
    <button onclick="copyIcalUrl()">Copiar</button>
  </div>

  <details>
    <summary>¿Cómo configurarlo en Booking.com?</summary>
    <ol>
      <li>Entrá a Booking.com Extranet → Calendario</li>
      <li>Clic en "Sincronizar calendario"</li>
      <li>Seleccioná "Importar calendario"</li>
      <li>Pegá la URL de arriba y guardá</li>
      <li>Booking actualiza el bloqueo automáticamente cada 2-4 horas</li>
    </ol>
  </details>

  <details>
    <summary>¿Cómo configurarlo en Airbnb?</summary>
    <ol>
      <li>Andá a Airbnb → Anfitrión → Calendario</li>
      <li>Configuración → Sincronización de disponibilidad</li>
      <li>Clic en "Conectar calendarios"</li>
      <li>Seleccioná "Importar calendario" y pegá la URL</li>
      <li>Airbnb actualiza el bloqueo cada 1-2 horas</li>
    </ol>
  </details>
</div>
```

El `id="ical-url"` debe mostrar la URL real — usar `window.location.origin + '/api/calendar.ics'`.

---

## Estructura de archivos resultante
```
├── index.html              (modificado — formulario conectado a API)
├── admin.html              (modificado — sección de instrucciones iCal)
├── api/
│   ├── availability.js     (Fase 2 — ya implementado)
│   ├── config.js           (Admin — lectura pública)
│   ├── update-config.js    (Admin — escritura protegida)
│   ├── reservations.js     (NUEVO — crear/listar reservas)
│   ├── calendar.ics.js     (NUEVO — exportar iCal)
│   └── _notify.js          (NUEVO — helper de notificaciones, no endpoint público)
```

## Variables de entorno nuevas a agregar en Vercel
| Variable | Descripción |
|----------|-------------|
| `RESEND_API_KEY` | API key de Resend (registrarse gratis en resend.com) |
| `OWNER_EMAIL` | Email del propietario para recibir notificaciones de reserva |

## Commits sugeridos
```
feat: add reservations table integration and POST /api/reservations
feat: add GET /api/calendar.ics iCal export for Booking/Airbnb sync
feat: connect booking form to reservations API
feat: add owner email notifications via Resend
chore: add iCal export instructions to admin panel
```
