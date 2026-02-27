export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  const { series_id, api_key, limit = 2, sort_order = 'desc' } = req.query;
  if (!series_id || !api_key) { res.status(400).json({ error: 'Missing params' }); return; }
  try {
    const r = await fetch('https://api.stlouisfed.org/fred/series/observations?series_id=' + series_id + '&api_key=' + api_key + '&file_type=json&sort_order=' + sort_order + '&limit=' + limit);
    const d = await r.json();
    res.status(200).json(d);
  } catch(e) { res.status(500).json({ error: e.message }); }
}