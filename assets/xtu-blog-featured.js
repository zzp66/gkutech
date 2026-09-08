/**
 * XTU Blog Featured — desktop split layout; mobile Swiper 1.1 peek
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

  function boot(scope) {
    var roots = (scope || document).querySelectorAll('[data-xtu-blog-featured]');
    Array.prototype.forEach.call(roots, function (root) {
      initRoot(root);
    });
  }

  function initRoot(root) {
    if (root.getAttribute('data-xtu-bf-bound') === 'true') return;
    root.setAttribute('data-xtu-bf-bound', 'true');

    var swiperEl = root.querySelector('[data-xtu-bf-swiper]');
    if (!swiperEl) return;

    waitForSwiper(function () {
      var mq = window.matchMedia('(max-width: 749px)');
      var swiper = null;

      function mount() {
        if (!mq.matches) {
          if (swiper) {
            swiper.destroy(true, true);
            swiper = null;
            instances.delete(root);
          }
          return;
        }
        if (swiper) return;

        swiper = new window.Swiper(swiperEl, {
          slidesPerView: 1.1,
          spaceBetween: 8,
          grabCursor: true,
          mousewheel: { forceToAxis: true },
          watchOverflow: true,
          autoHeight: false,
          observer: true,
          observeParents: true
        });
        instances.set(root, swiper);
      }

      mount();
      if (mq.addEventListener) {
        mq.addEventListener('change', mount);
      } else if (mq.addListener) {
        mq.addListener(mount);
      }
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

  document.addEventListener('shopify:section:load', function (event) {
    boot(event.target);
  });
})();
