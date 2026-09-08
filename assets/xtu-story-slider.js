/**
 * XTU Story Slider
 * Desktop: left-align to page content, 4 equal cards + right peek; both sides peek after scroll
 * Mobile: 1.1 peek with page margins
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

  function readInset(root) {
    var viewport = root.querySelector('.xtu-story-slider__viewport');
    var heading = root.querySelector('.xtu-story-slider__heading');
    var intro = root.querySelector('.xtu-story-slider__intro');
    var alignEl = heading || intro;

    if (alignEl && viewport) {
      var measured =
        alignEl.getBoundingClientRect().left - viewport.getBoundingClientRect().left;
      if (!heading && intro) {
        measured += parseFloat(window.getComputedStyle(intro).paddingLeft) || 0;
      }
      measured = Math.round(measured);
      if (measured >= 0) return measured;
    }

    var styles = window.getComputedStyle(root);
    var inset = parseFloat(styles.getPropertyValue('--xtu-ss-inset'));
    if (inset && !Number.isNaN(inset)) return inset;

    var margin = parseFloat(
      window.getComputedStyle(document.documentElement).getPropertyValue('--page-margin')
    );
    return margin || 16;
  }

  function applyInset(swiper, root) {
    if (!swiper || swiper.destroyed) return;
    var nextInset = readInset(root);
    swiper.params.slidesOffsetBefore = nextInset;
    swiper.params.slidesOffsetAfter = nextInset;
    if (swiper.params.breakpoints && swiper.params.breakpoints[750]) {
      swiper.params.breakpoints[750].slidesOffsetBefore = nextInset;
      swiper.params.breakpoints[750].slidesOffsetAfter = nextInset;
    }
    swiper.update();
  }

  function pauseAllVideos(root, except) {
    var videos = root.querySelectorAll('.xtu-story-slider__video');
    Array.prototype.forEach.call(videos, function (video) {
      if (except && video === except) return;
      video.pause();
      var card = video.closest('[data-xtu-story-card]');
      if (card) card.classList.remove('is-playing');
    });
  }

  function bindVideoCards(root) {
    var cards = root.querySelectorAll('[data-xtu-story-card][data-media-type="video"]');
    Array.prototype.forEach.call(cards, function (card) {
      if (card.getAttribute('data-xtu-story-video-bound') === 'true') return;
      card.setAttribute('data-xtu-story-video-bound', 'true');

      var videos = card.querySelectorAll('.xtu-story-slider__video');
      var playBtn = card.querySelector('[data-xtu-story-play]');
      if (!videos.length) return;

      function togglePlay(event) {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        var video = videos[0];
        Array.prototype.forEach.call(videos, function (node) {
          if (window.getComputedStyle(node).display === 'none') return;
          video = node;
        });
        if (video.paused) {
          pauseAllVideos(root, video);
          var playPromise = video.play();
          if (playPromise && typeof playPromise.then === 'function') {
            playPromise
              .then(function () {
                card.classList.add('is-playing');
              })
              .catch(function () {
                card.classList.remove('is-playing');
              });
          } else {
            card.classList.add('is-playing');
          }
        } else {
          video.pause();
          card.classList.remove('is-playing');
        }
      }

      if (playBtn) {
        playBtn.addEventListener('click', togglePlay);
      }

      Array.prototype.forEach.call(videos, function (video) {
        video.addEventListener('click', togglePlay);
        video.addEventListener('ended', function () {
          card.classList.remove('is-playing');
        });
        video.addEventListener('pause', function () {
          if (video.paused) card.classList.remove('is-playing');
        });
      });
      video.addEventListener('play', function () {
        card.classList.add('is-playing');
      });
    });
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

    var container = root.querySelector('[data-xtu-story-swiper]');
    if (!container) return;

    var gapDesktop = Number(root.getAttribute('data-gap') || 16);
    var gapMobile = Number(root.getAttribute('data-gap-mobile') || 8);
    var prevEl = root.querySelector('[data-xtu-story-prev]');
    var nextEl = root.querySelector('[data-xtu-story-next]');
    var inset = readInset(root);

    var swiper = new window.Swiper(container, {
      slidesPerView: 1.1,
      spaceBetween: gapMobile,
      slidesPerGroup: 1,
      slidesOffsetBefore: inset,
      slidesOffsetAfter: inset,
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
          slidesPerView: 'auto',
          spaceBetween: gapDesktop,
          slidesOffsetBefore: inset,
          slidesOffsetAfter: inset,
        },
      },
      on: {
        slideChange: function () {
          pauseAllVideos(root, null);
        },
      },
    });

    bindVideoCards(root);

    requestAnimationFrame(function () {
      applyInset(swiper, root);
      requestAnimationFrame(function () {
        applyInset(swiper, root);
      });
    });

    var resizeTimer;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        applyInset(swiper, root);
      }, 150);
    }

    window.addEventListener('resize', onResize);
    instances.set(root, { swiper: swiper, onResize: onResize });
  }

  function boot(scope) {
    var roots = (scope || document).querySelectorAll('[data-xtu-story-slider]');
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
    Array.prototype.forEach.call(document.querySelectorAll('[data-xtu-story-slider]'), function (root) {
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
    var root = event.target.querySelector('[data-xtu-story-slider]') || event.target;
    if (root && root.hasAttribute && root.hasAttribute('data-xtu-story-slider')) {
      destroy(root);
    }
  });
})();
