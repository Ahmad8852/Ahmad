'use strict';
process.env.PLAINSEARCH_DEMO = '1';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { execFile } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const R = require('../lib/providers');
const H = require('../lib/html');

const P = R.providers;
const first = (id, json, o = { page: 1, n: 10, sort: 'interleave', time: '' }) => P[id].parse(json, o);

test('registry: every source is well-formed', () => {
  const all = R.list();
  assert.ok(all.length >= 100, 'expected 100+ sources, got ' + all.length);
  const cats = new Set(R.CATEGORIES.map(([c]) => c));
  const ids = new Set();
  for (const s of all) {
    assert.ok(!ids.has(s.id), 'duplicate id ' + s.id); ids.add(s.id);
    assert.ok(s.name && s.desc && typeof s.run === 'function', s.id + ' needs name/desc/run');
    assert.ok(s.cats.length && s.cats.every((c) => cats.has(c) && c !== 'all'), s.id + ' bad categories');
    assert.ok(s.per >= 1 && s.maxDepth >= s.per, s.id + ' bad per/maxDepth');
  }
  for (const [c] of R.CATEGORIES) assert.ok(R.forCategory(c).length > 0, 'empty category ' + c);
  assert.ok(!R.forCategory('all').some((s) => s.id.startsWith('se-') || s.id.startsWith('wikipedia-')), 'noisy/quota sources stay out of Everything');
});

