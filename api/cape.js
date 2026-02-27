export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  try {
    const r = await fetch('https://www.multpl.com/shiller-pe', {
      headers: { 'User-Agent': 'MacroDashboard/1.0' }
    });
    const html = await r.text();

    // Extract current value from the page
    const match = html.match(/Current Shiller PE Ratio.*?<b[^>]*>([\d.]+)<\/b>/is)
      || html.match(/([\d.]+)\s*<\/b>/i)
      || html.match(/id="current"[^>]*>([\d.]+)/i);

    // Try another pattern - multpl shows "Current S&P 500 PE Ratio is XX.XX"
    const altMatch = html.match(/ratio\s+is\s+([\d.]+)/i)
      || html.match(/([\d.]+)\s*$/m);

    let value = null;
    if (match) value = parseFloat(match[1]);
    else if (altMatch) value = parseFloat(altMatch[1]);

    // Fallback: try parsing from meta/title
    if (!value) {
      const titleMatch = html.match(/(\d{2,3}\.\d{1,2})/);
      if (titleMatch) value = parseFloat(titleMatch[1]);
    }

    if (value && value > 5 && value < 100) {
      res.status(200).json({ value, source: 'multpl.com', date: new Date().toISOString().split('T')[0] });
    } else {
      // Hardcoded recent fallback so it never shows blank
      res.status(200).json({ value: 39.95, source: 'fallback (Feb 2026)', date: '2026-02-01', note: 'Could not scrape live value' });
    }
  } catch (e) {
    // Fallback
    res.status(200).json({ value: 39.95, source: 'fallback', date: '2026-02-01', error: e.message });
  }
}
