'use strict';
process.env.PLAINSEARCH_ALLOW_PRIVATE = '1'; // tests talk to a local mock site
process.env.PLAINSEARCH_DEMO = '1';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const H = require('../lib/html');
const P = require('../lib/providers');
const S = require('../lib/search');
const R = require('../lib/retro');
const netMod = require('../lib/net');

test('html parser: implied closes, entities, raw text', () => {
  const t = H.parse('<p>a &amp; b<p>c<ul><li>x<li>y</ul><script>if(1<2){}</script><br/>');
  assert.equal(H.findAll(t, (n) => n.tag === 'p').length, 2);
  assert.equal(H.findAll(t, (n) => n.tag === 'li').length, 2);
  assert.equal(H.clean(H.text(H.find(t, (n) => n.tag === 'p'))), 'a & b');
});

test('ddg parser decodes uddg redirect links and skips ads', () => {
  const html = `<div class="result results_links web-result"><h2><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa%3Fb%3D1&amp;rut=zz">Example <b>A</b></a></h2><a class="result__snippet" href="x">A snippet <b>here</b></a></div>
  <div class="result result--ad"><a class="result__a" href="https://ad.example/">AD</a></div>`;
  const r = P.parseDdg(html);
  assert.equal(r.length, 1);
  assert.deepEqual([r[0].title, r[0].url, r[0].snippet], ['Example A', 'https://example.com/a?b=1', 'A snippet here']);
});

test('mojeek parser', () => {
  const html = `<ul class="results-standard"><li><a class="ob" href="https://m.example/x">m.example</a><h2><a class="title" href="https://m.example/x">Mojeek hit</a></h2><p class="s">The <b>snippet</b></p></li></ul>`;
  const r = P.parseMojeek(html);
  assert.equal(r.length, 1); assert.equal(r[0].title, 'Mojeek hit'); assert.equal(r[0].snippet, 'The snippet');
});

test('youtube JSON extraction + video renderer walk', () => {
  const data = { contents: [{ videoRenderer: { videoId: 'dQw4w9WgXcQ', title: { runs: [{ text: 'Never "gonna"' }] }, ownerText: { runs: [{ text: 'Chan' }] }, viewCountText: { simpleText: '1M views' }, lengthText: { simpleText: '3:32' } } }, { lockupViewModel: { contentType: 'LOCKUP_CONTENT_TYPE_VIDEO', contentId: 'abcdefghijk', metadata: { lockupMetadataViewModel: { title: { content: 'New style' } } } } }, { lockupViewModel: { contentType: 'LOCKUP_CONTENT_TYPE_PLAYLIST', contentId: 'PLxxxxxxxxxxx' } }] };
  const page = `<script>var ytInitialData = ${JSON.stringify(data)};</script><script>other()</script>`;
  const got = P.extractJsonAfter(page, 'var ytInitialData =');
  assert.ok(got);
  const vs = P.youtubeVideos(got);
  assert.deepEqual(vs.map((v) => v.videoId), ['dQw4w9WgXcQ', 'abcdefghijk']);
  assert.match(vs[0].meta, /Chan · 1M views · 3:32/);
});

test('query operators', () => {
  const q = S.parseQuery('cats site:A.com -site:b.org filetype:.PDF -spam "exact phrase"');
  assert.deepEqual([q.sites, q.notSites, q.filetype, q.exclude], [['a.com'], ['b.org'], 'pdf', ['spam']]);
  assert.equal(q.text, 'cats "exact phrase"');
});

test('merge modes and seeded shuffle', () => {
  const by = { a: [{ title: 'a1' }, { title: 'a2' }], b: [{ title: 'b1' }], c: [{ title: 'c1' }, { title: 'c2' }, { title: 'c3' }] };
  const names = (x) => x.map((r) => r.title).join(' ');
  assert.equal(names(S.mergeResults(by, 'interleave')), 'a1 b1 c1 a2 c2 c3');
  assert.equal(names(S.mergeResults(by, 'grouped')), 'a1 a2 b1 c1 c2 c3');
  assert.equal(names(S.mergeResults(by, 'random', 's')), names(S.mergeResults(by, 'random', 's')));
  assert.notEqual(names(S.mergeResults(by, 'random', 's')), names(S.mergeResults(by, 'random', 'other-seed-123')));
  const dated = { a: [{ title: 'old', date: '2001-01-01' }, { title: 'none' }], b: [{ title: 'new', date: '2020-01-01' }] };
  assert.equal(names(S.mergeResults(dated, 'date')), 'new old none');
  assert.equal(names(S.mergeResults(dated, 'oldest')), 'old new none');
});

