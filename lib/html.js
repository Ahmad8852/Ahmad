'use strict';
// Tiny tolerant HTML/XML parser + helpers. Zero dependencies.
// Used by provider scrapers and by the retro page rewriter.

const VOID = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const AUTOCLOSE = {
  li: ['li'], dt: ['dt', 'dd'], dd: ['dt', 'dd'], option: ['option'],
  tr: ['td', 'th', 'tr'], td: ['td', 'th'], th: ['td', 'th'],
  thead: ['tbody', 'tfoot', 'tr', 'td', 'th'], tbody: ['thead', 'tbody', 'tfoot', 'tr', 'td', 'th'],
  tfoot: ['thead', 'tbody', 'tr', 'td', 'th'],
};
const CLOSES_P = new Set('address article aside blockquote div dl fieldset footer form h1 h2 h3 h4 h5 h6 header hr main nav ol p pre section table ul'.split(' '));
const MAX_DEPTH = 400;

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', middot: '·', bull: '•', laquo: '«', raquo: '»', times: '×', trade: '™', deg: '°', euro: '€', pound: '£', yen: '¥', cent: '¢', sect: '§', para: '¶', larr: '←', rarr: '→', uarr: '↑', darr: '↓' };

function decode(s) {
  if (!s || s.indexOf('&') < 0) return s || '';
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e) => {
    if (e[0] === '#') {
      const cp = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      if (!cp || cp > 0x10ffff || (cp >= 0xd800 && cp < 0xe000)) return '�';
      return String.fromCodePoint(cp);
    }
    const v = NAMED[e.toLowerCase()];
    return v === undefined ? m : v;
  });
}

function parseAttrs(src) {
  const attrs = {};
  const re = /([^\s=\/"'<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(src))) {
    const k = m[1].toLowerCase();
    if (k in attrs) continue;
    const v = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : '';
    attrs[k] = decode(v);
  }
  return attrs;
}

function parse(html) {
  const root = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  const re = /<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[([\s\S]*?)\]\]>|<![^>]*>|<\?[^>]*>|<\/([a-zA-Z][^\s>\/]*)[^>]*>|<([a-zA-Z][^\s>\/]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>|([^<]+|<)/g;
  html = String(html || '');
  const lower = html.toLowerCase();
  let m;
  while ((m = re.exec(html))) {
    if (m[1] !== undefined) { top().children.push({ text: m[1] }); continue; }
    if (m[5] !== undefined) { top().children.push({ text: decode(m[5]) }); continue; }
    if (m[2]) {
      const tag = m[2].toLowerCase();
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) { stack.length = i; break; }
      }
      continue;
    }
    if (!m[3]) continue;
    const tag = m[3].toLowerCase();
    const attrSrc = m[4] || '';
    const attrs = parseAttrs(attrSrc);
    const ac = AUTOCLOSE[tag];
    if (ac) while (stack.length > 1 && ac.includes(top().tag)) stack.pop();
    if (CLOSES_P.has(tag) && top().tag === 'p') stack.pop();
    const node = { tag, attrs, children: [] };
    top().children.push(node);
    if (VOID.has(tag)) continue;
    if (tag === 'script' || tag === 'style' || tag === 'textarea' || tag === 'title') {
      const end = lower.indexOf('</' + tag, re.lastIndex);
      const stop = end < 0 ? html.length : end;
      const raw = html.slice(re.lastIndex, stop);
      if (raw) node.children.push({ text: tag === 'textarea' || tag === 'title' ? decode(raw) : raw });
      if (end < 0) re.lastIndex = html.length;
      else { const gt = html.indexOf('>', end); re.lastIndex = gt < 0 ? html.length : gt + 1; }
      continue;
    }
    if (/\/\s*$/.test(attrSrc)) continue; // <tag/> (xml-style)
    if (stack.length < MAX_DEPTH) stack.push(node);
  }
  return root;
}

// ---- helpers -------------------------------------------------------------
function walk(node, fn) {
  if (!node.children) return;
  for (const c of node.children) {
    if (c.tag) { if (fn(c) === false) continue; walk(c, fn); }
  }
}
function findAll(node, pred) {
  const out = [];
  walk(node, (n) => { if (pred(n)) out.push(n); });
  return out;
}
function find(node, pred) {
  let hit = null;
  (function rec(n) {
    if (hit || !n.children) return;
    for (const c of n.children) {
      if (!c.tag) continue;
      if (pred(c)) { hit = c; return; }
      rec(c); if (hit) return;
    }
  })(node);
  return hit;
}
function hasClass(n, cls) {
  const c = n.attrs && n.attrs.class;
  return !!c && (' ' + c + ' ').includes(' ' + cls + ' ');
}
function text(node) {
  if (!node) return '';
  if (node.text !== undefined) return node.text;
  if (node.tag === 'script' || node.tag === 'style') return '';
  let s = '';
  for (const c of node.children || []) s += text(c);
  return s;
}
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = { esc, parse, decode, VOID, walk, find, findAll, hasClass, text, clean, parseAttrs };
