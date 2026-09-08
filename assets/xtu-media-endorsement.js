/**
 * XTU Media Endorsement — Swiper + Logo tab navigation
 */
(function () {
  'use strict';

  function boot(scope) {
    var roots = (scope || document).querySelectorAll('[data-xtu-media-endorsement]');
    roots.forEach(function (root) { initRoot(root); });
  }

  function initRoot(root) {
    if (root.dataset.xtuMeBound === 'true') return;
    root.dataset.xtuMeBound = 'true';

    var mode = root.dataset.mode || 'quote';
    var swiperEl = root.querySelector('[data-xtu-me-swiper]');
    if (!swiperEl) return;

    var prevBtn = root.querySelector('[data-xtu-me-prev]');
    var nextBtn = root.querySelector('[data-xtu-me-next]');
    var tabs = root.querySelectorAll('[data-xtu-me-tab]');

    var perView = mode === 'quote' ? 4 : 1;

    var swiper = new Swiper(swiperEl, {
      slidesPerView: 1.1,
      spaceBetween: 8,
      grabCursor: true,
      mousewheel: { forceToAxis: true },
      navigation: prevBtn && nextBtn ? {
        prevEl: prevBtn,
        nextEl: nextBtn
      } : false,
      breakpoints: {
        750: {
          slidesPerView: perView,
          spaceBetween: 16
        }
      }
    });

    if (tabs.length > 0) {
      tabs.forEach(function (tab, idx) {
        tab.addEventListener('click', function () {
          swiper.slideTo(idx);
          setActiveTab(tabs, idx);
        });
      });

      swiper.on('slideChange', function () {
        setActiveTab(tabs, swiper.activeIndex);
      });

      setActiveTab(tabs, 0);
    }
  }

  function setActiveTab(tabs, idx) {
    tabs.forEach(function (t, i) {
      t.classList.toggle('is-active', i === idx);
      t.setAttribute('aria-selected', i === idx ? 'true' : 'false');
    });
  }

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  onReady(function () { boot(); });
  document.addEventListener('shopify:section:load', function (e) { boot(e.target); });
})();
