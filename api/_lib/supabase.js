const baseUrl = () => {
  if (!process.env.SUPABASE_URL) throw new Error('SUPABASE_URL no esta configurado');
  return process.env.SUPABASE_URL.replace(/\/$/, '');
};

const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

async function supabaseFetch(path, options = {}) {
  const key = options.key || serviceKey() || process.env.SUPABASE_ANON_KEY;
  if (!key) throw new Error('Supabase key no esta configurada');

  const response = await fetch(`${baseUrl()}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${options.bearer || key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

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
    key: process.env.SUPABASE_ANON_KEY,
    bearer: accessToken
  });
}

async function refreshSupabaseSession(refreshToken) {
  return supabaseFetch('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    key: process.env.SUPABASE_ANON_KEY,
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

module.exports = {
  baseUrl,
  supabaseFetch,
  getSupabaseUser,
  refreshSupabaseSession,
  restSelect,
  restUpsert,
  restInsert,
  restPatch
};
