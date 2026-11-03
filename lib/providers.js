'use strict';
// Every source is a small adapter: run(query, opts) -> [{title,url,snippet,date,thumb,full,meta,type}]
// No adapter scores, boosts or personalises anything. Order is whatever the source returned.
const H = require('./html');
const { getJson, getText } = require('./net');

const enc = encodeURIComponent;
const strip = (s) => H.clean(H.decode(String(s || '').replace(/<[^>]*>/g, ' ')));
const iso = (d) => { const t = new Date(d); return isNaN(t) ? undefined : t.toISOString(); };
const T = { trusted: true };
const cut = (s, n = 320) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s);

// ---------- JSON extraction helpers (YouTube embeds JSON in the page) ------
function extractJsonAfter(src, marker) {
  const i = src.indexOf(marker);
  if (i < 0) return null;
  let j = src.indexOf('{', i + marker.length);
  if (j < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let k = j; k < src.length; k++) {
    const c = src[k];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) { try { return JSON.parse(src.slice(j, k + 1)); } catch { return null; } }
  }
  return null;
}
function collect(obj, keys, out = [], depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 40) return out;
  if (Array.isArray(obj)) { for (const v of obj) collect(v, keys, out, depth + 1); return out; }
  for (const k of Object.keys(obj)) {
    if (keys.includes(k)) out.push([k, obj[k]]);
    else collect(obj[k], keys, out, depth + 1);
  }
  return out;
}
const runsText = (x) => !x ? '' : x.simpleText || (x.runs || []).map((r) => r.text).join('') || x.content || '';

function youtubeVideos(data) {
  const seen = new Set(), out = [];
  const hits = collect(data, ['videoRenderer', 'compactVideoRenderer', 'gridVideoRenderer', 'playlistVideoRenderer', 'lockupViewModel']);
  for (const [k, v] of hits) {
    let id, title, channel, views, when, len, desc;
    if (k === 'lockupViewModel') {
      if (v.contentType && !/VIDEO/.test(v.contentType)) continue;
      id = v.contentId;
      const md = v.metadata && v.metadata.lockupMetadataViewModel;
      title = md && md.title && md.title.content;
      const rows = (md && md.metadata && md.metadata.contentMetadataViewModel && md.metadata.contentMetadataViewModel.metadataRows) || [];
      const parts = rows.flatMap((r) => (r.metadataParts || []).map((p) => p.text && p.text.content)).filter(Boolean);
      channel = parts[0]; views = parts[1]; when = parts[2];
    } else {
      id = v.videoId;
      title = runsText(v.title);
      channel = runsText(v.ownerText || v.longBylineText || v.shortBylineText);
      views = runsText(v.viewCountText || v.shortViewCountText);
      when = runsText(v.publishedTimeText);
      len = runsText(v.lengthText);
      desc = runsText(v.descriptionSnippet) || (v.detailedMetadataSnippets && runsText(v.detailedMetadataSnippets[0].snippetText));
    }
    if (!id || !/^[\w-]{11}$/.test(id) || !title || seen.has(id)) continue;
    seen.add(id);
    out.push({
      title, url: 'https://www.youtube.com/watch?v=' + id, type: 'video',
      snippet: cut(desc || ''), thumb: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      meta: [channel, views, when, len].filter(Boolean).join(' · '), videoId: id,
    });
  }
  return out;
}

const TIME_DAYS = { day: 1, week: 7, month: 31, year: 366 };

const P = {};
function def(id, name, cats, desc, run, extra = {}) { P[id] = { id, name, cats, desc, run, ...extra }; }

// ---------- WEB (independent indexes first) --------------------------------
def('mojeek', 'Mojeek', ['web'], 'Independent crawler & index (UK). No Google/Bing results.', async (q, o) => {
  const s = (o.page - 1) * 10 + 1;
  const { status, text } = await getText(`https://www.mojeek.com/search?q=${enc(q)}&s=${s}&safe=0`, T);
  if (status >= 400) throw new Error('HTTP ' + status);
  return parseMojeek(text);
}, { independent: true });

function parseMojeek(text) {
  const root = H.parse(text);
  const items = H.findAll(root, (n) => n.tag === 'li' && !!H.find(n, (x) => x.tag === 'a' && H.hasClass(x, 'title')));
  return items.map((li) => {
    const a = H.find(li, (x) => x.tag === 'a' && H.hasClass(x, 'title'));
    if (!a || !/^https?:/.test(a.attrs.href || '')) return null;
    const p = H.find(li, (x) => x.tag === 'p' && H.hasClass(x, 's'));
    return { title: H.clean(H.text(a)), url: a.attrs.href, snippet: H.clean(H.text(p)), type: 'web' };
  }).filter(Boolean);
}

