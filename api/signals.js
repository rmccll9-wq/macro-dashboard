export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' }); return; }

  try {
    const { macroData, marketContext } = req.body;

    const systemPrompt = `You are an advanced signal detection system. Your job is to identify anomalies, narrative shifts, and non-obvious patterns that most market participants miss.

Analyze available data and web signals to detect:

1. ANOMALY DETECTION
- Statistical outliers in market data
- Unusual divergences between correlated assets
- Volume/volatility spikes without clear catalysts
- Credit market stress signals (CDS, spreads, repo)

2. NARRATIVE SHIFTS
- Changes in how media/analysts are framing key stories
- Sentiment reversals on social media
- New narratives emerging that could move markets
- Consensus that is starting to crack

3. SMART MONEY SIGNALS
- Unusual options activity (large blocks, unusual strikes)
- Insider trading clusters (multiple insiders buying/selling)
- Institutional flow patterns
- Dark pool activity anomalies

4. LEADING INDICATORS
- Signals that historically precede major moves
- Cross-asset divergences that typically resolve
- Credit leading equity (or vice versa)
- International signals that US markets haven't priced

FORMAT each signal:
🔴/🟡/🟢 [SIGNAL NAME]
Confidence: [HIGH/MEDIUM/LOW]
Signal: What was detected
Context: Why this matters historically  
Implication: What this suggests could happen
Timeframe: When this typically plays out

End with an overall SIGNAL STRENGTH assessment and the single highest-conviction signal.`;

    const userMsg = macroData
      ? `Analyze current conditions and search the web for unusual market signals and anomalies. Current macro data:\n${JSON.stringify(macroData, null, 2)}\n\n${marketContext ? 'Additional context: ' + marketContext : ''}\n\nSearch for unusual options activity, insider trading patterns, credit market stress, sentiment shifts on Twitter/X, and any statistical anomalies in current market data.`
      : `Search the web for unusual market signals and anomalies right now. Look for unusual options activity, insider trading patterns, credit market stress, narrative shifts in financial media, sentiment changes on Twitter/X, and any divergences or anomalies in current market conditions.`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: systemPrompt,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: userMsg }]
      })
    });

    const data = await r.json();
    if (data.error) { res.status(400).json({ error: data.error.message }); return; }
    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    res.status(200).json({ signals: text, timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
