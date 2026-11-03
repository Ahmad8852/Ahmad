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
  `<li${c === cat ? ' class="on"' : ''}><a href="/search?${qs({ q: p.q, cat: c, sort: p.sort, time: p.time, n: '', embed: embed ? 1 : '' })}">${n}</a></li>`).join('')}</ul>`;

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
<tr><td>Results per source</td><td><select name="n"><option value="">10 (images 30)</option><option>5</option><option>20</option><option>30</option><option>50</option></select></td></tr>
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
  const thumb = r.thumb && r.type !== 'image' ? `<a class="rthumb" href="${esc(main)}"><img src="${esc(imgSrc(r.thumb))}" alt="" loading="lazy" referrerpolicy="no-referrer"></a>` : '';
  return `<li class="r${thumb ? ' withthumb' : ''}">${thumb}<div class="rbody"><h3><a href="${esc(main)}"${retro ? '' : ' rel="noreferrer"'}>${esc(r.title)}</a></h3>
<div class="u">${esc(hostPath(r.url))} <span class="src">${esc(r.sourceName)}</span> <a class="alt" href="${esc(alt)}"${retro ? ' rel="noreferrer"' : ''}>${retro ? 'original' : 'retro view'}</a>${r.discussion ? ` <a class="alt" href="${esc(retroHref(r.discussion, o.embed))}">discussion</a>` : ''}</div>
${r.snippet ? `<div class="s">${esc(r.snippet)}</div>` : ''}${r.date || r.meta ? `<div class="m">${[dateStr(r.date), r.meta].filter(Boolean).map(esc).join(' &middot; ')}</div>` : ''}</div></li>`;
}
function imageGrid(rs, o) {
  return `<div id="grid">${rs.map((r) => `<a class="gi" href="${esc(r.url)}" data-full="${esc(imgSrc(r.full || r.thumb))}" data-title="${esc(r.title)}" data-src="${esc(r.sourceName)}" data-meta="${esc([r.w && r.h ? r.w + '×' + r.h : '', r.meta].filter(Boolean).join(' · '))}" data-page="${esc(o.embed ? retroHref(r.url, true) : r.url)}"><img src="${esc(imgSrc(r.thumb || r.full))}" alt="${esc(r.title)}" loading="lazy" referrerpolicy="no-referrer"><span class="cap">${esc(r.title)}</span></a>`).join('')}</div>
<div id="lb" hidden><div id="lb-in"><img id="lb-img" alt=""><div id="lb-cap"></div><div id="lb-nav"><button type="button" id="lb-prev" class="btn">&laquo; Prev</button> <a id="lb-page" href="#" class="btn" rel="noreferrer">Source page</a> <a id="lb-full" href="#" class="btn" rel="noreferrer">Open image</a> <button type="button" id="lb-next" class="btn">Next &raquo;</button> <button type="button" id="lb-x" class="btn">Close</button></div></div></div>`;
}

function results(out, p, embed) {
  const cat = out.category;
  const allSrc = reg.forCategory(cat);
  const open = p.open || (cat === 'video' ? 'retro' : 'orig');
  const o = { open, embed };
  const sel = (p.sourcesList && p.sourcesList.length) ? new Set(p.sourcesList) : new Set(allSrc.map((s) => s.id));
  const nextQ = { q: p.q, cat, sort: p.sort, time: p.time, n: p.n, site: p.site, hide: p.hide, must: p.must, open: p.open, seed: p.seed, sources: p.sourcesList, embed: embed ? 1 : '' };
  const pager = `<div class="pager">${out.page > 1 ? `<a class="btn" href="/search?${qs({ ...nextQ, page: out.page - 1 })}">&laquo; Previous</a> ` : ''}<span>Page ${out.page}</span> <a class="btn" href="/search?${qs({ ...nextQ, page: out.page + 1 })}">Next &raquo;</a></div>`;
  const okN = out.sources.filter((s) => s.ok).length;
  const list = out.results.length
    ? (cat === 'images' ? imageGrid(out.results, o) : `<ol class="rl${cat === 'video' ? ' vid' : ''}">${out.results.map((r) => resultItem(r, o)).join('')}</ol>`)
    : `<div class="none"><p><b>No results.</b> ${okN ? 'Your filters may be too narrow – try removing “must contain”, the site filters or the time limit.' : 'No source answered. You may be offline or the sources are blocking this server – see the status list below.'}</p></div>`;
  const side = `<div id="side"><h4>Order</h4>${Object.entries(SORTS).map(([k, v]) => `<label class="blk"><input type="radio" name="sort" value="${k}"${out.sort === k ? ' checked' : ''}> ${esc(v.split(' – ')[0])}</label>`).join('')}
