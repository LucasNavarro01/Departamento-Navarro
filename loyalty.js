const MONEY = new Intl.NumberFormat('es-AR');
const NIGHTLY_RATE = 18500;
const CLEANING_FEE = 4500;

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

function tierFromCount(count) {
  if (count >= 10) return { key: 'vip', percent: 20, label: 'VIP · Anfitrion Honorario', next: null };
  if (count >= 5) return { key: 'gold', percent: 15, label: 'Huesped Frecuente', next: { at: 10, percent: 20 } };
  if (count >= 2) return { key: 'silver', percent: 10, label: 'Cliente Recurrente', next: { at: 5, percent: 15 } };
  if (count >= 1) return { key: 'bronze', percent: 0, label: 'Primera estadia completada', next: { at: 2, percent: 10 } };
  return { key: 'new', percent: 0, label: 'Nuevo huesped', next: { at: 2, percent: 10 } };
}

async function startOAuth(provider) {
  const config = await api('/api/auth/config');
  const returnTo = new URLSearchParams(location.search).get('return_to') || '/cuenta';
  localStorage.setItem('dn_return_to', returnTo);
  const redirectTo = `${location.origin}/auth/callback`;
  if (window.supabase) {
    const client = window.supabase.createClient(config.supabaseUrl, config.anonKey);
    const { error } = await client.auth.signInWithOAuth({
      provider,
      options: { redirectTo }
    });
    if (error) throw error;
    return;
  }

  const url = new URL(`${config.supabaseUrl}/auth/v1/authorize`);
  url.searchParams.set('provider', provider);
  url.searchParams.set('redirect_to', redirectTo);
  location.href = url.toString();
}

async function handleCallback() {
  const config = await api('/api/auth/config');
  if (window.supabase) {
    const client = window.supabase.createClient(config.supabaseUrl, config.anonKey);
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data?.session?.access_token) {
      await api('/api/auth/session', {
        method: 'POST',
        body: JSON.stringify({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_in: data.session.expires_in,
          remember: true
        })
      });
      await client.auth.signOut().catch(() => {});
      location.href = localStorage.getItem('dn_return_to') || '/cuenta';
      return;
    }
  }

  const params = new URLSearchParams(location.hash.slice(1) || location.search.slice(1));
  const accessToken = params.get('access_token');
  if (!accessToken) {
    $('#status').textContent = 'No recibimos la sesion de Supabase. Revisá la configuración de Redirect URLs.';
    return;
  }

  await api('/api/auth/session', {
    method: 'POST',
    body: JSON.stringify({
      access_token: accessToken,
      refresh_token: params.get('refresh_token'),
      expires_in: params.get('expires_in'),
      remember: true
    })
  });
  location.href = localStorage.getItem('dn_return_to') || '/cuenta';
}

async function logout() {
  await api('/api/auth/logout', { method: 'POST', body: '{}' }).catch(() => {});
  location.href = '/login';
}

function renderCoupon(coupon) {
  const pct = Number(coupon.percent || 0);
  return `
    <section class="panel coupon ${coupon.tier}">
      <div class="eyebrow" style="color:#F5D5C0">${coupon.label}</div>
      <div class="discount">${pct > 0 ? pct : 'PROX'}${pct > 0 ? '<span>%</span>' : ''}</div>
      <p>${pct > 0 ? 'off automatico en tu proxima reserva.' : 'Tu descuento se activa desde la segunda reserva confirmada.'}</p>
      <div class="codebox">
        <div><small>TU CODIGO</small><br><code>${coupon.code}</code></div>
        <button class="btn btn-outline" onclick="navigator.clipboard.writeText('${coupon.code}')">Copiar</button>
      </div>
    </section>
  `;
}

async function initAccount() {
  try {
    const me = await api('/api/me');
    const coupon = await api('/api/coupons/me');
    const history = await api('/api/reservations/me').catch(() => []);
    const firstName = (me.user.name || 'huesped').split(' ')[0];
    $('#account').innerHTML = `
      <header class="hero">
        <div><p class="eyebrow">MI CUENTA</p><h1>Hola, <em>${firstName}</em>.</h1><p class="muted">${coupon.label} · ${me.reservationCount} reservas confirmadas</p></div>
        <a class="btn btn-primary" href="/reservar">Reservar de nuevo</a>
      </header>
      <div class="grid">
        <div>
          ${renderCoupon(coupon)}
          <div class="stats">
            <div class="panel stat"><strong>${me.reservationCount}</strong><br><span class="muted">Reservas totales</span></div>
            <div class="panel stat"><strong>${history.reduce((a,r)=>a+(r.guests||r.num_guests||0),0)}</strong><br><span class="muted">Huespedes registrados</span></div>
            <div class="panel stat"><strong>$${MONEY.format(history.reduce((a,r)=>a+Number(r.total||0),0))}</strong><br><span class="muted">Total reservado</span></div>
          </div>
          <section class="panel" style="margin-top:1rem"><p class="eyebrow">HISTORIAL</p><h2>Tus estadias</h2>
            ${history.length ? history.map(r => `<div class="history-row"><div><strong>${r.checkin} al ${r.checkout}</strong><br><span class="muted">${r.guests || r.num_guests || 1} huespedes · ${r.id}</span></div><strong>$${MONEY.format(r.total || 0)}</strong></div>`).join('') : '<p class="muted">Aun no tenes reservas asociadas.</p>'}
          </section>
        </div>
        <aside class="panel"><p class="eyebrow">NIVELES</p><h2>Escalera de fidelidad</h2><p>2 reservas: 10% off</p><p>5 reservas: 15% off</p><p>10 reservas: 20% off</p></aside>
      </div>`;
  } catch (error) {
    location.href = `/login?return_to=${encodeURIComponent('/cuenta')}`;
  }
}

