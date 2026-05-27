const { sendJson } = require('../_lib/http');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return sendJson(res, 500, { error: 'Supabase Auth no esta configurado' });
  }

  sendJson(res, 200, {
    data: {
      supabaseUrl: process.env.SUPABASE_URL.replace(/\/$/, ''),
      anonKey: process.env.SUPABASE_ANON_KEY,
      providers: ['google', 'facebook', 'apple']
    }
  });
};
