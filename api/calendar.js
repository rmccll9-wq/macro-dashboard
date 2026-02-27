export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  // FOMC 2025-2026 meeting dates
  const fomc = [
    { date: '2025-01-29', type: 'FOMC Decision', desc: 'Rate decision + statement' },
    { date: '2025-03-19', type: 'FOMC Decision + SEP', desc: 'Rate decision + dot plot + projections' },
    { date: '2025-05-07', type: 'FOMC Decision', desc: 'Rate decision + statement' },
    { date: '2025-06-18', type: 'FOMC Decision + SEP', desc: 'Rate decision + dot plot + projections' },
    { date: '2025-07-30', type: 'FOMC Decision', desc: 'Rate decision + statement' },
    { date: '2025-09-17', type: 'FOMC Decision + SEP', desc: 'Rate decision + dot plot + projections' },
    { date: '2025-10-29', type: 'FOMC Decision', desc: 'Rate decision + statement' },
    { date: '2025-12-17', type: 'FOMC Decision + SEP', desc: 'Rate decision + dot plot + projections' },
    { date: '2026-01-28', type: 'FOMC Decision', desc: 'Rate decision + statement' },
    { date: '2026-03-18', type: 'FOMC Decision + SEP', desc: 'Rate decision + dot plot + projections' },
    { date: '2026-05-06', type: 'FOMC Decision', desc: 'Rate decision + statement' },
    { date: '2026-06-17', type: 'FOMC Decision + SEP', desc: 'Rate decision + dot plot + projections' },
  ];

  // Key economic data release estimates (recurring monthly)
  const recurring = [
    { name: 'CPI Report', dayOfMonth: 12, desc: 'Consumer Price Index — BLS' },
    { name: 'Jobs Report (NFP)', dayOfMonth: 7, desc: 'Nonfarm Payrolls — BLS' },
    { name: 'PCE Inflation', dayOfMonth: 28, desc: 'Personal Consumption Expenditures — BEA' },
    { name: 'ISM Manufacturing', dayOfMonth: 1, desc: 'ISM PMI — Institute for Supply Management' },
    { name: 'Retail Sales', dayOfMonth: 15, desc: 'Advance Monthly Retail Sales — Census Bureau' },
    { name: 'GDP (Quarterly)', dayOfMonth: 25, desc: 'GDP Advance/Preliminary/Final — BEA' },
  ];

  const today = new Date();
  const events = [];

  // Add FOMC dates
  fomc.forEach(f => {
    const d = new Date(f.date + 'T14:00:00Z');
    if (d >= new Date(today.getTime() - 7*86400000)) {
      const diff = Math.ceil((d - today) / 86400000);
      events.push({ ...f, daysAway: diff, category: 'fed', isPast: diff < 0 });
    }
  });

  // Generate upcoming recurring data releases for next 60 days
  for (let m = 0; m < 3; m++) {
    const month = new Date(today.getFullYear(), today.getMonth() + m, 1);
    recurring.forEach(r => {
      const d = new Date(month.getFullYear(), month.getMonth(), r.dayOfMonth);
      const diff = Math.ceil((d - today) / 86400000);
      if (diff >= -2 && diff <= 60) {
        events.push({ date: d.toISOString().split('T')[0], type: r.name, desc: r.desc, daysAway: diff, category: 'data', isPast: diff < 0 });
      }
    });
  }

  events.sort((a, b) => a.daysAway - b.daysAway);
  res.status(200).json({ events: events.slice(0, 30) });
}