async function initBooking() {
  let me = null;
  try { me = await api('/api/me'); } catch {}
  const tier = me ? tierFromCount(me.reservationCount) : { percent: 0, label: 'Invitado' };
  const state = { nights: 4, manualPct: 0 };

  function paint() {
    const subtotal = NIGHTLY_RATE * state.nights;
    const appliedPct = Math.max(tier.percent || 0, state.manualPct);
    const discount = Math.round(subtotal * appliedPct / 100);
    const total = subtotal - discount + CLEANING_FEE;
    $('#booking').innerHTML = `
      <header class="hero"><div><p class="eyebrow">NUEVA RESERVA</p><h1>${me ? `De vuelta, <em>${me.user.name.split(' ')[0]}</em>.` : 'Reserva tu estadia.'}</h1><p class="muted">${me ? `${tier.label}: ${tier.percent}% off automatico si aplica.` : 'Inicia sesion para aplicar cupones de fidelidad.'}</p></div>${me ? '' : '<a class="btn btn-outline" href="/login?return_to=/reservar">Iniciar sesion</a>'}</header>
      <div class="alert ${tier.percent ? 'success' : ''}">${tier.percent ? `Cupon de fidelidad aplicado: ${tier.percent}% off automatico.` : 'Tu segunda reserva activa 10% off automatico.'}</div>
      <div class="grid"><form class="panel" id="booking-form">
        <div class="form-grid"><div class="field"><label>Llegada</label><input type="date" name="checkin" required></div><div class="field"><label>Salida</label><input type="date" name="checkout" required></div></div>
        <div class="form-grid" style="margin-top:1rem"><div class="field"><label>Huespedes</label><select name="guests"><option>1</option><option selected>2</option><option>3</option><option>4</option><option>5</option><option>6</option></select></div><div class="field"><label>Codigo manual</label><input name="coupon" placeholder="MALARGUE5 o NIEVE5"></div></div>
        <div class="form-grid" style="margin-top:1rem"><div class="field"><label>Nombre</label><input name="name" value="${me?.user?.name || ''}" required></div><div class="field"><label>Email</label><input name="email" type="email" value="${me?.user?.email || ''}" required></div></div>
        <div class="field" style="margin-top:1rem"><label>WhatsApp</label><input name="phone" required></div>
        <button class="btn btn-primary" style="width:100%;margin-top:1.25rem">Confirmar reserva · $${MONEY.format(total)}</button>
      </form><aside class="panel summary"><h2>Departamento Navarro</h2><p class="muted">El Payen 466, Malargue</p><div class="breakdown"><div class="brow"><span>$${MONEY.format(NIGHTLY_RATE)} x ${state.nights} noches</span><span>$${MONEY.format(subtotal)}</span></div>${appliedPct ? `<div class="brow discount-row"><span>Cupon (${appliedPct}%)</span><span>-$${MONEY.format(discount)}</span></div>` : ''}<div class="brow"><span>Limpieza</span><span>$${MONEY.format(CLEANING_FEE)}</span></div><div class="brow total"><span>Total</span><span>$${MONEY.format(total)}</span></div></div></aside></div>`;
    $('#booking-form').addEventListener('submit', submitBooking);
    $('[name="coupon"]').addEventListener('change', event => {
      const code = event.target.value.trim().toUpperCase();
      state.manualPct = code === 'MALARGUE5' || code === 'NIEVE5' ? 5 : 0;
      paint();
      $('[name="coupon"]').value = code;
    });
  }

  async function submitBooking(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = await api('/api/reservations', {
      method: 'POST',
      body: JSON.stringify({
        checkin: form.get('checkin'),
        checkout: form.get('checkout'),
        guests: Number(form.get('guests')),
        couponCode: form.get('coupon'),
        contact: { name: form.get('name'), email: form.get('email'), phone: form.get('phone') }
      })
    });
    $('#booking').innerHTML = `<section class="panel" style="max-width:620px;margin:4rem auto;text-align:center"><div style="font-size:3rem;color:#2D6A4F">✓</div><p class="eyebrow">RESERVA CONFIRMADA</p><h1 class="title">Listo, te esperamos en Malargue.</h1><p class="muted">ID de reserva: ${data.id}</p><p>Total: <strong>$${MONEY.format(data.total)}</strong></p>${data.leveledUp ? `<div class="alert success">Subiste de nivel: proxima reserva con ${data.newTier.percent}% off.</div>` : ''}<a class="btn btn-primary" href="/cuenta">Ir a mi cuenta</a></section>`;
  }

  paint();
}
