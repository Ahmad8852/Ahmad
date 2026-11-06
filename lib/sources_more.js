'use strict';
// ~85 more sources, all keyless public APIs/feeds. Each adapter is `url` (request) + `list` (find the array)
// + `map` (one item -> result). If the response isn't the shape we expect the source reports
// "unexpected response format" instead of silently returning nothing. Test them live at /sources/check.
module.exports = function register({ def, getJson, getText, H, strip, iso, cut, enc }) {
  const TYPE = { web: 'web', images: 'image', video: 'video', discuss: 'discuss', code: 'code', papers: 'papers', books: 'books', archive: 'archive', news: 'news', audio: 'audio', reference: 'web', data: 'data' };
  const UA = { 'user-agent': 'plainsearch/1.0 (self-hosted metasearch; https://github.com/Ahmad8852/Ahmad)' };
  const arr = (x) => (Array.isArray(x) ? x : x == null ? [] : [x]);
  const first = (x) => arr(x)[0];

  function api(id, name, cats, desc, spec) {
    const type = spec.type || TYPE[cats[0]];
    const parse = (j, o) => {
      const items = spec.list(j);
      if (!Array.isArray(items)) throw new Error('unexpected response format');
      const out = [];
      for (const x of items) { try { const r = spec.map(x, o || {}); if (r && r.url && r.title) out.push({ type, ...r }); } catch { /* skip malformed item */ } }
      return out;
    };
    def(id, name, cats, desc, async (q, o) => parse(await getJson(spec.url(enc(q), o, q), { trusted: true, headers: spec.headers || {}, timeout: spec.timeout }), o),
      { per: spec.per || 20, maxDepth: spec.maxDepth || spec.per || 20, independent: spec.independent, skipAll: spec.skipAll, parse });
  }
  const off = (o) => (o.page - 1) * o.n;
  const authors = (list, key) => arr(list).map((a) => (typeof a === 'string' ? a : a && (a[key] || a.name || a.full_name || a.text))).filter(Boolean);
  const joinMeta = (...p) => p.flat().filter(Boolean).join(' · ');

  // ======================= WEB =============================================
  api('mwmbl', 'Mwmbl', ['web'], 'Open-source, community-run search engine with its own index.', {
    independent: true, per: 20, maxDepth: 20,
    url: (q) => `https://api.mwmbl.org/api/v1/search/?s=${q}`, list: (j) => j,
    map: (x) => ({ title: arr(x.title).map((t) => t.value).join(''), url: x.url, snippet: arr(x.extract).map((t) => t.value).join('') }),
  });
  api('yacy', 'YaCy (peer-to-peer)', ['web'], 'Decentralised peer-to-peer search index (public searchlab node).', {
    independent: true, per: 50, maxDepth: 200,
    url: (q, o) => `https://yacy.searchlab.eu/yacysearch.json?query=${q}&maximumRecords=${o.n}&startRecord=${off(o)}&resource=global`,
    list: (j) => j.channels && j.channels[0] && j.channels[0].items,
    map: (x) => ({ title: strip(x.title), url: x.link, snippet: strip(x.description), date: x.pubDate && iso(x.pubDate) }),
  });
  def('wiby', 'Wiby', ['web'], 'Hand-picked pages from the old, personal, non-commercial web.', async (q, o) => {
    const { status, text } = await getText(`https://wiby.me/?q=${enc(q)}&p=${o.page}`, { trusted: true });
    if (status >= 400) throw new Error('HTTP ' + status);
    return H.findAll(H.parse(text), (n) => n.tag === 'blockquote' && !!H.find(n, (x) => x.tag === 'a' && H.hasClass(x, 'tlink'))).map((b) => {
      const a = H.find(b, (x) => x.tag === 'a' && H.hasClass(x, 'tlink'));
      const ps = H.findAll(b, (x) => x.tag === 'p' && !H.hasClass(x, 'slink'));
      return { title: H.clean(H.text(a)), url: a.attrs.href, snippet: H.clean(H.text(ps[0])), type: 'web' };
    }).filter((r) => /^https?:/.test(r.url));
  }, { per: 12, maxDepth: 60, independent: true });
  function bingUrl(href) { // Bing wraps links: /ck/a?...&u=a1<base64url of real url>
    try { const u = new URL(href); const v = u.searchParams.get('u'); if (/bing\.com$/.test(u.hostname) && v && v.startsWith('a1')) return Buffer.from(v.slice(2).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); } catch {}
    return href;
  }
  function parseBing(html) {
    return H.findAll(H.parse(html), (n) => n.tag === 'li' && H.hasClass(n, 'b_algo')).map((li) => {
      const a = H.find(H.find(li, (x) => x.tag === 'h2') || li, (x) => x.tag === 'a');
      if (!a) return null;
      const p = H.find(li, (x) => x.tag === 'p');
      return { title: H.clean(H.text(a)), url: bingUrl(a.attrs.href || ''), snippet: H.clean(H.text(p)), type: 'web' };
    }).filter((r) => r && /^https?:/.test(r.url));
  }
  def('bing', 'Bing', ['web'], 'Bing web results (scraped; ranked by Bing).', async (q, o) => {
    const { status, text } = await getText(`https://www.bing.com/search?q=${enc(q)}&count=${o.n}&first=${off(o) + 1}&setlang=en`, { trusted: true, headers: { cookie: 'SRCHHPGUSR=ADLT=OFF' } });
    if (status >= 400) throw new Error('HTTP ' + status);
    return parseBing(text);
  }, { per: 50, maxDepth: 150, parse: parseBing });

  // ======================= NEWS ============================================
  api('gdelt', 'GDELT', ['news'], 'Global news monitor: articles in 65 languages from 150+ countries.', {
    per: 250, maxDepth: 250, timeout: 12000,
    url: (q, o) => `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=artlist&maxrecords=${o.n}&format=json${{ day: '&timespan=1d', week: '&timespan=1w', month: '&timespan=1m', year: '&timespan=12m' }[o.time] || ''}`,
    list: (j) => j.articles || (j && Object.keys(j).length === 0 ? [] : undefined),
    map: (x) => ({ title: x.title, url: x.url, snippet: joinMeta(x.domain, x.sourcecountry, x.language), thumb: x.socialimage, date: x.seendate && iso(String(x.seendate).replace(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/, '$1-$2-$3T$4:$5:$6Z')) }),
  });
  function parseBingNews(xmlText) {
    return H.findAll(H.parse(xmlText, { xml: true }), (n) => n.tag === 'item').map((it) => {
      const g = (t) => H.clean(H.text(H.find(it, (x) => x.tag === t)));
      let link = g('link');
      try { const u = new URL(link); if (u.searchParams.get('url')) link = u.searchParams.get('url'); } catch {}
      return { title: g('title'), url: link, snippet: strip(g('description')), date: iso(g('pubdate')), meta: g('news:source'), type: 'news' };
    }).filter((r) => r.title && /^https?:/.test(r.url));
  }
  def('bing-news', 'Bing News', ['news'], 'News headlines from thousands of publishers (RSS).', async (q, o) => {
    const { status, text } = await getText(`https://www.bing.com/news/search?q=${enc(q)}&format=rss&count=${o.n}&first=${off(o) + 1}`, { trusted: true });
    if (status >= 400) throw new Error('HTTP ' + status);
    return parseBingNews(text);
  }, { per: 100, maxDepth: 300, parse: parseBingNews });

  // ======================= WIKIMEDIA FAMILY (MediaWiki search) =============
  function mw(id, name, host, cats, desc, extra = {}) {
    api(id, name, cats, desc, {
      per: 50, maxDepth: 500, skipAll: extra.skipAll, type: extra.type,
      url: (q, o) => `https://${host}/w/api.php?action=query&list=search&srsearch=${q}&srlimit=${o.n}&sroffset=${off(o)}&format=json&origin=*`,
      list: (j) => j.query && j.query.search,
      map: (x) => ({ title: x.title, url: `https://${host}/wiki/${enc(x.title.replace(/ /g, '_')).replace(/%2F/g, '/').replace(/%3A/g, ':')}`, snippet: strip(x.snippet), date: iso(x.timestamp), meta: name }),
    });
  }
  mw('wikinews', 'Wikinews', 'en.wikinews.org', ['news'], 'Collaboratively written news.');
  mw('wiktionary', 'Wiktionary', 'en.wiktionary.org', ['reference'], 'Free dictionary: definitions, etymology, translations.');
  mw('wikibooks', 'Wikibooks', 'en.wikibooks.org', ['books', 'reference'], 'Open textbooks and manuals.');
  mw('wikisource', 'Wikisource', 'en.wikisource.org', ['books', 'reference'], 'Library of source texts and documents.');
  mw('wikiquote', 'Wikiquote', 'en.wikiquote.org', ['reference'], 'Quotations.');
  mw('wikivoyage', 'Wikivoyage', 'en.wikivoyage.org', ['reference'], 'Travel guides.');
  mw('wikiversity', 'Wikiversity', 'en.wikiversity.org', ['reference'], 'Learning resources.');
  mw('wikispecies', 'Wikispecies', 'species.wikimedia.org', ['reference'], 'Directory of species.');
  mw('wikidata', 'Wikidata', 'www.wikidata.org', ['reference', 'data'], 'Structured knowledge base behind Wikipedia.');
  for (const [lc, nm] of [['de', 'Deutsch'], ['fr', 'Français'], ['es', 'Español'], ['ru', 'Русский'], ['ja', '日本語'], ['zh', '中文'], ['pt', 'Português'], ['it', 'Italiano'], ['ar', 'العربية'], ['nl', 'Nederlands'], ['pl', 'Polski'], ['tr', 'Türkçe'], ['ko', '한국어'], ['uk', 'Українська']]) {
    mw('wikipedia-' + lc, `Wikipedia (${nm})`, `${lc}.wikipedia.org`, ['reference'], `Wikipedia in ${nm} – other viewpoints on the same topic.`, { skipAll: true, type: 'web' });
  }

  // ======================= REFERENCE =======================================
  api('urbandictionary', 'Urban Dictionary', ['reference'], 'Slang and internet culture definitions.', {
    per: 10, maxDepth: 40,
    url: (q, o) => `https://api.urbandictionary.com/v0/define?term=${q}&page=${o.page}`, list: (j) => j.list,
    map: (x) => ({ title: x.word, url: x.permalink, snippet: cut(strip(x.definition).replace(/[\[\]]/g, '')), date: iso(x.written_on), meta: `👍 ${x.thumbs_up} 👎 ${x.thumbs_down}` }),
  });
  api('nominatim', 'OpenStreetMap places', ['reference'], 'Places, addresses and landmarks worldwide.', {
    per: 40, maxDepth: 40, headers: UA,
    url: (q, o) => `https://nominatim.openstreetmap.org/search?q=${q}&format=jsonv2&limit=${o.n}`, list: (j) => j,
    map: (x) => ({ title: x.display_name.split(',')[0] + ' – ' + x.display_name.split(',').slice(1, 4).join(',').trim(), url: `https://www.openstreetmap.org/${x.osm_type}/${x.osm_id}`, snippet: joinMeta(x.category, x.type, `${(+x.lat).toFixed(4)}, ${(+x.lon).toFixed(4)}`) }),
  });
  api('gbif', 'GBIF species', ['reference'], 'Biodiversity: scientific names of every known organism.', {
    per: 100, maxDepth: 300,
    url: (q, o) => `https://api.gbif.org/v1/species/search?q=${q}&limit=${o.n}&offset=${off(o)}`, list: (j) => j.results,
    map: (x) => ({ title: x.scientificName, url: `https://www.gbif.org/species/${x.key}`, snippet: joinMeta(x.rank, x.kingdom, x.phylum, x.family), meta: x.canonicalName }),
  });
  api('inaturalist', 'iNaturalist', ['reference', 'images'], 'Observed plants, animals and fungi with community photos.', {
    per: 30, maxDepth: 150, type: 'image',
    url: (q, o) => `https://api.inaturalist.org/v1/taxa?q=${q}&per_page=${o.n}&page=${o.page}`, list: (j) => j.results,
    map: (x) => ({ title: x.preferred_common_name ? `${x.preferred_common_name} (${x.name})` : x.name, url: `https://www.inaturalist.org/taxa/${x.id}`, snippet: joinMeta(x.rank, x.iconic_taxon_name), thumb: x.default_photo && (x.default_photo.medium_url || x.default_photo.square_url), full: x.default_photo && (x.default_photo.large_url || x.default_photo.medium_url) }),
  });

  // ======================= IMAGES ==========================================
  const nasa = (id, name, media, cats, desc) => api(id, name, cats, desc, {
    per: 100, maxDepth: 1000,
    url: (q, o) => `https://images-api.nasa.gov/search?q=${q}&media_type=${media}&page=${o.page}&page_size=${o.n}`, list: (j) => j.collection && j.collection.items,
    map: (x) => {
      const d = x.data[0], th = x.links && x.links[0] && x.links[0].href;
      return { title: d.title, url: `https://images.nasa.gov/details/${enc(d.nasa_id)}`, snippet: cut(strip(d.description)), date: iso(d.date_created), thumb: th, full: th && th.replace(/~thumb\./, '~orig.'), meta: joinMeta('NASA', d.center) };
    },
  });
  nasa('nasa-images', 'NASA Image Library', 'image', ['images'], 'Public-domain NASA photographs and art.');
  nasa('nasa-video', 'NASA Video', 'video', ['video'], 'NASA launches, missions and documentaries.');
  api('artic', 'Art Institute of Chicago', ['images'], 'Open-access artworks with high-resolution images.', {
    per: 100, maxDepth: 1000,
    url: (q, o) => `https://api.artic.edu/api/v1/artworks/search?q=${q}&limit=${o.n}&page=${o.page}&fields=id,title,artist_display,date_display,image_id,medium_display`, list: (j) => j.data,
    map: (x) => x.image_id && { title: x.title, url: `https://www.artic.edu/artworks/${x.id}`, thumb: `https://www.artic.edu/iiif/2/${x.image_id}/full/400,/0/default.jpg`, full: `https://www.artic.edu/iiif/2/${x.image_id}/full/843,/0/default.jpg`, snippet: x.artist_display, meta: joinMeta(x.date_display, x.medium_display) },
  });
  api('cleveland', 'Cleveland Museum of Art', ['images'], 'Open-access collection, CC0 images.', {
    per: 100, maxDepth: 1000,
    url: (q, o) => `https://openaccess-api.clevelandart.org/api/artworks/?q=${q}&limit=${o.n}&skip=${off(o)}&has_image=1`, list: (j) => j.data,
    map: (x) => ({ title: x.title, url: x.url, thumb: x.images && x.images.web && x.images.web.url, full: x.images && ((x.images.print && x.images.print.url) || (x.images.web && x.images.web.url)), snippet: authors(x.creators, 'description').join(', '), meta: joinMeta(x.creation_date, x.technique) }),
  });

  // ======================= VIDEO ===========================================
  api('sepiasearch', 'SepiaSearch (PeerTube)', ['video'], 'Federated, ad-free PeerTube videos from hundreds of servers.', {
    per: 50, maxDepth: 500,
    url: (q, o) => `https://sepiasearch.org/api/v1/search/videos?search=${q}&start=${off(o)}&count=${o.n}`, list: (j) => j.data,
    map: (x) => ({ title: x.name, url: x.url, snippet: cut(x.description || ''), date: iso(x.publishedAt), thumb: x.thumbnailUrl || (x.channel && x.channel.host && x.thumbnailPath ? `https://${x.channel.host}${x.thumbnailPath}` : undefined), meta: joinMeta(x.channel && x.channel.displayName, x.views != null && `${x.views} views`) }),
  });
  api('dailymotion', 'Dailymotion', ['video'], 'Videos from Dailymotion.', {
    per: 100, maxDepth: 1000,
    url: (q, o) => `https://api.dailymotion.com/videos?search=${q}&fields=id,title,description,thumbnail_360_url,created_time,url,owner.screenname,views_total&limit=${o.n}&page=${o.page}`, list: (j) => j.list,
    map: (x) => ({ title: x.title, url: x.url, snippet: cut(strip(x.description)), date: x.created_time && iso(x.created_time * 1000), thumb: x.thumbnail_360_url, meta: joinMeta(x['owner.screenname'], x.views_total != null && `${x.views_total} views`) }),
  });

  // ======================= AUDIO ===========================================
  api('openverse-audio', 'Openverse (audio)', ['audio'], 'CC-licensed music and sound effects.', {
    per: 20, maxDepth: 240,
    url: (q, o) => `https://api.openverse.org/v1/audio/?q=${q}&page_size=${o.n}&page=${o.page}`, list: (j) => j.results,
    map: (x) => ({ title: x.title || 'Untitled', url: x.foreign_landing_url || x.url, thumb: x.thumbnail, snippet: x.creator, meta: joinMeta(x.source, x.license && 'CC ' + x.license.toUpperCase()) }),
  });
  api('itunes-podcasts', 'Podcasts (Apple directory)', ['audio'], 'Public podcast directory.', {
    per: 200, maxDepth: 200,
    url: (q, o) => `https://itunes.apple.com/search?term=${q}&media=podcast&limit=${o.n}`, list: (j) => j.results,
    map: (x) => ({ title: x.collectionName || x.trackName, url: x.collectionViewUrl || x.trackViewUrl, thumb: x.artworkUrl100, snippet: x.artistName, date: iso(x.releaseDate), meta: joinMeta(x.primaryGenreName, x.trackCount && `${x.trackCount} episodes`, x.feedUrl && 'RSS: ' + x.feedUrl) }),
  });
  api('itunes-music', 'Music (Apple directory)', ['audio'], 'Songs and artists with 30-second previews.', {
    per: 200, maxDepth: 200,
    url: (q, o) => `https://itunes.apple.com/search?term=${q}&media=music&entity=song&limit=${o.n}`, list: (j) => j.results,
    map: (x) => ({ title: `${x.trackName} – ${x.artistName}`, url: x.trackViewUrl, thumb: x.artworkUrl100, snippet: x.collectionName, date: iso(x.releaseDate), meta: joinMeta(x.primaryGenreName, x.previewUrl && 'preview: ' + x.previewUrl) }),
  });
  api('musicbrainz', 'MusicBrainz', ['audio', 'reference'], 'Open music encyclopedia: recordings, artists, releases.', {
    per: 100, maxDepth: 500, headers: UA, type: 'audio',
    url: (q, o) => `https://musicbrainz.org/ws/2/recording?query=${q}&fmt=json&limit=${o.n}&offset=${off(o)}`, list: (j) => j.recordings,
    map: (x) => ({ title: `${x.title} – ${authors(x['artist-credit'], 'name').join(', ')}`, url: `https://musicbrainz.org/recording/${x.id}`, snippet: joinMeta(arr(x.releases).slice(0, 2).map((r) => r.title)), date: iso(x['first-release-date']) }),
  });

  // ======================= DISCUSSION ======================================
  api('lemmy', 'Lemmy', ['discuss'], 'Federated link-aggregator communities (lemmy.world). Newest first – no popularity sort.', {
    per: 50, maxDepth: 200,
    url: (q, o) => `https://lemmy.world/api/v3/search?q=${q}&type_=Posts&sort=New&limit=${o.n}&page=${o.page}`, list: (j) => j.posts,
    map: (x) => ({ title: x.post.name, url: x.post.url || x.post.ap_id, snippet: cut(strip(x.post.body)), date: iso(x.post.published), thumb: x.post.thumbnail_url, discussion: x.post.ap_id, meta: joinMeta(x.community && x.community.name, x.counts && `${x.counts.score} pts · ${x.counts.comments} comments`) }),
  });
  api('pullpush', 'Reddit archive (PullPush)', ['discuss'], 'Archived Reddit posts, including ones Reddit itself hides from search.', {
    per: 100, maxDepth: 100,
    url: (q, o) => `https://api.pullpush.io/reddit/search/submission/?q=${q}&size=${o.n}`, list: (j) => j.data,
    map: (x) => ({ title: x.title, url: 'https://old.reddit.com' + x.permalink, snippet: cut(strip(x.selftext)), date: x.created_utc && iso(x.created_utc * 1000), meta: `r/${x.subreddit} · ${x.score} pts · ${x.num_comments} comments` }),
  });
  for (const [site, nm] of [['superuser', 'Super User'], ['serverfault', 'Server Fault'], ['askubuntu', 'Ask Ubuntu'], ['math', 'Mathematics'], ['unix', 'Unix & Linux'], ['tex', 'TeX / LaTeX'], ['physics', 'Physics'], ['security', 'Information Security'], ['softwareengineering', 'Software Engineering'], ['electronics', 'Electronics'], ['apple', 'Ask Different (Apple)'], ['diy', 'Home Improvement'], ['cooking', 'Cooking'], ['english', 'English Language']]) {
    api('se-' + site, 'Stack Exchange: ' + nm, ['discuss'], `${nm} Q&A (counts against the shared Stack Exchange quota; set STACKEXCHANGE_KEY to raise it).`, {
      per: 100, maxDepth: 100, skipAll: true,
      url: (q, o) => `https://api.stackexchange.com/2.3/search/advanced?q=${q}&site=${site}&pagesize=${o.n}&page=${o.page}&order=desc&sort=${o.sort === 'date' ? 'creation' : 'relevance'}${process.env.STACKEXCHANGE_KEY ? '&key=' + process.env.STACKEXCHANGE_KEY : ''}`, list: (j) => j.items,
      map: (i) => ({ title: strip(i.title), url: i.link, snippet: (i.tags || []).join(', '), date: iso(i.creation_date * 1000), meta: `${i.score} votes · ${i.answer_count} answers${i.is_answered ? ' · answered' : ''}` }),
    });
  }

  // ======================= CODE & PACKAGES =================================
  api('gitlab', 'GitLab', ['code'], 'Public GitLab projects.', {
    per: 100, maxDepth: 300,
    url: (q, o) => `https://gitlab.com/api/v4/projects?search=${q}&per_page=${o.n}&page=${o.page}&order_by=last_activity_at`, list: (j) => j,
    map: (x) => ({ title: x.path_with_namespace, url: x.web_url, snippet: x.description, date: iso(x.last_activity_at), meta: `★ ${x.star_count}` }),
  });
  api('codeberg', 'Codeberg', ['code'], 'Community-run Git hosting (non-profit).', {
    per: 50, maxDepth: 500,
    url: (q, o) => `https://codeberg.org/api/v1/repos/search?q=${q}&limit=${o.n}&page=${o.page}`, list: (j) => j.data,
    map: (x) => ({ title: x.full_name, url: x.html_url, snippet: x.description, date: iso(x.updated_at), meta: joinMeta(`★ ${x.stars_count}`, x.language) }),
  });
  api('npm', 'npm', ['code'], 'JavaScript packages.', {
    per: 250, maxDepth: 1000,
    url: (q, o) => `https://registry.npmjs.org/-/v1/search?text=${q}&size=${o.n}&from=${off(o)}`, list: (j) => j.objects,
    map: (x) => ({ title: `${x.package.name}@${x.package.version}`, url: (x.package.links && x.package.links.npm) || `https://www.npmjs.com/package/${x.package.name}`, snippet: x.package.description, date: iso(x.package.date), meta: (x.package.keywords || []).slice(0, 6).join(', ') }),
  });
  api('crates', 'crates.io', ['code'], 'Rust packages.', {
    per: 100, maxDepth: 500, headers: UA,
    url: (q, o) => `https://crates.io/api/v1/crates?q=${q}&per_page=${o.n}&page=${o.page}`, list: (j) => j.crates,
    map: (x) => ({ title: `${x.name} ${x.max_version}`, url: `https://crates.io/crates/${x.name}`, snippet: x.description, date: iso(x.updated_at), meta: `${x.downloads} downloads` }),
  });
  api('dockerhub', 'Docker Hub', ['code'], 'Container images.', {
    per: 100, maxDepth: 500,
    url: (q, o) => `https://hub.docker.com/v2/search/repositories/?query=${q}&page_size=${o.n}&page=${o.page}`, list: (j) => j.results,
    map: (x) => ({ title: x.repo_name, url: x.repo_name.includes('/') ? `https://hub.docker.com/r/${x.repo_name}` : `https://hub.docker.com/_/${x.repo_name}`, snippet: x.short_description, meta: joinMeta(`★ ${x.star_count}`, x.pull_count != null && `${x.pull_count} pulls`) }),
  });
  api('maven', 'Maven Central', ['code'], 'Java/JVM libraries.', {
    per: 100, maxDepth: 500,
    url: (q, o) => `https://search.maven.org/solrsearch/select?q=${q}&rows=${o.n}&start=${off(o)}&wt=json`, list: (j) => j.response && j.response.docs,
    map: (x) => ({ title: `${x.g}:${x.a}`, url: `https://search.maven.org/artifact/${x.g}/${x.a}`, snippet: `latest ${x.latestVersion || x.v}`, date: x.timestamp && iso(x.timestamp) }),
  });
  api('rubygems', 'RubyGems', ['code'], 'Ruby libraries.', {
    per: 30, maxDepth: 300,
    url: (q, o) => `https://rubygems.org/api/v1/search.json?query=${q}&page=${o.page}`, list: (j) => j,
    map: (x) => ({ title: `${x.name} ${x.version}`, url: x.project_uri, snippet: x.info, meta: `${x.downloads} downloads` }),
  });
  api('packagist', 'Packagist', ['code'], 'PHP packages.', {
    per: 100, maxDepth: 300,
    url: (q, o) => `https://packagist.org/search.json?q=${q}&per_page=${o.n}&page=${o.page}`, list: (j) => j.results,
    map: (x) => ({ title: x.name, url: x.url, snippet: x.description, meta: joinMeta(`${x.downloads} downloads`, `★ ${x.favers}`) }),
  });
  api('nuget', 'NuGet', ['code'], '.NET packages.', {
    per: 100, maxDepth: 500,
    url: (q, o) => `https://azuresearch-usnc.nuget.org/query?q=${q}&take=${o.n}&skip=${off(o)}`, list: (j) => j.data,
    map: (x) => ({ title: `${x.id} ${x.version}`, url: `https://www.nuget.org/packages/${x.id}`, snippet: x.description, meta: `${x.totalDownloads} downloads` }),
  });
  api('hex', 'Hex.pm', ['code'], 'Elixir/Erlang packages.', {
    per: 100, maxDepth: 300,
    url: (q, o) => `https://hex.pm/api/packages?search=${q}&page=${o.page}`, list: (j) => j,
    map: (x) => ({ title: x.name, url: x.html_url, snippet: x.meta && x.meta.description, date: iso(x.updated_at), meta: x.downloads && `${x.downloads.all} downloads` }),
  });
  api('pubdev', 'pub.dev', ['code'], 'Dart & Flutter packages.', {
    per: 10, maxDepth: 100,
    url: (q, o) => `https://pub.dev/api/search?q=${q}&page=${o.page}`, list: (j) => j.packages,
    map: (x) => ({ title: x.package, url: `https://pub.dev/packages/${x.package}` }),
  });
  api('hf-models', 'Hugging Face models', ['code'], 'Machine-learning models.', {
    per: 100, maxDepth: 100, type: 'code',
    url: (q, o) => `https://huggingface.co/api/models?search=${q}&limit=${o.n}`, list: (j) => j,
    map: (x) => ({ title: x.id || x.modelId, url: `https://huggingface.co/${x.id || x.modelId}`, snippet: joinMeta(x.pipeline_tag, (x.tags || []).slice(0, 5).join(', ')), date: iso(x.lastModified), meta: joinMeta(`${x.downloads || 0} downloads`, `♥ ${x.likes || 0}`) }),
  });
  api('mdn', 'MDN Web Docs', ['code', 'reference'], 'Documentation for HTML, CSS, JavaScript and Web APIs.', {
    per: 20, maxDepth: 200, type: 'code',
    url: (q, o) => `https://developer.mozilla.org/api/v1/search?q=${q}&page=${o.page}&size=${o.n}&locale=en-US`, list: (j) => j.documents,
    map: (x) => ({ title: x.title, url: 'https://developer.mozilla.org' + x.mdn_url, snippet: x.summary }),
  });

  // ======================= PAPERS ==========================================
  const abstractFrom = (inv) => { if (!inv) return ''; const w = []; for (const [k, ps] of Object.entries(inv)) for (const p of ps) w[p] = k; return cut(w.filter(Boolean).join(' ')); };
  api('openalex', 'OpenAlex', ['papers'], '250M+ scholarly works across every field.', {
    per: 200, maxDepth: 1000,
    url: (q, o) => `https://api.openalex.org/works?search=${q}&per-page=${o.n}&page=${o.page}`, list: (j) => j.results,
    map: (x) => ({ title: x.display_name || x.title, url: x.doi || (x.primary_location && x.primary_location.landing_page_url) || x.id, snippet: abstractFrom(x.abstract_inverted_index), date: iso(x.publication_date), meta: joinMeta(authors(arr(x.authorships).slice(0, 3).map((a) => a.author), 'display_name').join(', '), x.primary_location && x.primary_location.source && x.primary_location.source.display_name, x.cited_by_count != null && `${x.cited_by_count} citations`) }),
  });
  api('semanticscholar', 'Semantic Scholar', ['papers'], 'Papers with abstracts and citation counts.', {
    per: 100, maxDepth: 1000,
    url: (q, o) => `https://api.semanticscholar.org/graph/v1/paper/search?query=${q}&limit=${o.n}&offset=${off(o)}&fields=title,abstract,year,authors,venue,url,publicationDate,citationCount`, list: (j) => j.data || (j.total === 0 ? [] : undefined),
    map: (x) => ({ title: x.title, url: x.url, snippet: cut(x.abstract || ''), date: iso(x.publicationDate || (x.year && `${x.year}-01-01`)), meta: joinMeta(authors(arr(x.authors).slice(0, 3), 'name').join(', '), x.venue, x.citationCount != null && `${x.citationCount} citations`) }),
  });
  api('europepmc', 'Europe PMC', ['papers'], 'Life-science literature: PubMed, preprints, patents.', {
    per: 100, maxDepth: 1000,
    url: (q, o) => `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${q}&format=json&pageSize=${o.n}&page=${o.page}&resultType=lite`, list: (j) => j.resultList && j.resultList.result,
    map: (x) => ({ title: strip(x.title), url: `https://europepmc.org/article/${x.source}/${x.id}`, snippet: x.authorString, date: iso(x.firstPublicationDate), meta: joinMeta(x.journalTitle, x.pubYear) }),
  });
  api('doaj', 'DOAJ', ['papers'], 'Open-access journal articles.', {
    per: 100, maxDepth: 500,
    url: (q, o) => `https://doaj.org/api/search/articles/${q}?pageSize=${o.n}&page=${o.page}`, list: (j) => j.results,
    map: (x) => { const b = x.bibjson || {}; return { title: strip(b.title), url: (arr(b.link)[0] && arr(b.link)[0].url) || `https://doaj.org/article/${x.id}`, snippet: cut(strip(b.abstract)), date: iso(x.created_date), meta: joinMeta(authors(arr(b.author).slice(0, 3), 'name').join(', '), b.journal && b.journal.title) }; },
  });
  api('dblp', 'DBLP', ['papers'], 'Computer-science bibliography.', {
    per: 100, maxDepth: 1000,
    url: (q, o) => `https://dblp.org/search/publ/api?q=${q}&format=json&h=${o.n}&f=${off(o)}`, list: (j) => j.result && j.result.hits && (j.result.hits.hit || []),
    map: (x) => { const i = x.info; return { title: strip(i.title), url: i.ee || i.url, snippet: authors(arr(i.authors && i.authors.author), 'text').slice(0, 5).join(', '), date: i.year && iso(`${i.year}-01-01`), meta: joinMeta(i.venue, i.year) }; },
  });
  api('inspire', 'INSPIRE HEP', ['papers'], 'High-energy physics literature.', {
    per: 100, maxDepth: 1000,
    url: (q, o) => `https://inspirehep.net/api/literature?q=${q}&size=${o.n}&page=${o.page}&fields=titles,authors.full_name,abstracts,earliest_date,control_number`, list: (j) => j.hits && j.hits.hits,
    map: (x) => { const m = x.metadata; return { title: m.titles[0].title, url: `https://inspirehep.net/literature/${x.id}`, snippet: cut(strip(arr(m.abstracts)[0] && arr(m.abstracts)[0].value)), date: iso(m.earliest_date), meta: authors(arr(m.authors).slice(0, 3), 'full_name').join(', ') }; },
  });
  api('zenodo', 'Zenodo', ['papers', 'data'], 'Research outputs: papers, datasets, software (CERN).', {
    per: 25, maxDepth: 500, type: 'papers',
    url: (q, o) => `https://zenodo.org/api/records?q=${q}&size=${o.n}&page=${o.page}`, list: (j) => j.hits && j.hits.hits,
    map: (x) => ({ title: x.metadata.title, url: (x.links && x.links.self_html) || `https://zenodo.org/records/${x.id}`, snippet: cut(strip(x.metadata.description)), date: iso(x.metadata.publication_date), meta: authors(arr(x.metadata.creators).slice(0, 3), 'name').join(', ') }),
  });
  api('hal', 'HAL', ['papers'], 'French national open archive of research.', {
    per: 100, maxDepth: 1000,
    url: (q, o) => `https://api.archives-ouvertes.fr/search/?q=${q}&wt=json&rows=${o.n}&start=${off(o)}&fl=title_s,abstract_s,uri_s,producedDate_s,authFullName_s`, list: (j) => j.response && j.response.docs,
    map: (x) => ({ title: first(x.title_s), url: x.uri_s, snippet: cut(first(x.abstract_s) || ''), date: iso(x.producedDate_s), meta: arr(x.authFullName_s).slice(0, 3).join(', ') }),
  });

  // ======================= BOOKS ===========================================
  api('googlebooks', 'Google Books', ['books'], 'Book metadata and previews (public API, no personalisation).', {
    per: 40, maxDepth: 400,
    url: (q, o) => `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=${o.n}&startIndex=${off(o)}&printType=books`, list: (j) => j.items || (j.totalItems === 0 ? [] : undefined),
    map: (x) => { const v = x.volumeInfo; return { title: v.title + (v.subtitle ? ': ' + v.subtitle : ''), url: v.canonicalVolumeLink || v.infoLink, snippet: cut(strip(v.description)), thumb: v.imageLinks && v.imageLinks.thumbnail && v.imageLinks.thumbnail.replace('http://', 'https://'), date: iso(v.publishedDate && (v.publishedDate.length === 4 ? v.publishedDate + '-01-01' : v.publishedDate)), meta: arr(v.authors).join(', ') }; },
  });
  api('itunes-ebooks', 'Apple Books', ['books'], 'E-book catalogue.', {
    per: 200, maxDepth: 200,
    url: (q, o) => `https://itunes.apple.com/search?term=${q}&media=ebook&limit=${o.n}`, list: (j) => j.results,
    map: (x) => ({ title: x.trackName, url: x.trackViewUrl, thumb: x.artworkUrl100, snippet: cut(strip(x.description)), date: iso(x.releaseDate), meta: x.artistName }),
  });

  // ======================= DATA, GOVERNMENT, ARCHIVES ======================
  api('datagov', 'Data.gov', ['data'], 'US government open datasets.', {
    per: 100, maxDepth: 1000,
    url: (q, o) => `https://catalog.data.gov/api/3/action/package_search?q=${q}&rows=${o.n}&start=${off(o)}`, list: (j) => j.result && j.result.results,
    map: (x) => ({ title: x.title, url: `https://catalog.data.gov/dataset/${x.name}`, snippet: cut(strip(x.notes)), date: iso(x.metadata_modified), meta: x.organization && x.organization.title }),
  });
  api('federalregister', 'Federal Register', ['data'], 'US rules, notices and presidential documents.', {
    per: 100, maxDepth: 1000,
    url: (q, o) => `https://www.federalregister.gov/api/v1/documents.json?conditions[term]=${q}&per_page=${o.n}&page=${o.page}`, list: (j) => j.results || (j.count === 0 ? [] : undefined),
    map: (x) => ({ title: x.title, url: x.html_url, snippet: cut(strip(x.abstract)), date: iso(x.publication_date), meta: joinMeta(x.type, arr(x.agencies).map((a) => a.name).slice(0, 2)) }),
  });
  api('sec-edgar', 'SEC EDGAR full-text', ['data'], 'Full text of US company filings since 2001.', {
    per: 100, maxDepth: 1000, headers: UA,
    url: (q, o) => `https://efts.sec.gov/LATEST/search-index?q=${q}&from=${off(o)}`, list: (j) => j.hits && j.hits.hits,
    map: (x) => { const s = x._source, [adsh, file] = x._id.split(':'); return { title: `${arr(s.display_names)[0] || 'Filing'} – ${s.form || s.file_type}`, url: `https://www.sec.gov/Archives/edgar/data/${parseInt(arr(s.ciks)[0], 10)}/${adsh.replace(/-/g, '')}/${file}`, snippet: s.file_description, date: iso(s.file_date) }; },
  });
  api('hf-datasets', 'Hugging Face datasets', ['data'], 'Machine-learning datasets.', {
    per: 100, maxDepth: 100, type: 'data',
    url: (q, o) => `https://huggingface.co/api/datasets?search=${q}&limit=${o.n}`, list: (j) => j,
    map: (x) => ({ title: x.id, url: `https://huggingface.co/datasets/${x.id}`, snippet: (x.tags || []).slice(0, 6).join(', '), date: iso(x.lastModified), meta: joinMeta(`${x.downloads || 0} downloads`, `♥ ${x.likes || 0}`) }),
  });
  api('loc', 'Library of Congress', ['archive'], 'Digitised books, maps, photos, manuscripts and newspapers.', {
    per: 100, maxDepth: 1000,
    url: (q, o) => `https://www.loc.gov/search/?q=${q}&fo=json&c=${o.n}&sp=${o.page}`, list: (j) => j.results,
    map: (x) => ({ title: strip(x.title), url: String(x.id || x.url).replace(/^http:/, 'https:'), snippet: cut(strip(arr(x.description)[0])), date: iso(x.date), thumb: arr(x.image_url)[0] && String(arr(x.image_url)[0]).replace(/^\/\//, 'https://'), meta: arr(x.original_format).slice(0, 2).join(', ') }),
  });
};
