/**
 * XTU Tab Product Slider
 * Desktop: card width = 纯版心（--page-content-width）等分；左对齐内容区；每次滚动 1 张
 * Mobile: 1.1 peek cards；gap 默认 8px
 */
(function () {
  'use strict';

  var instances = new WeakMap();
  var MOBILE_MQ = '(max-width: 749px)';

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

  function getLayoutMetrics(root) {
    var align = root.querySelector('[data-xtu-align]');
    var isMobile = window.matchMedia(MOBILE_MQ).matches;
    var gapDesktop = Number(root.getAttribute('data-gap') || 16);
    var gapMobile = Number(root.getAttribute('data-gap-mobile') || 8);
    var gap = isMobile ? gapMobile : gapDesktop;
    var perView = Math.max(1, Math.round(Number(root.getAttribute('data-desktop-per-view') || 3)));

    var rootStyles = window.getComputedStyle(document.documentElement);
    var pageMargin =
      parseFloat(rootStyles.getPropertyValue('--page-margin')) || (isMobile ? 15 : 40);
    var pageContentWidth = parseFloat(rootStyles.getPropertyValue('--page-content-width')) || 0;

    // 版心 = 纯内容区宽度（不含左右安全边距）
    var inset = pageMargin;
    var contentWidth = Math.max(
      0,
      Math.min(pageContentWidth || Infinity, window.innerWidth - pageMargin * 2)
    );

    if (align) {
      var rect = align.getBoundingClientRect();
      var cs = window.getComputedStyle(align);
      var padL = parseFloat(cs.paddingLeft) || 0;
      var padR = parseFloat(cs.paddingRight) || 0;
      // 对齐内容区左缘，而非带 padding 的外框
      inset = Math.max(0, Math.round(rect.left + padL));
      contentWidth = Math.max(0, Math.round(align.clientWidth - padL - padR));
    }

    var cardWidth = isMobile
      ? Math.round((window.innerWidth - inset - gap * 0.1) / 1.1)
      : Math.floor((contentWidth - gap * (perView - 1)) / perView);

    return {
      isMobile: isMobile,
      gap: gap,
      perView: perView,
      inset: inset,
      contentWidth: contentWidth,
      cardWidth: Math.max(200, cardWidth),
      offsetAfter: isMobile ? pageMargin : inset,
    };
  }

  function applySlideWidths(root, container, cardWidth) {
    root.style.setProperty('--xtu-tps-card-width', cardWidth + 'px');
    var slides = container.querySelectorAll('.swiper-slide');
    Array.prototype.forEach.call(slides, function (slide) {
      slide.style.width = cardWidth + 'px';
      slide.style.maxWidth = cardWidth + 'px';
      slide.style.flexShrink = '0';
      slide.style.height = '';
    });
  }

  function destroyPanelSwiper(panel) {
    var swiper = instances.get(panel);
    if (swiper) {
      swiper.destroy(true, true);
      instances.delete(panel);
    }
  }

  function initPanelSwiper(root, panel) {
    if (!panel || typeof window.Swiper === 'undefined') return;

    var container = panel.querySelector('[data-xtu-tab-swiper]');
    if (!container) return;

    destroyPanelSwiper(panel);

    var slides = container.querySelectorAll('.swiper-slide');
    if (!slides.length) return;

    var metrics = getLayoutMetrics(root);
    applySlideWidths(root, container, metrics.cardWidth);

    var swiper = new window.Swiper(container, {
      slidesPerView: 'auto',
      slidesPerGroup: 1,
      spaceBetween: metrics.gap,
      slidesOffsetBefore: metrics.inset,
      slidesOffsetAfter: metrics.offsetAfter,
      speed: 550,
      grabCursor: true,
      simulateTouch: true,
      watchOverflow: true,
      resistanceRatio: 0.65,
      mousewheel: {
        enabled: true,
        forceToAxis: true,
        sensitivity: 1,
        releaseOnEdges: true,
      },
      navigation: {
        nextEl: root.querySelector('[data-xtu-tab-next]'),
        prevEl: root.querySelector('[data-xtu-tab-prev]'),
      },
      on: {
        init: function (instance) {
          var next = getLayoutMetrics(root);
          applySlideWidths(root, container, next.cardWidth);
          instance.update();
        },
        resize: function (instance) {
          var next = getLayoutMetrics(root);
          applySlideWidths(root, container, next.cardWidth);
          instance.params.spaceBetween = next.gap;
          instance.params.slidesOffsetBefore = next.inset;
          instance.params.slidesOffsetAfter = next.offsetAfter;
          instance.update();
        },
      },
    });

    instances.set(panel, swiper);
  }

  function activateTab(root, tabId) {
    var tabs = root.querySelectorAll('[data-xtu-tab]');
    var panels = root.querySelectorAll('[data-xtu-tab-panel]');

    Array.prototype.forEach.call(tabs, function (tab) {
      var active = tab.getAttribute('data-xtu-tab') === tabId;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.setAttribute('tabindex', active ? '0' : '-1');
    });

    Array.prototype.forEach.call(panels, function (panel) {
      var active = panel.getAttribute('data-xtu-tab-panel') === tabId;
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
      if (active) {
        requestAnimationFrame(function () {
          initPanelSwiper(root, panel);
        });
      } else {
        destroyPanelSwiper(panel);
      }
    });
  }

  function bindTabs(root) {
    var tabs = root.querySelectorAll('[data-xtu-tab]');
    Array.prototype.forEach.call(tabs, function (tab) {
      tab.addEventListener('click', function () {
        activateTab(root, tab.getAttribute('data-xtu-tab'));
      });
    });
  }

  function initRoot(root) {
    if (!root) return;
    bindTabs(root);

    var firstTab = root.querySelector('[data-xtu-tab]');
    if (firstTab) {
      activateTab(root, firstTab.getAttribute('data-xtu-tab'));
    }
  }

  function boot(scope) {
    var roots = (scope || document).querySelectorAll('[data-xtu-tab-product-slider]');
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
      var roots = document.querySelectorAll('[data-xtu-tab-product-slider]');
      Array.prototype.forEach.call(roots, function (root) {
        var activePanel = root.querySelector('[data-xtu-tab-panel].is-active');
        if (activePanel) initPanelSwiper(root, activePanel);
      });
    }, 150);
  });

  onReady(function () {
    waitForSwiper(function () {
      boot(document);
    });
  });

  window.addEventListener('xtu:nav:arrived', function () {
    var roots = document.querySelectorAll('[data-xtu-tab-product-slider]');
    Array.prototype.forEach.call(roots, function (root) {
      var panels = root.querySelectorAll('[data-xtu-tab-panel]');
      Array.prototype.forEach.call(panels, function (panel) {
        var swiper = instances.get(panel);
        if (swiper && !swiper.destroyed) {
          try {
            swiper.update();
          } catch (_) {}
        }
      });
    });
  });

  document.addEventListener('shopify:section:load', function (event) {
    waitForSwiper(function () {
      boot(event.target);
    });
  });

  document.addEventListener('shopify:section:unload', function (event) {
    var root = event.target.querySelector('[data-xtu-tab-product-slider]');
    if (!root) return;
    var panels = root.querySelectorAll('[data-xtu-tab-panel]');
    Array.prototype.forEach.call(panels, destroyPanelSwiper);
  });
})();
