# Plan — Web completa del Departamento Navarro

> Documento de planificación. Estado del proyecto auditado el **3 de junio de 2026**.
> No se modificó código: esto es solo el plan y el roadmap.

---

## 1. Resumen ejecutivo

El proyecto ya está **más avanzado de lo que parece**. El sitio público, la sincronización de calendarios (Booking/Airbnb → web), el panel de administración de precios y casi todo el backend de fidelidad **ya están construidos y funcionando**. Lo que falta para tener una web "completa" se concentra en tres frentes:

1. **Login opcional + descuentos por fidelidad** → el backend existe, pero las páginas de login/cuenta son cáscaras vacías y los porcentajes no coinciden con los que querés.
2. **Cerrar días desde el admin que se reflejen en todas las plataformas** → hoy podés cerrar la propiedad *entera*, pero no bloquear *fechas específicas*, y falta la pieza clave: **exportar un iCal propio** para que Booking y Airbnb importen esos bloqueos.
3. **Más animaciones / más vida** → el sitio es sólido pero estático; hay mucho margen para sumar movimiento sin recargarlo.

El resto (SEO, legales, pasarela de pago, emails automáticos) son mejoras que elevan la web de "funcional" a "profesional completa".

---

## 2. Auditoría del estado actual

### ✅ Ya construido y funcionando

| Pieza | Archivo | Qué hace |
|---|---|---|
| Sitio público | `index.html` (1146 líneas) | Landing completa con galería, calendario Flatpickr, formulario de reserva |
| Disponibilidad real | `api/availability.js` | Lee los iCal de Booking + Airbnb y bloquea esas fechas en la web |
| Configuración dinámica | `api/config.js` + `api/update-config.js` | El sitio lee precios/estado desde Supabase; el admin los escribe |
| Panel admin | `admin.html` (423 líneas) | Pestañas: Estado, Precios, Contacto, Comodidades, Fotos |
| Reservas directas | `api/reservations.js` | POST crea reserva, GET lista (protegido por contraseña) |
| Backend de fidelidad | `api/_lib/coupons.js`, `api/me.js`, `api/coupons/me.js`, `api/auth/*` | Niveles de descuento, sesión con login social (Supabase) |
| Esquemas de base de datos | `supabase/*.sql` | Tablas `property_config`, `reservations`, `loyalty_profiles` |

### 🟡 A medias / no construido

| Pieza | Estado | Impacto |
|---|---|---|
| `login.html` | **Stub** (5 líneas) | No se puede iniciar sesión desde la UI |
| `cuenta.html` | **Stub** (1 línea) | No hay panel del huésped (ver descuento, historial) |
| `reservar.html` | **Stub** (1 línea) | Flujo de reserva separado sin construir |
| `auth-callback.html` | **Stub** (1 línea) | El retorno del login social no tiene página |
| **Exportar iCal propio** (web → Booking/Airbnb) | **No existe** | ⛔ Sin esto, cerrar días en la web **NO** se refleja en las otras plataformas |
| **Bloquear fechas específicas** en el admin | **No existe** | Solo se puede cerrar la propiedad entera, no "del 10 al 15 de julio" |
| Porcentajes de descuento | Existen pero **distintos** | Hoy: 0/10/15/20%. Vos querés: 10/15/18% |

---

## 3. Qué falta para una web "completa" — checklist

Más allá de los tres pedidos puntuales, una web de alojamiento profesional y completa debería cubrir:

**Conversión y confianza**
- [ ] Sección de **reseñas/testimonios** (mostrar el 9.6 de Booking con capturas o reviews reales).
- [ ] **Mapa interactivo** con la ubicación y distancias a Las Leñas, Caverna de las Brujas, etc.
- [ ] **FAQ** (check-in/out, mascotas, estacionamiento, cancelaciones).
- [ ] **Botón flotante de WhatsApp** siempre visible.
- [ ] Galería con **lightbox** (ampliar fotos al click) y orden por ambiente.

