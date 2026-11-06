(function () {
  'use strict';
  var rows = [].slice.call(document.querySelectorAll('#ctab tr[data-id]')), running = false;
  function one(tr, q) {
    var st = tr.querySelector('.st'); st.textContent = 'testing…'; st.className = 'st run';
    return fetch('/api/sources/check?id=' + encodeURIComponent(tr.getAttribute('data-id')) + '&q=' + encodeURIComponent(q)).then(function (r) { return r.json(); }).then(function (d) {
      st.className = 'st ' + (d.ok ? 'ok' : 'bad');
      st.textContent = d.ok ? '✓ works' : '✗ ' + (d.error || 'failed');
      tr.querySelector('.ms').textContent = d.ms != null ? (d.ms / 1000).toFixed(1) + 's' : '';
      tr.querySelector('.ct').textContent = d.count != null ? d.count : '';
      tr.querySelector('.sm').textContent = (d.sample || []).join(' | ');
      return d.ok;
    }).catch(function () { st.className = 'st bad'; st.textContent = '✗ request failed'; return false; });
  }
  function run() {
    if (running) return; running = true;
    var q = document.getElementById('cq').value || 'linux', i = 0, ok = 0, done = 0;
    rows.forEach(function (r) { r.querySelector('.st').textContent = 'waiting…'; r.querySelector('.st').className = 'st'; });
    function worker() {
      if (i >= rows.length) return Promise.resolve();
      var tr = rows[i++];
      return one(tr, q).then(function (g) { done++; if (g) ok++; document.getElementById('csum').textContent = ok + ' of ' + rows.length + ' working (' + done + ' tested)'; return worker(); });
    }
    Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]).then(function () { running = false; });
  }
  document.getElementById('cgo').onclick = run;
  run();
})();