test('filters: site, hide, must, exclude, time keeps undated', () => {
  const items = [
    { title: 'Cats', url: 'https://www.a.com/x', snippet: 'purr' },
    { title: 'Cats', url: 'https://sub.b.org/y', snippet: 'purr spam' },
    { title: 'Old', url: 'https://a.com/z.pdf', date: '2000-01-01' },
  ];
  const f = (q, extra = {}) => S.applyFilters(items, S.parseQuery(q), { site: '', hide: '', must: '', time: '', ...extra }).map((r) => r.url);
  assert.deepEqual(f('x site:a.com'), ['https://www.a.com/x', 'https://a.com/z.pdf']);
  assert.deepEqual(f('x -site:b.org'), ['https://www.a.com/x', 'https://a.com/z.pdf']);
  assert.deepEqual(f('x -spam'), ['https://www.a.com/x', 'https://a.com/z.pdf']);
  assert.deepEqual(f('x filetype:pdf'), ['https://a.com/z.pdf']);
  assert.deepEqual(f('x', { must: 'purr' }), ['https://www.a.com/x', 'https://sub.b.org/y']);
  assert.deepEqual(f('x', { time: 'year' }), ['https://www.a.com/x', 'https://sub.b.org/y']);
  assert.equal(S.normUrl('https://www.A.com/p/?utm_source=x#frag'), 'https://a.com/p');
});

test('sanitizer strips active content, rewrites links/images/forms', () => {
  const evil = '<html><head><script>alert(1)</script></head><body onload=alert(1)><div class="cookie-banner">ACCEPT</div><h1 onclick=x>Hi</h1><a href="javascript:alert(1)">bad</a><a href="/rel" onclick=x>good</a><img src=//e.com/a.png onerror=alert(1)><img src=x.png width=1 height=1><iframe src="https://evil.test"></iframe><form method=post action=/login><input name=p></form><form action="/s"><input name=q><input type=password name=pw></form><p style="color:red">t<svg><script>1</script></svg></p><div hidden>secret</div><div style="display:none">secret2</div></body></html>';
  const out = R.sanitize(H.parse(evil), new R.Ctx(new URL('https://site.test/a/b'), {}));
  for (const bad of ['<script', 'onclick', 'onerror', 'onload', 'javascript:', 'ACCEPT', 'secret', 'type="password"', 'name="p"', 'style=', '<svg']) assert.ok(!out.includes(bad), 'should not contain ' + bad + ' in ' + out);
  assert.ok(out.includes('/browse?url=https%3A%2F%2Fsite.test%2Frel'));
  assert.ok(out.includes('/img?url=https%3A%2F%2Fe.com%2Fa.png'));
  assert.ok(out.includes('action="/form"') && out.includes('value="https://site.test/s"'));
});

test('reader mode picks the article body', () => {
  const html = `<body><nav>${'<a href=/x>menu</a>'.repeat(20)}</nav><div id=wrap><div id=art>${'<p>This is a long paragraph of real article text. '.repeat(12)}</div><div id=side><p>short</p></div></div></body>`;
  const main = R.findMain(H.parse(html));
  assert.equal(main.attrs.id, 'art');
});

test('SSRF guard (real, with private access OFF)', () => {
  const { execFileSync } = require('node:child_process');
  const out = execFileSync(process.execPath, ['-e', `
    const n=require('./lib/net');
    (async()=>{const r=[];for(const u of ['http://127.0.0.1/','http://10.1.2.3/','http://[::1]/','http://169.254.169.254/','http://[::ffff:7f00:1]/','http://localhost/','file:///etc/passwd','ftp://x/']){try{await n.assertPublicUrl(u);r.push('ALLOWED '+u)}catch(e){}}console.log(JSON.stringify(r))})()`],
  { cwd: require('node:path').join(__dirname, '..'), env: { ...process.env, PLAINSEARCH_ALLOW_PRIVATE: '' } }).toString();
  assert.equal(out.trim(), '[]');
});

