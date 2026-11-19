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

  var SELECTOR = '.price-container--sale';
  var timer = null;
  var pendingContainers = new Set();
  var renderedAmounts = new WeakMap();

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
    if (!(container instanceof HTMLElement) || !container.isConnected) return;
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
    var formattedAmount = formatLike(saleEl.textContent, diff);
    renderedAmounts.set(amountEl, formattedAmount);
    if (amountEl.textContent !== formattedAmount) {
      amountEl.textContent = formattedAmount;
    }
  }

  function flush() {
    timer = null;
    var containers = Array.from(pendingContainers);
    pendingContainers.clear();
    containers.forEach(syncContainer);
  }

  function schedule() {
    if (timer !== null || !pendingContainers.size) return;
    timer = setTimeout(flush, 60);
  }

  function queueRoot(root) {
    if (!root || !root.querySelectorAll) return;
    if (root instanceof Element) {
      var container = root.closest(SELECTOR);
      if (container) pendingContainers.add(container);
    }
    Array.prototype.forEach.call(root.querySelectorAll(SELECTOR), function (container) {
      pendingContainers.add(container);
    });
    schedule();
  }

  function boot() {
    queueRoot(document);

    var obs = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        var target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
        if (!target) return;

        // Our derived amount write must not schedule another price update.
        // A currency app changing that amount to a different value still resyncs.
        var amount = target.closest('[data-xtu-saved-amount]');
        if (amount && renderedAmounts.get(amount) === amount.textContent) return;

        var container = target.closest(SELECTOR);
        if (container) {
          pendingContainers.add(container);
        } else if (mutation.type === 'childList') {
          Array.prototype.forEach.call(mutation.addedNodes, function (node) {
            if (node instanceof Element) queueRoot(node);
          });
        }
      });
      schedule();
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
    queueRoot(event.target);
  });
})();
