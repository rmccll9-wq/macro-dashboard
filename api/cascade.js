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

    const systemPrompt = `You are CASCADE — an advanced geopolitical risk contagion analysis engine. You model how triggering events propagate through interconnected global systems, mapping the 2nd, 3rd, and 4th-order consequences that most analysts, traders, and policymakers miss entirely.

Your analytical framework maps contagion across these domains: ENERGY, FINANCIAL, MILITARY, TRADE, CYBER, POLITICAL, HUMANITARIAN, TECHNOLOGY, FOOD/AGRICULTURE, MONETARY.

METHODOLOGY:
1. Search the web for the CURRENT real-world context surrounding this event — what's actually happening right now, existing tensions, recent developments, current market conditions, and relevant precedents
2. Build a cascading consequence tree where each node triggers further downstream effects
3. Score each consequence on PROBABILITY (0-100%), SEVERITY (1-5), and TIMEFRAME
4. Identify convergence points where multiple cascade paths intersect (these are the highest-risk nodes)
5. Flag black swan amplifiers — low-probability events that would dramatically accelerate the cascade

RESPOND WITH EXACTLY THIS JSON STRUCTURE AND NOTHING ELSE — no markdown, no backticks, no explanation:
{
  "trigger": "Brief description of triggering event",
  "overall_threat_level": "SEVERE|HIGH|ELEVATED|GUARDED|LOW",
  "confidence": 75,
  "time_horizon": "Description of how fast this plays out",
  "cascades": [
    {
      "id": "1",
      "order": 1,
      "effect": "Description of the consequence (1-2 sentences, specific with numbers/names where possible)",
      "domain": "ENERGY|FINANCIAL|MILITARY|TRADE|CYBER|POLITICAL|HUMANITARIAN|TECHNOLOGY|FOOD|MONETARY",
      "probability": 85,
      "severity": 4,
      "timeframe": "0-48 hours|1-2 weeks|1-3 months|3-12 months",
      "parent": null,
      "watch_trigger": "The specific data point or event that confirms this path is activating",
      "current_status": "What the web search reveals about whether this is already happening"
    },
    {
      "id": "1.1",
      "order": 2,
      "effect": "Second-order consequence triggered by node 1",
      "domain": "FINANCIAL",
      "probability": 70,
      "severity": 3,
      "timeframe": "1-2 weeks",
      "parent": "1",
      "watch_trigger": "...",
      "current_status": "..."
    }
  ],
  "convergence_points": [
    {
      "description": "Where multiple cascade paths meet — why this is the most dangerous node",
      "feeding_nodes": ["1.1", "2.2", "3.1"],
      "risk_multiplier": "How this convergence amplifies risk beyond the sum of individual paths"
    }
  ],
  "black_swans": [
    {
      "scenario": "Low-probability event that would dramatically accelerate the cascade",
      "probability": 10,
      "impact": "What happens if this triggers — the nightmare scenario",
      "acceleration": "How it changes the timeline and severity of the cascade"
    }
  ],
  "contrarian_view": "Where consensus may be wrong — the scenario most people aren't considering",
  "bottom_line": "Single most important takeaway — what to watch and what to do"
}

CRITICAL RULES:
- Generate 15-25 cascade nodes, covering at least 5 domains
- Every 1st-order node (parent:null) should have at least 2 downstream children
- Include at least 3 convergence points
- Include at least 2 black swan scenarios
- Use REAL current data from web search — reference actual prices, names, positions, recent events
- Be brutally specific: not "oil prices rise" but "Brent crude spikes above $110 as Hormuz transit insurance premiums triple"
- Score probability honestly — not everything is high probability
- The contrarian view should be genuinely contrarian, not a hedge
- RETURN ONLY VALID JSON — no text before or after`;

    const userMsg = macroData
      ? `TRIGGERING EVENT: ${event}\n\nCURRENT MACRO CONTEXT:\n${JSON.stringify(macroData, null, 2)}\n\nSearch the web for the latest real-world context surrounding this event. What is actually happening right now? What are current market conditions, geopolitical tensions, and relevant developments? Then build the full cascade contagion tree with real data.`
      : `TRIGGERING EVENT: ${event}\n\nSearch the web for the latest real-world context surrounding this event. What is actually happening right now? What are current market conditions, geopolitical tensions, and relevant developments? Then build the full cascade contagion tree with real data.`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        system: systemPrompt,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: userMsg }]
      })
    });

    const data = await r.json();
    if (data.error) { res.status(400).json({ error: data.error.message }); return; }
    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('\n');

    // Try to parse structured JSON
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      const cascade = JSON.parse(clean);
      res.status(200).json({ cascade, timestamp: new Date().toISOString() });
    } catch {
      // If JSON parsing fails, return raw for the frontend to render as text
      res.status(200).json({ raw: text, timestamp: new Date().toISOString() });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
