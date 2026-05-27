function getCouponTier(count = 0) {
  const safeCount = Number(count) || 0;
  if (safeCount >= 10) {
    return { key: 'vip', percent: 20, label: 'VIP · Anfitrion Honorario', next: null };
  }
  if (safeCount >= 5) {
    return { key: 'gold', percent: 15, label: 'Huesped Frecuente', next: { at: 10, percent: 20, label: 'VIP' } };
  }
  if (safeCount >= 2) {
    return { key: 'silver', percent: 10, label: 'Cliente Recurrente', next: { at: 5, percent: 15, label: 'Huesped Frecuente' } };
  }
  if (safeCount >= 1) {
    return { key: 'bronze', percent: 0, label: 'Primera estadia completada', next: { at: 2, percent: 10, label: 'Cliente Recurrente' } };
  }
  return { key: 'new', percent: 0, label: 'Nuevo huesped', next: { at: 2, percent: 10, label: 'Cliente Recurrente' } };
}

function buildCouponCode(user, tier) {
  const source = (user.name || user.email || 'NAV').replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || 'NAV';
  return `NAVARRO${tier.percent}${source}`;
}

function getManualCouponPercent(code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (normalized === 'MALARGUE5' || normalized === 'NIEVE5') return 5;
  return 0;
}

module.exports = { getCouponTier, buildCouponCode, getManualCouponPercent };
