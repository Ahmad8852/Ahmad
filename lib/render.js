'use strict';
const { esc } = require('./html');
const reg = require('./providers');
const { SORTS } = require('./search');

const qs = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && v !== null && v !== false)
  .flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v]])).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

function layout({ title, body, embed, cls = '', head = '' }) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/static/style.css">
<link rel="search" type="application/opensearchdescription+xml" title="plainsearch" href="/opensearch.xml">
<link rel="icon" href="/static/favicon.svg" type="image/svg+xml">
${head}<script src="/static/frame.js" defer></script></head>
<body class="${embed ? 'embed ' : ''}${cls}">${body}</body></html>`;
}

const logo = (small) => `<a class="logo${small ? ' small' : ''}" href="/"><span class="l1">plain</span><span class="l2">search</span><sup>2010</sup></a>`;
const topbar = (embed, active) => embed ? '' : `<div id="topbar"><div class="wrap">
<a href="/"${active === 'search' ? ' class="on"' : ''}>Search</a><a href="/browser"${active === 'browser' ? ' class="on"' : ''}>Browser</a><a href="/api"${active === 'api' ? ' class="on"' : ''}>API</a><a href="/sources"${active === 'sources' ? ' class="on"' : ''}>Sources</a><a href="/about"${active === 'about' ? ' class="on"' : ''}>About</a>
</div></div>`;
const footer = () => `<div id="ft">plainsearch &mdash; no index, no ranking, no profile, no logs. <a href="/about">How it works</a> &middot; <a href="/api">API</a> &middot; <a href="/browser">Browser</a></div>`;

const tabsFor = (cat, p, embed) => `<ul class="tabs">${reg.CATEGORIES.map(([c, n]) =>
  `<li${c === cat ? ' class="on"' : ''}><a href="/search?${qs({ q: p.q, cat: c, sort: p.sort, time: p.time, limit: p.limit, embed: embed ? 1 : '' })}">${n}</a></li>`).join('')}</ul>`;

function searchBox(p, cat, embed, big) {
  return `<div class="sbox${big ? ' big' : ''}"><input type="text" name="q" value="${esc(p.q || '')}" size="${big ? 52 : 44}" maxlength="400" ${big ? 'autofocus' : ''} placeholder="Search everything – operators: site:  -site:  filetype:  -word  &quot;phrase&quot;" autocomplete="off" spellcheck="false">
<input type="hidden" name="cat" value="${esc(cat)}">${embed ? '<input type="hidden" name="embed" value="1">' : ''}
<button type="submit" class="btn blue">Search</button></div>`;
}

function home({ embed }) {
  const cats = reg.CATEGORIES.map(([c, n], i) => `<label class="cat"><input type="radio" name="cat" value="${c}"${i === 0 ? ' checked' : ''}> ${n}</label>`).join('');
  return layout({ title: 'plainsearch', embed, cls: 'home', body: `${topbar(embed, 'search')}
