export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  try {
    const feeds = [
      { name: 'Fed Press Releases', url: 'https://www.federalreserve.gov/feeds/press_all.xml' },
      { name: 'Reuters Business', url: 'https://feeds.reuters.com/reuters/businessNews' },
      { name: 'CNBC Economy', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258' },
    ];

    const results = [];
    for (const feed of feeds) {
      try {
        const r = await fetch(feed.url, { headers: { 'User-Agent': 'MacroDashboard/1.0' } });
        if (!r.ok) continue;
        const xml = await r.text();
        const items = [];
        const regex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
        let match;
        while ((match = regex.exec(xml)) !== null && items.length < 8) {
          const block = match[1];
          const title = (block.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i) || [])[1] || '';
          const link = (block.match(/<link[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/i) || [])[1] || '';
          const pubDate = (block.match(/<pubDate[^>]*>(.*?)<\/pubDate>/i) || [])[1] || '';
          const desc = (block.match(/<description[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/i) || [])[1] || '';
          if (title) items.push({ title: title.trim(), link: link.trim(), date: pubDate.trim(), desc: desc.replace(/<[^>]+>/g,'').trim().slice(0,200), source: feed.name });
        }
        results.push(...items);
      } catch (e) { /* skip failed feed */ }
    }

    results.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.status(200).json({ articles: results.slice(0, 25) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
