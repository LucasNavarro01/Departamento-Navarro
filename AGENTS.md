# Contexto del Proyecto — Departamento Navarro

## ¿Qué es este proyecto?
Sitio web oficial de un departamento de alojamiento temporario en **Malargüe, Mendoza, Argentina**.
El objetivo es doble:
1. Ser el sitio real del Departamento Navarro para recibir reservas directas
2. Servir como **plantilla replicable** para vender el servicio de web a otros alojamientos

## Estado actual
- `index.html` — sitio completo en un solo archivo HTML (sin frameworks, sin bundler)
- `fotos/` — fotografías reales del departamento
- Deployado en **Vercel** (free tier, Hobby plan)
- Repositorio: GitHub → `LucasNavarro01/Departamento-Navarro`

## Diseño y estilo
- Paleta: terracotta `#C67B5C`, sand `#EDE3D0`, cream `#F5F0E1`, brown `#3D2B1F`
- Tipografía: Playfair Display (títulos) + Inter (cuerpo) — Google Fonts
- Diseño responsive: breakpoints en 1024px, 768px, 480px
- Sin dependencias de npm en el frontend — todo por CDN o vanilla JS
- Score Booking.com: **9.6 / 10**

## Propiedad
- **Dirección:** Calle El Payén 466, Malargüe, Mendoza (5613)
- **Capacidad:** hasta 6 huéspedes · 2 dormitorios · 65 m²
- **Booking.com:** https://www.booking.com/hotel/ar/departamento-navarro-malargue.es-ar.html
- **Coordenadas:** -35.47054844, -69.57000147

## Stack técnico
```
Frontend:   HTML + CSS + Vanilla JS (index.html)
Backend:    Vercel Serverless Functions (Node.js 20) → carpeta /api
Base datos: Supabase (PostgreSQL) ✅ CONFIGURADO
Agente IA:  Claude API (Anthropic) — Fase 3
Mensajería: WhatsApp Business API — Fase 3
```

## Supabase
- **Project URL:** `https://jdqjweuzwtsxderzttqx.supabase.com`
- **Tabla principal:** `property_config` — almacena configuración como pares key/value (jsonb)
- **Tabla de bloqueos:** `blocked_dates` — rangos cerrados manualmente desde `/admin`, con `end_date` exclusivo
- **Tabla de reglas:** `calendar_rules` — precio por noche y mínimo de noches por rango, con `end_date` exclusivo
- Las credenciales (anon key, service key) están en Vercel env vars — nunca hardcodear en el código

## Calendarios iCal
- Importación hacia la web: `api/availability.js` lee `BOOKING_ICAL_URL` y `AIRBNB_ICAL_URL`
- Exportación pública para plataformas: `/api/calendar.ics`
- El feed exporta reservas directas `confirmed` y `pending`, más bloqueos manuales de `blocked_dates`
- Pegar la URL pública de `/api/calendar.ics` en Booking/Airbnb para que esas plataformas importen los cierres. La actualización externa puede tardar varias horas y no es instantánea.
- El admin usa `/api/calendar-settings` para aplicar en un rango: abrir/cerrar, precio por noche y mínimo de noches.
- `property_config.price_by_guests` guarda precios editables por cantidad de huéspedes (1 a 6).

## Roadmap de fases
- **Fase 1** ✅ Sitio en vivo en Vercel + GitHub
- **Fase 2** 🔄 Calendarios iCal (Booking + Airbnb) → `CODEX_TASK.md`
- **Fase 2.5** 🔄 Panel de administración `/admin` → `CODEX_TASK_ADMIN.md`
- **Fase 3** ⏳ Agente IA de reservas (Claude API + WhatsApp)
- **Fase 4** ⏳ Automatización completa + plantilla multi-propiedad

## Variables de entorno en Vercel
| Variable | Descripción | Estado |
|----------|-------------|--------|
| `SUPABASE_URL` | `https://jdqjweuzwtsxderzttqx.supabase.com` | ✅ Lista |
| `SUPABASE_ANON_KEY` | Anon public key de Supabase | ✅ Lista |
| `SUPABASE_SERVICE_KEY` | Service role key de Supabase | ✅ Lista |
| `ADMIN_PASSWORD` | Contraseña para acceder a /admin | ✅ Lista |
| `BOOKING_ICAL_URL` | URL .ics de Booking.com Extranet | ⏳ Pendiente |
| `AIRBNB_ICAL_URL` | URL .ics de Airbnb | ⏳ Pendiente |
| `ANTHROPIC_API_KEY` | API key de Claude (Fase 3) | ⏳ Pendiente |
| `WHATSAPP_TOKEN` | Token de WhatsApp Business API (Fase 3) | ⏳ Pendiente |

No se requieren variables nuevas para exportar el calendario iCal; reutiliza `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`/`SUPABASE_SERVICE_ROLE_KEY` y `ADMIN_PASSWORD`.

## Convenciones de código
- Funciones serverless en `/api/*.js` — cada archivo = un endpoint
- Nombres de endpoint en kebab-case: `/api/availability`, `/api/config`, `/api/update-config`, `/api/chat`
- Respuestas JSON siempre con estructura `{ data, error, updatedAt }`
- Frontend llama a las APIs con `fetch('/api/...')` — sin URLs hardcodeadas
- Commits en inglés, formato: `feat:`, `fix:`, `chore:`

## Tareas para Codex
- `CODEX_TASK.md` — Fase 2: calendario de disponibilidad iCal
- `CODEX_TASK_ADMIN.md` — Fase 2.5: panel de administración con Supabase
