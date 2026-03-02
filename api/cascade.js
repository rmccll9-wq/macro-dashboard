export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' }); return; }

  try {
    const { event, macroData } = req.body;
    if (!event) { res.status(400).json({ error: 'Missing event' }); return; }

    const systemPrompt = `You are CASCADE, a geopolitical risk contagion engine. Given a triggering event, search the web for current context, then map cascading 2nd/3rd/4th-order consequences across domains: ENERGY, FINANCIAL, MILITARY, TRADE, CYBER, POLITICAL, HUMANITARIAN, TECHNOLOGY, FOOD, MONETARY.

Return ONLY valid JSON (no markdown/backticks):
{"trigger":"event description","overall_threat_level":"SEVERE|HIGH|ELEVATED|GUARDED|LOW","confidence":75,"time_horizon":"timeline","cascades":[{"id":"1","order":1,"effect":"specific consequence with real numbers/names","domain":"DOMAIN","probability":85,"severity":4,"timeframe":"0-48h|1-2wk|1-3mo|3-12mo","parent":null,"watch_trigger":"confirming signal","current_status":"what's happening now"}],"convergence_points":[{"description":"where paths meet","feeding_nodes":["1.1","2.1"],"risk_multiplier":"amplification effect"}],"black_swans":[{"scenario":"low-prob accelerator","probability":10,"impact":"nightmare outcome","acceleration":"timeline change"}],"contrarian_view":"where consensus is wrong","bottom_line":"key takeaway"}

Rules: 12-20 nodes across 5+ domains. Use id format "1","1.1","1.2","2","2.1" etc. parent=null for 1st-order. Be specific with real data from web search. Include 2-3 convergence points and 2 black swans.`;

    const userMsg = `EVENT: ${event}\n\nSearch the web for current real-world context, then build the cascade contagion tree.`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 5000,
        system: systemPrompt,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: userMsg }]
      })
    });

    const data = await r.json();
    if (data.error) { res.status(400).json({ error: data.error.message }); return; }
    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('\n');

    try {
      const clean = text.replace(/```json|```/g, '').trim();
      const cascade = JSON.parse(clean);
      res.status(200).json({ cascade, timestamp: new Date().toISOString() });
    } catch {
      res.status(200).json({ raw: text, timestamp: new Date().toISOString() });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