<div id="homebox">${logo()}<p class="tag">Unfiltered. Unranked. Your query goes to many independent sources at once &ndash; <b>you</b> decide what matters.</p>
<form action="/search" method="get">
<div class="sbox big"><input type="text" name="q" size="52" maxlength="400" autofocus placeholder="Search everything…" autocomplete="off" spellcheck="false"><button type="submit" class="btn blue">Search</button></div>
${embed ? '<input type="hidden" name="embed" value="1">' : ''}
<div class="cats">${cats}</div>
<details class="adv"><summary>Advanced options</summary>
<table class="advt">
<tr><td>Order results</td><td><select name="sort">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></td></tr>
<tr><td>Time</td><td><select name="time"><option value="">Any time</option><option value="day">Past 24 hours</option><option value="week">Past week</option><option value="month">Past month</option><option value="year">Past year</option></select></td></tr>
<tr><td>Only these sites</td><td><input type="text" name="site" size="30" placeholder="example.com, other.org"></td></tr>
<tr><td>Hide these sites</td><td><input type="text" name="hide" size="30" placeholder="pinterest.com, quora.com"></td></tr>
<tr><td>Must contain</td><td><input type="text" name="must" size="30" placeholder="words that every result needs"></td></tr>
<tr><td>Max results</td><td><select name="limit"><option>100</option><option>250</option><option>500</option><option selected>1000</option><option>2000</option></select></td></tr>
</table></details>
</form>
<p class="tips">Try: <a href="/search?q=mechanical+keyboard+site%3Areddit.com">mechanical keyboard site:reddit.com</a> &middot; <a href="/search?q=cat&amp;cat=images">cat (images)</a> &middot; <a href="/search?q=lecture+notes+filetype%3Apdf">lecture notes filetype:pdf</a> &middot; <a href="/browse?url=https%3A%2F%2Fwww.youtube.com%2Fresults%3Fsearch_query%3Dlofi">classic YouTube</a></p>
</div>${footer()}` });
}

const hostPath = (u) => { try { const x = new URL(u); return (x.hostname + x.pathname).replace(/\/$/, '').slice(0, 70); } catch { return u; } };
const dateStr = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const retroHref = (u, embed) => '/browse?' + qs({ url: u, embed: embed ? 1 : '' });
const imgSrc = (u) => (!u ? '' : /^data:/.test(u) ? u : '/img?url=' + encodeURIComponent(u));

function resultItem(r, o) {
  const retro = o.open === 'retro' || o.embed;
  const main = retro ? retroHref(r.url, o.embed) : r.url;
  const alt = retro ? r.url : retroHref(r.url, o.embed);
  const thumb = r.thumb ? `<a class="rthumb" href="${esc(main)}"><img src="${esc(imgSrc(r.thumb))}" alt="" loading="lazy" referrerpolicy="no-referrer"></a>` : '';
  return `<li class="r${thumb ? ' withthumb' : ''}">${thumb}<div class="rbody"><h3><a href="${esc(main)}"${retro ? '' : ' rel="noreferrer"'}>${esc(r.title)}</a></h3>