<input type="text" name="seed" size="10" value="${esc(p.seed || '')}" placeholder="shuffle seed">
<h4>Time</h4><select name="time">${[['', 'Any time'], ['day', 'Past 24 hours'], ['week', 'Past week'], ['month', 'Past month'], ['year', 'Past year']].map(([v, n]) => `<option value="${v}"${out.time === v ? ' selected' : ''}>${n}</option>`).join('')}</select>
<h4>Sources</h4>${allSrc.map((s) => `<label class="blk" title="${esc(s.desc)}"><input type="checkbox" name="sources" value="${s.id}"${sel.has(s.id) ? ' checked' : ''}> ${esc(s.name)}${s.independent ? ' <span class="ind" title="Runs its own independent index">&#9733;</span>' : ''}</label>`).join('')}
<h4>Only these sites</h4><input type="text" name="site" size="18" value="${esc(p.site || '')}">
<h4>Hide these sites</h4><input type="text" name="hide" size="18" value="${esc(p.hide || '')}">
<h4>Must contain</h4><input type="text" name="must" size="18" value="${esc(p.must || '')}">
<h4>Per source</h4><select name="n">${[5, 10, 20, 30, 50].map((n) => `<option${Number(p.n || (cat === 'images' ? 30 : 10)) === n ? ' selected' : ''}>${n}</option>`).join('')}</select>
<h4>Open links in</h4><label class="blk"><input type="radio" name="open" value="orig"${open === 'orig' && !embed ? ' checked' : ''}> Original site</label><label class="blk"><input type="radio" name="open" value="retro"${open === 'retro' || embed ? ' checked' : ''}> Retro view</label>
<p><button type="submit" class="btn blue">Update</button></p></div>`;
  const status = `<div id="status"><h4>Sources asked (nothing is hidden from you)</h4><table>${out.sources.map((s) => `<tr class="${s.ok ? 'ok' : 'bad'}"><td>${s.ok ? '&#10003;' : '&#10007;'}</td><td>${esc(s.name)}</td><td>${s.ok ? s.count + ' results' : esc(s.error)}</td><td>${(s.ms / 1000).toFixed(1)}s</td></tr>`).join('')}</table>
<p class="m">Ordered by: <b>${esc(SORTS[out.sort])}</b>. plainsearch applies no relevance score, no popularity boost and no personalisation; inside each source the order is the source's own.${out.duplicates_removed ? ` ${out.duplicates_removed} duplicate link(s) merged.` : ''}${out.cached ? ' (cached for 60s)' : ''}</p></div>`;
  const film = cat === 'web' && out.page === 1 ? `<div id="film" data-q="${esc(p.q)}" data-embed="${embed ? 1 : ''}" hidden><div class="fh">Images for <b>${esc(p.q)}</b> &ndash; <a href="/search?${qs({ q: p.q, cat: 'images', embed: embed ? 1 : '' })}">more images &raquo;</a></div><div id="film-in"></div></div>` : '';
  return layout({
    title: `${p.q} – plainsearch`, embed, cls: 'results', body: `${topbar(embed, 'search')}
<form action="/search" method="get" id="sf"><div id="hd">${logo(true)}${searchBox(p, cat, embed)}<span class="count">${out.total} results from ${okN}/${out.sources.length} sources in ${(out.took_ms / 1000).toFixed(2)}s &middot; <a href="/api/search?${qs({ ...nextQ, embed: '' })}">JSON</a> &middot; <a href="/api/search?${qs({ ...nextQ, embed: '', format: 'rss' })}">RSS</a></span></div>
${tabsFor(cat, p, embed)}
<div id="cols">${side}<div id="main">${film}${list}${out.results.length ? pager : ''}${status}</div></div></form>${footer()}<script src="/static/results.js"></script>`,
  });
}

function apiDocs(base) {
  const ep = [
    ['GET /api/search', 'q, cat (web|images|video|discuss|code|papers|books|archive), sources (comma list), sort (interleave|grouped|date|oldest|random), seed, time (day|week|month|year), n (3-50 per source), page, site, hide, must, dedupe=0, format (json|rss|txt)', '/api/search?q=raspberry+pi&cat=web&sort=random&seed=1&site=github.com'],
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
  const rows = reg.list().map((s) => `<tr><td><b>${esc(s.name)}</b>${s.independent ? ' <span class="ind">&#9733; independent index</span>' : ''}</td><td>${s.cats.map(esc).join(', ')}</td><td>${esc(s.desc)}</td></tr>`).join('');
  return layout({ title: 'Sources – plainsearch', cls: 'doc', body: `${topbar(false, 'sources')}<div class="page">${logo(true)}<h1>Sources</h1><p>Every query is sent to all sources for the chosen tab, in parallel. You can switch any of them off on the results page.</p><table class="apit"><tr><th>Source</th><th>Tabs</th><th>What it is</th></tr>${rows}</table>
<p>Want more? Set <code>SEARXNG_URL</code> to your own <a href="https://docs.searxng.org/">SearXNG</a> instance and it joins the web / images / video tabs; add your own adapter in <code>lib/providers.js</code> (about 10 lines).</p></div>${footer()}` });
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

module.exports = { layout, home, results, apiDocs, sourcesPage, about, browserShell, retroPage, errorPage, qs };
