/**
 * XTU Customer Reviews
 *
 * 绑定 [data-xtu-customer-reviews]：Swiper 多卡左右滑动（PC 一行 4 卡，平板 2 卡，移动端 peek）。
 * 读取 data-gap / data-gap-mobile / data-mobile-per-view / data-autoplay / data-autoplay-delay。
 * 卡片高度按最高卡对齐；上传视频仅在可见卡片内静音循环；切出视口即暂停。
 * 自动轮播可配间隔；悬停暂停；prefers-reduced-motion 时关闭。
 */
(function initXtuCustomerReviews() {
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

  function prefersReducedMotion() {
    return (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  function syncVideos(swiper) {
    if (!swiper || !swiper.slides) return;
    Array.prototype.forEach.call(swiper.slides, function (slide) {
      var videos = slide.querySelectorAll('video');
      if (!videos.length) return;
      var visible = slide.classList.contains('swiper-slide-visible');
      Array.prototype.forEach.call(videos, function (video) {
        if (visible) {
          if (video.paused) {
            var playPromise = video.play();
            if (playPromise && typeof playPromise.catch === 'function') {
              playPromise.catch(function () {});
            }
          }
        } else if (!video.paused) {
          video.pause();
          try {
            video.currentTime = 0;
          } catch (err) {
            /* ignore */
          }
        }
      });
    });
  }

  function clearEqualHeights(root) {
    var cards = root.querySelectorAll('.xtu-cr__card');
    Array.prototype.forEach.call(cards, function (card) {
      card.style.minHeight = '';
    });
  }

  function equalizeCardHeights(root, swiper) {
    var cards = root.querySelectorAll('.xtu-cr__card');
    clearEqualHeights(root);
    if (cards.length < 2) {
      if (swiper && !swiper.destroyed) swiper.update();
      return;
    }

    var max = 0;
    Array.prototype.forEach.call(cards, function (card) {
      max = Math.max(max, card.offsetHeight);
    });
    if (max > 0) {
      Array.prototype.forEach.call(cards, function (card) {
        card.style.minHeight = max + 'px';
      });
    }
    if (swiper && !swiper.destroyed) swiper.update();
  }

  function destroy(root) {
    var inst = instances.get(root);
    if (!inst) return;
    if (inst.swiper && typeof inst.swiper.destroy === 'function') {
      inst.swiper.destroy(true, true);
    }
    if (inst.onResize) window.removeEventListener('resize', inst.onResize);
    clearEqualHeights(root);
    instances.delete(root);
  }

  function initRoot(root) {
    if (!(root instanceof HTMLElement)) return;
    destroy(root);

    var container = root.querySelector('[data-xtu-cr-swiper]');
    if (!container) return;

    var gapDesktop = Number(root.getAttribute('data-gap') || 16);
    var gapMobile = Number(root.getAttribute('data-gap-mobile') || 8);
    var mobilePerView = parseFloat(root.getAttribute('data-mobile-per-view') || '1.1');
    var autoplayOn = root.getAttribute('data-autoplay') === 'true' && !prefersReducedMotion();
    var autoplayDelay = Number(root.getAttribute('data-autoplay-delay') || 4000);
    var prevEl = root.querySelector('[data-xtu-cr-prev]');
    var nextEl = root.querySelector('[data-xtu-cr-next]');
    var pagerEl = root.querySelector('[data-xtu-cr-pager]');
    var slideCount = container.querySelectorAll('.swiper-slide').length;
    if (slideCount < 1) return;

    var swiper = new window.Swiper(container, {
      slidesPerView: mobilePerView,
      spaceBetween: gapMobile,
      slidesPerGroup: 1,
      speed: 550,
      watchOverflow: true,
      watchSlidesProgress: true,
      grabCursor: slideCount > 1,
      rewind: slideCount > 1,
      mousewheel: {
        forceToAxis: true,
        releaseOnEdges: true,
      },
      autoplay:
        autoplayOn && slideCount > 1
          ? {
              delay: autoplayDelay,
              disableOnInteraction: false,
              pauseOnMouseEnter: true,
            }
          : false,
      navigation:
        prevEl && nextEl && slideCount > 1
          ? {
              prevEl: prevEl,
              nextEl: nextEl,
            }
          : undefined,
      pagination:
        pagerEl && slideCount > 1
          ? {
              el: pagerEl,
              clickable: true,
              bulletClass: 'xtu-cr__bullet',
              bulletActiveClass: 'is-active',
            }
          : undefined,
      breakpoints: {
        750: {
          slidesPerView: 2,
          spaceBetween: gapDesktop,
        },
        990: {
          slidesPerView: 4,
          spaceBetween: gapDesktop,
        },
      },
      on: {
        init: function () {
          var self = this;
          syncVideos(self);
          requestAnimationFrame(function () {
            equalizeCardHeights(root, self);
          });
        },
        slideChange: function () {
          syncVideos(this);
        },
        progress: function () {
          syncVideos(this);
        },
      },
    });

    var media = root.querySelectorAll('.xtu-cr__image, .xtu-cr__video, video.xtu-cr__video');
    Array.prototype.forEach.call(media, function (el) {
      var refresh = function () {
        if (swiper && !swiper.destroyed) equalizeCardHeights(root, swiper);
      };
      if (el.tagName === 'IMG' && !el.complete) {
        el.addEventListener('load', refresh);
      }
      if (el.tagName === 'VIDEO') {
        el.addEventListener('loadedmetadata', refresh);
      }
    });

    var resizeTimer;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (swiper && !swiper.destroyed) equalizeCardHeights(root, swiper);
      }, 150);
    }

    window.addEventListener('resize', onResize);
    instances.set(root, { swiper: swiper, onResize: onResize });
  }

  function boot(scope) {
    var roots = (scope || document).querySelectorAll('[data-xtu-customer-reviews]');
    Array.prototype.forEach.call(roots, function (root) {
      waitForSwiper(function () {
        initRoot(root);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      boot(document);
    });
  } else {
    boot(document);
  }

  window.addEventListener('xtu:nav:arrived', function () {
    Array.prototype.forEach.call(document.querySelectorAll('[data-xtu-customer-reviews]'), function (root) {
      var inst = instances.get(root);
      if (inst && inst.swiper && !inst.swiper.destroyed) {
        try {
          equalizeCardHeights(root, inst.swiper);
        } catch (err) {
          /* ignore */
        }
      }
    });
  });

  document.addEventListener('shopify:section:load', function (event) {
    boot(event.target);
  });

  document.addEventListener('shopify:section:unload', function (event) {
    var root = event.target;
    if (!root) return;
    if (!root.hasAttribute || !root.hasAttribute('data-xtu-customer-reviews')) {
      root = root.querySelector ? root.querySelector('[data-xtu-customer-reviews]') : null;
    }
    if (root) destroy(root);
  });

  document.addEventListener('shopify:block:select', function (event) {
    var slide = event.target && event.target.closest ? event.target.closest('.xtu-cr__slide') : null;
    var root = event.target && event.target.closest ? event.target.closest('[data-xtu-customer-reviews]') : null;
    if (!slide || !root) return;
    var inst = instances.get(root);
    if (!inst || !inst.swiper) return;
    var slides = root.querySelectorAll('.xtu-cr__slide');
    var index = Array.prototype.indexOf.call(slides, slide);
    if (index >= 0) inst.swiper.slideTo(index);
  });
})();