**Captación y pagos**
- [ ] Login opcional + descuentos por fidelidad *(pedido #1, ver sección 4)*.
- [ ] **Pasarela de pago / seña** (Mercado Pago es lo natural para Argentina) o al menos un flujo claro de "reservá con seña por transferencia".
- [ ] **Emails automáticos** de confirmación de reserva al huésped y aviso al dueño.

**SEO y legales (necesarios para que la web aparezca y sea legítima)**
- [ ] Meta tags, Open Graph (cómo se ve al compartir en WhatsApp/redes), `sitemap.xml`, `robots.txt`.
- [ ] Datos estructurados Schema.org (`LodgingBusiness`) → mejora cómo aparece en Google.
- [ ] **Política de privacidad** y **términos** (obligatorio si hay login y datos personales).
- [ ] Banner de **cookies/consentimiento** (si se agrega analítica).
- [ ] **Google Analytics / Search Console** para medir visitas y reservas.

**Operación**
- [ ] Panel admin: bloquear fechas + ver/gestionar reservas *(pedido #2, ver sección 5)*.
- [ ] Versión **multi-idioma** (ES/EN) — útil si apuntás a turismo extranjero a Las Leñas.

---

## 4. Login opcional + descuentos por fidelidad

### 4.1 Recomendación de modelo (basada en investigación de mercado)

Investigué buenas prácticas del rubro. Conclusiones clave:

- El **estándar de la industria es 5–10%** para huéspedes recurrentes. Menos de 5% "no se siente" y no compite con la inercia de reservar por Airbnb/Booking; **10% o más es lo más efectivo**.
- **Descontar de más erosiona el margen y educa mal al cliente**: si siempre hay rebaja grande, el huésped aprende a esperarla y deja de valorar el precio normal.
- Los **mejores programas combinan un descuento moderado con perks no monetarios**: acceso anticipado a fechas pico, late check-out gratis, regalo de bienvenida. Esto fideliza sin regalar margen.
- **Cuidado con las reglas de las OTA**: Booking/Airbnb prohíben *invitar* al huésped a reservar por fuera de la plataforma durante o justo después de una estadía hecha por ellas. El descuento se ofrece en *tu* web y a tus contactos directos, no como mensaje dentro de Booking.

**Mi recomendación: usar los porcentajes que pediste (10/15/18%) pero con tres reglas de protección de margen:**

1. **Por estadías completadas, no por noches.** Coincide con tus ejemplos ("1ra, 2da, 3ra vez") y es mucho más simple y transparente para el huésped. Una estadía cuenta cuando está **confirmada y finalizada** (check-out pasado), no apenas alguien se loguea.
2. **Solo sobre reservas directas** (hechas en tu web y asociadas a la cuenta). Una estadía que vino por Booking no suma al contador — así el descuento premia a quien te reserva directo, que es justamente lo que querés incentivar.
3. **El descuento aplica a la *próxima* reserva**, nunca a la actual. Es lo que hace la industria y evita que alguien se cree una cuenta y pida descuento en su primera reserva.

### 4.2 Tabla de niveles propuesta

| Reservas directas completadas | Descuento en la próxima | Nivel | Perk adicional sugerido |
|---|---|---|---|
| 0 (huésped nuevo) | — (precio normal) | Nuevo | — |
| 1 completada | **10%** | Recurrente | — |
| 2 completadas | **15%** | Frecuente | Late check-out gratis |
| 3 o más | **18%** | Embajador | Late check-out + acceso anticipado a fechas pico |

> **Nota:** el sistema actual ya tiene niveles 0/10/15/20%. El cambio es ajustar los umbrales y porcentajes en `api/_lib/coupons.js` a esta tabla. El tope en 18% protege tu margen (vs. el 20% actual).

**Opcional — variante "por noches":** si en el futuro querés premiar estadías largas, se puede sumar un contador de noches acumuladas en paralelo. Para empezar, **por estadías es lo correcto** y lo que pediste.

### 4.3 Qué hay que construir para esto

1. Construir **`login.html`** real (botones de Google/login social que ya soporta el backend de Supabase, + email).
2. Construir **`auth-callback.html`** (procesa el retorno del login y crea la sesión).
3. Construir **`cuenta.html`**: el huésped ve su nivel, su % de descuento, su código y su historial de reservas.
4. Ajustar **`api/_lib/coupons.js`** a la tabla 4.2.
5. En el formulario de reserva (`index.html`): si hay sesión, aplicar el descuento automáticamente y mostrarlo en el desglose del precio.
6. Lógica para **incrementar el contador** solo cuando una reserva pasa a "completada" (check-out cumplido).

> **Importante:** el login es **opcional**. El huésped no logueado reserva igual, al precio normal. El login solo desbloquea el beneficio.

---

## 5. Panel de administración — precios + cerrar días en todas las plataformas

### 5.1 Lo que ya podés hacer

El admin (`admin.html`) ya te deja cambiar **precios** (base por noche, persona adicional, mínimo de noches), datos de contacto, comodidades, fotos, y **cerrar/abrir la propiedad entera**. Eso ya cumple buena parte del pedido.

### 5.2 La pieza que falta (y es la clave de tu pedido)

> *"cerrar días y que se cierren en todas las páginas conectadas, o sea todos los calendarios"*

Hoy la sincronización es **en un solo sentido**: Booking/Airbnb → tu web. Falta el sentido inverso. Cómo funciona realmente la sincronización entre plataformas (importante entenderlo):

```
   TU WEB  ──(exporta iCal)──►  Booking  ◄── lo importa cada X horas
      ▲                          Airbnb   ◄── lo importa cada X horas
      └──(importa iCal)──── Booking + Airbnb
```

No existe un "cerrar día instantáneo en todos lados". El estándar de la industria (y lo único que Booking/Airbnb soportan sin pagar un channel manager) es **iCal**: vos publicás un calendario `.ics` con tus fechas cerradas, y cada plataforma lo lee y se actualiza **cada pocas horas** (no es en tiempo real, es importante que lo sepas y lo comuniques).

**Lo que hay que construir:**

1. **Nueva pestaña "Calendario" en el admin** para bloquear/desbloquear rangos de fechas específicos (ej: "cerrá del 10 al 15 de julio"). Se guardan en una tabla `blocked_dates` en Supabase.
2. **Endpoint `api/calendar.ics`** que genere un iCal con: las reservas directas confirmadas + los días bloqueados manualmente. Esta es la URL que pegás **una sola vez** en Booking y en Airbnb (en su sección "Importar calendario").
3. A partir de ahí, **cerrar un día en tu admin → aparece en el `.ics` → Booking y Airbnb lo importan automáticamente** en su próximo refresco.

Resultado: cerrás días desde **un solo lugar** (tu admin) y se propagan a todas las plataformas conectadas. El `CODEX_TASK_RESERVATIONS.md` del proyecto ya tenía esto diseñado pero **nunca se implementó** el endpoint de exportación.

> **Alternativa "tiempo real":** si querés sincronización instantánea (no cada pocas horas), eso requiere un **channel manager** pago (Smoobu, Lodgify, Hostaway, etc.) que se conecta por API. Para una sola propiedad, iCal gratis suele ser más que suficiente.

### 5.3 Gestión de reservas en el admin

Complemento natural: una pestaña **"Reservas"** donde veas la lista de reservas directas, confirmes/canceles, y marques las completadas (esto último alimenta el contador de fidelidad de la sección 4).

---

## 6. Más animaciones / más vida

El sitio se ve prolijo pero es estático. Mejoras de movimiento, ordenadas de mayor a menor impacto y todas livianas (sin frameworks pesados, respetando el stack vanilla):

**Alto impacto, bajo esfuerzo**
- **Animaciones al hacer scroll** (las secciones aparecen con un fade-in suave a medida que bajás) usando `IntersectionObserver` — moderno y sin librerías.
- **Galería con lightbox** y transición al ampliar fotos.
- **Hero más vivo**: leve parallax o un slideshow suave de las 4 fotos estacionales de Malargüe que ya tenés (`malargue-invierno/otoño/primavera/verano`).
- **Microinteracciones**: hover con elevación en las tarjetas, botones con transición, calendario con animación al seleccionar fechas.

**Impacto medio**
- **Contador animado** de stats ("65 m²", "6 huéspedes", "9.6 en Booking") que sube al entrar en pantalla.
- **Skeleton loaders** mientras carga la disponibilidad (en vez de un salto brusco).
- **Sticky CTA** de reservar que aparece al scrollear.
- **Transiciones de página** suaves entre index / cuenta / login.

**Detalle / "wow"**
- Animación temática sutil (ej: una nevada muy ligera en invierno, acorde a Las Leñas) activable por temporada.
- Badge de "fidelidad" animado en la cuenta del huésped cuando sube de nivel.

> Recomendación técnica: usar CSS animations + `IntersectionObserver` (nativo). Si querés algo más elaborado, una librería liviana como **AOS** (Animate On Scroll, ~15 KB) encaja sin romper el stack actual.

---

## 7. Roadmap por fases

Ordenado por prioridad y dependencias. Estimación de esfuerzo relativa (no en horas exactas).

### Fase A — Cerrar el loop de calendarios *(prioridad máxima — es operación real)*
- Pestaña "Calendario" en admin + tabla `blocked_dates`.
- Endpoint `api/calendar.ics` (exportación).
- Pegar la URL en Booking y Airbnb.
- Pestaña "Reservas" en admin.
- **Esfuerzo:** medio · **Desbloquea:** que puedas operar sin sobreventas.

### Fase B — Login + fidelidad *(pedido #1)*
- Construir `login.html`, `auth-callback.html`, `cuenta.html`.
- Ajustar porcentajes en `coupons.js` (tabla 4.2).
- Aplicar descuento en el formulario de reserva.
- Lógica de contador por estadía completada.
- **Esfuerzo:** medio-alto · **Depende de:** Fase A (necesita reservas confirmadas para contar estadías).

### Fase C — Animaciones y vida *(pedido #3)*
- Scroll animations, lightbox, hero dinámico, microinteracciones.
- **Esfuerzo:** bajo-medio · **Independiente:** se puede hacer en paralelo.

### Fase D — Completar la web profesional
- Reseñas, mapa, FAQ, WhatsApp flotante.
- SEO (meta tags, Open Graph, schema, sitemap).
- Legales (privacidad, términos, cookies).
- Emails automáticos de confirmación.
- (Opcional) Pasarela de pago / seña con Mercado Pago.
- (Opcional) Multi-idioma ES/EN.
- **Esfuerzo:** alto (pero modular, se puede picar).

---

## 8. Riesgos y cosas a tener en cuenta

- **La sincronización iCal NO es instantánea.** Booking/Airbnb refrescan cada pocas horas. Para una sola propiedad es aceptable; comunicalo para no sorprenderte con una doble reserva en una ventana corta. Tiempo real = channel manager pago.
- **Reglas de las OTA.** No promociones el descuento directo *dentro* de mensajes de Booking/Airbnb. Hacelo en tu web, redes, y al huésped una vez que ya es contacto directo.
- **Protección de margen.** El 18% es generoso (tope de mercado). Está bien para fidelizar, pero combinalo con perks no monetarios para no competir solo por precio.
- **Datos personales = responsabilidad legal.** Al haber login y guardar reservas, necesitás política de privacidad y un manejo prolijo de los datos (Supabase ya ayuda con RLS).
- **Seguridad del admin.** Hoy el admin se protege con una contraseña en variable de entorno. Para producción conviene reforzarlo (sesión robusta, rate limiting).

---

## 9. Próximo paso sugerido

Si te parece bien este plan, el orden lógico para empezar a construir es **Fase A (calendarios)**, porque es lo que más te impacta operativamente y porque la Fase B (fidelidad) depende de tener reservas confirmadas. La Fase C (animaciones) se puede ir haciendo en paralelo cuando quieras un respiro de lo técnico.

Avisame cuál fase querés que arranque primero y lo construimos.
