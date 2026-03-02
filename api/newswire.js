export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  // Aggregate RSS feeds from unconventional/high-value intelligence sources
  const feeds = [
    // Geopolitics & Defense
    { name: 'War on the Rocks', url: 'https://warontherocks.com/feed/', cat: 'GEOPOLITICAL' },
    { name: 'Lawfare', url: 'https://www.lawfaremedia.org/feed', cat: 'GEOPOLITICAL' },
    { name: 'Foreign Affairs', url: 'https://www.foreignaffairs.com/rss.xml', cat: 'GEOPOLITICAL' },
    { name: 'CSIS', url: 'https://www.csis.org/feeds', cat: 'GEOPOLITICAL' },
    { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', cat: 'GEOPOLITICAL' },
    // Economics & Central Banks
    { name: 'Fed Press', url: 'https://www.federalreserve.gov/feeds/press_all.xml', cat: 'ECONOMIC' },
    { name: 'ECB Press', url: 'https://www.ecb.europa.eu/rss/press.html', cat: 'ECONOMIC' },
    { name: 'BIS Speeches', url: 'https://www.bis.org/doclist/cbspeeches.rss', cat: 'ECONOMIC' },
    { name: 'IMF Blog', url: 'https://www.imf.org/en/Blogs/rss', cat: 'ECONOMIC' },
    // Energy & Commodities
    { name: 'OilPrice.com', url: 'https://oilprice.com/rss/main', cat: 'ENERGY' },
    // Technology & Cyber
    { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', cat: 'TECH' },
    { name: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/', cat: 'CYBER' },
    { name: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews', cat: 'CYBER' },
    // Financial / Markets
    { name: 'Reuters Business', url: 'https://feeds.reuters.com/reuters/businessNews', cat: 'MARKET' },
    { name: 'CNBC Economy', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258', cat: 'ECONOMIC' },
    { name: 'FT', url: 'https://www.ft.com/rss/home', cat: 'MARKET' },
    { name: 'Zero Hedge', url: 'https://feeds.feedburner.com/zerohedge/feed', cat: 'MARKET' },
    { name: 'Calculated Risk', url: 'https://www.calculatedriskblog.com/feeds/posts/default?alt=rss', cat: 'ECONOMIC' },
    // Science & Emerging Tech
    { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/', cat: 'TECH' },
    // Disaster / Environment
    { name: 'USGS Earthquakes', url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.atom', cat: 'ENVIRONMENT' },
    { name: 'GDACS', url: 'https://www.gdacs.org/xml/rss.xml', cat: 'ENVIRONMENT' },
  ];

  const results = [];
  const fetchPromises = feeds.map(async feed => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const r = await fetch(feed.url, { 
        headers: { 'User-Agent': 'GlobalIntelPlatform/2.0' },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!r.ok) return;
      const xml = await r.text();
      const items = [];

      // Parse RSS <item> or Atom <entry>
      const rssRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
      const atomRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
      let match;

      const regex = xml.includes('<entry') ? atomRegex : rssRegex;
      const isAtom = xml.includes('<entry');

      while ((match = regex.exec(xml)) !== null && items.length < 5) {
        const block = match[1];
        let title, link, pubDate, desc;

        if (isAtom) {
          title = (block.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i) || [])[1] || '';
          link = (block.match(/<link[^>]*href=["']([^"']+)["']/i) || [])[1] || '';
          pubDate = (block.match(/<published[^>]*>(.*?)<\/published>/i) || block.match(/<updated[^>]*>(.*?)<\/updated>/i) || [])[1] || '';
          desc = (block.match(/<summary[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/summary>/i) || block.match(/<content[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/content>/i) || [])[1] || '';
        } else {
          title = (block.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i) || [])[1] || '';
          link = (block.match(/<link[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/i) || [])[1] || '';
          pubDate = (block.match(/<pubDate[^>]*>(.*?)<\/pubDate>/i) || block.match(/<dc:date[^>]*>(.*?)<\/dc:date>/i) || [])[1] || '';
          desc = (block.match(/<description[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/i) || [])[1] || '';
        }

        if (title) {
          items.push({
            title: title.replace(/<[^>]+>/g, '').trim(),
            link: link.trim(),
            date: pubDate.trim(),
            desc: desc.replace(/<[^>]+>/g, '').trim().slice(0, 250),
            source: feed.name,
            category: feed.cat
          });
        }
      }
      results.push(...items);
    } catch (e) { /* skip failed feed — non-critical */ }
  });

  await Promise.all(fetchPromises);

  // Sort by date, newest first
  results.sort((a, b) => {
    const da = new Date(a.date), db = new Date(b.date);
    if (isNaN(da)) return 1;
    if (isNaN(db)) return -1;
    return db - da;
  });

  // Group by category
  const grouped = {};
  results.forEach(item => {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  });

  res.status(200).json({ 
    articles: results.slice(0, 60),
    grouped,
    feedCount: feeds.length,
    articleCount: results.length,
    timestamp: new Date().toISOString()
  });
}
