# CODEX TASK — Fase A: Cerrar días + Exportar calendario iCal a todas las plataformas

## Contexto (leer primero)
Lee `AGENTS.md` antes de empezar. Este es el sitio del **Departamento Navarro**, alojamiento temporario en Malargüe (Argentina). Stack:

- **Frontend:** HTML + CSS + JS vanilla, sin frameworks ni bundler (`index.html`, `admin.html`).
- **Backend:** Vercel Serverless Functions (Node.js 20) en `/api`.
- **Base de datos:** Supabase (PostgreSQL), accedida desde el backend vía REST con `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (env vars). Nunca hardcodear credenciales.
- **iCal:** librería `node-ical` (ya en package.json) para leer; para *generar* el `.ics` armar el texto a mano (no agregar dependencias nuevas).

### Estado actual relevante
- `api/availability.js` ya lee los iCal de Booking/Airbnb (`BOOKING_ICAL_URL`, `AIRBNB_ICAL_URL`) y devuelve `{ blockedDates: ["YYYY-MM-DD", ...] }`. La web usa esto para bloquear fechas en el calendario Flatpickr.
- `api/reservations.js` ya crea reservas directas (POST) en la tabla `reservations` de Supabase.
- El admin (`admin.html`) se autentica con una contraseña: el frontend guarda `ADMIN_PASSWORD` en `sessionStorage.admin_auth` y la manda en cada request. Los endpoints comparan contra `process.env.ADMIN_PASSWORD`. **Seguir exactamente este patrón** en los endpoints nuevos.

### Problema a resolver
Hoy la sincronización es de **una sola vía** (Booking/Airbnb → web). Falta el sentido inverso: que el dueño pueda **cerrar fechas específicas desde el admin** y que esas fechas **se exporten en un iCal propio** para que Booking y Airbnb las importen y bloqueen también. Resultado esperado: cerrar un día en un solo lugar (el admin) lo propaga a todas las plataformas conectadas.

---

## TAREA 1 — Tabla `blocked_dates` en Supabase
Generar el SQL (en un archivo `supabase/blocked-dates-schema.sql`) para ejecutar una vez:

```sql
create table if not exists public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,           -- exclusiva (checkout): el día end_date NO se bloquea
  reason text,                      -- ej: "Mantenimiento", "Uso personal"
  created_at timestamptz not null default now()
);
alter table public.blocked_dates enable row level security;
create policy "Service full access blocked_dates"
  on public.blocked_dates for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create index if not exists blocked_dates_range_idx on public.blocked_dates (start_date, end_date);
```

---

## TAREA 2 — Endpoint `api/blocked-dates.js` (CRUD para el admin)
Crear `api/blocked-dates.js` con autenticación por `ADMIN_PASSWORD` (mismo patrón que `update-config.js`). Usar las helpers de Supabase REST que ya existen en `api/_lib/supabase.js`.

- **GET** `?password=...` → devuelve `{ data: [ {id, start_date, end_date, reason}, ... ] }` ordenado por `start_date`.
- **POST** body `{ password, start_date, end_date, reason }` → inserta un rango. Validar que `start_date < end_date` y formato `YYYY-MM-DD`. Devolver `{ ok: true, data: <fila> }`.
- **DELETE** `?password=...&id=...` → elimina el rango. Devolver `{ ok: true }`.
- Manejar `OPTIONS` (204) y métodos no permitidos (405). Errores con status correcto y `{ error: "mensaje" }`.
- Si falta `ADMIN_PASSWORD` o no coincide → 401 `{ error: "Unauthorized" }`.

---

## TAREA 3 — Endpoint `api/calendar.ics` (exportación iCal pública)
Crear `api/calendar.ics.js` que devuelva un calendario iCal **público** (sin contraseña; es una URL secreta que se pega en Booking/Airbnb) con `Content-Type: text/calendar; charset=utf-8`.

El `.ics` debe contener un `VEVENT` por cada bloqueo de fechas, combinando dos fuentes:
1. **Reservas directas confirmadas** de la tabla `reservations` (`status = 'confirmed'` y, si aplica, `'pending'` — decidir y documentar; recomendado bloquear `confirmed` y `pending` para evitar sobreventa). Usar `checkin` → `checkout`.
2. **Bloqueos manuales** de `blocked_dates` (`start_date` → `end_date`).

Reglas del iCal:
- Cabecera estándar: `BEGIN:VCALENDAR`, `VERSION:2.0`, `PRODID:-//Departamento Navarro//Reservas//ES`, `CALSCALE:GREGORIAN`.
- Cada evento: `UID` único y estable (ej: `reserva-<id>@departamento-navarro` o `bloqueo-<id>@...`), `DTSTART;VALUE=DATE:YYYYMMDD`, `DTEND;VALUE=DATE:YYYYMMDD` (la fecha de checkout/`end_date` es **exclusiva**, no se ocupa), `SUMMARY` (ej: "Reservado" o "No disponible"), `DTSTAMP`.
- Header `Cache-Control: public, max-age=900` (15 min).
- Si hay error leyendo Supabase, devolver igualmente un VCALENDAR válido y vacío (no romper el feed que consumen Booking/Airbnb).