def('marginalia', 'Marginalia', ['web'], 'Independent index of the small, non-commercial web.', async (q, o) => {
  const j = await getJson(`https://api.marginalia.nu/public/search/${enc(q)}?count=${o.n}&page=${o.page}`, T);
  return (j.results || []).map((r) => ({ title: strip(r.title), url: r.url, snippet: strip(r.description), type: 'web' }));
}, { independent: true });

def('ddg', 'DuckDuckGo', ['web'], 'Bing-derived web results via DuckDuckGo HTML (safe-search off).', async (q, o) => {
  const df = { day: 'd', week: 'w', month: 'm', year: 'y' }[o.time] || '';
  const url = `https://html.duckduckgo.com/html/?q=${enc(q)}&kp=-2&kl=wt-wt${df ? '&df=' + df : ''}${o.page > 1 ? '&s=' + (o.page - 1) * 30 + '&dc=' + ((o.page - 1) * 30 + 1) : ''}`;
  const { status, text } = await getText(url, T);
  if (status >= 400) throw new Error('HTTP ' + status);
  if (/anomaly|captcha/i.test(text) && !/result__a/.test(text)) throw new Error('blocked by upstream bot check');
  return parseDdg(text);
});
function parseDdg(html) {
  const root = H.parse(html);
  const out = [];
  for (const r of H.findAll(root, (n) => n.tag === 'div' && H.hasClass(n, 'result') && !H.hasClass(n, 'result--ad'))) {
    const a = H.find(r, (x) => x.tag === 'a' && H.hasClass(x, 'result__a'));
    if (!a) continue;
    let href = a.attrs.href || '';
    const m = /[?&]uddg=([^&]+)/.exec(href);
    if (m) href = decodeURIComponent(m[1]);
    else if (href.startsWith('//')) href = 'https:' + href;
    if (!/^https?:/.test(href) || /duckduckgo\.com\/y\.js/.test(href)) continue;
    const sn = H.find(r, (x) => H.hasClass(x, 'result__snippet'));
    out.push({ title: H.clean(H.text(a)), url: href, snippet: H.clean(H.text(sn)), type: 'web' });
  }
  return out;
}

def('searxng', 'SearXNG', ['web', 'images', 'video'], 'Your own SearXNG instance (set SEARXNG_URL) – fans out to 70+ more engines.', async (q, o) => {
  const base = process.env.SEARXNG_URL.replace(/\/$/, '');
  const cat = { web: 'general', images: 'images', video: 'videos' }[o.cat] || 'general';
  const j = await getJson(`${base}/search?q=${enc(q)}&format=json&pageno=${o.page}&categories=${cat}&safesearch=0`, { guard: false, timeout: 9000 });
  return (j.results || []).map((r) => ({
    title: strip(r.title), url: r.url, snippet: strip(r.content), date: r.publishedDate && iso(r.publishedDate),
    thumb: r.thumbnail_src || r.thumbnail, full: r.img_src, type: o.cat === 'images' ? 'image' : o.cat === 'video' ? 'video' : 'web',
    meta: (r.engines || []).join(', '),
  }));
}, { enabled: () => !!process.env.SEARXNG_URL });

def('wikipedia', 'Wikipedia', ['web'], 'Encyclopedia articles (English).', async (q, o) => {
  const j = await getJson(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${enc(q)}&srlimit=${Math.min(o.n, 20)}&sroffset=${(o.page - 1) * o.n}&format=json&origin=*`, T);
  return ((j.query && j.query.search) || []).map((r) => ({
    title: r.title, url: 'https://en.wikipedia.org/wiki/' + enc(r.title.replace(/ /g, '_')).replace(/%2F/g, '/'),
    snippet: strip(r.snippet), date: iso(r.timestamp), type: 'web', meta: 'Wikipedia',
  }));
});

// ---------- IMAGES ----------------------------------------------------------
def('commons', 'Wikimedia Commons', ['images'], '90M+ freely licensed media files.', async (q, o) => {
  const j = await getJson(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${enc(q + ' filetype:bitmap')}&gsrnamespace=6&gsrlimit=${Math.min(o.n, 30)}&gsroffset=${(o.page - 1) * o.n}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=360&format=json&origin=*`, T);
  const pages = Object.values((j.query && j.query.pages) || {}).sort((a, b) => a.index - b.index);
  return pages.map((p) => {
    const ii = p.imageinfo && p.imageinfo[0];
    if (!ii) return null;
    const em = ii.extmetadata || {};
    return {
      title: p.title.replace(/^File:/, '').replace(/\.\w+$/, ''), url: ii.descriptionurl, thumb: ii.thumburl || ii.url, full: ii.url,
      snippet: strip(em.ImageDescription && em.ImageDescription.value), w: ii.width, h: ii.height, type: 'image',
      meta: strip(em.LicenseShortName && em.LicenseShortName.value), date: em.DateTimeOriginal && iso(strip(em.DateTimeOriginal.value)),
    };
  }).filter(Boolean);
});

