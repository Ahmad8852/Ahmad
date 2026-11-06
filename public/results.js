(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  // ---- filmstrip: a row of images under the search bar on Web results ----
  var film = $('film');
  if (film) {
    var q = film.getAttribute('data-q'), embed = film.getAttribute('data-embed');
    fetch('/api/search?cat=images&limit=20&q=' + encodeURIComponent(q)).then(function (r) { return r.json(); }).then(function (d) {
      var box = $('film-in'), shown = 0;
      (d.results || []).slice(0, 16).forEach(function (r) {
        if (!r.thumb) return;
        var a = document.createElement('a');
        a.href = '/search?cat=images&q=' + encodeURIComponent(q) + (embed ? '&embed=1' : '');
        a.title = r.title;
        var i = document.createElement('img');
        i.loading = 'lazy'; i.alt = r.title; i.referrerPolicy = 'no-referrer';
        i.src = /^data:/.test(r.thumb) ? r.thumb : '/img?url=' + encodeURIComponent(r.thumb);
        a.appendChild(i); box.appendChild(a); shown++;
      });
      if (shown) film.hidden = false;
    }).catch(function () {});
  }

  // ---- lightbox (event delegation: the grid is re-rendered while results stream in) ----
  var lb = $('lb'), cur = 0;
  function items() { return [].slice.call(document.querySelectorAll('#grid .gi')); }
  function show(i) {
    var list = items(); if (!list.length) return;
    cur = (i + list.length) % list.length;
    var a = list[cur];
    $('lb-img').src = a.getAttribute('data-full');
    $('lb-cap').textContent = a.getAttribute('data-title') + ' — ' + a.getAttribute('data-src') + (a.getAttribute('data-meta') ? ' — ' + a.getAttribute('data-meta') : '');
    $('lb-page').href = a.getAttribute('data-page');
    $('lb-full').href = a.getAttribute('data-full');
    lb.hidden = false;
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('#grid .gi');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault(); show(items().indexOf(a));
  });
  $('lb-prev').onclick = function () { show(cur - 1); };
  $('lb-next').onclick = function () { show(cur + 1); };
  $('lb-x').onclick = function () { lb.hidden = true; };
  lb.addEventListener('click', function (e) { if (e.target === lb) lb.hidden = true; });
  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') lb.hidden = true; else if (e.key === 'ArrowLeft') show(cur - 1); else if (e.key === 'ArrowRight') show(cur + 1);
  });

  // ---- streaming: results appear as each source answers ----
  var box = $('reslist'), url = box && box.getAttribute('data-stream');
  if (!url) return;
  function apply(m) {
    if (m.list != null) box.innerHTML = m.list;
    if (m.status != null) $('status').innerHTML = m.status;
    if (m.count != null) $('count').innerHTML = m.count;
  }
  fetch(url).then(function (res) {
    var reader = res.body.getReader(), dec = new TextDecoder(), buf = '';
    function pump() {
      return reader.read().then(function (r) {
        if (r.done) return;
        buf += dec.decode(r.value, { stream: true });
        var lines = buf.split('\n'); buf = lines.pop();
        lines.forEach(function (l) { if (!l) return; try { var m = JSON.parse(l); if (m.e === 'error') box.innerHTML = '<div class="none">Search failed: ' + m.message + '</div>'; else apply(m); } catch (e) {} });
        return pump();
      });
    }
    return pump();
  }).catch(function () { box.innerHTML = '<div class="none">Could not stream results. <a href="' + location.href + '&wait=1">Load them the slow way</a>.</div>'; });
})();
