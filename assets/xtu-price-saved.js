/**
 * XTU Price Saved
 *
 * Keeps .price-item__saved in sync with displayed sale / compare-at prices
 * after currency apps (e.g. GLC / gelacy) rewrite money nodes.
 * Without this, Save stays in shop currency while prices show converted currency.
 */
(function () {
  'use strict';

  if (window.__xtuPriceSavedInit) return;
  window.__xtuPriceSavedInit = true;

  var timer = null;

  function parseAmount(text) {
    if (!text) return null;
    var cleaned = String(text).replace(/,/g, '');
    var m = cleaned.match(/-?\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }

  function formatLike(template, amount) {
    var cleaned = String(template).trim();
    if (!cleaned) return amount.toFixed(2);
    return cleaned.replace(/-?[\d,]+(?:\.\d+)?/, amount.toFixed(2));
  }

  function moneyNode(group) {
    if (!group) return null;
    return group.querySelector('.glc-money') || group;
  }

  function syncContainer(container) {
    if (!(container instanceof HTMLElement)) return;
    if (!container.classList.contains('price-container--sale')) return;

    var amountEl = container.querySelector('[data-xtu-saved-amount]');
    if (!amountEl) return;

    var saleGroup =
      container.querySelector('.price-item__group.price') ||
      container.querySelector('.price');
    var compareGroup =
      container.querySelector('.price-item__group.compare-at-price') ||
      container.querySelector('.compare-at-price');

    var saleEl = moneyNode(saleGroup);
    var compareEl = moneyNode(compareGroup);
    if (!saleEl || !compareEl) return;

    var sale = parseAmount(saleEl.textContent);
    var compare = parseAmount(compareEl.textContent);
    if (sale == null || compare == null || !(compare > sale)) return;

    var diff = Math.round((compare - sale) * 100) / 100;
    amountEl.textContent = formatLike(saleEl.textContent, diff);
  }

  function syncAll(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var nodes = scope.querySelectorAll('.price-container--sale');
    Array.prototype.forEach.call(nodes, syncContainer);
    if (root instanceof HTMLElement && root.classList.contains('price-container--sale')) {
      syncContainer(root);
    }
  }

  function schedule(root) {
    clearTimeout(timer);
    timer = setTimeout(function () {
      syncAll(root || document);
    }, 60);
  }

  function boot() {
    schedule(document);

    var obs = new MutationObserver(function () {
      schedule(document);
    });
    obs.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('shopify:section:load', function (event) {
    schedule(event.target);
  });
})();