test('parsers map recorded response shapes', () => {
  let r;
  r = first('mwmbl', [{ title: [{ value: 'Hello ', is_bold: true }, { value: 'World' }], url: 'https://a.example/', extract: [{ value: 'text' }], source: 'x' }]);
  assert.deepEqual([r[0].title, r[0].url, r[0].snippet], ['Hello World', 'https://a.example/', 'text']);
  r = first('yacy', { channels: [{ items: [{ title: 'Y', link: 'https://y.example/', description: 'd', pubDate: 'Mon, 03 Nov 2025 10:00:00 GMT' }] }] });
  assert.equal(r[0].url, 'https://y.example/');
  r = first('gdelt', { articles: [{ url: 'https://n.example/a', title: 'Headline', seendate: '20251103T120000Z', domain: 'n.example', sourcecountry: 'France', language: 'French' }] });
  assert.equal(r[0].date, '2025-11-03T12:00:00.000Z'); assert.equal(r[0].type, 'news');
  r = first('wiktionary', { query: { search: [{ title: 'dog house', snippet: 'a <span class="searchmatch">dog</span>', timestamp: '2025-01-01T00:00:00Z' }] } });
  assert.equal(r[0].url, 'https://en.wiktionary.org/wiki/dog_house'); assert.equal(r[0].snippet, 'a dog');
  r = first('wikipedia-de', { query: { search: [{ title: 'Hund', snippet: 'x', timestamp: '2025-01-01T00:00:00Z' }] } });
  assert.equal(r[0].url, 'https://de.wikipedia.org/wiki/Hund');
  r = first('urbandictionary', { list: [{ word: 'rizz', definition: 'charm [obviously]', permalink: 'https://u.example/rizz', thumbs_up: 5, thumbs_down: 1, written_on: '2023-01-01T00:00:00Z' }] });
  assert.equal(r[0].snippet, 'charm obviously');
  r = first('nominatim', [{ display_name: 'Paris, Île-de-France, France', osm_type: 'relation', osm_id: 7444, lat: '48.85', lon: '2.35', category: 'boundary', type: 'administrative' }]);
  assert.equal(r[0].url, 'https://www.openstreetmap.org/relation/7444');
  r = first('nasa-images', { collection: { items: [{ data: [{ title: 'Apollo 11', nasa_id: 'as11-40-5903', description: 'Buzz', date_created: '1969-07-20T00:00:00Z', center: 'JSC' }], links: [{ href: 'https://images-assets.nasa.gov/image/as11/as11~thumb.jpg' }] }] } });
  assert.equal(r[0].full, 'https://images-assets.nasa.gov/image/as11/as11~orig.jpg'); assert.equal(r[0].type, 'image');
  r = first('artic', { data: [{ id: 1, title: 'Nighthawks', image_id: 'abc', artist_display: 'Hopper' }, { id: 2, title: 'No image', image_id: null }] });
  assert.equal(r.length, 1); assert.match(r[0].thumb, /iiif\/2\/abc\/full\/400,/);
  r = first('sepiasearch', { data: [{ name: 'Vid', url: 'https://tube.example/w/1', description: 'd', publishedAt: '2025-01-01T00:00:00Z', thumbnailPath: '/lazy-static/t.jpg', channel: { host: 'tube.example', displayName: 'Chan' }, views: 3 }] });
  assert.equal(r[0].thumb, 'https://tube.example/lazy-static/t.jpg');
  r = first('dailymotion', { list: [{ id: 'x1', title: 'DM', url: 'https://dm.example/x1', created_time: 1700000000, 'owner.screenname': 'o', views_total: 9 }] });
  assert.match(r[0].date, /^2023-11-14/);
  r = first('itunes-podcasts', { results: [{ collectionName: 'Pod', collectionViewUrl: 'https://p.example/1', artistName: 'A', releaseDate: '2025-01-01T00:00:00Z', trackCount: 10 }] });
  assert.equal(r[0].title, 'Pod');
  r = first('musicbrainz', { recordings: [{ id: 'mbid', title: 'Song', 'artist-credit': [{ name: 'Band' }], releases: [{ title: 'Album' }], 'first-release-date': '1999-05-01' }] });
  assert.equal(r[0].title, 'Song – Band');
  r = first('lemmy', { posts: [{ post: { name: 'Post', ap_id: 'https://l.example/post/1', url: 'https://ext.example/x', body: 'b', published: '2025-01-01T00:00:00Z' }, community: { name: 'tech' }, counts: { score: 3, comments: 2 } }] });
  assert.equal(r[0].url, 'https://ext.example/x'); assert.equal(r[0].discussion, 'https://l.example/post/1');
  r = first('pullpush', { data: [{ title: 'T', permalink: '/r/x/comments/1/t/', selftext: 'body', subreddit: 'x', score: 1, num_comments: 2, created_utc: 1700000000 }] });
  assert.equal(r[0].url, 'https://old.reddit.com/r/x/comments/1/t/');
  r = first('se-math', { items: [{ title: 'What is &amp; why', link: 'https://math.stackexchange.com/q/1', tags: ['a'], creation_date: 1700000000, score: 1, answer_count: 2, is_answered: true }] });
  assert.equal(r[0].title, 'What is & why');
  r = first('npm', { objects: [{ package: { name: 'left-pad', version: '1.3.0', description: 'pad', date: '2020-01-01T00:00:00Z', links: { npm: 'https://www.npmjs.com/package/left-pad' }, keywords: ['pad'] } }] });
  assert.equal(r[0].title, 'left-pad@1.3.0');
  r = first('crates', { crates: [{ name: 'serde', max_version: '1.0.0', description: 'd', downloads: 9, updated_at: '2025-01-01T00:00:00Z' }] });
  assert.equal(r[0].url, 'https://crates.io/crates/serde');
  r = first('dockerhub', { results: [{ repo_name: 'nginx', short_description: 'web', star_count: 1, pull_count: 2 }, { repo_name: 'user/app', short_description: 'x' }] });
  assert.deepEqual(r.map((x) => x.url), ['https://hub.docker.com/_/nginx', 'https://hub.docker.com/r/user/app']);
  r = first('maven', { response: { docs: [{ g: 'org.x', a: 'lib', latestVersion: '1.0', timestamp: 1700000000000 }] } });
  assert.equal(r[0].url, 'https://search.maven.org/artifact/org.x/lib');
  r = first('rubygems', [{ name: 'rails', version: '7', info: 'web', downloads: 1, project_uri: 'https://rubygems.org/gems/rails' }]);
  assert.equal(r[0].title, 'rails 7');
  r = first('hex', [{ name: 'phoenix', html_url: 'https://hex.pm/packages/phoenix', meta: { description: 'web' }, downloads: { all: 5 }, updated_at: '2025-01-01T00:00:00Z' }]);
  assert.equal(r[0].snippet, 'web');
  r = first('hf-models', [{ id: 'bert-base', pipeline_tag: 'fill-mask', tags: ['a'], downloads: 5, likes: 1, lastModified: '2025-01-01T00:00:00Z' }]);
  assert.equal(r[0].url, 'https://huggingface.co/bert-base');
  r = first('mdn', { documents: [{ title: 'Array', mdn_url: '/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array', summary: 's' }] });
  assert.match(r[0].url, /^https:\/\/developer\.mozilla\.org\/en-US/);
  r = first('openalex', { results: [{ display_name: 'Paper', doi: 'https://doi.org/10.1/x', publication_date: '2024-02-02', authorships: [{ author: { display_name: 'A B' } }], abstract_inverted_index: { Hello: [0], world: [1] }, cited_by_count: 3 }] });
  assert.equal(r[0].snippet, 'Hello world'); assert.equal(r[0].url, 'https://doi.org/10.1/x');
  r = first('semanticscholar', { total: 1, data: [{ title: 'S2', url: 'https://s2.example/p', abstract: 'abs', year: 2020, authors: [{ name: 'Q' }], citationCount: 4 }] });
  assert.equal(r[0].title, 'S2');
  r = first('europepmc', { resultList: { result: [{ id: '123', source: 'MED', title: 'Cell <i>study</i>.', authorString: 'X Y', firstPublicationDate: '2020-01-01', journalTitle: 'J', pubYear: '2020' }] } });
  assert.equal(r[0].url, 'https://europepmc.org/article/MED/123'); assert.equal(r[0].title, 'Cell study.');
  r = first('doaj', { results: [{ id: 'abc', created_date: '2020-01-01T00:00:00Z', bibjson: { title: 'T', abstract: 'a', author: [{ name: 'N' }], link: [{ url: 'https://j.example/t' }], journal: { title: 'JJ' } } }] });
  assert.equal(r[0].url, 'https://j.example/t');
  r = first('dblp', { result: { hits: { hit: [{ info: { title: 'DB paper.', authors: { author: [{ text: 'A' }, { text: 'B' }] }, venue: 'VLDB', year: '2020', ee: 'https://doi.org/10.1/db' } }] } } });
  assert.equal(r[0].snippet, 'A, B');
  r = first('inspire', { hits: { hits: [{ id: '99', metadata: { titles: [{ title: 'Higgs' }], authors: [{ full_name: 'P' }], abstracts: [{ value: 'abs' }], earliest_date: '2012-07-01' } }] } });
  assert.equal(r[0].url, 'https://inspirehep.net/literature/99');
  r = first('hal', { response: { docs: [{ title_s: ['Titre'], uri_s: 'https://hal.science/hal-1', abstract_s: ['r'], producedDate_s: '2020-01-01', authFullName_s: ['Z'] }] } });
  assert.equal(r[0].title, 'Titre');
  r = first('googlebooks', { totalItems: 1, items: [{ volumeInfo: { title: 'Book', subtitle: 'Sub', authors: ['Au'], description: 'd', publishedDate: '2001', canonicalVolumeLink: 'https://books.example/1', imageLinks: { thumbnail: 'http://t.example/a.jpg' } } }] });
  assert.equal(r[0].title, 'Book: Sub'); assert.equal(r[0].thumb, 'https://t.example/a.jpg');
  r = first('datagov', { result: { results: [{ name: 'ds', title: 'Dataset', notes: 'n', metadata_modified: '2025-01-01T00:00:00', organization: { title: 'Org' } }] } });
  assert.equal(r[0].url, 'https://catalog.data.gov/dataset/ds');
  r = first('federalregister', { count: 1, results: [{ title: 'Rule', html_url: 'https://fr.example/r', abstract: 'a', publication_date: '2025-01-01', type: 'Rule', agencies: [{ name: 'EPA' }] }] });
  assert.equal(r[0].meta, 'Rule · EPA');
  r = first('sec-edgar', { hits: { hits: [{ _id: '0001234567-24-000001:form10k.htm', _source: { display_names: ['ACME Corp'], form: '10-K', ciks: ['0000320193'], file_date: '2024-11-01', file_description: 'Annual report' } }] } });
  assert.equal(r[0].url, 'https://www.sec.gov/Archives/edgar/data/320193/000123456724000001/form10k.htm');
  r = first('loc', { results: [{ id: 'http://www.loc.gov/item/123/', title: 'Map', description: ['old map'], date: '1850', image_url: ['//tile.loc.gov/x.jpg'], original_format: ['map'] }] });
  assert.equal(r[0].url, 'https://www.loc.gov/item/123/'); assert.equal(r[0].thumb, 'https://tile.loc.gov/x.jpg');
});

