/**
 * XTU Deal Countdown
 *
 * Reads [data-xtu-deal-countdown][data-end] (ISO datetime).
 * Updates days/hours/minutes/seconds pads; hides or zeros when expired.
 * Multi-instance safe.
 */
(function () {
  'use strict';

  if (window.__xtuDealCountdownInit) return;
  window.__xtuDealCountdownInit = true;

  var timers = new WeakMap();

  function pad(n) {
    n = Math.max(0, Math.floor(n));
    return n < 10 ? '0' + n : String(n);
  }

  function parseEnd(raw) {
    if (!raw) return null;
    var t = Date.parse(raw);
    if (Number.isNaN(t)) {
      t = Date.parse(String(raw).replace(/-/g, '/'));
    }
    return Number.isNaN(t) ? null : t;
  }

  function setUnit(root, name, value) {
    var el = root.querySelector('[data-xtu-dc-unit="' + name + '"]');
    if (el) el.textContent = pad(value);
  }

  function tick(root) {
    var end = parseEnd(root.getAttribute('data-end'));
    if (!end) return;

    var diff = end - Date.now();
    var expiredBehavior = root.getAttribute('data-expired') || 'zero';

    if (diff <= 0) {
      setUnit(root, 'days', 0);
      setUnit(root, 'hours', 0);
      setUnit(root, 'minutes', 0);
      setUnit(root, 'seconds', 0);
      root.classList.add('is-expired');
      if (expiredBehavior === 'hide') {
        var timer = root.querySelector('[data-xtu-dc-timer]');
        if (timer) timer.hidden = true;
      }
      var msg = root.querySelector('[data-xtu-dc-expired-msg]');
      if (msg) msg.hidden = false;
      stop(root);
      return;
    }

    root.classList.remove('is-expired');
    var totalSec = Math.floor(diff / 1000);
    var days = Math.floor(totalSec / 86400);
    var hours = Math.floor((totalSec % 86400) / 3600);
    var minutes = Math.floor((totalSec % 3600) / 60);
    var seconds = totalSec % 60;

    setUnit(root, 'days', days);
    setUnit(root, 'hours', hours);
    setUnit(root, 'minutes', minutes);
    setUnit(root, 'seconds', seconds);
  }

  function stop(root) {
    var id = timers.get(root);
    if (id) {
      clearInterval(id);
      timers.delete(root);
    }
  }

  function initRoot(root) {
    if (!(root instanceof HTMLElement)) return;
    stop(root);
    if (!root.hasAttribute('data-end')) return;

    tick(root);
    var id = setInterval(function () {
      tick(root);
    }, 1000);
    timers.set(root, id);
  }

  function boot(scope) {
    var roots = (scope || document).querySelectorAll('[data-xtu-deal-countdown]');
    Array.prototype.forEach.call(roots, initRoot);
  }

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  onReady(function () {
    boot(document);
  });

  document.addEventListener('shopify:section:load', function (event) {
    boot(event.target);
  });

  document.addEventListener('shopify:section:unload', function (event) {
    var root = event.target.querySelector
      ? event.target.querySelector('[data-xtu-deal-countdown]')
      : null;
    if (!root && event.target && event.target.hasAttribute && event.target.hasAttribute('data-xtu-deal-countdown')) {
      root = event.target;
    }
    if (root) stop(root);
  });
})();