> **Nota:** generar el texto del `.ics` manualmente con plantillas de string. No agregar librerías. Respetar los saltos de línea CRLF (`\r\n`) que pide el estándar iCal.

---

## TAREA 4 — Sumar los bloqueos manuales a `api/availability.js`
Modificar `api/availability.js` para que, además de los iCal de Booking/Airbnb, **incluya las fechas de `blocked_dates`** en el array `blockedDates` que ya devuelve. Así la web también bloquea en su calendario las fechas que el dueño cerró manualmente. Mantener compatibilidad total con la respuesta actual (`{ blockedDates, updatedAt }`).

---

## TAREA 5 — Nueva pestaña "Calendario" en `admin.html`
Agregar una pestaña **"Calendario"** al panel (junto a Estado, Precios, Contacto, Comodidades, Fotos), respetando el estilo existente (misma paleta, mismos componentes de form/tabs). Debe permitir:

- **Cerrar un rango de fechas:** dos inputs de fecha (desde / hasta) + un campo opcional "motivo" + botón "Cerrar fechas". Idealmente usar Flatpickr en modo rango (ya se carga por CDN en el sitio).
- **Listar los bloqueos activos** (trayendo de `GET /api/blocked-dates`) con un botón para **eliminar** cada uno (DELETE).
- Usar `state.password` / `sessionStorage.admin_auth` para autenticar las requests, igual que el resto del panel.
- Mostrar un cartel de ayuda explicando: *"Las fechas cerradas se exportan en tu calendario iCal. Booking y Airbnb las importan automáticamente cada pocas horas (no es instantáneo)."*
- Mostrar la **URL del iCal de exportación** (`/api/calendar.ics`) con un botón "Copiar", e instrucciones cortas de dónde pegarla en Booking y Airbnb.

---

## TAREA 6 — `vercel.json` y documentación
- Verificar que `api/calendar.ics.js` se sirva correctamente (la URL pública debe ser `/api/calendar.ics`). Ajustar `vercel.json` con un `rewrite` si hace falta para que la extensión `.ics` funcione.
- Actualizar `AGENTS.md` y `README.md` con: las nuevas env vars (ninguna nueva, reutiliza `SUPABASE_*` y `ADMIN_PASSWORD`), la URL de exportación iCal y el paso manual de pegarla en Booking/Airbnb.

---

## Criterios de aceptación
- [ ] El dueño puede cerrar un rango de fechas desde `/admin` → pestaña Calendario, y verlo listado.
- [ ] Esas fechas aparecen bloqueadas en el calendario público de `index.html`.
- [ ] `GET /api/calendar.ics` devuelve un iCal válido que incluye reservas confirmadas + bloqueos manuales, importable por Booking/Airbnb.
- [ ] La fecha de checkout / fin de rango es exclusiva (no se bloquea de más).
- [ ] Todos los endpoints nuevos del admin exigen `ADMIN_PASSWORD`; el `.ics` es público.
- [ ] No se agregaron dependencias npm nuevas. Estilo y patrones consistentes con el código existente.

## Restricciones
- No romper endpoints ni el HTML existentes. Cambios mínimos y consistentes con el estilo actual.
- No hardcodear credenciales. Nada de frameworks ni build steps nuevos.
- Mensajes de UI y comentarios en español.