<div class="u">${esc(hostPath(r.url))} <span class="src">${esc(r.sourceName)}</span> <a class="alt" href="${esc(alt)}"${retro ? ' rel="noreferrer"' : ''}>${retro ? 'original' : 'retro view'}</a>${r.discussion ? ` <a class="alt" href="${esc(retroHref(r.discussion, o.embed))}">discussion</a>` : ''}</div>
${r.snippet ? `<div class="s">${esc(r.snippet)}</div>` : ''}${r.date || r.meta ? `<div class="m">${[dateStr(r.date), r.meta].filter(Boolean).map(esc).join(' &middot; ')}</div>` : ''}</div></li>`;
}
function imageGrid(rs, o) {
  return `<div id="grid">${rs.map((r) => `<a class="gi" href="${esc(r.url)}" data-full="${esc(imgSrc(r.full || r.thumb))}" data-title="${esc(r.title)}" data-src="${esc(r.sourceName)}" data-meta="${esc([r.w && r.h ? r.w + '×' + r.h : '', r.meta].filter(Boolean).join(' · '))}" data-page="${esc(o.embed ? retroHref(r.url, true) : r.url)}"><img src="${esc(imgSrc(r.thumb || r.full))}" alt="${esc(r.title)}" loading="lazy" referrerpolicy="no-referrer"><span class="cap">${esc(r.title)}</span></a>`).join('')}</div>`;
}

const pageSize = (cat) => (cat === 'images' ? 60 : 50);
const LIMITS = [100, 250, 500, 1000, 2000];
const fmt = (n) => Number(n).toLocaleString('en-US');

// Query string that reproduces a search (used for tabs, pager, stream, JSON links)
function searchQuery(p, o, embed, extra = {}) {
  return qs({ q: p.q, cat: o.cat, sort: p.sort, time: p.time, limit: o.limit, site: p.site, hide: p.hide, must: p.must, open: p.open, seed: p.seed, sources: p.sourcesList, embed: embed ? 1 : '', ...extra });
}

function pagerHtml(o, p, embed, sl, total) {
  if (sl.pages <= 1) return '';
  const link = (n, label, cls) => `<a class="${cls || 'pg'}" href="/search?${searchQuery(p, o, embed, { page: n })}">${label}</a>`;
  let from = Math.max(1, sl.page - 4), to = Math.min(sl.pages, from + 9);
  from = Math.max(1, to - 9);
  const nums = [];
  for (let i = from; i <= to; i++) nums.push(i === sl.page ? `<b class="pg on">${i}</b>` : link(i, i));
  return `<div class="pager">${sl.page > 1 ? link(sl.page - 1, '&laquo; Previous', 'btn') : ''} ${from > 1 ? link(1, '1') + ' … ' : ''}${nums.join(' ')}${to < sl.pages ? ' … ' + link(sl.pages, sl.pages) : ''} ${sl.page < sl.pages ? link(sl.page + 1, 'Next &raquo;', 'btn') : ''}<div class="m">Results ${fmt((sl.page - 1) * sl.per + 1)}–${fmt(Math.min(total, sl.page * sl.per))} of ${fmt(total)}</div></div>`;
}

function listHtml(out, o, p, embed, S) {
  const cat = o.cat;
  const open = p.open || (cat === 'video' ? 'retro' : 'orig');
  const ro = { open, embed };
  const sl = S.pageSlice(out, p.page, pageSize(cat));
  const okN = out.sources.filter((s) => s.ok).length;
  const pending = out.sources.filter((s) => s.pending).length;
  let list;
  if (sl.items.length) list = cat === 'images' ? imageGrid(sl.items, ro) : `<ol class="rl${cat === 'video' ? ' vid' : ''}" start="${(sl.page - 1) * sl.per + 1}">${sl.items.map((r) => resultItem(r, ro)).join('')}</ol>`;
  else if (pending) list = `<div class="none"><p>Searching ${pending} source${pending > 1 ? 's' : ''}…</p></div>`;
  else list = `<div class="none"><p><b>No results.</b> ${okN ? 'Your filters may be too narrow – try removing “must contain”, the site filters or the time limit.' : 'No source answered. You may be offline or the sources are blocking this server – see the status list below.'}</p></div>`;
  return list + (pending ? '' : pagerHtml(o, p, embed, sl, out.results.length));
}

function statusHtml(out) {
  return `<h4>Sources asked (nothing is hidden from you)</h4><table>${out.sources.map((s) => `<tr class="${s.pending ? 'wait' : s.ok ? 'ok' : 'bad'}"><td>${s.pending ? '&hellip;' : s.ok ? '&#10003;' : '&#10007;'}</td><td>${esc(s.name)}</td><td>${s.ok || s.count ? fmt(s.count) + ' results' + (s.pages > 1 ? ' (' + s.pages + ' pages)' : '') : s.pending ? 'working…' : esc(s.error || 'no results')}${s.note ? ` <span class="m">${esc(s.note)}</span>` : ''}</td><td>${(s.ms / 1000).toFixed(1)}s</td></tr>`).join('')}</table>
<p class="m">Ordered by: <b>${esc(SORTS[out.sort])}</b>. plainsearch applies no relevance score, no popularity boost and no personalisation; inside each source the order is the source's own.${out.duplicates_removed ? ` ${fmt(out.duplicates_removed)} duplicate link(s) merged.` : ''}${out.cached ? ' (cached for 10 min)' : ''}</p>`;
}

function countHtml(out, o, p, embed) {
  const okN = out.sources.filter((s) => s.ok).length, pend = out.sources.filter((s) => s.pending).length;
  const q = searchQuery(p, o, '', {});
  return `${fmt(out.total)} results from ${okN}/${out.sources.length} sources${pend ? ` &middot; <i>${pend} still loading…</i>` : ` in ${(out.took_ms / 1000).toFixed(1)}s`} &middot; <a href="/api/search?${q}">JSON</a> &middot; <a href="/api/search?${q}&amp;format=rss">RSS</a>`;
}

