function getCouponTier(count = 0) {
  const safeCount = Number(count) || 0;
  if (safeCount >= 3) {
    return { key: 'ambassador', percent: 18, label: 'Embajador', next: null };
  }
  if (safeCount >= 2) {
    return { key: 'frequent', percent: 15, label: 'Frecuente', next: { at: 3, percent: 18, label: 'Embajador' } };
  }
  if (safeCount >= 1) {
    return { key: 'recurrent', percent: 10, label: 'Recurrente', next: { at: 2, percent: 15, label: 'Frecuente' } };
  }
  return { key: 'new', percent: 0, label: 'Nuevo', next: { at: 1, percent: 10, label: 'Recurrente' } };
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
