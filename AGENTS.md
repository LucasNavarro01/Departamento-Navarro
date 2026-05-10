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

## Stack técnico (presente y futuro)
```
Frontend:   HTML + CSS + Vanilla JS (index.html)
Backend:    Vercel Serverless Functions (Node.js 20) → carpeta /api
Base datos: Supabase (PostgreSQL) — a implementar en Fase 3
Agente IA:  Claude API (Anthropic) — a implementar en Fase 3
Mensajería: WhatsApp Business API — a implementar en Fase 3
```

## Roadmap de fases
- **Fase 1** ✅ Sitio en vivo en Vercel + GitHub
- **Fase 2** 🔄 Sincronización de calendarios Booking.com + Airbnb (iCal) → ver `CODEX_TASK.md`
- **Fase 3** ⏳ Agente IA de reservas (Claude API + Supabase + WhatsApp)
- **Fase 4** ⏳ Automatización completa + panel admin + plantilla multi-propiedad

## Variables de entorno (Vercel Dashboard → Settings → Environment Variables)
| Variable | Descripción |
|----------|-------------|
| `BOOKING_ICAL_URL` | URL .ics exportada desde Booking.com Extranet |
| `AIRBNB_ICAL_URL` | URL .ics exportada desde Airbnb (puede estar vacía) |
| `ANTHROPIC_API_KEY` | API key de Claude (Fase 3) |
| `SUPABASE_URL` | URL del proyecto Supabase (Fase 3) |
| `SUPABASE_ANON_KEY` | Anon key de Supabase (Fase 3) |
| `WHATSAPP_TOKEN` | Token de WhatsApp Business API (Fase 3) |

## Convenciones de código
- Funciones serverless en `/api/*.js` — cada archivo = un endpoint
- Nombres de endpoint en kebab-case: `/api/availability`, `/api/reservations`, `/api/chat`
- Respuestas JSON siempre con estructura `{ data, error, updatedAt }`
- Frontend llama a las APIs con `fetch('/api/...')` — sin URLs hardcodeadas
- Commits en inglés, formato: `feat:`, `fix:`, `chore:`

## Tarea actual
Ver `CODEX_TASK.md` para la tarea en curso.
