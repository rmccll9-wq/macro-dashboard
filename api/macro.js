export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const { api_key, series_id, limit = 2, sort_order = 'desc' } = req.query;
  if (!api_key) { res.status(400).json({ error: 'Missing api_key' }); return; }

  // Single series mode (replaces old fred.js)
  if (series_id) {
    try {
      const r = await fetch('https://api.stlouisfed.org/fred/series/observations?series_id=' + series_id + '&api_key=' + api_key + '&file_type=json&sort_order=' + sort_order + '&limit=' + limit);
      const d = await r.json();
      res.status(200).json(d);
    } catch(e) { res.status(500).json({ error: e.message }); }
    return;
  }

  // Extended FRED series for deeper macro view
  const series = {
    // Labor
    UNRATE: { name: 'Unemployment Rate', unit: '%', cat: 'labor' },
    PAYEMS: { name: 'Nonfarm Payrolls', unit: 'K', cat: 'labor', transform: 'chg' },
    ICSA: { name: 'Initial Jobless Claims', unit: 'K', cat: 'labor' },
    U6RATE: { name: 'U-6 Underemployment', unit: '%', cat: 'labor' },
    // Growth
    GDP: { name: 'Real GDP (QoQ Ann.)', unit: '%', cat: 'growth', transform: 'pctchg' },
    INDPRO: { name: 'Industrial Production', unit: 'idx', cat: 'growth' },
    RSXFS: { name: 'Retail Sales ex-Food/Auto', unit: '$B', cat: 'growth' },
    // Housing
    HOUST: { name: 'Housing Starts', unit: 'K', cat: 'housing' },
    MORTGAGE30US: { name: '30Y Mortgage Rate', unit: '%', cat: 'housing' },
    CSUSHPINSA: { name: 'Case-Shiller Home Price', unit: 'idx', cat: 'housing' },
    // Money & Credit
    M2SL: { name: 'M2 Money Supply', unit: '$T', cat: 'money' },
    TOTRESNS: { name: 'Bank Reserves', unit: '$B', cat: 'money' },
    DRCCLACBS: { name: 'Credit Card Delinquency', unit: '%', cat: 'money' },
    // Sentiment
    UMCSENT: { name: 'Michigan Consumer Sent.', unit: 'idx', cat: 'sentiment' },
    // Manufacturing
    MANEMP: { name: 'Manufacturing Employment', unit: 'K', cat: 'manufacturing' },
    NEWORDER: { name: 'New Orders (Mfg)', unit: '$M', cat: 'manufacturing' },
  };

  const results = {};
  const fetches = Object.entries(series).map(async ([id, meta]) => {
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${api_key}&file_type=json&sort_order=desc&limit=3`;
      const r = await fetch(url);
      const d = await r.json();
      if (d.error_message) return;
      const obs = (d.observations || []).filter(o => o.value !== '.');
      if (!obs.length) return;
      const val = +obs[0].value;
      const prev = obs[1] ? +obs[1].value : null;
      results[id] = { ...meta, value: val, prev, date: obs[0].date, seriesId: id };
    } catch (e) { /* skip */ }
  });

  await Promise.all(fetches);
  res.status(200).json({ data: results });
}
