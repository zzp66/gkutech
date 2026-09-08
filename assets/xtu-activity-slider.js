/**
 * XTU Activity Slider
 * Desktop: equal divide in page content width — 6 (≥1400) / 5 (≥1200) / 4 (≥750), no peek
 * Mobile: 2.1 peek
 */
(function () {
  'use strict';

  var instances = new WeakMap();

  function waitForSwiper(cb) {
    if (typeof window.Swiper !== 'undefined') {
      cb();
      return;
    }
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (typeof window.Swiper !== 'undefined' || tries > 40) {
        clearInterval(timer);
        if (typeof window.Swiper !== 'undefined') cb();
      }
    }, 50);
  }

  function destroy(root) {
    var inst = instances.get(root);
    if (!inst) return;
    if (inst.swiper && typeof inst.swiper.destroy === 'function') {
      inst.swiper.destroy(true, true);
    }
    if (inst.onResize) window.removeEventListener('resize', inst.onResize);
    instances.delete(root);
  }

  function initRoot(root) {
    if (!root) return;
    destroy(root);

    var container = root.querySelector('[data-xtu-activity-swiper]');
    if (!container) return;

    var gapDesktop = Number(root.getAttribute('data-gap') || 16);
    var gapMobile = Number(root.getAttribute('data-gap-mobile') || 8);
    var mobilePerView = parseFloat(root.getAttribute('data-mobile-per-view') || '2.1');
    var prevEl = root.querySelector('[data-xtu-activity-prev]');
    var nextEl = root.querySelector('[data-xtu-activity-next]');

    var swiper = new window.Swiper(container, {
      slidesPerView: mobilePerView,
      spaceBetween: gapMobile,
      slidesPerGroup: 1,
      speed: 550,
      watchOverflow: true,
      grabCursor: true,
      mousewheel: {
        forceToAxis: true,
        releaseOnEdges: true,
      },
      navigation:
        prevEl && nextEl
          ? {
              prevEl: prevEl,
              nextEl: nextEl,
            }
          : undefined,
      breakpoints: {
        750: {
          slidesPerView: 4,
          spaceBetween: gapDesktop,
        },
        1200: {
          slidesPerView: 5,
          spaceBetween: gapDesktop,
        },
        1400: {
          slidesPerView: 6,
          spaceBetween: gapDesktop,
        },
      },
    });

    var resizeTimer;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (swiper && !swiper.destroyed) swiper.update();
      }, 150);
    }

    window.addEventListener('resize', onResize);
    instances.set(root, { swiper: swiper, onResize: onResize });
  }

  function boot(scope) {
    var roots = (scope || document).querySelectorAll('[data-xtu-activity-slider]');
    Array.prototype.forEach.call(roots, function (root) {
      waitForSwiper(function () {
        initRoot(root);
      });
    });
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

  window.addEventListener('xtu:nav:arrived', function () {
    Array.prototype.forEach.call(document.querySelectorAll('[data-xtu-activity-slider]'), function (root) {
      var inst = instances.get(root);
      if (inst && inst.swiper && !inst.swiper.destroyed) {
        try {
          inst.swiper.update();
        } catch (_) {}
      }
    });
  });

  document.addEventListener('shopify:section:load', function (event) {
    boot(event.target);
  });

  document.addEventListener('shopify:section:unload', function (event) {
    var root = event.target.querySelector('[data-xtu-activity-slider]') || event.target;
    if (root && root.hasAttribute && root.hasAttribute('data-xtu-activity-slider')) {
      destroy(root);
    }
  });
})();
