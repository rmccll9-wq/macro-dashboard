export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' }); return; }

  try {
    const { macroData, question } = req.body;
    const systemPrompt = `You are an elite macro strategist and market analyst. You have access to live economic data from FRED (Federal Reserve Economic Data). Your job is to provide institutional-quality market analysis, regime identification, and actionable insights.

Be direct, specific, and data-driven. Reference actual numbers from the data provided. Identify:
- Current macro regime (expansion, late-cycle, contraction, recovery)
- Key risks and tail risks
- Historical analogs (what past periods looked like this)
- What to watch next (upcoming catalysts, data releases)
- Cross-asset implications (bonds, equities, commodities, USD)

Format with clear sections. Be concise but thorough. No fluff.`;

    const userMsg = question
      ? `Here is the current live macro data:\n${JSON.stringify(macroData, null, 2)}\n\nUser question: ${question}`
      : `Here is the current live macro data:\n${JSON.stringify(macroData, null, 2)}\n\nProvide a comprehensive macro regime assessment and market outlook based on this data.`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMsg }]
      })
    });

    const data = await r.json();
    if (data.error) { res.status(400).json({ error: data.error.message }); return; }
    const text = data.content.map(b => b.text || '').join('\n');
    res.status(200).json({ analysis: text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
