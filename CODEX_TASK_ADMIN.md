# CODEX TASK — Panel de Administración /admin

## Contexto
Leer AGENTS.md antes de empezar. El sitio es un HTML estático (index.html) en Vercel.
Necesitamos un panel protegido en `/admin` para que el propietario gestione la propiedad
sin tocar código. Los datos se guardan en Supabase y el sitio los lee dinámicamente.

## Prerequisito — Setup de Supabase (hacerlo UNA VEZ manualmente)

### 1. Crear proyecto en Supabase
- Ir a https://supabase.com → New Project
- Nombre: `departamento-navarro`
- Región: South America (São Paulo) → la más cercana a Argentina
- Guardar la contraseña de la base de datos

### 2. Crear la tabla `property_config`
Ir a Supabase → SQL Editor → pegar y ejecutar:

```sql
create table property_config (
  id uuid default gen_random_uuid() primary key,
  key text unique not null,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- Habilitar RLS
alter table property_config enable row level security;

-- Política: lectura pública (el sitio necesita leer los precios)
create policy "Public read"
  on property_config for select
  using (true);

-- Política: escritura solo con service_role (desde el backend, nunca desde el frontend)
create policy "Service write"
  on property_config for all
  using (auth.role() = 'service_role');

-- Datos iniciales
insert into property_config (key, value) values
  ('price_per_night', '15000'),
  ('price_extra_person', '3000'),
  ('min_nights_low', '2'),
  ('min_nights_high', '4'),
  ('phone', '+5492604000000'),
  ('is_closed', 'false'),
  ('closed_message', '"Temporalmente sin disponibilidad. Contactanos por WhatsApp."'),
  ('amenities', '["WiFi Alta Velocidad gratis","Calefacción","Gas · Luz · Agua incl.","Garaje cubierto","Patio con Parrilla","Cocina equipada","Heladera","Lavarropas","Microondas","Cafetera","Ropa de cama","Toallas","Smart TV","Mascotas permitidas"]'),
  ('photos', '[{"src":"fotos/living.jpeg","alt":"Living","visible":true},{"src":"fotos/dormitorio1.jpeg","alt":"Dormitorio principal","visible":true},{"src":"fotos/cocina.jpeg","alt":"Cocina","visible":true},{"src":"fotos/bano.jpeg","alt":"Baño","visible":true},{"src":"fotos/patio.jpeg","alt":"Patio con parrilla","visible":true},{"src":"fotos/dormitorio2.jpeg","alt":"Segundo dormitorio","visible":true},{"src":"fotos/exterior.jpeg","alt":"Exterior","visible":true}]');
```

### 3. Obtener credenciales
- Supabase → Settings → API
- Copiar: **Project URL** y **anon public key** y **service_role secret key**

### 4. Agregar env vars en Vercel
| Variable | Valor |
|----------|-------|
| `SUPABASE_URL` | Project URL de Supabase |
| `SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_SERVICE_KEY` | service_role secret key |
| `ADMIN_PASSWORD` | contraseña que elija el propietario |

---

## TAREA 1 — Crear `api/config.js` (lectura pública)

```
GET /api/config
Respuesta: { price_per_night, price_extra_person, min_nights_low, min_nights_high,
             phone, is_closed, closed_message, amenities, photos }
Cache: public, max-age=60 (1 minuto)
```

- Usa `SUPABASE_URL` y `SUPABASE_ANON_KEY`
- Hace un SELECT de todos los rows de `property_config`
- Transforma el array de `{ key, value }` en un objeto plano
- Si Supabase falla, devuelve config por defecto hardcodeada (no romper el sitio)

```javascript
// Estructura de respuesta esperada:
{
  price_per_night: 15000,
  price_extra_person: 3000,
  min_nights_low: 2,
  min_nights_high: 4,
  phone: "+5492604000000",
  is_closed: false,
  closed_message: "...",
  amenities: ["WiFi Alta Velocidad gratis", ...],
  photos: [{ src: "fotos/living.jpeg", alt: "Living", visible: true }, ...]
}
```

---

## TAREA 2 — Crear `api/update-config.js` (escritura protegida)

```
POST /api/update-config
Body: { password: "...", key: "price_per_night", value: 18000 }
Respuesta: { ok: true } o { error: "Unauthorized" }
```

- Verifica que `password === process.env.ADMIN_PASSWORD`
- Si no coincide: status 401, `{ error: "Unauthorized" }`
- Usa `SUPABASE_SERVICE_KEY` (nunca el anon key para escritura)
- Hace un UPSERT en `property_config` con el key y value recibidos
- Actualiza `updated_at` a `now()`
- Claves permitidas (whitelist): `price_per_night`, `price_extra_person`,
  `min_nights_low`, `min_nights_high`, `phone`, `is_closed`, `closed_message`,
  `amenities`, `photos`
- Si el key no está en la whitelist: status 400, `{ error: "Invalid key" }`

---

## TAREA 3 — Crear `admin.html`

Página completamente independiente de `index.html`. La carga directamente en `/admin`.

