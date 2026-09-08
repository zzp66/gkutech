/**
 * XTU Footer — mobile menu accordion (one open at a time)
 */
(function () {
  'use strict';

  var MOBILE_MQ = '(max-width: 749px)';

  function syncAccordionState(root) {
    var detailsList = root.querySelectorAll('[data-xtu-footer-details]');
    if (!detailsList.length) return;

    var isMobile = window.matchMedia(MOBILE_MQ).matches;
    Array.prototype.forEach.call(detailsList, function (details) {
      // Desktop: always open so links remain visible
      // Mobile: start collapsed for accordion UX
      details.open = !isMobile;
    });
  }

  function bindAccordion(root) {
    var detailsList = root.querySelectorAll('[data-xtu-footer-details]');
    if (!detailsList.length) return;

    Array.prototype.forEach.call(detailsList, function (details) {
      details.addEventListener('toggle', function () {
        if (!window.matchMedia(MOBILE_MQ).matches) {
          details.open = true;
          return;
        }
        if (!details.open) return;
        Array.prototype.forEach.call(detailsList, function (other) {
          if (other !== details && other.open) other.open = false;
        });
      });
    });
  }

  function initRoot(root) {
    if (!root || root.dataset.xtuFooterReady === '1') return;
    root.dataset.xtuFooterReady = '1';
    syncAccordionState(root);
    bindAccordion(root);
  }

  function boot(scope) {
    var roots = (scope || document).querySelectorAll('[data-xtu-footer]');
    Array.prototype.forEach.call(roots, initRoot);
  }

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var roots = document.querySelectorAll('[data-xtu-footer]');
      Array.prototype.forEach.call(roots, syncAccordionState);
    }, 150);
  });

  onReady(function () {
    boot(document);
  });

  document.addEventListener('shopify:section:load', function (event) {
    var root = event.target.querySelector('[data-xtu-footer]') || event.target;
    if (root && root.hasAttribute && root.hasAttribute('data-xtu-footer')) {
      root.dataset.xtuFooterReady = '';
    }
    boot(event.target);
  });
})();
