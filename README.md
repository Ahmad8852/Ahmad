# plainsearch

An **unranked metasearch engine**, **tabbed retro browser** and **page rewriter** in a 2010 look.
Zero dependencies – only Node 20+.

```bash
npm start            # http://127.0.0.1:8080  (browser version, no install step)
npm test             # 12 tests (parsers, filters, sanitizer, SSRF guard, deep results, streaming, end-to-end)
npm run demo         # adds offline fixture sources, for trying the UI with no internet
```

## Mac app (Electron)
Runs the same server inside its own window: tabs, bookmarks, address bar, Cmd+T / Cmd+L / Cmd+[ / Cmd+], links to other sites open in your normal browser.

```bash
npm install          # once (downloads Electron, a few hundred MB)
npm run app          # run it as an app right now
npm run dist         # build dist/plainsearch-*.dmg  → drag to Applications
```
Or just double-click **build-mac.command** in Finder. The app is unsigned, so the first time: right-click it → **Open** → **Open**
(if macOS says it's "damaged": `xattr -cr /Applications/plainsearch.app`).

## Speed and depth
* Results **stream in** as each source answers – the page appears instantly and the first results show within about a second; slow sources no longer hold up fast ones. Identical searches are cached for 10 minutes (paging is instant).
* Each source is fetched **page after page in parallel** until it runs dry or reaches its limit. *Max results* goes up to 2,000 (default 1,000 in the UI, 100 in the API). Real depth depends on the sources: Wikipedia/Archive/arXiv/Crossref/Hacker News give hundreds to 1,000, while DuckDuckGo, Mojeek, GitHub and Stack Overflow are capped lower to avoid being blocked. The **Everything** tab asks all 18 sources at once.


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
(`format=json|rss|txt`; `limit` up to 2000, `per`/`page` to slice). `/api/stream` is the same search as newline-delimited JSON. Full docs at `/api`.

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
