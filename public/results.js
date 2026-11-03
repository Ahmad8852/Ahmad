(function () {
  // ---- filmstrip: a row of images under the search bar on Web results ----
  var film = document.getElementById('film');
  if (film) {
    var q = film.getAttribute('data-q'), embed = film.getAttribute('data-embed');
    fetch('/api/search?cat=images&n=10&q=' + encodeURIComponent(q)).then(function (r) { return r.json(); }).then(function (d) {
      var box = document.getElementById('film-in'), shown = 0;
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
  // ---- lightbox for the image grid ----
  var grid = document.getElementById('grid'), lb = document.getElementById('lb');
  if (!grid || !lb) return;
  var items = [].slice.call(grid.querySelectorAll('.gi')), cur = 0;
  function show(i) {
    cur = (i + items.length) % items.length;
    var a = items[cur];
    document.getElementById('lb-img').src = a.getAttribute('data-full');
    document.getElementById('lb-cap').textContent = a.getAttribute('data-title') + ' — ' + a.getAttribute('data-src') + (a.getAttribute('data-meta') ? ' — ' + a.getAttribute('data-meta') : '');
    document.getElementById('lb-page').href = a.getAttribute('data-page');
    document.getElementById('lb-full').href = a.getAttribute('data-full');
    lb.hidden = false;
  }
  items.forEach(function (a, i) { a.addEventListener('click', function (e) { if (e.ctrlKey || e.metaKey || e.shiftKey) return; e.preventDefault(); show(i); }); });
  document.getElementById('lb-prev').onclick = function () { show(cur - 1); };
  document.getElementById('lb-next').onclick = function () { show(cur + 1); };
  document.getElementById('lb-x').onclick = function () { lb.hidden = true; };
  lb.addEventListener('click', function (e) { if (e.target === lb) lb.hidden = true; });
  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') lb.hidden = true; else if (e.key === 'ArrowLeft') show(cur - 1); else if (e.key === 'ArrowRight') show(cur + 1);
  });
})();
