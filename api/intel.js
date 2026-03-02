export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' }); return; }

  try {
    const { category = 'all', customQuery } = req.body;

    const categoryPrompts = {
      all: `Search the web comprehensively for the most important and unusual developments in the last 24-48 hours across: geopolitics, military/defense, global economics, energy/commodities, technology disruption, cyber threats, and unconventional signals. Focus on things most people would MISS — not mainstream headlines everyone already knows. Look for:
- Unusual military movements or defense posture changes
- Sanctions, trade policy shifts, or diplomatic ruptures
- Central bank actions outside the US (BOJ, ECB, PBOC, emerging markets)
- Energy infrastructure disruptions or OPEC+ signals
- Cyber attacks on critical infrastructure
- Unusual options flow or insider trading patterns mentioned on financial Twitter/X
- Supply chain disruptions
- Political instability in key regions
- Tech regulatory actions globally
- Commodity market anomalies

Search Twitter/X for posts from credible OSINT accounts, defense analysts, and macro traders. Search for unusual patterns others might miss.`,

      geopolitical: `Search the web for the latest geopolitical developments, military movements, diplomatic shifts, sanctions, and conflict zone updates. Include OSINT from Twitter/X. Focus on: US-China relations, Russia/Ukraine, Middle East, Taiwan Strait, North Korea, NATO movements, and emerging flashpoints.`,

      markets_dark: `Search the web and Twitter/X for unusual market signals that most retail investors would miss: dark pool activity, unusual options flow, insider buying/selling clusters, repo market stress, credit default swap movements, sovereign debt concerns, shadow banking risks, and contrarian positioning by smart money. Look for hedge fund manager commentary and unusual patterns.`,

      energy_commodities: `Search the web for critical energy and commodity intelligence: oil supply disruptions, natural gas storage anomalies, rare earth supply chains, agricultural commodity shocks, shipping lane disruptions, OPEC+ dynamics, LNG market shifts, and energy infrastructure threats. Include geopolitical risks to energy.`,

      tech_cyber: `Search the web for technology disruption signals and cyber intelligence: major cyber attacks, zero-day exploits being actively used, AI regulatory moves globally, semiconductor supply chain updates, tech company layoffs/pivots, Chinese tech developments, quantum computing milestones, and critical infrastructure vulnerabilities.`,

      social_unrest: `Search the web and Twitter/X for social unrest indicators, protest movements, political instability, election disruptions, labor strikes in key industries, immigration policy shifts, and populist movement developments globally.`,

      x_osint: `Search Twitter/X specifically for the latest posts from OSINT analysts, defense intelligence accounts, macro traders, and geopolitical commentators. Look for: satellite imagery analysis, military movement tracking, unusual financial flows, and insider perspectives. Focus on what's being discussed in informed circles that hasn't hit mainstream news yet.`
    };

    const prompt = customQuery || categoryPrompts[category] || categoryPrompts.all;

    const systemPrompt = `You are SIGINT — a global intelligence analyst operating a signals intelligence desk. Your job is to surface the most critical, non-obvious information that gives your principal an edge over 99% of the population.

RULES:
- Lead with the MOST critical/actionable item first
- Assign a THREAT LEVEL (1-5) to each item: 1=Monitor, 2=Elevated, 3=High, 4=Critical, 5=Flash/Immediate
- Tag each item with a CATEGORY: GEOPOLITICAL | MILITARY | ECONOMIC | ENERGY | CYBER | SOCIAL | MARKET | TECH
- Include source attribution
- Flag items that are DEVELOPING (situation still evolving)
- Note CONTRARIAN signals — where consensus may be wrong
- Be specific — names, numbers, dates, not vague summaries
- If you find conflicting signals, highlight the contradiction

FORMAT each intelligence item as:
[THREAT_LEVEL] [CATEGORY] — Headline
Brief (2-3 sentence) intelligence summary with specific details.
Source: [attribution]
Status: DEVELOPING | CONFIRMED | MONITORING
Implications: One sentence on why this matters.

End with a BOTTOM LINE assessment: What is the single most important thing to watch in the next 24 hours.`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 4000,
        system: systemPrompt,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await r.json();
    if (data.error) { res.status(400).json({ error: data.error.message }); return; }
    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    res.status(200).json({ intel: text, category, timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
