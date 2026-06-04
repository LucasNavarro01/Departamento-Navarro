const https = require('https');

const baseUrl = () => {
  const url = String(process.env.SUPABASE_URL || '').trim();
  if (!url) throw new Error('SUPABASE_URL no esta configurado');
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(url.replace(/\/$/, ''))) {
    throw new Error('SUPABASE_URL no parece valida. Debe ser una URL https://... de Supabase sin espacios');
  }
  return url.replace(/\/$/, '');
};

const serviceKey = () => String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').trim();
const anonKey = () => String(process.env.SUPABASE_ANON_KEY || '').trim();

function fetchWithHttpsFallback(url, options) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const body = options.body || null;
    const request = https.request({
      method: options.method || 'GET',
      hostname: parsed.hostname,
      path: `${parsed.pathname}${parsed.search}`,
      headers: options.headers
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({
          ok: response.statusCode >= 200 && response.statusCode < 300,
          status: response.statusCode,
          text: async () => text
        });
      });
    });

    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

async function supabaseFetch(path, options = {}) {
  const key = String(options.key || serviceKey() || anonKey() || '').trim();
  if (!key) throw new Error('Supabase key no esta configurada');
  const bearer = String(options.bearer || key).trim();
  const url = `${baseUrl()}${path}`;

  let response;
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const requestOptions = {
      ...options,
      headers: {
        apikey: key,
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    try {
      response = await fetch(url, requestOptions);
      break;
    } catch (error) {
      lastError = error;
      if (attempt === 1) {
        try {
          response = await fetchWithHttpsFallback(url, requestOptions);
          break;
        } catch (fallbackError) {
          throw new Error(`No se pudo conectar con Supabase. Revisa SUPABASE_URL y que el proyecto este activo (${fallbackError.message || error.message || 'fetch failed'})`);
        }
      }
    }
  }

  if (!response && lastError) {
    throw new Error(`No se pudo conectar con Supabase (${lastError.message || 'fetch failed'})`);
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.message || data?.error_description || data?.error || `Supabase respondio ${response.status}`);
  }
  return data;
}

async function getSupabaseUser(accessToken) {
  return supabaseFetch('/auth/v1/user', {
    method: 'GET',
    key: anonKey(),
    bearer: accessToken
  });
}

async function refreshSupabaseSession(refreshToken) {
  return supabaseFetch('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    key: anonKey(),
    body: JSON.stringify({ refresh_token: refreshToken })
  });
}

async function restSelect(table, query) {
  return supabaseFetch(`/rest/v1/${table}?${query}`, {
    method: 'GET',
    headers: { Prefer: 'return=representation' }
  });
}

async function restUpsert(table, rows, onConflict) {
  const query = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '';
  return supabaseFetch(`/rest/v1/${table}${query}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(rows)
  });
}

async function restInsert(table, rows) {
  return supabaseFetch(`/rest/v1/${table}`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(rows)
  });
}

async function restPatch(table, query, patch) {
  return supabaseFetch(`/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch)
  });
}

async function restDelete(table, query) {
  return supabaseFetch(`/rest/v1/${table}?${query}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' }
  });
}

module.exports = {
  baseUrl,
  supabaseFetch,
  getSupabaseUser,
  refreshSupabaseSession,
  restSelect,
  restUpsert,
  restInsert,
  restPatch,
  restDelete
};
