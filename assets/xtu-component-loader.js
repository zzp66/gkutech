/* Register optional Horizon components only when their markup is present. */
(function () {
  'use strict';
  var config = document.getElementById('xtu-component-modules');
  if (!config || window.__xtuComponentModules) return;
  window.__xtuComponentModules = true;
  var modules = JSON.parse(config.textContent);
  var byTag = new Map(modules.map(function (entry) { return [entry.selector, entry]; }));
  var selector = modules.map(function (entry) { return entry.selector; }).join(',');
  var pending = new Set();
  var scheduled = false;

  function loadWithin(root) {
    if (!root || !root.querySelector) return;
    function load(element) {
      var entry = byTag.get(element.localName);
      if (!entry || entry.loading) return;
      entry.loading = import(entry.url).catch(function (error) {
        entry.loading = null;
        console.error('Unable to load theme component:', entry.selector, error);
      });
    }
    if (root.matches && root.matches(selector)) load(root);
    root.querySelectorAll(selector).forEach(load);
  }

  function flush() {
    scheduled = false;
    pending.forEach(loadWithin);
    pending.clear();
  }

  loadWithin(document);
  new MutationObserver(function (records) {
    records.forEach(function (record) {
      record.addedNodes.forEach(function (node) {
        if (node.nodeType === 1) pending.add(node);
      });
    });
    if (pending.size && !scheduled) {
      scheduled = true;
      queueMicrotask(flush);
    }
  }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('shopify:section:load', function (event) {
    loadWithin(event.target);
  });
})();