// ---- integration: real server + local mock website --------------------------
test('end-to-end: server, retro proxy, image proxy, forms, API', async (t) => {
  const origin = http.createServer((req, res) => {
    if (req.url === '/img.png') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(Buffer.from('iVBORw0KGgo=', 'base64')); }
    if (req.url === '/file.bin') { res.writeHead(200, { 'content-type': 'application/zip' }); return res.end('PK'); }
    if (req.url === '/redir') { res.writeHead(302, { location: '/page' }); return res.end(); }
    if (req.url.startsWith('/search')) { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<title>S</title><p>got ${req.url}</p>`); }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<html><head><title>Mock “Page”</title><script>window.evil=1</script><style>body{background:red}</style></head><body><div class="ad-slot">BUY NOW</div><h1>Welcome</h1><p>Hello <a href="/next" onclick="steal()">next</a></p><img src="/img.png" onerror="x()"><form action="/search" method="get"><input name="q" type="search"><input type="submit" value="Go"></form></body></html>`);
  });
  await new Promise((r) => origin.listen(0, '127.0.0.1', r));
  const op = origin.address().port;
  const { server } = require('../server');
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => { server.close(); origin.close(); server.closeAllConnections?.(); });
  const get = async (p, o) => { const r = await fetch(base + p, { redirect: 'manual', ...o }); return { r, text: await r.text() }; };

  let { r, text } = await get('/browse?url=' + encodeURIComponent(`http://127.0.0.1:${op}/`));
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-security-policy'), /default-src 'none'/);
  assert.ok(text.includes('<h1>Welcome</h1>') && text.includes('<title>Mock “Page”</title>'));
  for (const bad of ['window.evil', 'steal()', 'onerror', 'BUY NOW', 'background:red']) assert.ok(!text.includes(bad), bad);
  assert.ok(text.includes('action="/form"'));

  ({ r, text } = await get('/browse?url=' + encodeURIComponent(`http://127.0.0.1:${op}/redir`)));
  assert.ok(text.includes('Welcome'));

  // form round-trip
  ({ r } = await get(`/form?__t=${encodeURIComponent(`http://127.0.0.1:${op}/search`)}&q=hello+world&embed=1`));
  assert.equal(r.status, 302);
  const loc = r.headers.get('location');
  assert.match(loc, /^\/browse\?url=/);
  ({ text } = await get(loc));
  assert.ok(text.includes('got /search?q=hello+world'));

  // image proxy: only images
  ({ r } = await get('/img?url=' + encodeURIComponent(`http://127.0.0.1:${op}/img.png`)));
  assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'image/png');
  ({ r } = await get('/img?url=' + encodeURIComponent(`http://127.0.0.1:${op}/`)));
  assert.equal(r.status, 404);

  // binary files aren't rewritten
  ({ text } = await get('/browse?url=' + encodeURIComponent(`http://127.0.0.1:${op}/file.bin`)));
  assert.ok(text.includes('not rewritten'));

  // omnibox text → search
  ({ r } = await get('/browse?url=' + encodeURIComponent('some words here')));
  assert.equal(r.status, 302); assert.match(r.headers.get('location'), /^\/search\?q=some%20words%20here/);

  // static traversal blocked
  ({ r } = await get('/static/..%2fserver.js')); assert.equal(r.status, 404);
  ({ r } = await get('/static/../server.js')); assert.equal(r.status, 404);

  // search (demo sources) + formats
  ({ text } = await get('/api/search?q=hello&cat=web&sort=interleave'));
  let j = JSON.parse(text);
  assert.ok(j.sources.length >= 6);
  assert.ok(j.results.some((x) => x.source === 'demo-a') && j.results.some((x) => x.source === 'demo-b'));
  assert.ok(j.sources.some((s) => s.id === 'mojeek' && typeof s.ok === 'boolean' && (s.ok || s.error)), 'every source asked is reported, with its error if it failed');
  ({ text } = await get('/api/search?q=hello&cat=web&sources=demo-a,demo-b&sort=interleave'));
  j = JSON.parse(text);
  assert.deepEqual(j.results.slice(0, 4).map((x) => x.source), ['demo-a', 'demo-b', 'demo-a', 'demo-b']);
  ({ text } = await get('/api/search?q=hello&sources=demo-a&site=example.com&hide=nothing.org'));
  assert.equal(JSON.parse(text).results.length, 100); // default API limit
  ({ text } = await get('/api/search?q=hello&sources=demo-a&format=rss')); assert.match(text, /<rss/);
  ({ text } = await get('/api/search?q=hello&sources=demo-a&format=txt')); assert.match(text, /1\. Demo A result 1/);

  // deep results: >1000 across sources, sliced by per/page
  ({ text } = await get('/api/search?q=deep&sources=demo-a,demo-b,demo-c&limit=2000'));
  j = JSON.parse(text);
  assert.equal(j.total, 820); assert.equal(j.results.length, 820);
  assert.equal(new Set(j.results.map((x) => x.url)).size, 820, 'no duplicates');
  ({ text } = await get('/api/search?q=deep&sources=demo-a,demo-b,demo-c&limit=2000&per=100&page=3'));
  j = JSON.parse(text);
  assert.equal(j.results.length, 100); assert.equal(j.page, 3); assert.equal(j.pages, 9);
  ({ text } = await get('/api/search?q=deep&sources=demo-a&limit=10')); assert.equal(JSON.parse(text).results.length, 10);

  // streaming endpoint: first progress arrives before the slow source finishes
  const t0 = Date.now();
  const sr = await fetch(base + '/api/stream?q=streamtest&sources=demo-a,demo-c&limit=1000');
  const lines = []; let firstAt = 0;
  const reader = sr.body.getReader(); const dec = new TextDecoder(); let buf = '';
  for (;;) { const { done, value } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true }); const parts = buf.split('\n'); buf = parts.pop(); for (const l of parts) if (l) { lines.push(JSON.parse(l)); if (!firstAt) firstAt = Date.now() - t0; } }
  assert.ok(firstAt < 1500, 'first results should not wait for the slow source (was ' + firstAt + 'ms)');
  assert.equal(lines.at(-1).e, 'done'); assert.equal(lines.at(-1).total, 560);
  assert.ok(lines.some((l) => l.e === 'progress'));
  assert.ok(lines.at(-1).list.includes('Demo A result 1 for'));
  // the finished search is now cached → /search renders server-side, instantly, with numbered pages
  const t1 = Date.now();
  ({ r, text } = await get('/search?q=streamtest&sources=demo-a,demo-c&limit=1000&page=2'));
  assert.ok(Date.now() - t1 < 500 && text.includes('Results 51–100 of 560') && text.includes('class="pg on">2<'));
  // uncached page 1 → shell with data-stream
  ({ text } = await get('/search?q=neverseen&sources=demo-a&limit=100'));
  assert.ok(text.includes('data-stream="/api/stream?q=neverseen'));
  ({ r } = await get('/api/search')); assert.equal(r.status, 400);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  ({ text } = await get('/api/sources')); assert.ok(JSON.parse(text).sources.length >= 18);

  // html pages render
  for (const p of ['/', '/search?q=hello&sources=demo-a', '/search?q=hello&cat=images&sources=demo-a', '/search?q=hello&cat=video&sources=demo-a&embed=1', '/api', '/sources', '/about', '/browser', '/opensearch.xml', '/nope']) {
    ({ r, text } = await get(p));
    assert.ok(r.status === 200 || (p === '/nope' && r.status === 404), p + ' → ' + r.status);
  }
  // XSS in the query is escaped
  ({ text } = await get('/search?q=' + encodeURIComponent('"><script>alert(1)</script>') + '&sources=demo-a'));
  assert.ok(!text.includes('<script>alert(1)</script>'));
});

