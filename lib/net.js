'use strict';
const dns = require('node:dns').promises;
const net = require('node:net');

const UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';
const ALLOW_PRIVATE = process.env.PLAINSEARCH_ALLOW_PRIVATE === '1';

function isPrivateV4(ip) {
  const p = ip.split('.').map(Number);
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 192 && b === 0 && p[2] === 0) || (a === 198 && (b === 18 || b === 19));
}
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) return isPrivateV4(ip);
  const l = ip.toLowerCase();
  const mapped = l.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateV4(mapped[1]);
  const hex = l.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) { const a = parseInt(hex[1], 16), b = parseInt(hex[2], 16); return isPrivateV4([a >> 8, a & 255, b >> 8, b & 255].join('.')); }
  return l === '::' || l === '::1' || /^f[cd]/.test(l) || /^fe[89ab]/.test(l);
}

class FetchError extends Error {
  constructor(msg, status) { super(msg); this.status = status; }
}

// Throws unless the URL is http(s) and resolves only to public addresses.
async function assertPublicUrl(u) {
  let url;
  try { url = new URL(u); } catch { throw new FetchError('Invalid URL', 400); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new FetchError('Only http(s) URLs are allowed', 400);
  if (ALLOW_PRIVATE) return url;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) throw new FetchError('Blocked: private address', 403);
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new FetchError('Blocked: private address', 403);
    return url;
  }
  let addrs;
  try { addrs = await dns.lookup(host, { all: true }); } catch { throw new FetchError('DNS lookup failed for ' + host, 502); }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new FetchError('Blocked: private address', 403);
  return url;
}

// Low-level fetch: manual redirects (each hop re-validated), size cap, timeout.
async function request(url, opts = {}) {
  const { timeout = 8000, maxBytes = 5 * 1024 * 1024, headers = {}, guard = true, method = 'GET', body } = opts;
  let cur = url;
  for (let hop = 0; hop < 6; hop++) {
    if (guard) await assertPublicUrl(cur);
    let res;
    try {
      res = await fetch(cur, {
        method, body, redirect: 'manual', signal: AbortSignal.timeout(timeout),
        headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.8', accept: '*/*', ...headers },
      });
    } catch (e) {
      const m = e.name === 'TimeoutError' ? 'timeout' : (e.cause && e.cause.code) || e.message;
      throw new FetchError('Fetch failed: ' + m, 504);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      cur = new URL(res.headers.get('location'), cur).href;
      try { await res.body?.cancel(); } catch {}
      continue;
    }
    const chunks = [];
    let size = 0;
    if (res.body) {
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes) { try { await reader.cancel(); } catch {} break; }
        chunks.push(value);
      }
    }
    return { status: res.status, headers: res.headers, buf: Buffer.concat(chunks), url: cur, truncated: size > maxBytes };
  }
  throw new FetchError('Too many redirects', 508);
}

function decodeBody(buf, contentType) {
  let cs = (/charset=["']?([\w-]+)/i.exec(contentType || '') || [])[1];
  if (!cs) {
    const head = buf.subarray(0, 4096).toString('latin1');
    cs = (/<meta[^>]+charset=["']?([\w-]+)/i.exec(head) || [])[1];
  }
  try { return new TextDecoder(cs || 'utf-8').decode(buf); } catch { return buf.toString('utf8'); }
}

async function getText(url, opts) {
  const r = await request(url, opts);
  return { ...r, text: decodeBody(r.buf, r.headers.get('content-type')) };
}
async function getJson(url, opts) {
  const r = await getText(url, { ...opts, headers: { accept: 'application/json', ...(opts && opts.headers) } });
  if (r.status >= 400) throw new FetchError('HTTP ' + r.status, r.status);
  try { return JSON.parse(r.text); } catch { throw new FetchError('Bad JSON from upstream', 502); }
}

// Tiny TTL cache
class Cache {
  constructor(max = 200, ttl = 60000) { this.m = new Map(); this.max = max; this.ttl = ttl; }
  get(k) { const e = this.m.get(k); if (!e) return; if (e.t < Date.now()) { this.m.delete(k); return; } return e.v; }
  set(k, v, ttl = this.ttl) { if (this.m.size >= this.max) this.m.delete(this.m.keys().next().value); this.m.set(k, { v, t: Date.now() + ttl }); }
}

module.exports = { UA, request, getText, getJson, decodeBody, assertPublicUrl, isPrivateIp, FetchError, Cache };
