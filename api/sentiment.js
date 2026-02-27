export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const { symbol } = req.query;

  try {
    if (symbol) {
      // Get messages + sentiment for a specific symbol
      const r = await fetch(`https://api.stocktwits.com/api/2/streams/symbol/${symbol.toUpperCase()}.json`, {
        headers: { 'User-Agent': 'MacroDashboard/1.0' }
      });
      const d = await r.json();
      if (d.response?.status === 404) { res.status(404).json({ error: 'Symbol not found' }); return; }

      const messages = (d.messages || []).slice(0, 20).map(m => ({
        body: m.body,
        sentiment: m.entities?.sentiment?.basic || 'neutral',
        user: m.user?.username,
        followers: m.user?.followers || 0,
        created: m.created_at,
        likes: m.likes?.total || 0
      }));

      const bull = messages.filter(m => m.sentiment === 'Bullish').length;
      const bear = messages.filter(m => m.sentiment === 'Bearish').length;
      const total = bull + bear || 1;

      res.status(200).json({
        symbol: symbol.toUpperCase(),
        sentiment: { bullish: bull, bearish: bear, bullPct: Math.round((bull/total)*100), bearPct: Math.round((bear/total)*100) },
        messages,
        title: d.symbol?.title || symbol.toUpperCase()
      });
    } else {
      // Get trending symbols
      const r = await fetch('https://api.stocktwits.com/api/2/trending/symbols.json', {
        headers: { 'User-Agent': 'MacroDashboard/1.0' }
      });
      const d = await r.json();
      const symbols = (d.symbols || []).slice(0, 15).map(s => ({
        symbol: s.symbol,
        title: s.title,
        watchlistCount: s.watchlist_count
      }));

      // Fetch sentiment for top 8 trending
      const withSentiment = await Promise.all(symbols.slice(0, 8).map(async s => {
        try {
          const sr = await fetch(`https://api.stocktwits.com/api/2/streams/symbol/${s.symbol}.json`, {
            headers: { 'User-Agent': 'MacroDashboard/1.0' }
          });
          const sd = await sr.json();
          const msgs = (sd.messages || []).slice(0, 15);
          const bull = msgs.filter(m => m.entities?.sentiment?.basic === 'Bullish').length;
          const bear = msgs.filter(m => m.entities?.sentiment?.basic === 'Bearish').length;
          const total = bull + bear || 1;
          return { ...s, sentiment: { bullish: bull, bearish: bear, bullPct: Math.round((bull/total)*100) } };
        } catch { return { ...s, sentiment: null }; }
      }));

      res.status(200).json({ trending: withSentiment, remaining: symbols.slice(8) });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