def('openverse', 'Openverse', ['images'], 'CC-licensed images from Flickr, museums, and more.', async (q, o) => {
  const j = await getJson(`https://api.openverse.org/v1/images/?q=${enc(q)}&page_size=${Math.min(o.n, 20)}&page=${o.page}`, T);
  return (j.results || []).map((r) => ({
    title: r.title || 'Untitled', url: r.foreign_landing_url || r.url, thumb: r.thumbnail || r.url, full: r.url,
    w: r.width, h: r.height, type: 'image', meta: [r.source, r.license && 'CC ' + r.license.toUpperCase()].filter(Boolean).join(' · '),
  }));
});

// ---------- ARCHIVE.ORG -----------------------------------------------------
function archiveRun(extra, type) {
  return async (q, o) => {
    const cat = type === 'image' ? ' AND mediatype:image' : type === 'video' ? ' AND mediatype:movies' : extra;
    const fl = ['identifier', 'title', 'description', 'mediatype', 'publicdate', 'creator'].map((f) => 'fl[]=' + f).join('&');
    const j = await getJson(`https://archive.org/advancedsearch.php?q=${enc('(' + q + ')' + cat)}&${fl}&rows=${Math.min(o.n, 50)}&page=${o.page}&output=json`, T);
    return ((j.response && j.response.docs) || []).map((d) => {
      const desc = Array.isArray(d.description) ? d.description.join(' ') : d.description;
      return {
        title: strip(Array.isArray(d.title) ? d.title[0] : d.title) || d.identifier, url: 'https://archive.org/details/' + d.identifier,
        snippet: cut(strip(desc)), date: iso(d.publicdate), thumb: 'https://archive.org/services/img/' + d.identifier,
        type: type || 'archive', meta: [d.mediatype, strip(Array.isArray(d.creator) ? d.creator[0] : d.creator)].filter(Boolean).join(' · '),
      };
    });
  };
}
def('archive', 'Internet Archive', ['archive', 'books'], 'Books, audio, video, software and web captures.', archiveRun(''));
def('archive-images', 'Internet Archive (images)', ['images'], 'Scanned plates, photos and ephemera.', archiveRun('', 'image'));
def('archive-video', 'Internet Archive (video)', ['video'], 'Films, TV, public-domain movies.', archiveRun('', 'video'));

// ---------- VIDEO -----------------------------------------------------------
def('youtube', 'YouTube', ['video'], 'Search results scraped straight from YouTube, un-personalised (no cookies).', async (q, o) => {
  const sp = { day: 'EgQIAhAB', week: 'EgQIAxAB', month: 'EgQIBBAB', year: 'EgQIBRAB' }[o.time];
  const { text } = await getText(`https://www.youtube.com/results?search_query=${enc(q)}${sp ? '&sp=' + sp : ''}`, { ...T, headers: { cookie: 'CONSENT=YES+1; SOCS=CAI' } });
  const data = extractJsonAfter(text, 'var ytInitialData =') || extractJsonAfter(text, 'ytInitialData"] =') || extractJsonAfter(text, 'window["ytInitialData"] =');
  if (!data) throw new Error('could not read YouTube page (consent or layout change)');
  return youtubeVideos(data);
});