### Diseño
- Mismo sistema de colores que el sitio principal:
  - `--terracotta: #C67B5C` | `--brown: #3D2B1F` | `--cream: #F5F0E1` | `--sand: #EDE3D0`
- Tipografía: Inter desde Google Fonts
- Layout: columna centrada, max-width 680px, mobile-first
- Logo/header simple: "⚙️ Panel de Administración · Departamento Navarro"

### Flujo de autenticación
1. Al cargar la página mostrar un formulario de login (solo campo contraseña + botón)
2. Al enviar: llamar POST `/api/update-config` con `{ password, key: "ping", value: 1 }`
   — si responde 200 → mostrar el panel; si 401 → mostrar "Contraseña incorrecta"
3. Guardar `sessionStorage.setItem('admin_auth', password)` para no pedir de nuevo
4. Al recargar: si hay contraseña en sessionStorage, verificar automáticamente

### Secciones del panel (mostrar una por una con tabs o acordeones)

#### 📋 Sección 1 — Estado de la propiedad
```
Toggle: "Propiedad activa / Cerrada temporalmente"
  → actualiza is_closed (true/false)

Textarea: "Mensaje cuando está cerrada"
  → actualiza closed_message
  → solo visible cuando el toggle está en "Cerrada"
```

#### 💰 Sección 2 — Precios
```
Input número: "Precio base por noche (ARS $)"
  → actualiza price_per_night

Input número: "Cargo por persona adicional (ARS $)"
  → actualiza price_extra_person
  → texto de ayuda: "Se cobra a partir de la 3ra persona"

Input número: "Mínimo de noches — temporada baja"
  → actualiza min_nights_low

Input número: "Mínimo de noches — temporada alta (julio–sept)"
  → actualiza min_nights_high
```

#### 📞 Sección 3 — Contacto
```
Input texto: "Número de WhatsApp"
  → actualiza phone
  → placeholder: "+5492604XXXXXXX"
  → texto de ayuda: "Incluir código de país. Ej: +5492604123456"
```

#### ✅ Sección 4 — Comodidades
```
Lista editable de comodidades (chips con ✕ para eliminar)
Input + botón "Agregar" para añadir nueva comodidad
→ actualiza amenities (array completo)
```

#### 📸 Sección 5 — Fotos
```
Lista de fotos con:
  - Miniatura (img con src de la foto)
  - Toggle visible/oculta
  - Botón "Eliminar"
Input de URL + botón "Agregar foto" (para agregar URLs de fotos externas)
→ actualiza photos (array completo)
Nota: las fotos de la carpeta fotos/ se siguen cargando de ahí. Este panel
solo controla cuáles se muestran y permite agregar fotos por URL.
```

### Comportamiento de guardado
- Cada sección tiene su propio botón "Guardar cambios"
- Al guardar: mostrar spinner → llamar `/api/update-config` → mostrar "✓ Guardado" o error
- NO guardar automáticamente al tipear (evitar llamadas innecesarias)
- Botón de logout al final: limpia sessionStorage y vuelve al login

### Carga inicial del panel
- Al autenticarse, llamar `GET /api/config` y pre-rellenar todos los campos con los valores actuales

---

## TAREA 4 — Modificar `index.html` para leer config dinámica

Al cargar el sitio, hacer `fetch('/api/config')` y actualizar:

1. **Precio** en la sección de reservas:
   - `.price-amt` → mostrar `$ {price_per_night.toLocaleString('es-AR')}`
   - `.price-per` → `por noche · precio base 2 personas`
   - Agregar línea: `+ $ {price_extra_person.toLocaleString('es-AR')} por persona adicional`

2. **Mínimo de noches** en la capacidad:
   - Actualizar el texto de estadía mínima según temporada actual
   - Si mes actual es julio/agosto/septiembre → usar `min_nights_high`, resto → `min_nights_low`

3. **Teléfono** en el footer y en el botón de WhatsApp:
   - Actualizar todos los `href="https://wa.me/..."` con el número de `phone`

4. **Alojamiento cerrado:**
   - Si `is_closed === true`: mostrar un banner prominente en el hero con `closed_message`
   - Deshabilitar el formulario de reservas y el botón de WhatsApp
   - Banner color: `#3D2B1F` con texto blanco

5. **Comodidades:**
   - Si `amenities` cambia, actualizar la lista `.amenities-list` (regenerar los items)

6. **Fotos visibles:**
   - Filtrar la galería para mostrar solo las fotos donde `visible === true`

Usar `Promise.allSettled` para que si `/api/config` falla, el sitio igual cargue con los valores hardcodeados por defecto.

---

## Estructura de archivos resultante
```
├── index.html          (modificado — lee /api/config)
├── admin.html          (NUEVO — panel de admin)
├── api/
│   ├── availability.js (Fase 2 — ya implementado)
│   ├── config.js       (NUEVO — lectura pública)
│   └── update-config.js (NUEVO — escritura protegida)
├── package.json
├── vercel.json
└── AGENTS.md
```

## Commits sugeridos
```
feat: add Supabase config API endpoints (read/write)
feat: add /admin panel with property management UI
feat: make index.html read dynamic config from API
```
