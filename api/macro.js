export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const { api_key, series_id, limit = 2, sort_order = 'desc', mode } = req.query;

  // Calendar mode (merged from calendar.js)
  if (mode === 'calendar') {
    const fomc = [
      { date:'2025-01-29',type:'FOMC Decision',desc:'Rate decision + statement' },
      { date:'2025-03-19',type:'FOMC Decision + SEP',desc:'Rate decision + dot plot + projections' },
      { date:'2025-05-07',type:'FOMC Decision',desc:'Rate decision + statement' },
      { date:'2025-06-18',type:'FOMC Decision + SEP',desc:'Rate decision + dot plot + projections' },
      { date:'2025-07-30',type:'FOMC Decision',desc:'Rate decision + statement' },
      { date:'2025-09-17',type:'FOMC Decision + SEP',desc:'Rate decision + dot plot + projections' },
      { date:'2025-10-29',type:'FOMC Decision',desc:'Rate decision + statement' },
      { date:'2025-12-17',type:'FOMC Decision + SEP',desc:'Rate decision + dot plot + projections' },
      { date:'2026-01-28',type:'FOMC Decision',desc:'Rate decision + statement' },
      { date:'2026-03-18',type:'FOMC Decision + SEP',desc:'Rate decision + dot plot + projections' },
      { date:'2026-05-06',type:'FOMC Decision',desc:'Rate decision + statement' },
      { date:'2026-06-17',type:'FOMC Decision + SEP',desc:'Rate decision + dot plot + projections' },
    ];
    const recurring = [
      { name:'CPI Report',dayOfMonth:12,desc:'Consumer Price Index — BLS' },
      { name:'Jobs Report (NFP)',dayOfMonth:7,desc:'Nonfarm Payrolls — BLS' },
      { name:'PCE Inflation',dayOfMonth:28,desc:'Personal Consumption Expenditures — BEA' },
      { name:'ISM Manufacturing',dayOfMonth:1,desc:'ISM PMI — Institute for Supply Management' },
      { name:'Retail Sales',dayOfMonth:15,desc:'Advance Monthly Retail Sales — Census Bureau' },
      { name:'GDP (Quarterly)',dayOfMonth:25,desc:'GDP Advance/Preliminary/Final — BEA' },
    ];
    const today = new Date(), events = [];
    fomc.forEach(f => { const d=new Date(f.date+'T14:00:00Z'); if(d>=new Date(today.getTime()-7*86400000)){const diff=Math.ceil((d-today)/86400000);events.push({...f,daysAway:diff,category:'fed',isPast:diff<0});} });
    for(let m=0;m<3;m++){const month=new Date(today.getFullYear(),today.getMonth()+m,1);recurring.forEach(r=>{const d=new Date(month.getFullYear(),month.getMonth(),r.dayOfMonth);const diff=Math.ceil((d-today)/86400000);if(diff>=-2&&diff<=60)events.push({date:d.toISOString().split('T')[0],type:r.name,desc:r.desc,daysAway:diff,category:'data',isPast:diff<0});});}
    events.sort((a,b)=>a.daysAway-b.daysAway);
    res.status(200).json({ events: events.slice(0,30) });
    return;
  }

  if (!api_key) { res.status(400).json({ error: 'Missing api_key' }); return; }

  // Single series mode (replaces old fred.js)
  if (series_id) {
    try {
      const r = await fetch('https://api.stlouisfed.org/fred/series/observations?series_id=' + series_id + '&api_key=' + api_key + '&file_type=json&sort_order=' + sort_order + '&limit=' + limit);
      const d = await r.json();
      res.status(200).json(d);
    } catch(e) { res.status(500).json({ error: e.message }); }
    return;
  }

  // Extended FRED series for deeper macro view
  const series = {
    // Labor
    UNRATE: { name: 'Unemployment Rate', unit: '%', cat: 'labor' },
    PAYEMS: { name: 'Nonfarm Payrolls', unit: 'K', cat: 'labor', transform: 'chg' },
    ICSA: { name: 'Initial Jobless Claims', unit: 'K', cat: 'labor' },
    U6RATE: { name: 'U-6 Underemployment', unit: '%', cat: 'labor' },
    // Growth
    GDP: { name: 'Real GDP (QoQ Ann.)', unit: '%', cat: 'growth', transform: 'pctchg' },
    INDPRO: { name: 'Industrial Production', unit: 'idx', cat: 'growth' },
    RSXFS: { name: 'Retail Sales ex-Food/Auto', unit: '$B', cat: 'growth' },
    // Housing
    HOUST: { name: 'Housing Starts', unit: 'K', cat: 'housing' },
    MORTGAGE30US: { name: '30Y Mortgage Rate', unit: '%', cat: 'housing' },
    CSUSHPINSA: { name: 'Case-Shiller Home Price', unit: 'idx', cat: 'housing' },
    // Money & Credit
    M2SL: { name: 'M2 Money Supply', unit: '$T', cat: 'money' },
    TOTRESNS: { name: 'Bank Reserves', unit: '$B', cat: 'money' },
    DRCCLACBS: { name: 'Credit Card Delinquency', unit: '%', cat: 'money' },
    // Sentiment
    UMCSENT: { name: 'Michigan Consumer Sent.', unit: 'idx', cat: 'sentiment' },
    // Manufacturing
    MANEMP: { name: 'Manufacturing Employment', unit: 'K', cat: 'manufacturing' },
    NEWORDER: { name: 'New Orders (Mfg)', unit: '$M', cat: 'manufacturing' },
  };

  const results = {};
  const fetches = Object.entries(series).map(async ([id, meta]) => {
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${api_key}&file_type=json&sort_order=desc&limit=3`;
      const r = await fetch(url);
      const d = await r.json();
      if (d.error_message) return;
      const obs = (d.observations || []).filter(o => o.value !== '.');
      if (!obs.length) return;
      const val = +obs[0].value;
      const prev = obs[1] ? +obs[1].value : null;
      results[id] = { ...meta, value: val, prev, date: obs[0].date, seriesId: id };
    } catch (e) { /* skip */ }
  });

  await Promise.all(fetches);
  res.status(200).json({ data: results });
}
