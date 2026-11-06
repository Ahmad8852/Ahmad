'use strict';
// Your own sources, no code needed. Put a sources.json next to server.js (or set PLAINSEARCH_SOURCES=/path/file.json).
// See sources.example.json. Supports JSON APIs and RSS/Atom search feeds.
const fs = require('node:fs');
const path = require('node:path');

module.exports = function register({ def, getJson, getText, H, strip, iso, cut, enc }) {
  const file = process.env.PLAINSEARCH_SOURCES || path.join(__dirname, '..', 'sources.json');
  if (!fs.existsSync(file)) return;
  let specs;
  try { specs = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.error('[sources.json] ignored:', e.message); return; }
  const at = (o, p) => String(p || '').split('.').filter(Boolean).reduce((a, k) => (a == null ? a : a[k]), o);
  const TYPE = { web: 'web', images: 'image', video: 'video', discuss: 'discuss', code: 'code', papers: 'papers', books: 'books', archive: 'archive', news: 'news', audio: 'audio', reference: 'web', data: 'data' };
  for (const s of Array.isArray(specs) ? specs : []) {
    if (!s || !s.id || !s.name || !s.url) { console.error('[sources.json] skipped an entry without id/name/url'); continue; }
    const cats = s.cats && s.cats.length ? s.cats : ['web'];
    const per = s.per || 20;
    const defaults = s.format === 'rss' ? { title: 'title', url: 'link', snippet: 'description', date: 'pubDate', thumb: 'thumbnail', full: 'full', meta: 'author' } : { title: 'title', url: 'url', snippet: 'snippet', date: 'date', thumb: 'thumb', full: 'full', meta: 'meta' };
    const m = Object.assign(defaults, s.map || {});
    const build = (q, o) => s.url.replace(/\{q\}/g, enc(q)).replace(/\{page\}/g, o.page).replace(/\{n\}/g, o.n).replace(/\{offset\}/g, (o.page - 1) * o.n);
    const opts = { guard: false, headers: s.headers || {}, timeout: s.timeout };
    const toResult = (get) => {
      const url = get(m.url), title = get(m.title);
      if (!url || !title) return null;
      const d = get(m.date);
      return { title: strip(String(title)), url: String(url), snippet: cut(strip(String(get(m.snippet) || ''))), date: d ? iso(typeof d === 'number' && d < 1e12 ? d * 1000 : d) : undefined, thumb: get(m.thumb) || undefined, full: get(m.full) || undefined, meta: get(m.meta) || undefined, type: TYPE[cats[0]] };
    };
    def(s.id, s.name, cats, s.desc || 'Custom source from sources.json', async (q, o) => {
      if (s.format === 'rss') {
        const { status, text } = await getText(build(q, o), opts);
        if (status >= 400) throw new Error('HTTP ' + status);
        const items = H.findAll(H.parse(text, { xml: true }), (n) => n.tag === 'item' || n.tag === 'entry');
        return items.map((it) => toResult((k) => {
          const n = H.find(it, (x) => x.tag === String(k).toLowerCase());
          if (!n) return undefined;
          return n.attrs && n.attrs.href && !H.text(n).trim() ? n.attrs.href : H.clean(H.text(n));
        })).filter(Boolean);
      }
      const j = await getJson(build(q, o), opts);
      const list = s.list ? at(j, s.list) : j;
      if (!Array.isArray(list)) throw new Error('unexpected response format (check "list" in sources.json)');
      return list.map((x) => toResult((k) => at(x, k))).filter(Boolean);
    }, { per, maxDepth: s.maxDepth || per, independent: !!s.independent });
  }
};
