export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const { symbol, range = '2y' } = req.query;
  if (!symbol) { res.status(400).json({ error: 'Missing symbol' }); return; }

  try {
    // Yahoo Finance chart API — free, no key needed
    const rangeMap = { '1y': { range: '1y', interval: '1d' }, '2y': { range: '2y', interval: '1d' }, '5y': { range: '5y', interval: '1wk' } };
    const cfg = rangeMap[range] || rangeMap['2y'];
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol.toUpperCase())}?range=${cfg.range}&interval=${cfg.interval}&includePrePost=false`;

    const r = await fetch(url, { headers: { 'User-Agent': 'MacroDashboard/1.0' } });
    const d = await r.json();

    if (d.chart?.error) { res.status(400).json({ error: d.chart.error.description }); return; }

    const result = d.chart?.result?.[0];
    if (!result) { res.status(404).json({ error: 'No data found for ' + symbol }); return; }

    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const closes = quote.close || [];
    const highs = quote.high || [];
    const lows = quote.low || [];
    const volumes = quote.volume || [];

    const prices = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] == null) continue;
      prices.push({
        date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
        close: +closes[i].toFixed(2),
        high: highs[i] ? +highs[i].toFixed(2) : null,
        low: lows[i] ? +lows[i].toFixed(2) : null,
        volume: volumes[i] || 0
      });
    }

    const meta = result.meta || {};
    res.status(200).json({
      symbol: meta.symbol || symbol.toUpperCase(),
      currency: meta.currency || 'USD',
      name: meta.shortName || meta.symbol || symbol,
      prices,
      range: cfg.range,
      interval: cfg.interval
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