test('wrong response shape is reported, not hidden', () => {
  assert.throws(() => first('npm', { error: 'rate limited' }), /unexpected response format/);
  assert.throws(() => first('openalex', 'oops'), /unexpected response format/);
  assert.deepEqual(first('semanticscholar', { total: 0 }), []); // genuine "no results"
});

test('bing + bing-news + wiby HTML/RSS parsers', () => {
  const real = 'https://example.com/page?a=1';
  const wrapped = 'https://www.bing.com/ck/a?!&&p=abc&u=a1' + Buffer.from(real).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') + '&ntb=1';
  let r = P.bing.parse(`<ol><li class="b_algo"><h2><a href="${wrapped}">Bing <strong>hit</strong></a></h2><div class="b_caption"><p>snippet here</p></div></li></ol>`);
  assert.deepEqual([r[0].title, r[0].url, r[0].snippet], ['Bing hit', real, 'snippet here']);
  r = P['bing-news'].parse(`<rss><channel><item><title>News &amp; views</title><link>http://www.bing.com/news/apiclick.aspx?ref=x&amp;url=https%3a%2f%2fnews.example%2fa&amp;c=1</link><description>desc</description><pubDate>Mon, 03 Nov 2025 10:00:00 GMT</pubDate><News:Source>The Example</News:Source></item></channel></rss>`);
  assert.deepEqual([r[0].title, r[0].url, r[0].meta], ['News & views', 'https://news.example/a', 'The Example']);
});