// ---------- DISCUSSION ------------------------------------------------------
def('hackernews', 'Hacker News', ['discuss'], 'Tech discussion (Algolia API).', async (q, o) => {
  const ep = o.sort === 'date' ? 'search_by_date' : 'search';
  const j = await getJson(`https://hn.algolia.com/api/v1/${ep}?query=${enc(q)}&tags=story&hitsPerPage=${Math.min(o.n, 50)}&page=${o.page - 1}`, T);
  return (j.hits || []).map((h) => ({
    title: h.title, url: h.url || 'https://news.ycombinator.com/item?id=' + h.objectID, snippet: cut(strip(h.story_text)),
    date: iso(h.created_at), type: 'discuss', meta: `${h.points || 0} pts · ${h.num_comments || 0} comments · discuss: news.ycombinator.com/item?id=${h.objectID}`,
    discussion: 'https://news.ycombinator.com/item?id=' + h.objectID,
  }));
});

def('reddit', 'Reddit', ['discuss'], 'Reddit posts (public JSON; may be rate-limited).', async (q, o) => {
  const t = { day: 'day', week: 'week', month: 'month', year: 'year' }[o.time] || 'all';
  const j = await getJson(`https://www.reddit.com/search.json?q=${enc(q)}&limit=${Math.min(o.n, 50)}&t=${t}&raw_json=1`, { ...T, headers: { 'user-agent': 'plainsearch/1.0 (self-hosted metasearch)' } });
  return ((j.data && j.data.children) || []).map((c) => c.data).map((d) => ({
    title: d.title, url: 'https://old.reddit.com' + d.permalink, snippet: cut(strip(d.selftext)), date: iso(d.created_utc * 1000),
    type: 'discuss', meta: `r/${d.subreddit} · ${d.score} pts · ${d.num_comments} comments`,
  }));
});

def('stackexchange', 'Stack Exchange', ['discuss', 'code'], 'Stack Overflow Q&A.', async (q, o) => {
  const j = await getJson(`https://api.stackexchange.com/2.3/search/advanced?q=${enc(q)}&site=stackoverflow&pagesize=${Math.min(o.n, 50)}&page=${o.page}&order=desc&sort=${o.sort === 'date' ? 'creation' : 'relevance'}`, T);
  return (j.items || []).map((i) => ({
    title: strip(i.title), url: i.link, snippet: (i.tags || []).join(', '), date: iso(i.creation_date * 1000),
    type: 'discuss', meta: `${i.score} votes · ${i.answer_count} answers${i.is_answered ? ' · answered' : ''}`,
  }));
});

