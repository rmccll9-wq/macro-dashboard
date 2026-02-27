export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' }); return; }

  try {
    // Use Claude web search to get upcoming earnings
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
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: `Search for "earnings calendar this week" and "major earnings reports next week". Return ONLY a JSON array of upcoming earnings reports for the next 2 weeks. Each object should have: {"symbol": "AAPL", "company": "Apple Inc", "date": "2026-02-28", "timing": "AMC" or "BMO", "estimate_eps": "1.23" or null, "context": "brief 1-line note"}. Return the JSON array and nothing else — no markdown, no backticks, no explanation. Only include companies with market cap over $10B. Sort by date ascending.` }]
      })
    });

    const data = await r.json();
    if (data.error) { res.status(400).json({ error: data.error.message }); return; }

    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    // Try to parse JSON from response
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      const earnings = JSON.parse(clean);
      res.status(200).json({ earnings });
    } catch {
      // If JSON parse fails, return raw text
      res.status(200).json({ earnings: [], raw: text });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