// out = null renders the empty shell that streams in via /api/stream
function results({ out, o, p, embed, S, streamQs }) {
  const cat = o.cat;
  const allSrc = reg.forCategory(cat);
  const open = p.open || (cat === 'video' ? 'retro' : 'orig');
  const sel = (p.sourcesList && p.sourcesList.length) ? new Set(p.sourcesList) : new Set(allSrc.map((s) => s.id));
  const side = `<div id="side"><h4>Order</h4>${Object.entries(SORTS).map(([k, v]) => `<label class="blk"><input type="radio" name="sort" value="${k}"${o.sort === k ? ' checked' : ''}> ${esc(v.split(' – ')[0])}</label>`).join('')}
<input type="text" name="seed" size="10" value="${esc(p.seed || '')}" placeholder="shuffle seed">
<h4>Time</h4><select name="time">${[['', 'Any time'], ['day', 'Past 24 hours'], ['week', 'Past week'], ['month', 'Past month'], ['year', 'Past year']].map(([v, n]) => `<option value="${v}"${o.time === v ? ' selected' : ''}>${n}</option>`).join('')}</select>
<h4>Sources <span class="selall"><a href="#" data-sel="1">all</a> · <a href="#" data-sel="0">none</a></span></h4><div id="srcs">${allSrc.map((s) => `<label class="blk" title="${esc(s.desc)}"><input type="checkbox" name="sources" value="${s.id}"${sel.has(s.id) ? ' checked' : ''}> ${esc(s.name)}${s.independent ? ' <span class="ind" title="Runs its own independent index">&#9733;</span>' : ''}</label>`).join('')}</div>
<h4>Only these sites</h4><input type="text" name="site" size="18" value="${esc(p.site || '')}">
<h4>Hide these sites</h4><input type="text" name="hide" size="18" value="${esc(p.hide || '')}">
<h4>Must contain</h4><input type="text" name="must" size="18" value="${esc(p.must || '')}">
<h4>Max results</h4><select name="limit">${LIMITS.map((n) => `<option${o.limit === n ? ' selected' : ''}>${n}</option>`).join('')}</select>
<h4>Open links in</h4><label class="blk"><input type="radio" name="open" value="orig"${open === 'orig' && !embed ? ' checked' : ''}> Original site</label><label class="blk"><input type="radio" name="open" value="retro"${open === 'retro' || embed ? ' checked' : ''}> Retro view</label>
<p><button type="submit" class="btn blue">Update</button></p></div>`;
  const shown = out || { total: 0, sources: reg.forCategory(cat).filter((s) => !p.sourcesList.length || p.sourcesList.includes(s.id)).map((s) => ({ id: s.id, name: s.name, pending: true, count: 0, ms: 0 })), sort: o.sort, took_ms: 0, results: [], duplicates_removed: 0 };
  const film = cat === 'web' && !(p.page > 1) ? `<div id="film" data-q="${esc(p.q)}" data-embed="${embed ? 1 : ''}" hidden><div class="fh">Images for <b>${esc(p.q)}</b> &ndash; <a href="/search?${qs({ q: p.q, cat: 'images', embed: embed ? 1 : '' })}">more images &raquo;</a></div><div id="film-in"></div></div>` : '';
  const stream = out ? '' : ` data-stream="/api/stream?${searchQuery(p, o, embed, { page: p.page > 1 ? p.page : '' })}"`;
  return layout({
    title: `${p.q} – plainsearch`, embed, cls: 'results', body: `${topbar(embed, 'search')}
<form action="/search" method="get" id="sf"><div id="hd">${logo(true)}${searchBox(p, cat, embed)}<span class="count" id="count">${countHtml(shown, o, p, embed)}</span></div>
${tabsFor(cat, { ...p, limit: o.limit }, embed)}
<div id="cols">${side}<div id="main">${film}<div id="reslist"${stream}>${out ? listHtml(out, o, p, embed, S) : '<div class="none"><p>Searching…</p></div>'}</div>${out ? '' : `<noscript><p><a class="btn" href="/search?${searchQuery(p, o, embed, { wait: 1 })}">Load results without JavaScript</a></p></noscript>`}<div id="status">${statusHtml(shown)}</div></div></div></form>
<div id="lb" hidden><div id="lb-in"><img id="lb-img" alt=""><div id="lb-cap"></div><div id="lb-nav"><button type="button" id="lb-prev" class="btn">&laquo; Prev</button> <a id="lb-page" href="#" class="btn" rel="noreferrer">Source page</a> <a id="lb-full" href="#" class="btn" rel="noreferrer">Open image</a> <button type="button" id="lb-next" class="btn">Next &raquo;</button> <button type="button" id="lb-x" class="btn">Close</button></div></div></div>${footer()}<script src="/static/results.js"></script>`,
  });
}

