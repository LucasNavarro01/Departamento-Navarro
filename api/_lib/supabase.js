const baseUrl = () => {
  const url = String(process.env.SUPABASE_URL || '').trim();
  if (!url) throw new Error('SUPABASE_URL no esta configurado');
  return url.replace(/\/$/, '');
};

const serviceKey = () => String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').trim();
const anonKey = () => String(process.env.SUPABASE_ANON_KEY || '').trim();

async function supabaseFetch(path, options = {}) {
  const key = String(options.key || serviceKey() || anonKey() || '').trim();
  if (!key) throw new Error('Supabase key no esta configurada');
  const bearer = String(options.bearer || key).trim();
  const url = `${baseUrl()}${path}`;

  let response;
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await fetch(url, {
        ...options,
        headers: {
          apikey: key,
          Authorization: `Bearer ${bearer}`,
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      });
      break;
    } catch (error) {
      lastError = error;
      if (attempt === 1) {
        throw new Error(`No se pudo conectar con Supabase (${error.message || 'fetch failed'})`);
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
