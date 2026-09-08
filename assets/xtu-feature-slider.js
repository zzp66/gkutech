/**
 * XTU Feature Slider
 *
 * 绑定 [data-xtu-feature-slider]：单卡 Swiper，PC 左图右文或左文右图。
 * 卡片高度 PC 跟图片走（autoHeight）；移动端各屏对齐为最高卡。
 * YouTube 点封面后叠 iframe，封面图仍占位撑高。
 * 切走 slide 时暂停/卸载媒体。
 */
(function initXtuFeatureSlider() {
  'use strict';

  var instances = new WeakMap();

  function youtubeIdFromUrl(url) {
    if (!url) return '';
    var match = String(url).match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return match ? match[1] : '';
  }

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

  function stopYoutube(slide) {
    if (!slide) return;
    var iframe = slide.querySelector('iframe[data-xtu-fsl-iframe]');
    if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
    var stage = slide.querySelector('[data-xtu-fsl-stage]');
    if (stage) stage.classList.remove('is-playing');
  }

  function pauseHosted(slide) {
    if (!slide) return;
    var videos = slide.querySelectorAll('.xtu-fsl__video');
    Array.prototype.forEach.call(videos, function (video) {
      video.pause();
      try {
        video.currentTime = 0;
      } catch (err) {
        /* ignore */
      }
    });
  }

  function playHosted(slide) {
    if (!slide) return;
    var videos = slide.querySelectorAll('.xtu-fsl__video');
    Array.prototype.forEach.call(videos, function (video) {
      var playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function () {});
      }
    });
  }

  function stopAllExcept(root, exceptSlide) {
    var slides = root.querySelectorAll('.swiper-slide');
    Array.prototype.forEach.call(slides, function (slide) {
      if (exceptSlide && slide === exceptSlide) return;
      stopYoutube(slide);
      pauseHosted(slide);
    });
  }

  function bindYoutube(root) {
    var covers = root.querySelectorAll('[data-xtu-fsl-yt-cover]');
    Array.prototype.forEach.call(covers, function (cover) {
      if (cover.getAttribute('data-xtu-fsl-bound') === 'true') return;
      cover.setAttribute('data-xtu-fsl-bound', 'true');

      cover.addEventListener('click', function () {
        var slide = cover.closest('.swiper-slide');
        var stage = slide && slide.querySelector('[data-xtu-fsl-stage]');
        var url = cover.getAttribute('data-youtube-url') || '';
        var id = youtubeIdFromUrl(url);
        if (!stage || !id) return;

        stopAllExcept(root, slide);

        var iframe = document.createElement('iframe');
        iframe.className = 'xtu-fsl__iframe';
        iframe.setAttribute('data-xtu-fsl-iframe', '');
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute(
          'allow',
          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
        );
        iframe.setAttribute('title', cover.getAttribute('aria-label') || 'Video');
        iframe.src =
          'https://www.youtube.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0&modestbranding=1';
        stage.appendChild(iframe);
        stage.classList.add('is-playing');
      });
    });
  }

  function isMobile() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 749px)').matches;
  }

  function clearEqualHeights(root) {
    var cards = root.querySelectorAll('.xtu-fsl__card');
    Array.prototype.forEach.call(cards, function (card) {
      card.style.minHeight = '';
    });
  }

  function equalizeMobileHeights(root, swiper) {
    var cards = root.querySelectorAll('.xtu-fsl__card');
    clearEqualHeights(root);
    if (!isMobile() || cards.length < 2) {
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

  function bindAutoHeight(root, swiper) {
    var media = root.querySelectorAll('.xtu-fsl__image, .xtu-fsl__video, video.xtu-fsl__video');
    var refresh = function () {
      if (!swiper || swiper.destroyed) return;
      if (isMobile()) {
        equalizeMobileHeights(root, swiper);
        return;
      }
      if (typeof swiper.updateAutoHeight === 'function') swiper.updateAutoHeight(0);
    };
    Array.prototype.forEach.call(media, function (el) {
      if (el.tagName === 'IMG' && !el.complete) {
        el.addEventListener('load', refresh);
      }
      if (el.tagName === 'VIDEO') {
        el.addEventListener('loadedmetadata', refresh);
      }
    });
  }

  function syncActiveMedia(root, swiper) {
    var active = swiper.slides[swiper.activeIndex];
    stopAllExcept(root, active);
    playHosted(active);
  }

  function destroy(root) {
    var inst = instances.get(root);
    if (!inst) return;
    if (inst.onResize) window.removeEventListener('resize', inst.onResize);
    if (inst.swiper && typeof inst.swiper.destroy === 'function') {
      inst.swiper.destroy(true, true);
    }
    clearEqualHeights(root);
    instances.delete(root);
  }

  function initRoot(root) {
    if (!(root instanceof HTMLElement)) return;
    destroy(root);

    var container = root.querySelector('[data-xtu-fsl-swiper]');
    if (!container) return;

    var prevEl = root.querySelector('[data-xtu-fsl-prev]');
    var nextEl = root.querySelector('[data-xtu-fsl-next]');
    var pagerEl = root.querySelector('[data-xtu-fsl-pager]');
    var slideCount = container.querySelectorAll('.swiper-slide').length;
    if (slideCount < 1) return;

    var swiper = new window.Swiper(container, {
      slidesPerView: 1,
      spaceBetween: 0,
      speed: 550,
      autoHeight: false,
      watchOverflow: true,
      observer: true,
      observeParents: true,
      grabCursor: slideCount > 1,
      loop: false,
      rewind: slideCount > 1,
      mousewheel: {
        forceToAxis: true,
        releaseOnEdges: true,
      },
      breakpoints: {
        750: {
          autoHeight: true,
        },
      },
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
              bulletClass: 'xtu-fsl__bullet',
              bulletActiveClass: 'is-active',
              renderBullet: function (index, className) {
                return (
                  '<button type="button" class="' +
                  className +
                  '" aria-label="Go to slide ' +
                  (index + 1) +
                  '"></button>'
                );
              },
            }
          : undefined,
      on: {
        init: function () {
          syncActiveMedia(root, this);
          equalizeMobileHeights(root, this);
        },
        slideChange: function () {
          syncActiveMedia(root, this);
        },
      },
    });

    bindYoutube(root);
    bindAutoHeight(root, swiper);

    var resizeTimer;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (!swiper || swiper.destroyed) return;
        equalizeMobileHeights(root, swiper);
      }, 150);
    }

    window.addEventListener('resize', onResize);
    instances.set(root, { swiper: swiper, onResize: onResize });
  }

  function boot(scope) {
    var roots = (scope || document).querySelectorAll('[data-xtu-feature-slider]');
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

  document.addEventListener('shopify:section:load', function (event) {
    boot(event.target);
  });

  document.addEventListener('shopify:section:unload', function (event) {
    var root = event.target;
    if (!root) return;
    if (!root.hasAttribute || !root.hasAttribute('data-xtu-feature-slider')) {
      root = root.querySelector ? root.querySelector('[data-xtu-feature-slider]') : null;
    }
    if (root) destroy(root);
  });

  document.addEventListener('shopify:block:select', function (event) {
    var slide = event.target && event.target.closest ? event.target.closest('.xtu-fsl__slide') : null;
    var root = event.target && event.target.closest ? event.target.closest('[data-xtu-feature-slider]') : null;
    if (!slide || !root) return;
    var inst = instances.get(root);
    if (!inst || !inst.swiper) return;
    var slides = root.querySelectorAll('.xtu-fsl__slide');
    var index = Array.prototype.indexOf.call(slides, slide);
    if (index >= 0) inst.swiper.slideTo(index);
  });
})();