function apiDocs(base) {
  const ep = [
    ['GET /api/search', 'q, cat (web|images|video|discuss|code|papers|books|archive), sources (comma list), limit (10–2000 total results, default 100), per + page (slice the output), sort (interleave|grouped|date|oldest|random), seed, time (day|week|month|year), site, hide, must, dedupe=0, format (json|rss|txt)', '/api/search?q=raspberry+pi&cat=web&sort=random&seed=1&site=github.com'],
    ['GET /api/stream', 'Same parameters as /api/search plus page, embed. Newline-delimited JSON: {e:"progress"|"done", count, list, status} with ready-made HTML fragments, sent as each source answers.', ''],
    ['GET /api/images', 'Shortcut for cat=images. Same parameters.', '/api/images?q=aurora&n=40'],
    ['GET /api/videos', 'Shortcut for cat=video.', '/api/videos?q=lofi'],
    ['GET /api/sources', 'Every source plus its categories and description.', '/api/sources'],
    ['GET /api/suggest', 'q – autocomplete suggestions (Wikipedia OpenSearch).', '/api/suggest?q=linu'],
    ['GET /api/page', 'url, mode (retro|reader|plain) – returns the cleaned page as JSON {title,url,html,text}.', '/api/page?url=https://example.com&mode=reader'],
    ['GET /api/youtube', 'id – structured video info {title, author, description, views, related[]} without JavaScript.', '/api/youtube?id=dQw4w9WgXcQ'],
    ['GET /browse', 'url, mode (retro|reader|plain), embed=1 – the retro page rewriter (HTML).', '/browse?url=https://en.wikipedia.org/wiki/Gopher_(protocol)'],
    ['GET /img', 'url – privacy-preserving image proxy (no referrer, no cookies).', ''],
    ['GET /opensearch.xml', 'Add plainsearch as a search engine in any browser.', '/opensearch.xml'],
  ];
  return layout({ title: 'API – plainsearch', cls: 'doc', body: `${topbar(false, 'api')}<div class="page">${logo(true)}<h1>API</h1>
<p>All endpoints are plain GET, return CORS-enabled JSON, need no key, and are never logged. Base URL: <code>${esc(base)}</code></p>
<table class="apit"><tr><th>Endpoint</th><th>Parameters</th><th>Try</th></tr>${ep.map(([a, b, c]) => `<tr><td><code>${esc(a)}</code></td><td>${esc(b)}</td><td>${c ? `<a href="${esc(c)}">${esc(c)}</a>` : ''}</td></tr>`).join('')}</table>
<h2>Result object</h2><pre>{ "title", "url", "snippet", "date" (ISO, if the source gives one),
  "thumb", "full", "w", "h", "meta", "type", "source", "sourceName", "videoId?" }</pre>
<h2>Response envelope</h2><pre>{ "query", "category", "page", "sort", "took_ms", "total", "duplicates_removed",
  "sources": [ { "id", "name", "ok", "count", "ms", "error?" } ],   // every source asked
  "results": [ ... ] }</pre>
<h2>Operators</h2><p><code>site:example.com</code> <code>-site:example.com</code> <code>filetype:pdf</code> <code>-word</code> <code>"exact phrase"</code></p></div>${footer()}` });
}

