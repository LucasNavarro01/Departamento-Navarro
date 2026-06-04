const MONEY = new Intl.NumberFormat('es-AR');

function $(selector) { return document.querySelector(selector); }

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const payload = await res.json().catch(() => ({ error: 'Respuesta invalida' }));
  if (!res.ok || payload.error) throw new Error(payload.error || 'Error');
  return payload.data;
}

async function getAuthClient() {
  const config = await api('/api/auth/config');
  if (!window.supabase) throw new Error('No se pudo cargar Supabase Auth');
  return window.supabase.createClient(config.supabaseUrl, config.anonKey);
}

async function startOAuth(provider) {
  const returnTo = new URLSearchParams(location.search).get('return_to') || '/cuenta';
  localStorage.setItem('dn_return_to', returnTo);
  const client = await getAuthClient();
  const { error } = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${location.origin}/auth/callback` }
  });
  if (error) throw error;
}

async function sendMagicLink(event) {
  event.preventDefault();
  const status = $('#login-status');
  const email = new FormData(event.currentTarget).get('email');
  const returnTo = new URLSearchParams(location.search).get('return_to') || '/cuenta';
  localStorage.setItem('dn_return_to', returnTo);
  status.textContent = 'Enviando enlace...';
  const client = await getAuthClient();
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${location.origin}/auth/callback` }
  });
  if (error) throw error;
  status.textContent = 'Listo. Revisa tu email para entrar.';
}

async function handleCallback() {
  const status = $('#status');
  const client = await getAuthClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;

  let session = data?.session;
  if (!session?.access_token) {
    const params = new URLSearchParams(location.hash.slice(1) || location.search.slice(1));
    if (params.get('access_token')) {
      session = {
        access_token: params.get('access_token'),
        refresh_token: params.get('refresh_token'),
        expires_in: params.get('expires_in')
      };
    }
  }

  if (!session?.access_token) {
    status.textContent = 'No recibimos la sesion de Supabase. Revisa la configuracion de Redirect URLs.';
    return;
  }

  await api('/api/auth/session', {
    method: 'POST',
    body: JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      remember: true
    })
  });
  await client.auth.signOut().catch(() => {});
  location.href = localStorage.getItem('dn_return_to') || '/cuenta';
}

async function logout() {
  await api('/api/auth/logout', { method: 'POST', body: '{}' }).catch(() => {});
  location.href = '/login';
}

function progressFor(coupon) {
  if (!coupon.nextTier) return 100;
  return Math.min(100, Math.round((Number(coupon.count || 0) / Number(coupon.nextTier.at || 1)) * 100));
}

function renderCoupon(coupon) {
  const pct = Number(coupon.percent || 0);
  return `
    <section class="panel coupon ${coupon.tier}">
      <div class="eyebrow" style="color:#F5D5C0">${coupon.label}</div>
      <div class="discount">${pct}<span>%</span></div>
      <p>${pct > 0 ? 'off automatico en tu proxima reserva directa.' : 'Precio normal. Completa una estadia directa para activar 10% off.'}</p>
      <div class="codebox">
        <div><small>ETIQUETA</small><br><code>${coupon.code}</code></div>
        <button class="btn btn-outline" onclick="navigator.clipboard.writeText('${coupon.code}')">Copiar</button>
      </div>
    </section>
  `;
}

function renderProgress(coupon) {
  const current = Number(coupon.count || 0);
  if (!coupon.nextTier) {
    return '<p class="muted">Ya estas en el nivel mas alto.</p><div class="progress"><span style="width:100%"></span></div>';
  }
  const missing = Math.max(0, Number(coupon.nextTier.at) - current);
  return `<p class="muted">Te falta ${missing} ${missing === 1 ? 'estadia completada' : 'estadias completadas'} para ${coupon.nextTier.percent}% off.</p><div class="progress"><span style="width:${progressFor(coupon)}%"></span></div>`;
}

async function initAccount() {
  try {
    const coupon = await api('/api/coupons/me');
    const history = await api('/api/reservations/me').catch(() => []);
    const firstName = (coupon.user?.name || 'huesped').split(' ')[0];
    $('#account').innerHTML = `
      <header class="hero">
        <div><p class="eyebrow">MI CUENTA</p><h1>Hola, <em>${firstName}</em>.</h1><p class="muted">${coupon.label} · ${coupon.count} estadias directas completadas</p></div>
        <a class="btn btn-primary" href="/#reservas">Reservar de nuevo</a>
      </header>
      <div class="grid">
        <div>
          ${renderCoupon(coupon)}
          <section class="panel" style="margin-top:1rem"><p class="eyebrow">PROGRESO</p><h2>Tu nivel de fidelidad</h2>${renderProgress(coupon)}</section>
          <section class="panel" style="margin-top:1rem"><p class="eyebrow">HISTORIAL</p><h2>Tus reservas</h2>
            ${history.length ? history.map(r => `<div class="history-row"><div><strong>${r.checkin} al ${r.checkout}</strong><br><span class="muted">${r.guests || r.num_guests || 1} huespedes · ${r.status}</span></div><strong>$${MONEY.format(r.total || 0)}</strong></div>`).join('') : '<p class="muted">Aun no tenes reservas asociadas.</p>'}
          </section>
        </div>
        <aside class="panel"><p class="eyebrow">NIVELES</p><h2>Descuentos</h2><p>1 estadia completada: 10% off</p><p>2 estadias completadas: 15% off</p><p>3 o mas: 18% off</p></aside>
      </div>`;
  } catch (error) {
    location.href = `/login?return_to=${encodeURIComponent('/cuenta')}`;
  }
}
