export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const { api_key } = req.query;
  if (!api_key) { res.status(400).json({ error: 'Missing api_key' }); return; }

  const fetchFred = async (id, limit = 2) => {
    try {
      const r = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${api_key}&file_type=json&sort_order=desc&limit=${limit}`);
      const d = await r.json();
      return (d.observations || []).filter(o => o.value !== '.').map(o => +o.value);
    } catch { return []; }
  };

  try {
    const [vix, spread, baa, aaa, sp500, sp500Hist] = await Promise.all([
      fetchFred('VIXCLS', 2),
      fetchFred('T10Y2Y', 2),
      fetchFred('DBAA', 2),      // Baa corporate bond yield
      fetchFred('DAAA', 2),      // Aaa corporate bond yield
      fetchFred('SP500', 5),
      fetchFred('SP500', 126),   // ~6 months for momentum
    ]);

    const scores = {};

    // 1. VIX Score (0-100, lower VIX = more greedy)
    if (vix.length) {
      const v = vix[0];
      scores.vix = { value: v, score: v < 12 ? 95 : v < 15 ? 80 : v < 20 ? 60 : v < 25 ? 40 : v < 30 ? 20 : 5, label: v < 15 ? 'Extreme Greed' : v < 20 ? 'Greed' : v < 25 ? 'Neutral' : v < 30 ? 'Fear' : 'Extreme Fear' };
    }

    // 2. Yield Curve Score
    if (spread.length) {
      const s = spread[0];
      scores.yieldCurve = { value: s, score: s > 1.5 ? 85 : s > 0.5 ? 70 : s > 0 ? 50 : s > -0.5 ? 25 : 10, label: s > 0.5 ? 'Greed' : s > 0 ? 'Neutral' : 'Fear (Inverted)' };
    }

    // 3. Credit Spread Score (Baa - Aaa, tighter = greedy)
    if (baa.length && aaa.length) {
      const cs = baa[0] - aaa[0];
      scores.creditSpread = { value: +cs.toFixed(2), score: cs < 0.7 ? 90 : cs < 1.0 ? 75 : cs < 1.5 ? 50 : cs < 2.0 ? 25 : 10, label: cs < 1.0 ? 'Greed' : cs < 1.5 ? 'Neutral' : 'Fear' };
    }

    // 4. Market Momentum (S&P vs 125-day SMA)
    if (sp500Hist.length > 100) {
      const current = sp500Hist[0];
      const avg = sp500Hist.slice(0, 125).reduce((a, b) => a + b, 0) / 125;
      const pctAbove = ((current - avg) / avg) * 100;
      scores.momentum = { value: +pctAbove.toFixed(1), score: pctAbove > 10 ? 90 : pctAbove > 5 ? 75 : pctAbove > 0 ? 55 : pctAbove > -5 ? 30 : 10, label: pctAbove > 5 ? 'Greed' : pctAbove > 0 ? 'Neutral' : 'Fear' };
    }

    // 5. VIX Momentum (is VIX rising or falling)
    if (vix.length >= 2) {
      const chg = vix[0] - vix[1];
      scores.vixMomentum = { value: +chg.toFixed(2), score: chg < -3 ? 85 : chg < -1 ? 70 : chg < 1 ? 50 : chg < 3 ? 30 : 10, label: chg < -1 ? 'Greed (VIX falling)' : chg < 1 ? 'Neutral' : 'Fear (VIX rising)' };
    }

    // Composite
    const allScores = Object.values(scores).map(s => s.score);
    const composite = allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 50;
    const compositeLabel = composite >= 80 ? 'Extreme Greed' : composite >= 60 ? 'Greed' : composite >= 40 ? 'Neutral' : composite >= 20 ? 'Fear' : 'Extreme Fear';

    res.status(200).json({ composite, label: compositeLabel, components: scores });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
