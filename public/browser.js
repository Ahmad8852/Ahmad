(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var view = $('view'), addr = $('addr'), tabsEl = $('tabs');
  var HOME = '/?embed=1';
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var tabs = store.get('ps.tabs', null), active = store.get('ps.active', 0), bookmarks = store.get('ps.bookmarks', []);
  if (!tabs || !tabs.length) tabs = [newTabObj()];
  if (active >= tabs.length) active = 0;
  var viewmode = store.get('ps.mode', 'retro'); $('viewmode').value = viewmode;
  var skipPush = false;

  function newTabObj() { return { hist: [HOME], i: 0, title: 'New tab' }; }
  function cur() { return tabs[active]; }
  function save() { store.set('ps.tabs', tabs); store.set('ps.active', active); }

  function looksLikeUrl(s) {
    return /^[a-z][a-z0-9+.-]*:\/\/\S+$/i.test(s) || /^(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?(\/\S*)?$/i.test(s);
  }
  function hrefFor(input) {
    input = input.trim();
    if (!input) return HOME;
    if (looksLikeUrl(input)) return '/browse?url=' + encodeURIComponent(input) + '&embed=1' + (viewmode !== 'retro' ? '&mode=' + viewmode : '');
    return '/search?q=' + encodeURIComponent(input) + '&embed=1';
  }
  function display(href) { // what to show in the address bar for one of our internal hrefs
    try {
      var u = new URL(href, location.origin), p = u.pathname;
      if (p === '/browse') return u.searchParams.get('url') || '';
      if (p === '/search') return u.searchParams.get('q') || '';
    } catch (e) {}
    return '';
  }
  function withEmbed(href) { return href.indexOf('embed=1') < 0 ? href + (href.indexOf('?') < 0 ? '?' : '&') + 'embed=1' : href; }

  function go(href) {
    var t = cur();
    href = withEmbed(href);
    if (t.hist[t.i] !== href) { t.hist = t.hist.slice(0, t.i + 1); t.hist.push(href); t.i++; }
    skipPush = true; view.src = href; $('st').textContent = 'Loading…'; render(); save();
  }
  function step(d) {
    var t = cur(), n = t.i + d;
    if (n < 0 || n >= t.hist.length) return;
    t.i = n; skipPush = true; view.src = t.hist[n]; $('st').textContent = 'Loading…'; render(); save();
  }

  function render() {
    var t = cur();
    tabsEl.innerHTML = '';
    tabs.forEach(function (tb, idx) {
      var li = document.createElement('li'); if (idx === active) li.className = 'on';
      var s = document.createElement('span'); s.className = 'tt'; s.textContent = tb.title || 'New tab';
      var x = document.createElement('button'); x.className = 'tx'; x.textContent = '×'; x.title = 'Close tab';
      x.onclick = function (e) { e.stopPropagation(); closeTab(idx); };
      li.onclick = function () { switchTab(idx); };
      li.appendChild(s); li.appendChild(x); tabsEl.appendChild(li);
    });
    $('back').disabled = t.i <= 0; $('fwd').disabled = t.i >= t.hist.length - 1;
    if (document.activeElement !== addr) addr.value = display(t.hist[t.i]);
    var u = display(t.hist[t.i]);
    $('star').textContent = bookmarks.some(function (b) { return b.url === u; }) ? '★' : '☆';
    renderBookmarks();
  }
  function renderBookmarks() {
    var bar = $('bookmarks'); bar.innerHTML = '';
    if (!bookmarks.length) { bar.innerHTML = '<span class="hint">Bookmarks appear here – click ☆ to add the current page. They are stored only in this browser.</span>'; return; }
    bookmarks.forEach(function (b, i) {
      var d = document.createElement('span'); d.className = 'bm';
      var a = document.createElement('a'); a.href = '#'; a.textContent = b.title || b.url; a.title = b.url;
      a.onclick = function (e) { e.preventDefault(); go(hrefFor(b.url)); };
      var x = document.createElement('button'); x.textContent = '×'; x.title = 'Remove';
      x.onclick = function () { bookmarks.splice(i, 1); store.set('ps.bookmarks', bookmarks); render(); };
      d.appendChild(a); d.appendChild(x); bar.appendChild(d);
    });
  }
  function switchTab(i) { active = i; skipPush = true; view.src = cur().hist[cur().i]; render(); save(); }
  function closeTab(i) {
    if (tabs.length === 1) { tabs = [newTabObj()]; active = 0; } else { tabs.splice(i, 1); if (active >= tabs.length) active = tabs.length - 1; else if (i < active) active--; }
    skipPush = true; view.src = cur().hist[cur().i]; render(); save();
  }

  window.addEventListener('message', function (e) {
    if (e.source !== view.contentWindow || e.origin !== location.origin || !e.data || e.data.type !== 'ps-nav') return;
    var t = cur(), href = e.data.href;
    if (typeof href !== 'string' || href.charAt(0) !== '/') return;
    if (skipPush) { t.hist[t.i] = href; skipPush = false; }
    else if (t.hist[t.i] !== href) { t.hist = t.hist.slice(0, t.i + 1); t.hist.push(href); t.i++; }
    t.title = e.data.title && e.data.title !== 'plainsearch' ? e.data.title : (display(href) || 'New tab');
    $('st').textContent = 'Done'; if (document.activeElement !== addr) addr.value = display(href);
    render(); save();
  });

  $('omni').addEventListener('submit', function (e) { e.preventDefault(); go(hrefFor(addr.value)); view.focus(); });
  addr.addEventListener('focus', function () { addr.select(); });
  $('back').onclick = function () { step(-1); };
  $('fwd').onclick = function () { step(1); };
  $('reload').onclick = function () { skipPush = true; view.src = cur().hist[cur().i]; };
  $('home').onclick = function () { go(HOME); };
  $('newtab').onclick = function () { tabs.push(newTabObj()); active = tabs.length - 1; skipPush = true; view.src = HOME; render(); save(); addr.focus(); };
  $('star').onclick = function () {
    var u = display(cur().hist[cur().i]); if (!u) return;
    var idx = -1; bookmarks.forEach(function (b, i) { if (b.url === u) idx = i; });
    if (idx >= 0) bookmarks.splice(idx, 1); else bookmarks.push({ url: u, title: cur().title });
    store.set('ps.bookmarks', bookmarks); render();
  };
  $('viewmode').onchange = function () {
    viewmode = this.value; store.set('ps.mode', viewmode);
    var u = display(cur().hist[cur().i]);
    if (/\/browse/.test(cur().hist[cur().i]) && u) go(hrefFor(u));
  };
  document.addEventListener('keydown', function (e) {
    if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  });

  skipPush = true; view.src = cur().hist[cur().i]; render();
})();
