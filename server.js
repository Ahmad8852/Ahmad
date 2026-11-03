'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const net = require('./lib/net');
const H = require('./lib/html');
const reg = require('./lib/providers');
const S = require('./lib/search');
const R = require('./lib/retro');
const V = require('./lib/render');

const PORT = parseInt(process.env.PORT, 10) || 8080;
const HOST = process.env.HOST || '127.0.0.1';
const PUB = path.join(__dirname, 'public');
const MIME = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
const BROWSE_CSP = "default-src 'none'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-src https://www.youtube-nocookie.com; form-action 'self'; base-uri 'none'; connect-src 'none'";

function send(res, status, body, type = 'text/html; charset=utf-8', extra = {}) {
  res.writeHead(status, {
    'content-type': type, 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
    'x-frame-options': 'SAMEORIGIN', 'cache-control': 'no-store', ...extra,
  });
  res.end(body);
}
const json = (res, status, obj) => send(res, status, JSON.stringify(obj, null, 1), 'application/json; charset=utf-8', { 'access-control-allow-origin': '*' });

function params(sp) {
  const p = {};
  for (const k of ['q', 'cat', 'sort', 'time', 'n', 'page', 'site', 'hide', 'must', 'seed', 'dedupe', 'open']) p[k] = sp.get(k) || '';
  p.sourcesList = sp.getAll('sources').flatMap((s) => s.split(',')).filter(Boolean);
  p.sources = p.sourcesList;
  return p;
}
const looksLikeUrl = (s) => /^[a-z][a-z0-9+.-]*:\/\/\S+$/i.test(s) || /^(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?(\/\S*)?$/i.test(s);

async function handle(req, res) {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;
  const sp = u.searchParams;
  const embed = sp.get('embed') === '1';
  const base = `http://${req.headers.host || 'localhost:' + PORT}`;

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', 'text/plain');
  if (p === '/healthz') return send(res, 200, 'ok', 'text/plain');

  if (p.startsWith('/static/')) {
    const f = path.normalize(path.join(PUB, p.slice(8)));
    if (!f.startsWith(PUB + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return send(res, 404, 'Not found', 'text/plain');
    return send(res, 200, fs.readFileSync(f), MIME[path.extname(f)] || 'application/octet-stream', { 'cache-control': 'no-cache' });
  }

  if (p === '/') return send(res, 200, V.home({ embed }));
  if (p === '/api') return send(res, 200, V.apiDocs(base));
  if (p === '/sources') return send(res, 200, V.sourcesPage());
  if (p === '/about') return send(res, 200, V.about());
  if (p === '/browser') return send(res, 200, V.browserShell());
  if (p === '/opensearch.xml') {
    return send(res, 200, `<?xml version="1.0"?><OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/"><ShortName>plainsearch</ShortName><Description>Unfiltered metasearch</Description><InputEncoding>UTF-8</InputEncoding><Url type="text/html" template="${base}/search?q={searchTerms}"/><Url type="application/x-suggestions+json" template="${base}/api/suggest?q={searchTerms}&amp;format=os"/></OpenSearchDescription>`, 'application/opensearchdescription+xml');
  }

  if (p === '/search') {
    const q = sp.get('q') || '';
    if (!q.trim()) return send(res, 200, V.home({ embed }));
    const pr = params(sp);
    const out = await S.search(pr);
    return send(res, 200, V.results(out, { ...pr, n: sp.get('n') }, embed));
  }

  if (p === '/api/search' || p === '/api/images' || p === '/api/videos') {
    const pr = params(sp);
    if (p === '/api/images') pr.cat = 'images';
    if (p === '/api/videos') pr.cat = 'video';
    if (!pr.q.trim()) return json(res, 400, { error: 'missing q' });
    const out = await S.search(pr);
    const fmt = sp.get('format');
    if (fmt === 'rss') return send(res, 200, S.toRss(out, base + req.url), 'application/rss+xml; charset=utf-8', { 'access-control-allow-origin': '*' });
    if (fmt === 'txt') return send(res, 200, S.toText(out), 'text/plain; charset=utf-8', { 'access-control-allow-origin': '*' });
    return json(res, 200, out);
  }
  if (p === '/api/sources') return json(res, 200, { categories: reg.CATEGORIES.map(([id, name]) => ({ id, name })), sorts: S.SORTS, sources: reg.list().map(({ id, name, cats, desc, independent }) => ({ id, name, categories: cats, description: desc, independent: !!independent })) });
  if (p === '/api/suggest') {
    const q = (sp.get('q') || '').slice(0, 100);
    if (!q) return json(res, 200, { query: q, suggestions: [] });
    const [w, d] = await Promise.allSettled([
      net.getJson(`https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=6&format=json&origin=*`, { trusted: true, guard: false, timeout: 3000 }),
      net.getJson(`https://duckduckgo.com/ac/?q=${encodeURIComponent(q)}&type=list`, { guard: false, timeout: 3000 }),
    ]);
    const sug = [...new Set([...(d.value ? d.value[1] : []), ...(w.value ? w.value[1] : [])])].slice(0, 10);
    if (sp.get('format') === 'os') return send(res, 200, JSON.stringify([q, sug]), 'application/x-suggestions+json', { 'access-control-allow-origin': '*' });
    return json(res, 200, { query: q, suggestions: sug });
  }
  if (p === '/api/youtube') return json(res, 200, await R.youtubeInfo(sp.get('id') || ''));
  if (p === '/api/page') {
    const r = await R.render(sp.get('url') || '', { mode: ['reader', 'plain'].includes(sp.get('mode')) ? sp.get('mode') : 'retro' });
    if (r.redirect) return json(res, 200, { image: sp.get('url') });
    return json(res, 200, { title: r.title, url: r.url, html: r.html, text: H.clean(H.decode(r.html.replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)>/g, '\n').replace(/<[^>]*>/g, ' '))).slice(0, 200000) });
  }

  if (p === '/browse') {
    const target = (sp.get('url') || '').trim();
    if (!target) return send(res, 302, '', 'text/plain', { location: embed ? '/?embed=1' : '/browser' });
    if (!looksLikeUrl(target)) return send(res, 302, '', 'text/plain', { location: '/search?q=' + encodeURIComponent(target) + (embed ? '&embed=1' : '') });
    const mode = ['reader', 'plain'].includes(sp.get('mode')) ? sp.get('mode') : 'retro';
    try {
      const r = await R.render(target, { mode, embed });
      if (r.redirect) return send(res, 302, '', 'text/plain', { location: r.redirect });
      return send(res, 200, V.retroPage(r, { embed, mode, url: target }), 'text/html; charset=utf-8', { 'content-security-policy': BROWSE_CSP });
    } catch (e) {
      return send(res, e.status === 403 ? 403 : 502, V.errorPage(e.message, e.status === 403 ? 403 : 502, embed, target), 'text/html; charset=utf-8', { 'content-security-policy': BROWSE_CSP });
    }
  }

  if (p === '/form') { // GET forms from rewritten pages
    const t = sp.get('__t');
    try {
      const x = new URL(t);
      if (!/^https?:$/.test(x.protocol)) throw new Error('bad scheme');
      for (const [k, v] of sp) if (k !== '__t' && k !== 'embed') x.searchParams.append(k, v);
      return send(res, 302, '', 'text/plain', { location: '/browse?url=' + encodeURIComponent(x.href) + (embed ? '&embed=1' : '') });
    } catch { return send(res, 400, V.errorPage('Bad form target', 400, embed), 'text/html; charset=utf-8'); }
  }

  if (p === '/img') {
    const target = sp.get('url') || '';
    let origin;
    try { origin = new URL(target).origin; } catch { return send(res, 400, 'bad url', 'text/plain'); }
    try {
      const r = await net.request(target, { maxBytes: 12 * 1024 * 1024, timeout: 10000, headers: { referer: origin + '/', accept: 'image/*,*/*;q=0.5' } });
      const ct = (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (r.status >= 400 || !ct.startsWith('image/')) return send(res, 404, 'not an image', 'text/plain');
      return send(res, 200, r.buf, ct, { 'cache-control': 'public, max-age=3600', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" });
    } catch (e) { return send(res, e.status || 502, 'image unavailable', 'text/plain'); }
  }

  return send(res, 404, V.errorPage('Page not found', 404, embed), 'text/html; charset=utf-8');
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    console.error('[error]', req.url.slice(0, 120), e && e.message);
    if (!res.headersSent) send(res, 500, V.errorPage('Internal error: ' + (e && e.message), 500, false), 'text/html; charset=utf-8');
    else res.end();
  });
});
server.requestTimeout = 30000;

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`plainsearch listening on http://${HOST}:${PORT}`);
    if (HOST !== '127.0.0.1' && HOST !== 'localhost') console.log('WARNING: this is an open web proxy – do not expose it to the internet.');
  });
}
module.exports = { server };