function sourcesPage() {
  const row = (s) => `<tr><td><b>${esc(s.name)}</b>${s.independent ? ' <span class="ind">&#9733; own index</span>' : ''}</td><td>${esc(s.desc)}</td><td class="m">${s.per} × up to ${s.maxDepth}</td></tr>`;
  const groups = reg.CATEGORIES.filter(([c]) => c !== 'all').map(([c, n]) => {
    const list = reg.forCategory(c);
    return list.length ? `<h2 id="${c}">${esc(n)} <span class="m">(${list.length})</span></h2><table class="apit"><tr><th>Source</th><th>What it is</th><th>Per request × depth</th></tr>${list.map(row).join('')}</table>` : '';
  }).join('');
  return layout({ title: 'Sources – plainsearch', cls: 'doc', body: `${topbar(false, 'sources')}<div class="page">${logo(true)}<h1>${reg.list().length} sources</h1>
<p>Every query goes to all sources of the chosen tab in parallel; switch any off on the results page. Some appear in several tabs. <a class="btn blue" href="/sources/check">Test every source live</a></p>
<p>Add your own with no code: copy <code>sources.example.json</code> to <code>sources.json</code> (JSON APIs and RSS feeds), or set <code>SEARXNG_URL</code> to your own <a href="https://docs.searxng.org/">SearXNG</a> instance (70+ more engines).</p>${groups}</div>${footer()}` });
}

function sourceCheck() {
  const rows = reg.list().map((s) => `<tr data-id="${esc(s.id)}"><td>${esc(s.name)}</td><td class="st">waiting…</td><td class="ms"></td><td class="ct"></td><td class="sm"></td></tr>`).join('');
  return layout({ title: 'Source check – plainsearch', cls: 'doc', body: `${topbar(false, 'sources')}<div class="page">${logo(true)}<h1>Source check</h1>
<p>Sends one harmless query to every source from <i>this</i> computer and shows which answer. Sources that fail are usually blocked, rate-limited, or changed their format &ndash; they simply stay greyed out in searches.</p>
<p>Query: <input type="text" id="cq" value="linux" size="20"> <button class="btn blue" id="cgo" type="button">Run check</button> <span id="csum" class="m"></span></p>
<table class="apit" id="ctab"><tr><th>Source</th><th>Status</th><th>Time</th><th>Results</th><th>First results</th></tr>${rows}</table></div>${footer()}<script src="/static/check.js"></script>` });
}

function about() {
  return layout({ title: 'About – plainsearch', cls: 'doc', body: `${topbar(false, 'about')}<div class="page">${logo(true)}<h1>How this works – and what it can't do</h1>
<h2>What it is</h2><p>A <b>metasearch</b> engine with a <b>retro page rewriter</b>. It owns no index and ranks nothing. Your query is sent to independent indexes (Mojeek, Marginalia), open APIs (Wikipedia, Commons, Internet Archive, arXiv, Crossref, Open Library, Hacker News, Stack Exchange, GitHub, Openverse…) and scraped pages (YouTube, DuckDuckGo). Results are combined in a way <i>you</i> choose and the whole list of sources asked is always shown.</p>
<h2>Honest limits</h2><ul>
<li><b>No index means no web-wide crawl.</b> A genuinely complete, unbiased index of the web costs a datacentre. The closest honest approach is to ask many different indexes and let you compare. Sources with their own crawler are marked &#9733;.</li>
<li>Every <i>source</i> still ranks its own results. We don't re-rank them; use “Grouped by source”, “Newest”, or “Shuffled” to stop any single source's order dominating.</li>
<li>Scraped sources (YouTube, DuckDuckGo, Mojeek, Reddit) can break or block when their markup/bot checks change. The status panel tells you when one fails.</li>
<li>The retro view removes scripts, styles, ads, cookie walls and tracking, then shows the page in a plain frame. Sites that are pure JavaScript apps may show little or nothing; use Reader or open the original.</li>
<li>Run it on your own machine. It's a proxy; don't expose it to the public internet. Private/LAN addresses are blocked.</li></ul>
<h2>Privacy</h2><p>No cookies, no accounts, no logs, no analytics. Images are proxied without a referrer. Bookmarks and tabs live only in your browser's localStorage.</p></div>${footer()}` });
}

