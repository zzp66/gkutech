/**
 * XTU Variant Cards
 *
 * Camouflage / Hide OOS sometimes tags available Horizon card options with
 * .camouflage-marked-unavailable. Combined with our display:flex !important
 * card shell, the label stays visible while the title body is display:none —
 * an empty option. Strip false-positive classes from available inputs.
 */
(function () {
  'use strict';

  if (window.__xtuVariantCardsInit) return;
  window.__xtuVariantCardsInit = true;

  var CLASSES = ['camouflage-marked-unavailable', 'hide-oos-disable', 'camouflage-unavailable'];
  var timer = null;

  function clearClasses(el) {
    if (!el || !el.classList) return;
    for (var i = 0; i < CLASSES.length; i++) {
      el.classList.remove(CLASSES[i]);
    }
  }

  function restoreAvailable(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var inputs = scope.querySelectorAll(
      '.xtu-product-pdp .variant-option__card > input[data-option-available="true"], body:has(.xtu-product-pdp) .variant-option__card > input[data-option-available="true"]'
    );

    // Fallback without :has support on query — scope product details
    if (!inputs.length) {
      inputs = scope.querySelectorAll('.variant-option__card > input[data-option-available="true"]');
    }

    Array.prototype.forEach.call(inputs, function (input) {
      var card = input.closest('.variant-option__card, label');
      if (!card) return;
      clearClasses(card);
      var nodes = card.querySelectorAll('.' + CLASSES.join(', .'));
      Array.prototype.forEach.call(nodes, clearClasses);
      // Also clear direct body/title if class list was re-applied
      clearClasses(card.querySelector('.variant-option__card-body'));
      clearClasses(card.querySelector('.variant-option__card-title'));
    });
  }

  function schedule(root) {
    clearTimeout(timer);
    timer = setTimeout(function () {
      restoreAvailable(root || document);
    }, 50);
  }

  function boot() {
    schedule(document);
    // Camouflage often runs after first paint
    setTimeout(function () {
      schedule(document);
    }, 300);
    setTimeout(function () {
      schedule(document);
    }, 1200);

    var obs = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === 'attributes' && m.attributeName === 'class') {
          schedule(document);
          return;
        }
        if (m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length)) {
          schedule(document);
          return;
        }
      }
    });

    obs.observe(document.documentElement, {
      subtree: true,
      childList: true,
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