test('custom sources.json: JSON API and RSS with no code', async () => {
  const srv = http.createServer((req, res) => {
    if (req.url.startsWith('/api')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ data: { hits: [{ t: 'Alpha ' + req.url, link: 'https://a.example/1', desc: 'first', ts: 1700000000, img: 'https://a.example/i.png' }, { t: 'Beta', link: 'https://a.example/2' }, { t: 'no url' }] } })); }
    res.writeHead(200, { 'content-type': 'application/rss+xml' });
    res.end('<rss><channel><item><title>Feed one</title><link>https://f.example/1</link><description>d1</description><pubDate>Mon, 03 Nov 2025 10:00:00 GMT</pubDate></item></channel></rss>');
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-'));
  const file = path.join(dir, 'sources.json');
  fs.writeFileSync(file, JSON.stringify([
    { id: 'mine', name: 'Mine', cats: ['web', 'reference'], url: `http://127.0.0.1:${port}/api?q={q}&page={page}&n={n}&o={offset}`, list: 'data.hits', map: { title: 't', url: 'link', snippet: 'desc', date: 'ts', thumb: 'img' }, per: 5, maxDepth: 20 },
    { id: 'myfeed', name: 'My feed', cats: ['news'], url: `http://127.0.0.1:${port}/feed?q={q}`, format: 'rss' },
    { name: 'broken entry without id' },
  ]));
  const script = `const R=require('./lib/providers');(async()=>{const a=await R.providers.mine.run('cat dog',{page:2,n:5});const b=await R.providers.myfeed.run('x',{page:1,n:5});console.log(JSON.stringify({a,b,cats:R.providers.mine.cats,per:R.providers.mine.per,inWeb:R.forCategory('web').some(s=>s.id==='mine'),inNews:R.forCategory('news').some(s=>s.id==='myfeed')}))})()`;
  const out = await new Promise((resolve, reject) => execFile(process.execPath, ['-e', script], { cwd: path.join(__dirname, '..'), env: { ...process.env, PLAINSEARCH_SOURCES: file, PLAINSEARCH_DEMO: '' } }, (e, so, se) => (e ? reject(new Error(se || e.message)) : resolve(so))));
  srv.close();
  const j = JSON.parse(out.trim().split('\n').pop());
  assert.equal(j.a.length, 2);
  assert.match(j.a[0].title, /Alpha .*q=cat%20dog&page=2&n=5&o=5/);
  assert.equal(j.a[0].date, '2023-11-14T22:13:20.000Z'); assert.equal(j.a[0].thumb, 'https://a.example/i.png');
  assert.equal(j.b[0].title, 'Feed one'); assert.equal(j.b[0].url, 'https://f.example/1');
  assert.ok(j.inWeb && j.inNews && j.per === 5);
});

test('source check endpoint reports failures honestly', async () => {
  const S = require('../lib/search');
  const bad = await S.checkSource('does-not-exist');
  assert.equal(bad.ok, false);
  const demo = await S.checkSource('demo-a');
  assert.equal(demo.ok, true); assert.equal(demo.count, 10);
});
