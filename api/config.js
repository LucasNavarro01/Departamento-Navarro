const DEFAULT_CONFIG = {
  price_per_night: 15000,
  price_extra_person: 3000,
  price_by_guests: {
    1: 25000,
    2: 30000,
    3: 40000,
    4: 50000,
    5: 60000,
    6: 70000
  },
  min_nights_low: 1,
  phone: process.env.WHATSAPP_PHONE || '',
  is_closed: false,
  closed_message: 'Temporalmente sin disponibilidad. Contactanos por WhatsApp.',
  amenities: [
    'WiFi Alta Velocidad gratis',
    'Calefacción',
    'Gas · Luz · Agua incl.',
    'Garaje cubierto',
    'Patio con Parrilla',
    'Cocina equipada',
    'Heladera',
    'Lavarropas',
    'Microondas',
    'Cafetera',
    'Ropa de cama',
    'Toallas',
    'Smart TV',
    'Mascotas permitidas'
  ],
  photos: [
    { src: 'fotos/living.jpeg', alt: 'Living', visible: true },
    { src: 'fotos/dormitorio1.jpeg', alt: 'Dormitorio principal', visible: true },
    { src: 'fotos/cocina.jpeg', alt: 'Cocina', visible: true },
    { src: 'fotos/bano.jpeg', alt: 'Baño', visible: true },
    { src: 'fotos/patio.jpeg', alt: 'Patio con parrilla', visible: true },
    { src: 'fotos/dormitorio2.jpeg', alt: 'Segundo dormitorio', visible: true },
    { src: 'fotos/exterior.jpeg', alt: 'Exterior', visible: true }
  ]
};

function json(res, status, body) {
  res.status(status).json(body);
}

async function readSupabaseConfig() {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase no está configurado');
  }

  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/property_config?select=key,value`;
  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase respondió ${response.status}`);
  }

  const rows = await response.json();
  return rows.reduce((config, row) => {
    config[row.key] = row.value;
    return config;
  }, {});
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    json(res, 405, { ...DEFAULT_CONFIG, error: 'Method not allowed' });
    return;
  }

  res.setHeader('Cache-Control', 'public, max-age=60');

  try {
    const config = await readSupabaseConfig();
    json(res, 200, { ...DEFAULT_CONFIG, ...config });
  } catch (error) {
    json(res, 200, { ...DEFAULT_CONFIG, error: error.message || 'No se pudo leer la configuración' });
  }
};
