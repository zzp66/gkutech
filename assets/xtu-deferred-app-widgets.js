/* Start the promotion popup and contact toolbar after load or real user activity. */
(function () {
  'use strict';

  if (window.__xtuDeferredAppWidgets) return;
  window.__xtuDeferredAppWidgets = true;

  var head = document.head;
  var appendChild = head.appendChild;
  var insertBefore = head.insertBefore;
  var pending = [];
  var sources = new Set();
  var released = false;
  var started = false;
  var events = ['scroll', 'wheel', 'pointermove', 'mousemove', 'pointerdown', 'touchstart', 'keydown'];

  function isToolbar(source) {
    return /^https:\/\/chat-plugin\.hiifans\.com\/widget\/js\/install\.js(?:\?|$)/.test(source);
  }

  // Only the two vendors' bootstraps are held. Other app scripts use native DOM
  // insertion immediately. No DOM prototypes or Shopify header output are changed.
  function holdWidget(parent, node) {
    if (parent !== head || node.tagName !== 'SCRIPT') return false;
    var source = node.src;
    if (!isToolbar(source) && !/^https:\/\/popup\.1clicklabs\.io\/widget\.js(?:\?|$)/.test(source)) return false;
    if (sources.has(source)) return true;
    sources.add(source);
    if (started) return false;
    pending.push(node);
    return true;
  }

  function deferredAppend(node) {
    return holdWidget(this, node) ? node : appendChild.call(this, node);
  }
  function deferredInsert(node, reference) {
    return holdWidget(this, node) ? node : insertBefore.call(this, node, reference);
  }
  head.appendChild = deferredAppend;
  head.insertBefore = deferredInsert;

  // Shopify normally starts this legacy ScriptTag at window.load. Read only its
  // public URL list so early interaction can start it too; never evaluate app code.
  function toolbarSource() {
    for (var i = 0; i < document.scripts.length; i += 1) {
      var script = document.scripts[i];
      if (script.src || script.textContent.indexOf('chat-plugin.hiifans.com') === -1) continue;
      var match = script.textContent.match(/var urls\s*=\s*(\[[\s\S]*?\]);/);
      if (!match) continue;
      try {
        var urls = JSON.parse(match[1]);
        for (var j = 0; j < urls.length; j += 1) {
          if (isToolbar(urls[j])) return urls[j];
        }
      } catch (_) {}
    }
    return null;
  }

  function loadWidgets() {
    if (started) return;
    var toolbar = toolbarSource();
    if (toolbar && !sources.has(toolbar)) {
      var script = document.createElement('script');
      script.src = toolbar;
      script.async = true;
      sources.add(toolbar);
      pending.push(script);
    }
    started = true;
    pending.forEach(function (node) { appendChild.call(head, node); });
    pending.length = 0;
  }

  function release(event) {
    if (released || (event && !event.isTrusted)) return;
    released = true;
    events.forEach(function (type) { window.removeEventListener(type, release, true); });
    // The contact app requires document.body, even if interaction starts in <head>.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadWidgets, { once: true });
    } else {
      loadWidgets();
    }
  }

  function onLoad() {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        release();
        // Keep deduplication through Shopify's load handlers, then restore both
        // methods without overwriting any later wrapper installed by another app.
        if (head.appendChild === deferredAppend) head.appendChild = appendChild;
        if (head.insertBefore === deferredInsert) head.insertBefore = insertBefore;
      });
    });
  }

  events.forEach(function (type) {
    window.addEventListener(type, release, { capture: true, passive: true });
  });
  if (document.readyState === 'complete') onLoad();
  else window.addEventListener('load', onLoad, { once: true });
})();
