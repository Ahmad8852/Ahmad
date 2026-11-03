'use strict';
// The "retro proxy": fetch any page, throw away its scripts/CSS/trackers/overlays,
// keep the semantic content, and re-present it in a plain 2010-style frame.
// Output is built from a WHITELIST (never by editing the original HTML), and the
// route also sends a strict CSP, so a page can't run code in this origin.
const H = require('./html');
const { esc } = H;
const net = require('./net');
const { extractJsonAfter, youtubeVideos } = require('./providers');

const ALLOWED = new Set(('a abbr address article aside b bdi bdo blockquote br caption cite code col colgroup dd del details dfn div dl dt em fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr i img input ins kbd label legend li main mark nav ol optgroup option p pre q s samp section select small span strong sub summary sup table tbody td textarea tfoot th thead time tr u ul var wbr center font big tt strike button').split(' '));
const DROP = new Set('script style noscript template svg canvas iframe object embed applet head link meta base audio video source track map area dialog math frame frameset param'.split(' '));
const ATTRS = {
  '*': ['id', 'title', 'lang', 'dir'],
  a: ['href'], img: ['src', 'alt', 'width', 'height'], td: ['colspan', 'rowspan', 'align'], th: ['colspan', 'rowspan', 'align', 'scope'],
  ol: ['start', 'type'], li: ['value'], time: ['datetime'], q: ['cite'], blockquote: ['cite'], del: ['datetime'], ins: ['datetime'],
  input: ['type', 'name', 'value', 'placeholder', 'checked', 'size', 'maxlength', 'min', 'max', 'step'], textarea: ['name', 'rows', 'cols', 'placeholder'],
  select: ['name', 'multiple'], option: ['value', 'selected'], label: ['for'], button: ['type', 'name', 'value'], col: ['span'], colgroup: ['span'],
};
const INPUT_TYPES = new Set(['text', 'search', 'hidden', 'checkbox', 'radio', 'submit', 'number', 'email', 'url', 'date', 'tel', 'password']);
const NOISE = new Set('cookie cookies consent gdpr cmp adsbygoogle advert advertisement adslot ads ad sponsored sponsor popup modal overlay newsletter paywall taboola outbrain interstitial skiplink subscribe'.split(' '));
const WP_DROP = new Set('mw-editsection navbox navbox-inner sistersitebox noprint mw-empty-elt mw-jump-link hatnote-hidden metadata ambox vector-toc mw-cite-backlink'.split(' '));

