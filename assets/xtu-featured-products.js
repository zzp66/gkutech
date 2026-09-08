/**
 * XtuCam featured products: desktop 2-up grid, optional mobile Swiper.
 */
(function () {
  'use strict';

  var instances = new WeakMap();
  var MOBILE_MQ = '(max-width: 749px)';

  function destroySwiper(root) {
    var swiper = instances.get(root);
    if (swiper) {
      swiper.destroy(true, true);
      instances.delete(root);
    }
  }

  function initFeatured(root) {
    if (!root || typeof window.Swiper === 'undefined') return;

    var mode = root.getAttribute('data-mobile-layout') || 'swiper';
    var container = root.querySelector('[data-xtu-featured-swiper]');
    if (!container) return;

    var isMobile = window.matchMedia(MOBILE_MQ).matches;

    if (mode !== 'swiper' || !isMobile) {
      destroySwiper(root);
      root.classList.remove('is-swiper-active');
      return;
    }

    if (instances.has(root)) return;

    var spaceBetween = Number(root.getAttribute('data-mobile-gap') || 12);
    var swiper = new window.Swiper(container, {
      slidesPerView: 1.1,
      spaceBetween: spaceBetween,
      slidesOffsetBefore: 16,
      slidesOffsetAfter: 16,
      grabCursor: true,
      simulateTouch: true,
      mousewheel: {
        enabled: true,
        forceToAxis: true,
        sensitivity: 1,
        releaseOnEdges: true,
      },
    });

    instances.set(root, swiper);
    root.classList.add('is-swiper-active');
  }

  function boot(scope) {
    var roots = (scope || document).querySelectorAll('[data-xtu-featured-products]');
    Array.prototype.forEach.call(roots, initFeatured);
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
      boot(document);
    }, 150);
  });

  onReady(function () {
    if (typeof window.Swiper === 'undefined') {
      var tries = 0;
      var timer = setInterval(function () {
        tries += 1;
        if (typeof window.Swiper !== 'undefined' || tries > 40) {
          clearInterval(timer);
          boot(document);
        }
      }, 50);
    } else {
      boot(document);
    }
  });

  document.addEventListener('shopify:section:load', function (event) {
    boot(event.target);
  });

  document.addEventListener('shopify:section:unload', function (event) {
    var root = event.target.querySelector('[data-xtu-featured-products]');
    if (root) destroySwiper(root);
  });
})();
