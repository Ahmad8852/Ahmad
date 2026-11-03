'use strict';
const crypto = require('node:crypto');
const reg = require('./providers');
const { Cache } = require('./net');

const cache = new Cache(300, 60_000);
const SORTS = {
  interleave: 'Interleaved – one from each source in turn (default)',
  grouped: 'Grouped by source',
  date: 'Newest first',
  oldest: 'Oldest first',
  random: 'Shuffled (seeded, repeatable)',
};

// "foo bar site:a.com -site:b.com filetype:pdf -spam" -> pieces
function parseQuery(raw) {
  const q = { text: '', sites: [], notSites: [], filetype: '', exclude: [], phrases: [] };
  const out = [];
  const re = /(-?site:\S+|filetype:\S+|-[^\s"-]\S*|-?"[^"]+"|\S+)/g;
  let m;
  while ((m = re.exec(raw || ''))) {
    const t = m[1];
    let r;
    if ((r = /^site:(\S+)/i.exec(t))) q.sites.push(r[1].toLowerCase().replace(/^www\./, ''));
    else if ((r = /^-site:(\S+)/i.exec(t))) q.notSites.push(r[1].toLowerCase().replace(/^www\./, ''));
    else if ((r = /^filetype:(\S+)/i.exec(t))) q.filetype = r[1].toLowerCase().replace(/^\./, '');
    else if ((r = /^-"([^"]+)"$/.exec(t))) q.exclude.push(r[1].toLowerCase());
    else if ((r = /^-(\S+)$/.exec(t))) q.exclude.push(r[1].toLowerCase());
    else { out.push(t); if ((r = /^"([^"]+)"$/.exec(t))) q.phrases.push(r[1].toLowerCase()); }
  }
  q.text = out.join(' ');
  return q;
}

const host = (u) => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } };
const domainMatch = (h, d) => h === d || h.endsWith('.' + d);

function normUrl(u) {
  try {
    const x = new URL(u);
    x.hash = ''; x.hostname = x.hostname.replace(/^www\./, '');
    for (const k of [...x.searchParams.keys()]) if (/^(utm_|fbclid|gclid|mc_)/.test(k)) x.searchParams.delete(k);
    return (x.protocol + '//' + x.host + x.pathname.replace(/\/$/, '') + x.search).toLowerCase();
  } catch { return u; }
}

function normalizeOpts(p) {
  const cat = reg.CATEGORIES.some(([c]) => c === p.cat) ? p.cat : 'web';
  const n = Math.max(3, Math.min(50, parseInt(p.n, 10) || (cat === 'images' ? 30 : 10)));
  return {
    q: String(p.q || '').slice(0, 400).trim(), cat, n,
    page: Math.max(1, Math.min(50, parseInt(p.page, 10) || 1)),
    sort: SORTS[p.sort] ? p.sort : 'interleave',
    time: ['day', 'week', 'month', 'year'].includes(p.time) ? p.time : '',
    sources: Array.isArray(p.sources) ? p.sources : String(p.sources || '').split(',').filter(Boolean),
    site: String(p.site || '').trim(), hide: String(p.hide || '').trim(),
    must: String(p.must || '').trim(), seed: String(p.seed || ''),
    dedupe: p.dedupe !== '0' && p.dedupe !== false,
  };
}

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffle(arr, seed) {
  const rnd = mulberry32(parseInt(crypto.createHash('md5').update(seed).digest('hex').slice(0, 8), 16));
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function applyFilters(items, pq, o) {
  const sites = [...pq.sites, ...o.site.split(/[\s,]+/).filter(Boolean).map((s) => s.toLowerCase().replace(/^www\./, ''))];
  const hide = [...pq.notSites, ...o.hide.split(/[\s,]+/).filter(Boolean).map((s) => s.toLowerCase().replace(/^www\./, ''))];
  const must = o.must.toLowerCase().split(/\s+/).filter(Boolean);
  const cutoff = o.time ? Date.now() - reg.TIME_DAYS[o.time] * 864e5 : 0;
  return items.filter((r) => {
    const h = host(r.url);
    if (sites.length && !sites.some((d) => domainMatch(h, d))) return false;
    if (hide.some((d) => domainMatch(h, d))) return false;
    if (pq.filetype) { try { if (!new URL(r.url).pathname.toLowerCase().endsWith('.' + pq.filetype)) return false; } catch { return false; } }
    const hay = `${r.title} ${r.snippet || ''} ${r.url}`.toLowerCase();
    if (pq.exclude.some((w) => hay.includes(w))) return false;
    if (must.some((w) => !hay.includes(w))) return false;
    if (cutoff && r.date && Date.parse(r.date) < cutoff) return false; // undated results are kept
    return true;
  });
}

function mergeResults(bySource, sort, seed) {
  const ids = Object.keys(bySource);
  let flat = [];
  if (sort === 'grouped') flat = ids.flatMap((id) => bySource[id]);
  else if (sort === 'date' || sort === 'oldest') {
    flat = ids.flatMap((id) => bySource[id]);
    const dir = sort === 'date' ? -1 : 1;
    flat = flat.map((r, i) => [r, i]).sort((a, b) => {
      const ta = a[0].date ? Date.parse(a[0].date) : NaN, tb = b[0].date ? Date.parse(b[0].date) : NaN;
      if (isNaN(ta) && isNaN(tb)) return a[1] - b[1];
      if (isNaN(ta)) return 1;
      if (isNaN(tb)) return -1;
      return (ta - tb) * dir || a[1] - b[1];
    }).map((x) => x[0]);
  } else {
    const max = Math.max(0, ...ids.map((id) => bySource[id].length));
    for (let i = 0; i < max; i++) for (const id of ids) if (bySource[id][i]) flat.push(bySource[id][i]);
    if (sort === 'random') flat = shuffle(flat, seed || 'plainsearch');
  }
  return flat;
}

async function search(params) {
  const o = normalizeOpts(params);
  const pq = parseQuery(o.q);
  const all = reg.forCategory(o.cat);
  const chosen = o.sources.length ? all.filter((p) => o.sources.includes(p.id)) : all;
  const key = JSON.stringify([o, chosen.map((p) => p.id)]);
  const hit = cache.get(key);
  if (hit) return { ...hit, cached: true };

  const t0 = Date.now();
  const engineQ = [pq.text,
    ...pq.sites.map((s) => 'site:' + s), ...pq.notSites.map((s) => '-site:' + s),
    pq.filetype && 'filetype:' + pq.filetype, ...pq.exclude.map((w) => (/\s/.test(w) ? `-"${w}"` : '-' + w)),
  ].filter(Boolean).join(' ') || o.q;
  const plain = pq.text || o.q;

  const settled = await Promise.all(chosen.map(async (p) => {
    const s = Date.now();
    try {
      // Only web engines understand operators; everything else gets the bare terms.
      const q = p.cats.includes('web') && ['ddg', 'mojeek', 'searxng'].includes(p.id) ? engineQ : plain;
      const items = await Promise.race([
        p.run(q, { ...o, cat: o.cat }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 9000)),
      ]);
      return { id: p.id, name: p.name, ok: true, ms: Date.now() - s, items: (items || []).filter((r) => r && r.url && r.title).map((r) => ({ ...r, source: p.id, sourceName: p.name })) };
    } catch (e) {
      return { id: p.id, name: p.name, ok: false, ms: Date.now() - s, error: String((e && e.message) || e).slice(0, 160), items: [] };
    }
  }));

  const sources = settled.map(({ items, ...rest }) => ({ ...rest, count: items.length }));
  const bySource = {};
  const seen = new Set();
  let removed = 0;
  for (const s of settled) {
    bySource[s.id] = applyFilters(s.items, pq, o).filter((r) => {
      if (!o.dedupe) return true;
      const k = normUrl(r.url);
      if (seen.has(k)) { removed++; return false; }
      seen.add(k); return true;
    });
  }
  const results = mergeResults(bySource, o.sort, o.seed);
  const out = { query: o.q, category: o.cat, page: o.page, sort: o.sort, time: o.time, took_ms: Date.now() - t0, total: results.length, duplicates_removed: removed, sources, results };
  if (sources.some((s) => s.ok)) cache.set(key, out);
  return out;
}

// ---- output formats -------------------------------------------------------
const xml = (s) => String(s == null ? '' : s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
function toRss(out, selfUrl) {
  const items = out.results.map((r) => `<item><title>${xml(r.title)}</title><link>${xml(r.url)}</link><description>${xml(r.snippet || '')}</description><source url="${xml(r.url)}">${xml(r.sourceName)}</source>${r.date ? `<pubDate>${new Date(r.date).toUTCString()}</pubDate>` : ''}</item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${xml(out.query)} – plainsearch</title><link>${xml(selfUrl)}</link><description>Unranked results for ${xml(out.query)}</description>${items}</channel></rss>`;
}
function toText(out) {
  return out.results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   [${r.sourceName}]${r.date ? ' ' + r.date.slice(0, 10) : ''}${r.snippet ? '\n   ' + r.snippet : ''}`).join('\n\n') + '\n';
}

module.exports = { search, parseQuery, normalizeOpts, mergeResults, applyFilters, normUrl, SORTS, toRss, toText };
