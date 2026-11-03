# plainsearch

An **unranked metasearch engine**, **tabbed retro browser** and **page rewriter** in a 2010 look.
Zero dependencies – only Node 20+.

```bash
npm start            # http://127.0.0.1:8080
npm test             # 12 tests (parsers, filters, sanitizer, SSRF guard, end-to-end)
npm run demo         # adds offline fixture sources, for trying the UI with no internet
```

## What it does

| | |
|---|---|
| **/** `/search` | Web · Images · Video · Discussions · Code · Papers · Books · Archive. Left "refine" panel: order, time, sources on/off, only/hide sites, must-contain, per-source count. Image filmstrip under the bar on Web results; lightbox grid on Images. |
| **/browser** | Tabbed browser (back/forward/reload/home, omnibox that tells URLs from searches, bookmarks, Retro / Reader / Text-only). Everything loads through the rewriter. |
| **/browse?url=** | Retro rewriter: removes scripts, CSS, ads, cookie walls, trackers, POST forms; keeps content; re-frames it in a plain style. Images and GET-forms are proxied. |
| **YouTube** | `/watch` → classic watch page (privacy embed, description, tags, related). Results/channel/home pages → plain video lists. `/api/youtube?id=` gives it as JSON. |
| **Wikipedia** | Cleaned article view. |
| **Reddit / X** | Redirected to `old.reddit.com` / a Nitter host (best effort – they may block servers). |

### How results are ordered (the "unbiased" part)
plainsearch adds **no relevance score, popularity boost or personalisation**. You pick the merge:
interleaved (default) · grouped by source · newest · oldest · shuffled with a repeatable seed.
Every query shows **every source asked**, with result counts, timings and errors.

### API (no keys, CORS on, no logs)
`/api/search` `/api/images` `/api/videos` `/api/sources` `/api/suggest` `/api/page` `/api/youtube` + `/opensearch.xml`
(`format=json|rss|txt`). Full docs at `/api`.

### Sources
Mojeek ★, Marginalia ★ (own indexes) · DuckDuckGo · Wikipedia · Wikimedia Commons · Openverse · Internet Archive · YouTube · Hacker News · Reddit · Stack Overflow · GitHub · arXiv · Crossref · Open Library · Project Gutenberg · optional **SearXNG** (`SEARXNG_URL=http://localhost:8888`) which fans out to 70+ engines.
Add one in ~10 lines in `lib/providers.js` (`def(id, name, categories, description, async (q, opts) => [...])`).

## Honest limits
* **There is no such thing as an index-free search engine** that also covers the web. This asks many independent indexes/APIs and lets *you* control merging and filtering. Each source still ranks its own results.
* Scraped sources (YouTube, DuckDuckGo, Mojeek, Reddit) depend on page markup and bot checks and can break; the status panel shows when they do.
* Pure-JavaScript sites may render empty in retro view – try Reader or open the original.
* YouTube comments aren't available without their API/JS.

## Security
* Binds to `127.0.0.1` by default. It's an open proxy – **don't expose it to the internet**.
* Output of the rewriter is built from a tag/attribute **whitelist**, and `/browse` sends a strict CSP (`script-src 'self'`, no inline script/style).
* Private/loopback/link-local/metadata addresses are blocked on every redirect hop (`PLAINSEARCH_ALLOW_PRIVATE=1` disables this, tests only).
* Images are proxied with no referrer/cookies and must really be `image/*`.
* No cookies, accounts or logs. Bookmarks/tabs live in your browser's `localStorage`.

Env: `PORT` `HOST` `SEARXNG_URL` `GITHUB_TOKEN` (higher GitHub limits). Behind a proxy use `NODE_USE_ENV_PROXY=1`.
