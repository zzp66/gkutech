/**
 * XTU Story Slider
 * Desktop: left-align to page content, 4 equal cards + right peek; both sides peek after scroll
 * Mobile: 1.1 peek with page margins
 *
 * Multi-instance safe: section may include this script more than once; boot only once.
 * One section failing must not block other instances on the same page.
 *
 * Media: image / hosted video / YouTube|Vimeo link coexist under section card_ratio.
 * Link videos use poster + click-to-inject iframe (Swiper otherwise blocks nested iframe UX).
 */
(function () {
  'use strict';

  if (window.__xtuStorySliderInit) return;
  window.__xtuStorySliderInit = true;

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

  function stopYoutubeStage(stage) {
    if (!stage) return;
    var iframe = stage.querySelector('iframe[data-xtu-story-yt-iframe]');
    if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
    stage.classList.remove('swiper-no-swiping');
    var card = stage.closest('[data-xtu-story-card]');
    if (card) card.classList.remove('is-playing');
  }

  function pauseAllMedia(root, exceptCard) {
    var videos = root.querySelectorAll('.xtu-story-slider__video');
    Array.prototype.forEach.call(videos, function (video) {
      var card = video.closest('[data-xtu-story-card]');
      if (exceptCard && card === exceptCard) return;
      video.pause();
      if (card) card.classList.remove('is-playing');
    });

    var stages = root.querySelectorAll('[data-xtu-story-yt]');
    Array.prototype.forEach.call(stages, function (stage) {
      var card = stage.closest('[data-xtu-story-card]');
      if (exceptCard && card === exceptCard) return;
      stopYoutubeStage(stage);
    });
  }

  function visibleHostedVideo(card) {
    var videos = card.querySelectorAll('.xtu-story-slider__video');
    var video = videos[0] || null;
    Array.prototype.forEach.call(videos, function (node) {
      if (window.getComputedStyle(node).display === 'none') return;
      video = node;
    });
    return video;
  }

  function bindHostedVideoCards(root) {
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
        var video = visibleHostedVideo(card);
        if (!video) return;
        if (video.paused) {
          pauseAllMedia(root, card);
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

      if (playBtn) playBtn.addEventListener('click', togglePlay);

      Array.prototype.forEach.call(videos, function (video) {
        video.addEventListener('click', togglePlay);
        video.addEventListener('ended', function () {
          card.classList.remove('is-playing');
        });
        video.addEventListener('pause', function () {
          if (video.paused) card.classList.remove('is-playing');
        });
        video.addEventListener('play', function () {
          card.classList.add('is-playing');
        });
      });
    });
  }

  function embedSrc(embedType, embedId) {
    if (!embedId) return '';
    if (embedType === 'vimeo') {
      return (
        'https://player.vimeo.com/video/' +
        encodeURIComponent(embedId) +
        '?autoplay=1&dnt=1'
      );
    }
    return (
      'https://www.youtube.com/embed/' +
      encodeURIComponent(embedId) +
      '?autoplay=1&rel=0&modestbranding=1&playsinline=1'
    );
  }

  function bindYoutubeCards(root) {
    var cards = root.querySelectorAll('[data-xtu-story-card][data-media-type="youtube"]');
    Array.prototype.forEach.call(cards, function (card) {
      if (card.getAttribute('data-xtu-story-yt-bound') === 'true') return;
      card.setAttribute('data-xtu-story-yt-bound', 'true');

      var stage = card.querySelector('[data-xtu-story-yt]');
      var playBtn = card.querySelector('[data-xtu-story-play]');
      if (!stage || !playBtn) return;

      function startEmbed(event) {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        if (card.classList.contains('is-playing')) return;

        var embedId = stage.getAttribute('data-embed-id') || '';
        var embedType = stage.getAttribute('data-embed-type') || 'youtube';
        var src = embedSrc(embedType, embedId);
        if (!src) return;

        pauseAllMedia(root, card);

        var iframe = document.createElement('iframe');
        iframe.className = 'xtu-story-slider__yt-iframe';
        iframe.setAttribute('data-xtu-story-yt-iframe', '');
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute(
          'allow',
          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
        );
        iframe.setAttribute('title', playBtn.getAttribute('aria-label') || 'Video');
        iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        iframe.src = src;
        stage.appendChild(iframe);
        stage.classList.add('swiper-no-swiping');
        card.classList.add('is-playing');
      }

      playBtn.addEventListener('click', startEmbed);
      stage.addEventListener('click', function (event) {
        if (event.target.closest('[data-xtu-story-play]')) return;
        if (card.classList.contains('is-playing')) return;
        startEmbed(event);
      });
    });
  }

  function destroy(root) {
    var inst = instances.get(root);
    if (inst) {
      if (inst.swiper && typeof inst.swiper.destroy === 'function') {
        try {
          inst.swiper.destroy(true, true);
        } catch (err) {
          /* ignore */
        }
      }
      if (inst.onResize) window.removeEventListener('resize', inst.onResize);
      instances.delete(root);
    }

    var container = root && root.querySelector ? root.querySelector('[data-xtu-story-swiper]') : null;
    if (container && container.swiper && typeof container.swiper.destroy === 'function') {
      try {
        container.swiper.destroy(true, true);
      } catch (err) {
        /* ignore */
      }
    }
  }

  function initRoot(root) {
    if (!(root instanceof HTMLElement)) return;
    destroy(root);

    var container = root.querySelector('[data-xtu-story-swiper]');
    if (!container) return;

    var gapDesktop = Number(root.getAttribute('data-gap') || 16);
    var gapMobile = Number(root.getAttribute('data-gap-mobile') || 8);
    var prevEl = root.querySelector('[data-xtu-story-prev]');
    var nextEl = root.querySelector('[data-xtu-story-next]');
    var inset = readInset(root);
    var slideCount = container.querySelectorAll('.swiper-slide').length;
    if (slideCount < 1) return;

    var swiper = new window.Swiper(container, {
      slidesPerView: 1.1,
      spaceBetween: gapMobile,
      slidesPerGroup: 1,
      slidesOffsetBefore: inset,
      slidesOffsetAfter: inset,
      speed: 550,
      watchOverflow: true,
      grabCursor: slideCount > 1,
      noSwipingSelector: 'iframe, button, a, [data-xtu-story-play], .swiper-no-swiping',
      mousewheel: {
        forceToAxis: true,
        releaseOnEdges: true,
      },
      navigation:
        prevEl && nextEl && slideCount > 1
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
          pauseAllMedia(root, null);
        },
      },
    });

    bindHostedVideoCards(root);
    bindYoutubeCards(root);

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
        try {
          initRoot(root);
        } catch (err) {
          if (typeof console !== 'undefined' && console.error) {
            console.error('[xtu-story-slider] init failed', err);
          }
        }
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
          applyInset(inst.swiper, root);
        } catch (_) {}
      }
    });
  });

  document.addEventListener('shopify:section:load', function (event) {
    boot(event.target);
  });

  document.addEventListener('shopify:section:unload', function (event) {
    var root = event.target.querySelector
      ? event.target.querySelector('[data-xtu-story-slider]')
      : null;
    if (!root && event.target && event.target.hasAttribute && event.target.hasAttribute('data-xtu-story-slider')) {
      root = event.target;
    }
    if (root) destroy(root);
  });
})();
