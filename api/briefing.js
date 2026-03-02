export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' }); return; }

  try {
    const { macroData } = req.body;

    const systemPrompt = `You are a senior intelligence analyst preparing a Presidential Daily Brief (PDB) style morning intelligence report for a sophisticated investor/decision-maker. This is their most important document of the day.

FORMAT THE BRIEF EXACTLY AS FOLLOWS:

═══════════════════════════════════════
DAILY INTELLIGENCE BRIEF
[Today's date] · [Day of week] · Classification: EYES ONLY
═══════════════════════════════════════

I. THREAT ASSESSMENT (Current global threat level: [LOW/GUARDED/ELEVATED/HIGH/SEVERE])
One paragraph summarizing the overall risk environment and any overnight developments.

II. TOP PRIORITY ITEMS (Items requiring immediate attention)
Number each item. 3-5 most critical items across all domains. Each gets a threat level marker.

III. MARKET INTELLIGENCE
- Pre-market positioning and overnight moves
- Key levels to watch today
- Unusual activity detected (options, dark pools, insider)

IV. GEOPOLITICAL WATCH
- Active conflict zones status
- Diplomatic developments
- Sanctions/trade policy updates

V. ECONOMIC SIGNALS
- Central bank actions/communications
- Leading indicator changes
- Supply chain/inflation signals

VI. DEVELOPING SITUATIONS
Items to monitor that could escalate. Include probability assessments.

VII. CONTRARIAN WATCH
Where consensus may be wrong. What the crowd is missing.

VIII. 24-HOUR OUTLOOK
What to watch for in the next 24 hours. Key decision points.

═══════════════════════════════════════
BOTTOM LINE: [Single most important takeaway in bold]
═══════════════════════════════════════

Be specific, data-driven, and actionable. No fluff. This person needs an edge.`;

    const userMsg = macroData 
      ? `Generate today's Daily Intelligence Brief. Here is current macro data for context:\n${JSON.stringify(macroData, null, 2)}\n\nSearch the web for the latest overnight developments, market-moving news, geopolitical events, and any unusual signals. This brief should cover everything that happened since yesterday's close and what matters today.`
      : `Generate today's Daily Intelligence Brief. Search the web for the latest overnight developments, pre-market action, geopolitical events, economic data releases, and any unusual signals. This brief should give me a comprehensive view of what happened overnight and what matters today.`;

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
    res.status(200).json({ briefing: text, timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
