# Departamento Navarro — Malargüe, Mendoza

Sitio web oficial del Departamento Navarro, alojamiento temporario en Malargüe, Mendoza, Argentina.

## 🌐 Ver sitio en vivo
[departamento-navarro.vercel.app](#) *(próximamente)*

## 📋 Descripción
Departamento completo para hasta 6 huéspedes. La base perfecta para explorar Las Leñas, Laguna Llancanelo, Reserva La Payunia y la Caverna de las Brujas.

## 🛠️ Stack
- HTML + CSS + JS (sitio estático, sin dependencias)
- Hosteado en **Vercel**
- Vercel Serverless Functions en `/api`
- Supabase PostgreSQL para configuración, reservas y bloqueos de calendario
- Fotos propias del alojamiento

## Calendario iCal
- La web importa disponibilidad desde Booking/Airbnb con `BOOKING_ICAL_URL` y `AIRBNB_ICAL_URL`.
- El admin permite cerrar rangos manuales en `/admin`, pestaña **Calendario**.
- La URL pública de exportación es `/api/calendar.ics`.
- Pegar esa URL en Booking y Airbnb para que importen reservas directas confirmadas/pendientes y bloqueos manuales. La sincronización de las plataformas puede tardar varias horas.

Variables necesarias: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` o `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` y `ADMIN_PASSWORD`. No se agrega ninguna variable nueva para el feed iCal.

## 📁 Estructura
```
├── index.html          # Sitio completo (single-file)
├── admin.html          # Panel de administración
├── api/                # Endpoints serverless
├── supabase/           # SQL para tablas y políticas
├── fotos/              # Fotografías del departamento
└── README.md
```

## 📞 Contacto
- **WhatsApp:** +54 9 2604 XX-XXXX
- **Booking.com:** [Ver propiedad](https://www.booking.com/hotel/ar/departamento-navarro-malargue.es-ar.html)

---
*Desarrollado como plantilla para alojamientos temporarios en Argentina.*