// ---------- CODE ------------------------------------------------------------
def('github', 'GitHub', ['code'], 'Repositories (set GITHUB_TOKEN for higher rate limits).', async (q, o) => {
  const headers = { accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.authorization = 'Bearer ' + process.env.GITHUB_TOKEN;
  const j = await getJson(`https://api.github.com/search/repositories?q=${enc(q)}&per_page=${Math.min(o.n, 50)}&page=${o.page}`, { ...T, headers });
  return (j.items || []).map((r) => ({
    title: r.full_name, url: r.html_url, snippet: r.description || '', date: iso(r.pushed_at), type: 'code',
    meta: `★ ${r.stargazers_count}${r.language ? ' · ' + r.language : ''}`,
  }));
});

// ---------- PAPERS ----------------------------------------------------------
def('arxiv', 'arXiv', ['papers'], 'Preprints in physics, maths, CS, and more.', async (q, o) => {
  const { text } = await getText(`https://export.arxiv.org/api/query?search_query=all:${enc(q)}&start=${(o.page - 1) * o.n}&max_results=${Math.min(o.n, 50)}`, T);
  const root = H.parse(text);
  return H.findAll(root, (n) => n.tag === 'entry').map((e) => {
    const g = (t) => H.clean(H.text(H.find(e, (x) => x.tag === t)));
    const authors = H.findAll(e, (x) => x.tag === 'name').map((x) => H.clean(H.text(x)));
    return { title: g('title'), url: g('id').replace('http://', 'https://'), snippet: cut(g('summary')), date: iso(g('published')), type: 'papers', meta: authors.slice(0, 4).join(', ') + (authors.length > 4 ? ' et al.' : '') };
  });
});

def('crossref', 'Crossref', ['papers'], 'Scholarly articles with DOIs (all publishers).', async (q, o) => {
  const j = await getJson(`https://api.crossref.org/works?query=${enc(q)}&rows=${Math.min(o.n, 50)}&offset=${(o.page - 1) * o.n}`, T);
  return ((j.message && j.message.items) || []).map((i) => {
    const dp = i.issued && i.issued['date-parts'] && i.issued['date-parts'][0];
    return {
      title: strip((i.title || [])[0]) || i.DOI, url: i.URL, snippet: cut(strip(i.abstract)), type: 'papers',
      date: dp && dp[0] ? iso(`${dp[0]}-${String(dp[1] || 1).padStart(2, '0')}-${String(dp[2] || 1).padStart(2, '0')}`) : undefined,
      meta: [(i['container-title'] || [])[0], (i.author || []).slice(0, 3).map((a) => a.family).filter(Boolean).join(', ')].filter(Boolean).join(' · '),
    };
  });
});

// ---------- BOOKS -----------------------------------------------------------
def('openlibrary', 'Open Library', ['books'], 'Millions of book records.', async (q, o) => {
  const j = await getJson(`https://openlibrary.org/search.json?q=${enc(q)}&limit=${Math.min(o.n, 50)}&page=${o.page}`, T);
  return (j.docs || []).map((d) => ({
    title: d.title, url: 'https://openlibrary.org' + d.key, type: 'books',
    thumb: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : undefined,
    snippet: (d.author_name || []).slice(0, 3).join(', '), meta: [d.first_publish_year, d.edition_count && d.edition_count + ' editions'].filter(Boolean).join(' · '),
  }));
});

def('gutenberg', 'Project Gutenberg', ['books'], 'Free public-domain e-books.', async (q, o) => {
  const j = await getJson(`https://gutendex.com/books?search=${enc(q)}&page=${o.page}`, T);
  return (j.results || []).map((b) => ({
    title: b.title, url: 'https://www.gutenberg.org/ebooks/' + b.id, type: 'books', thumb: b.formats && b.formats['image/jpeg'],
    snippet: (b.authors || []).map((a) => a.name).join('; '), meta: (b.download_count || 0) + ' downloads',
  }));
});

// ---------- DEMO (offline) --------------------------------------------------
if (process.env.PLAINSEARCH_DEMO === '1') {
  const svg = (c, t) => 'data:image/svg+xml;utf8,' + enc(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220"><rect width="320" height="220" fill="${c}"/><text x="160" y="118" font-family="Verdana" font-size="26" fill="#fff" text-anchor="middle">${t}</text></svg>`);
  def('demo-a', 'Demo A', ['web', 'images', 'video', 'discuss', 'code', 'papers', 'books', 'archive'], 'Offline fixture.', async (q, o) => Array.from({ length: 6 }, (_, i) => ({
    title: `Demo A result ${i + 1} for “${q}”`, url: `https://example.com/a/${i + 1}`, snippet: `This is a canned snippet number ${i + 1} about ${q}. Nothing here is ranked by us.`,
    date: new Date(Date.now() - i * 864e5 * 9).toISOString(), thumb: svg(['#3b6ea5', '#a53b3b', '#3ba55a', '#a58a3b', '#6b3ba5', '#3ba5a0'][i], 'A' + (i + 1)), full: svg('#333', 'A' + (i + 1)), w: 320, h: 220,
    type: o.cat === 'images' ? 'image' : o.cat === 'video' ? 'video' : 'web', meta: 'fixture', videoId: 'dQw4w9WgXcQ',
  })));
  def('demo-b', 'Demo B', ['web', 'images', 'video', 'discuss', 'code', 'papers', 'books', 'archive'], 'Offline fixture.', async (q, o) => Array.from({ length: 5 }, (_, i) => ({
    title: `Demo B result ${i + 1}: ${q}`, url: `https://example.org/b/${i + 1}`, snippet: `Second fixture source, item ${i + 1}.`,
    date: new Date(Date.now() - i * 864e5 * 40).toISOString(), thumb: svg(['#555', '#7a4', '#47a', '#a47', '#74a'][i], 'B' + (i + 1)), full: svg('#222', 'B' + (i + 1)), w: 320, h: 220,
    type: o.cat === 'images' ? 'image' : o.cat === 'video' ? 'video' : 'web', meta: 'fixture', videoId: 'dQw4w9WgXcQ',
  })));
}

const CATEGORIES = [
  ['web', 'Web'], ['images', 'Images'], ['video', 'Video'], ['discuss', 'Discussions'],
  ['code', 'Code'], ['papers', 'Papers'], ['books', 'Books'], ['archive', 'Archive'],
];
const list = () => Object.values(P).filter((p) => !p.enabled || p.enabled());
const forCategory = (cat) => list().filter((p) => p.cats.includes(cat));

module.exports = { parseMojeek, providers: P, list, forCategory, CATEGORIES, parseDdg, extractJsonAfter, youtubeVideos, TIME_DAYS };
