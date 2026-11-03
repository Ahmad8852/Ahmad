// Tells the tabbed browser (parent window) where this page navigated to.
(function () {
  if (window.parent === window) return;
  function report() {
    try { window.parent.postMessage({ type: 'ps-nav', href: location.pathname + location.search, title: document.title }, location.origin); } catch (e) {}
  }
  report();
  window.addEventListener('pageshow', report);
})();