function browserShell() {
  return layout({ title: 'plainbrowser', cls: 'browserapp', body: `
<div id="bw">
<div id="tabstrip"><ul id="tabs"></ul><button id="newtab" class="btn" title="New tab">+</button></div>
<div id="toolbar">
<button id="back" class="btn" title="Back" disabled>&#9664;</button><button id="fwd" class="btn" title="Forward" disabled>&#9654;</button><button id="reload" class="btn" title="Reload">&#8635;</button><button id="home" class="btn" title="Home">&#8962;</button>
<form id="omni" autocomplete="off"><input id="addr" type="text" placeholder="Type a web address or search for anything" spellcheck="false"><button class="btn blue" type="submit">Go</button></form>
<button id="star" class="btn" title="Bookmark this page">&#9734;</button>
<select id="viewmode" title="How to display pages"><option value="retro">Retro view</option><option value="reader">Reader</option><option value="plain">Text only</option></select>
</div>
<div id="bookmarks"></div>
<iframe id="view" title="page" referrerpolicy="no-referrer" sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"></iframe>
<div id="statusbar"><span id="st">Done</span></div>
</div>
<script src="/static/browser.js"></script>` });
}

function retroPage(r, { embed, mode, url }) {
  const modes = [['retro', 'Retro'], ['reader', 'Reader'], ['plain', 'Text only']];
  const chrome = embed ? '' : `<div id="rtbar">${logo(true)}<form action="/browse" method="get" class="rtf"><input type="text" name="url" value="${esc(r.url || url)}" size="60"><input type="hidden" name="mode" value="${esc(mode)}"><button class="btn blue" type="submit">Go</button></form>
<span class="modes">${modes.map(([m, n]) => (m === mode ? `<b>${n}</b>` : `<a href="/browse?${qs({ url: r.url || url, mode: m })}">${n}</a>`)).join(' | ')}</span></div>`;
  return layout({
    title: r.title || url, embed, cls: `retro ${r.cls || ''}`, head: `<meta name="rt-url" content="${esc(r.url || url)}"><meta name="referrer" content="no-referrer">`,
    body: `${chrome}<div id="rt-page">${r.html}</div><div id="rt-foot">Rewritten by plainsearch &middot; scripts, styles and trackers removed &middot; source: <a href="${esc(r.url || url)}" rel="noreferrer">${esc(r.url || url)}</a>${r.truncated ? ' &middot; <b>(page truncated)</b>' : ''}</div>`,
  });
}

function errorPage(msg, status, embed, url) {
  return layout({ title: 'Error – plainsearch', embed, cls: 'doc', body: `${topbar(embed)}<div class="page"><h1>${status || 500} &ndash; ${esc(msg)}</h1>${url ? `<p>While loading <code>${esc(url)}</code></p><p><a href="${esc(url)}" rel="noreferrer">Open the original page</a></p>` : ''}<p><a href="/">Back to search</a></p></div>` });
}

module.exports = { sourceCheck, listHtml, statusHtml, countHtml, searchQuery, pageSize, layout, home, results, apiDocs, sourcesPage, about, browserShell, retroPage, errorPage, qs };
