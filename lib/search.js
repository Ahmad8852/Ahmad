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

function normalizeOpts(p, defLimit = 100) {
  const cat = reg.CATEGORIES.some(([c]) => c === p.cat) ? p.cat : 'web';
  return {
    q: String(p.q || '').slice(0, 400).trim(), cat,
    limit: Math.max(10, Math.min(2000, parseInt(p.limit, 10) || defLimit)),
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

const JOBS = new Cache(40, 10 * 60_000);   // finished searches, so paging & repeat searches are instant
const INFLIGHT = new Map();                 // key -> { promise, listeners }
const REQ_TIMEOUT = 7000, DEADLINE = 25000, PAGE_WORKERS = 4;

// Global cap on simultaneous upstream requests, so 75 sources x several pages never swamp your connection.
const MAX_INFLIGHT = parseInt(process.env.PLAINSEARCH_CONCURRENCY, 10) || 40;
let active = 0; const waiting = [];
async function slot(fn) {
  if (active >= MAX_INFLIGHT) await new Promise((r) => waiting.push(r));
  active++;
  try { return await fn(); } finally { active--; const n = waiting.shift(); if (n) n(); }
}

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

// Fetch as many pages as the source allows (up to `limit`), reporting after every page.
async function fetchSource(p, q, o, st, deadline, update) {
  const per = p.per || 10;
  const depth = Math.min(p.maxDepth || per, o.limit);
  const pages = Math.max(1, Math.ceil(depth / per));
  const got = {};
  const assemble = () => Object.keys(got).map(Number).sort((a, b) => a - b).flatMap((k) => got[k]).slice(0, depth);
  const t0 = Date.now();
  const get = async (pg) => {
    const rem = deadline - Date.now();
    if (rem < 400) throw new Error('deadline reached');
    const items = await slot(() => withTimeout(p.run(q, { ...o, page: pg, n: per }), Math.min(p.timeout || REQ_TIMEOUT, rem)));
    return (items || []).filter((r) => r && r.url && r.title).map((r) => ({ ...r, source: p.id, sourceName: p.name }));
  };
  let first;
  try { first = await get(1); } catch (e) {
    Object.assign(st, { pending: false, ok: false, ms: Date.now() - t0, error: String((e && e.message) || e).slice(0, 160) });
    update(p.id, []); return;
  }
  got[1] = first; Object.assign(st, { ok: true, count: first.length, ms: Date.now() - t0, pages: 1 });
  update(p.id, assemble());
  if (pages > 1 && first.length >= per * 0.6) {
    let next = 2, stop = false;
    const worker = async () => {
      while (!stop && next <= pages) {
        const pg = next++;
        try {
          const r = await get(pg);
          if (!r.length) stop = true; else got[pg] = r;
        } catch (e) { st.note = `stopped at page ${pg}: ${String((e && e.message) || e).slice(0, 80)}`; stop = true; }
        const all = assemble();
        Object.assign(st, { count: all.length, ms: Date.now() - t0, pages: Object.keys(got).length });
        update(p.id, all);
      }
    };
    await Promise.all(Array.from({ length: Math.min(PAGE_WORKERS, pages - 1) }, worker));
  }
  st.pending = false; st.ms = Date.now() - t0;
  update(p.id, assemble());
}

function buildOut(o, pq, chosen, state, done, t0) {
  const bySource = {};
  const seen = new Set();
  let removed = 0;
  for (const p of chosen) {                         // fixed order => deterministic de-duplication
    bySource[p.id] = applyFilters(state.items[p.id] || [], pq, o).filter((r) => {
      if (!o.dedupe) return true;
      const k = normUrl(r.url);
      if (seen.has(k)) { removed++; return false; }
      seen.add(k); return true;
    });
  }
  const results = mergeResults(bySource, o.sort, o.seed).slice(0, o.limit);
  return {
    query: o.q, category: o.cat, sort: o.sort, time: o.time, limit: o.limit, done, took_ms: Date.now() - t0,
    total: results.length, duplicates_removed: removed, sources: chosen.map((p) => ({ ...state.status[p.id], count: (state.items[p.id] || []).length })), results,
  };
}

// search(params, { defLimit, onProgress(out) }) -> final out. Identical searches are shared and cached.
async function search(params, { defLimit = 100, onProgress } = {}) {
  const o = normalizeOpts(params, defLimit);
  const pq = parseQuery(o.q);
  const all = reg.forCategory(o.cat);
  const filtered = o.sources.length ? all.filter((p) => o.sources.includes(p.id)) : all;
  const chosen = filtered.length ? filtered : all;
  const key = JSON.stringify([o, chosen.map((p) => p.id)]);
  const hit = JOBS.get(key);
  if (hit) { if (onProgress) onProgress(hit); return { ...hit, cached: true }; }
  let job = INFLIGHT.get(key);
  if (!job) {
    const t0 = Date.now();
    const deadline = t0 + DEADLINE;
    const state = { items: {}, status: {} };
    for (const p of chosen) state.status[p.id] = { id: p.id, name: p.name, pending: true, ok: false, ms: 0 };
    const engineQ = [pq.text,
      ...pq.sites.map((s) => 'site:' + s), ...pq.notSites.map((s) => '-site:' + s),
      pq.filetype && 'filetype:' + pq.filetype, ...pq.exclude.map((w) => (/\s/.test(w) ? `-"${w}"` : '-' + w)),
    ].filter(Boolean).join(' ') || o.q;
    const plain = pq.text || o.q;
    job = { listeners: new Set(), last: null };
    let timer = null;
    const emit = (done) => {
      const out = buildOut(o, pq, chosen, state, done, t0);
      job.last = out;
      for (const l of job.listeners) { try { l(out); } catch {} }
      return out;
    };
    const update = (id, items) => {
      state.items[id] = items;
      if (!timer) timer = setTimeout(() => { timer = null; emit(false); }, 120); // coalesce bursts
    };
    job.promise = Promise.all(chosen.map((p) => {
      const q = ['ddg', 'mojeek', 'searxng'].includes(p.id) ? engineQ : plain; // only these understand operators
      return fetchSource(p, q, o, state.status[p.id], deadline, update).catch((e) => {
        Object.assign(state.status[p.id], { pending: false, ok: false, error: String(e && e.message).slice(0, 160) });
      });
    })).then(() => {
      clearTimeout(timer); timer = null;
      const out = emit(true);
      if (out.sources.some((s) => s.ok)) JOBS.set(key, out);
      INFLIGHT.delete(key);
      return out;
    });
    INFLIGHT.set(key, job);
  }
  if (onProgress) { job.listeners.add(onProgress); if (job.last) onProgress(job.last); }
  try { return await job.promise; } finally { if (onProgress) job.listeners.delete(onProgress); }
}

function isCached(params, defLimit) {
  const o = normalizeOpts(params, defLimit);
  const all = reg.forCategory(o.cat);
  const filtered = o.sources.length ? all.filter((p) => o.sources.includes(p.id)) : all;
  const chosen = filtered.length ? filtered : all;
  return !!JOBS.get(JSON.stringify([o, chosen.map((p) => p.id)]));
}

// Live self-test of one source with a harmless query (used by /sources/check).
async function checkSource(id, q = 'linux') {
  const p = reg.providers[id];
  if (!p) return { id, ok: false, error: 'unknown source' };
  const t0 = Date.now();
  try {
    const cat = p.cats[0];
    const items = await withTimeout(p.run(q, { q, cat, page: 1, n: Math.min(p.per || 10, 10), time: '', sort: 'interleave', limit: 10 }), 12000);
    const ok = items.length > 0;
    return { id, name: p.name, ok, ms: Date.now() - t0, count: items.length, sample: items.slice(0, 2).map((r) => r.title), error: ok ? undefined : 'responded but returned 0 results' };
  } catch (e) { return { id, name: p.name, ok: false, ms: Date.now() - t0, error: String((e && e.message) || e).slice(0, 160) }; }
}

function pageSlice(out, page, per) {
  const pages = Math.max(1, Math.ceil(out.results.length / per));
  const pg = Math.max(1, Math.min(pages, parseInt(page, 10) || 1));
  return { page: pg, pages, per, items: out.results.slice((pg - 1) * per, pg * per) };
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

module.exports = { checkSource, search, isCached, pageSlice, parseQuery, normalizeOpts, mergeResults, applyFilters, normUrl, SORTS, toRss, toText };