function tokens(n) {
  return `${n.attrs.class || ''} ${n.attrs.id || ''}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}
function isHidden(n) {
  const a = n.attrs;
  if ('hidden' in a) return true;
  if (a.style && /display\s*:\s*none|visibility\s*:\s*hidden/i.test(a.style)) return true;
  if (a['aria-hidden'] === 'true' && /^(div|span|section)$/.test(n.tag) && !H.text(n).trim()) return true;
  return false;
}

class Ctx {
  constructor(base, opts = {}) {
    this.base = base; this.embed = !!opts.embed; this.mode = opts.mode || 'retro'; this.images = opts.images !== false; this.clean = opts.clean !== false;
    this.dropTokens = opts.dropTokens || null; this.formCount = 0;
  }
  abs(u) { try { return new URL(u, this.base); } catch { return null; } }
  link(u) {
    if (!u) return null;
    u = String(u).trim();
    if (u.startsWith('#')) return u;
    const x = this.abs(u);
    if (!x) return null;
    if (x.protocol === 'mailto:') return x.href;
    if (x.protocol !== 'http:' && x.protocol !== 'https:') return null;
    return '/browse?url=' + encodeURIComponent(x.href) + (this.embed ? '&embed=1' : '') + (this.mode !== 'retro' ? '&mode=' + this.mode : '');
  }
  img(u) {
    const x = u && !/^data:/.test(u) ? this.abs(String(u).trim()) : null;
    if (!x || (x.protocol !== 'http:' && x.protocol !== 'https:')) return null;
    return '/img?url=' + encodeURIComponent(x.href);
  }
}

function serialize(node, ctx, out) {
  if (node.text !== undefined) { out.push(esc(node.text)); return; }
  const tag = node.tag;
  if (DROP.has(tag)) {
    if (tag === 'iframe' || tag === 'video' || tag === 'audio') {
      const src = node.attrs.src || (H.find(node, (n) => n.tag === 'source') || { attrs: {} }).attrs.src;
      const l = src && ctx.abs(src);
      if (l && /^https?:$/.test(l.protocol)) out.push(`<p class="rt-note">[embedded ${esc(tag)}: <a href="${esc(ctx.link(l.href))}">${esc(l.hostname)}</a>]</p>`);
    }
    return;
  }
  if (tag === '#root') { for (const c of node.children) serialize(c, ctx, out); return; }
  if (isHidden(node)) return;
  if (ctx.clean) {
    const tk = ctx.dropTokens || NOISE;
    if (tokens(node).some((t) => tk.has(t)) && tag !== 'body' && tag !== 'html' && tag !== 'main' && tag !== 'article' && tag !== 'a') return;
    if (node.attrs.role === 'dialog' || node.attrs.role === 'alertdialog' || node.attrs['aria-modal'] === 'true') return;
  }
  if (!ALLOWED.has(tag)) { for (const c of node.children) serialize(c, ctx, out); return; } // unwrap unknown (html, body, custom elements)

  if (tag === 'form') {
    const method = (node.attrs.method || 'get').toLowerCase();
    if (method !== 'get') { out.push('<p class="rt-note">[a form that sends data (POST) was removed – open the original page to use it]</p>'); return; }
    const target = ctx.abs(node.attrs.action || ctx.base.href);
    if (!target || !/^https?:$/.test(target.protocol)) return;
    target.hash = '';
    out.push(`<form action="/form" method="get" class="rt-form"><input type="hidden" name="__t" value="${esc(target.href)}">${ctx.embed ? '<input type="hidden" name="embed" value="1">' : ''}`);
    for (const c of node.children) serialize(c, ctx, out);
    out.push('</form>');
    return;
  }

  const a = {};
  const allow = (ATTRS['*'].concat(ATTRS[tag] || []));
  for (const k of allow) if (node.attrs[k] !== undefined) a[k] = node.attrs[k];
  if (node.attrs.class) a.class = node.attrs.class.split(/\s+/).filter(Boolean).slice(0, 8).map((c) => 'x-' + c.replace(/[^\w-]/g, '')).join(' ');
  if (a.id) a.id = 'x-' + a.id.replace(/[^\w:.-]/g, '');

  if (tag === 'a') {
    const h = ctx.link(node.attrs.href);
    if (h) { a.href = h; a.rel = 'noreferrer'; } else delete a.href;
  } else if (tag === 'img') {
    if (!ctx.images) return;
    const lazy = ['data-src', 'data-lazy-src', 'data-original', 'data-lazy'].map((k) => node.attrs[k]).find(Boolean);
    let src = node.attrs.src;
    if (!src || /^data:/.test(src)) src = lazy || (node.attrs.srcset || node.attrs['data-srcset'] || '').trim().split(/[\s,]+/)[0];
    const p = ctx.img(src);
    const w = parseInt(node.attrs.width, 10), h = parseInt(node.attrs.height, 10);
    if (!p || (w && w <= 2) || (h && h <= 2) || /pixel|beacon|tracking|1x1/i.test(src)) return;
    a.src = p; a.loading = 'lazy'; delete a.width; delete a.height;
  } else if (tag === 'input') {
    const t = (node.attrs.type || 'text').toLowerCase();
    if (!INPUT_TYPES.has(t) || t === 'password') return;
    a.type = t;
  } else if (tag === 'button') {
    a.type = 'submit';
  } else if (tag === 'font' || tag === 'center') {
    // keep as structural wrappers only
  }
  if (tag === 'td' || tag === 'th') delete a.align;
  if (a.href === undefined && tag === 'a') { out.push('<span>'); for (const c of node.children) serialize(c, ctx, out); out.push('</span>'); return; }

  const attrStr = Object.entries(a).map(([k, v]) => (v === '' ? ` ${k}` : ` ${k}="${esc(v)}"`)).join('');
  if (tag === 'img' || tag === 'br' || tag === 'hr' || tag === 'input' || tag === 'col' || tag === 'wbr') { out.push(`<${tag}${attrStr}>`); return; }
  out.push(`<${tag}${attrStr}>`);
  for (const c of node.children) serialize(c, ctx, out);
  out.push(`</${tag}>`);
}

function sanitize(node, ctx) {
  const out = [];
  serialize(node, ctx, out);
  return out.join('').replace(/(<(div|span|p|section|li|ul|ol)>\s*<\/\2>)+/g, '').replace(/(\s*<br>\s*){4,}/g, '<br><br>');
}

// ---- reader mode: smallest container holding most of the paragraph text ---
function paraWeight(node, map) {
  if (node.text !== undefined) return 0;
  let w = 0;
  for (const c of node.children) w += paraWeight(c, map);
  if (node.tag === 'p' || node.tag === 'pre' || node.tag === 'blockquote') w += H.text(node).trim().length;
  map.set(node, w);
  return w;
}
function findMain(root) {
  const art = H.find(root, (n) => n.tag === 'article' && H.text(n).length > 400) || H.find(root, (n) => n.tag === 'main' && H.text(n).length > 400);
  const map = new Map();
  const total = paraWeight(root, map);
  let cur = root;
  if (art) { paraWeight(art, map); cur = art; }
  else if (!total) return root;
  for (;;) {
    const w = map.get(cur) || total;
    const next = cur.children.filter((c) => c.tag).find((c) => (map.get(c) || 0) >= w * 0.7);
    if (!next) break;
    cur = next;
  }
  return cur;
}

// ---- helpers --------------------------------------------------------------
const linkify = (s, ctx) => esc(s).replace(/https?:\/\/[^\s<]+/g, (u) => {
  const clean = u.replace(/[.,;:!?)\]]+$/, ''); const tail = u.slice(clean.length);
  const l = ctx.link(H.decode(clean));
  return l ? `<a href="${esc(l)}" rel="noreferrer">${clean}</a>${tail}` : u;
});
const kfmt = (n) => (n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n));
const ytCookie = { cookie: 'CONSENT=YES+1; SOCS=CAI' };
const thumbUrl = (id) => '/img?url=' + encodeURIComponent(`https://i.ytimg.com/vi/${id}/mqdefault.jpg`);

// ---- adapters -------------------------------------------------------------
function mapUrl(u) {
  const x = new URL(u);
  const h = x.hostname.replace(/^www\./, '');
  if (h === 'youtu.be') { const id = x.pathname.slice(1); return `https://www.youtube.com/watch?v=${id}${x.search ? '&' + x.search.slice(1) : ''}`; }
  if (h === 'm.youtube.com' || h === 'music.youtube.com') x.hostname = 'www.youtube.com';
  if (h === 'reddit.com' || h === 'm.reddit.com' || h === 'new.reddit.com') x.hostname = 'old.reddit.com';
  if (h === 'twitter.com' || h === 'x.com' || h === 'mobile.twitter.com') x.hostname = 'nitter.net';
  if (h === 'en.m.wikipedia.org') x.hostname = 'en.wikipedia.org';
  return x.href;
}

async function youtubeInfo(id) {
  if (!/^[\w-]{11}$/.test(id || '')) throw new net.FetchError('Bad YouTube video id', 400);
  const u = 'https://www.youtube.com/watch?v=' + id;
  const r = await net.getText(u, { headers: ytCookie });
  const pr = extractJsonAfter(r.text, 'var ytInitialPlayerResponse =') || extractJsonAfter(r.text, 'ytInitialPlayerResponse =');
  const data = extractJsonAfter(r.text, 'var ytInitialData =') || extractJsonAfter(r.text, 'ytInitialData =');
  const vd = (pr && pr.videoDetails) || {};
  const mf = (pr && pr.microformat && pr.microformat.playerMicroformatRenderer) || {};
  return {
    id, url: u, title: vd.title || (mf.title && mf.title.simpleText) || 'YouTube video', author: vd.author, channelId: vd.channelId,
    description: vd.shortDescription || '', views: vd.viewCount ? Number(vd.viewCount) : undefined, lengthSeconds: vd.lengthSeconds ? Number(vd.lengthSeconds) : undefined,
    published: mf.publishDate, keywords: vd.keywords || [], embed: 'https://www.youtube-nocookie.com/embed/' + id,
    related: youtubeVideos(data || {}).filter((v) => v.videoId !== id).slice(0, 14),
  };
}
async function youtubeWatch(url, ctx) {
  const id = url.searchParams.get('v');
  const info = await youtubeInfo(id);
  const vd = { title: info.title, author: info.author, channelId: info.channelId, shortDescription: info.description, viewCount: info.views, lengthSeconds: info.lengthSeconds, keywords: info.keywords };
  const mf = { publishDate: info.published };
  const title = info.title;
  const related = info.related;
  const chan = vd.channelId ? ctx.link('https://www.youtube.com/channel/' + vd.channelId + '/videos') : null;
  const body = `
<div class="yt">
 <div class="yt-main">
  <h1 class="yt-title">${esc(title)}</h1>
  <div class="yt-player"><iframe width="640" height="390" src="https://www.youtube-nocookie.com/embed/${id}" allowfullscreen referrerpolicy="no-referrer" title="${esc(title)}"></iframe></div>
  <div class="yt-meta">
   ${vd.author ? `<b>${chan ? `<a href="${esc(chan)}">${esc(vd.author)}</a>` : esc(vd.author)}</b> &middot; ` : ''}
   ${vd.viewCount ? `${esc(Number(vd.viewCount).toLocaleString('en-US'))} views` : ''}
   ${mf.publishDate ? ` &middot; ${esc(mf.publishDate)}` : ''}
   ${vd.lengthSeconds ? ` &middot; ${Math.floor(vd.lengthSeconds / 60)}:${String(vd.lengthSeconds % 60).padStart(2, '0')}` : ''}
  </div>
  <div class="yt-desc">${linkify(vd.shortDescription || '', ctx).replace(/\n/g, '<br>')}</div>
  ${vd.keywords && vd.keywords.length ? `<div class="yt-tags"><b>Tags:</b> ${vd.keywords.slice(0, 20).map(esc).join(', ')}</div>` : ''}
  <p class="rt-note">Comments, recommendations-by-watch-history and autoplay are intentionally not loaded. <a href="${esc(url.href)}" rel="noreferrer">Open on YouTube</a></p>
 </div>
 <div class="yt-side"><h3>Related videos</h3>${videoList(related, ctx) || '<p class="rt-note">(none could be read)</p>'}</div>
</div>`;
  return { title, html: body, cls: 'yt-page' };
}
function videoList(vs, ctx) {
  return vs.length ? `<ul class="vlist">${vs.map((v) => `<li><a class="vthumb" href="${esc(ctx.link(v.url))}"><img src="${esc(thumbUrl(v.videoId))}" alt="" loading="lazy" width="120" height="68"></a><div><a class="vtitle" href="${esc(ctx.link(v.url))}">${esc(v.title)}</a><div class="vmeta">${esc(v.meta)}</div>${v.snippet ? `<div class="vsnip">${esc(v.snippet)}</div>` : ''}</div></li>`).join('')}</ul>` : '';
}
async function youtubeList(url, ctx) {
  const r = await net.getText(url.href, { headers: ytCookie });
  const data = extractJsonAfter(r.text, 'var ytInitialData =') || extractJsonAfter(r.text, 'ytInitialData =');
  const vs = youtubeVideos(data || {});
  const q = url.searchParams.get('search_query');
  const title = q ? `Videos: ${q}` : H.clean(H.text(H.find(H.parse(r.text), (n) => n.tag === 'title')) || 'YouTube').replace(/ - YouTube$/, '');
  return { title, html: `<h1>${esc(title)}</h1>${videoList(vs, ctx) || '<p class="rt-note">No videos could be read from this page (YouTube may have changed its layout or asked for consent).</p>'}`, cls: 'yt-page' };
}

function wikipedia(root, ctx) {
  const heading = H.find(root, (n) => n.attrs.id === 'firstHeading');
  const content = H.find(root, (n) => n.attrs.id === 'mw-content-text');
  if (!content) return null;
  const drop = new Set([...NOISE].filter((t) => !['ad', 'ads', 'modal'].includes(t)));
  for (const t of WP_DROP) drop.add(t);
  const c2 = new Ctx(ctx.base, { embed: ctx.embed, mode: ctx.mode, images: ctx.images, dropTokens: drop });
  const body = sanitize(content, c2);
  return { title: H.clean(H.text(heading)), html: `<h1 class="wp-title">${esc(H.clean(H.text(heading)))}</h1><div class="wp-body">${body}</div>`, cls: 'wp-page' };
}

// ---- main entry -----------------------------------------------------------
async function render(target, { mode = 'retro', embed = false } = {}) {
  let url;
  try { url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(target) ? target : 'https://' + target); } catch { throw new net.FetchError('That does not look like a URL', 400); }
  url = new URL(mapUrl(url.href));
  const ctx = new Ctx(url, { embed, mode, images: mode !== 'plain' });
  const host = url.hostname.replace(/^www\./, '');

  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') return { ...(await youtubeWatch(url, ctx)), url: url.href };
    return { ...(await youtubeList(url, ctx)), url: url.href };
  }

  const res = await net.getText(url.href, { maxBytes: 4 * 1024 * 1024 });
  const finalUrl = new URL(res.url);
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (ct.startsWith('image/')) return { redirect: '/img?url=' + encodeURIComponent(finalUrl.href) };
  if (ct.startsWith('text/plain') || /json|xml/.test(ct) && !/html/.test(ct)) {
    return { title: finalUrl.pathname.split('/').pop() || finalUrl.hostname, url: finalUrl.href, cls: 'plain-page', html: `<pre>${esc(res.text.slice(0, 500000))}</pre>`, status: res.status };
  }
  if (ct && !/html|xhtml/.test(ct)) {
    return { title: 'Download', url: finalUrl.href, cls: 'plain-page', status: res.status, html: `<p>This is a <code>${esc(ct.split(';')[0])}</code> file – it is not rewritten.</p><p><a href="${esc(finalUrl.href)}" rel="noreferrer">Download the original</a></p>` };
  }

  const root = H.parse(res.text);
  const ctx2 = new Ctx(finalUrl, { embed, mode, images: mode !== 'plain', clean: !/[?&]clean=0/.test(url.search) });
  const titleNode = H.find(root, (n) => n.tag === 'title');
  const og = H.find(root, (n) => n.tag === 'meta' && n.attrs.property === 'og:title');
  const title = H.clean(H.text(titleNode)) || (og && og.attrs.content) || finalUrl.hostname;

  if (/(^|\.)wikipedia\.org$/.test(finalUrl.hostname) && mode === 'retro') {
    const w = wikipedia(root, ctx2);
    if (w) return { ...w, url: finalUrl.href, status: res.status };
  }
  let html;
  if (mode === 'reader' || mode === 'plain') {
    const main = findMain(H.find(root, (n) => n.tag === 'body') || root);
    html = `<h1 class="rt-h1">${esc(title)}</h1>` + sanitize(main, ctx2);
  } else {
    html = sanitize(H.find(root, (n) => n.tag === 'body') || root, ctx2);
  }
  if (!H.clean(html.replace(/<[^>]*>/g, ''))) html = '<p class="rt-note">Nothing readable was found on this page. It probably needs JavaScript to show its content. <a href="' + esc(finalUrl.href) + '" rel="noreferrer">Open the original</a>.</p>';
  return { title, url: finalUrl.href, html, cls: 'mode-' + mode, status: res.status, truncated: res.truncated };
}

module.exports = { render, youtubeInfo, sanitize, Ctx, findMain, mapUrl };