test('youtube watch page → classic layout (stubbed network)', async () => {
  const orig = netMod.getText;
  const pr = { videoDetails: { videoId: 'dQw4w9WgXcQ', title: 'Test <video>', author: 'Some Chan', channelId: 'UC123', shortDescription: 'Line one\nSee https://example.com/x for more', viewCount: '1234567', lengthSeconds: '212', keywords: ['a', 'b'] }, microformat: { playerMicroformatRenderer: { publishDate: '2010-05-01' } } };
  const data = { contents: [{ compactVideoRenderer: { videoId: 'abcdefghijk', title: { simpleText: 'Related one' }, shortBylineText: { runs: [{ text: 'R chan' }] } } }] };
  netMod.getText = async () => ({ status: 200, headers: new Map(), url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', text: `<script>var ytInitialPlayerResponse = ${JSON.stringify(pr)};</script><script>var ytInitialData = ${JSON.stringify(data)};</script>` });
  try {
    const r = await R.render('https://youtu.be/dQw4w9WgXcQ', { embed: true });
    assert.equal(r.title, 'Test <video>');
    assert.ok(r.html.includes('youtube-nocookie.com/embed/dQw4w9WgXcQ'));
    assert.ok(r.html.includes('Test &lt;video&gt;') && !r.html.includes('<video>'));
    assert.ok(r.html.includes('1,234,567 views') && r.html.includes('3:32'));
    assert.ok(r.html.includes('/browse?url=https%3A%2F%2Fexample.com%2Fx&amp;embed=1'));
    assert.ok(r.html.includes('Related one') && r.html.includes('i.ytimg.com%2Fvi%2Fabcdefghijk%2Fmqdefault.jpg'));
    const info = await R.youtubeInfo('dQw4w9WgXcQ');
    assert.equal(info.related.length, 1); assert.equal(info.views, 1234567);
  } finally { netMod.getText = orig; }
});
