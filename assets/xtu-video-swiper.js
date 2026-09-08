/**
 * XTU Video Swiper
 *
 * 全宽居中：slidesPerView auto，卡片宽度由 CSS min(max, %) 控制（DJI 式 peek）。
 * 仅激活 slide 播放上传视频 / 注入 YouTube·Vimeo 静音循环 iframe。
 * 不使用 Swiper 自带 loop/navigation/pagination。
 * 首尾各复制一张真实 slide，切过边界后瞬时跳回对应真 slide，实现 DJI 式无缝循环。
 * 滚到版块前预加载当前与左右邻张；切卡只播已缓冲视频，避免卡顿。
 */
(function initXtuVideoSwiper() {
  'use strict';

  var instances = new WeakMap();

  function playableVideoUrl(url) {
    var str = String(url || '').trim();
    if (!str) return '';
    if (/\.m3u8(\?|#|$)/i.test(str)) return '';
    if (str.indexOf('//') === 0) str = (window.location.protocol || 'https:') + str;
    return str;
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

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function sectionOnScreen(el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return false;
    var rect = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    var vw = window.innerWidth || document.documentElement.clientWidth || 0;
    return rect.bottom > 80 && rect.top < vh - 80 && rect.right > 0 && rect.left < vw;
  }

  function visibleVideos(slide) {
    if (!slide) return [];
    var mobile = window.matchMedia('(max-width: 749px)').matches;
    var split = slide.querySelector('.xtu-vs__media--split');
    var nodes = slide.querySelectorAll('video.xtu-vs__video');
    var list = [];
    Array.prototype.forEach.call(nodes, function (video) {
      if (split) {
        var isMobile = video.classList.contains('xtu-vs__video--mobile');
        if (mobile === isMobile) list.push(video);
      } else {
        list.push(video);
      }
    });
    return list;
  }

  function pauseSlide(slide, unloadEmbed) {
    if (!slide) return;
    Array.prototype.forEach.call(slide.querySelectorAll('video.xtu-vs__video'), function (video) {
      video.pause();
    });
    if (unloadEmbed) {
      var iframe = slide.querySelector('iframe.xtu-vs__iframe');
      if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }
    var card = slide.querySelector('.xtu-vs__card');
    if (card) card.classList.remove('is-playing');
  }

  function ensureVideoSrc(video) {
    if (!video) return false;
    var source = video.querySelector('source');
    var url = playableVideoUrl((source && source.getAttribute('src')) || video.getAttribute('src') || '');
    if (!url) return false;
    if (video.getAttribute('src') !== url) video.setAttribute('src', url);
    return true;
  }

  function warmVideo(video) {
    if (!ensureVideoSrc(video)) return;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute('webkit-playsinline', '');
    video.preload = 'auto';
    if (video.dataset.xtuVsWarm === '1') return;
    video.dataset.xtuVsWarm = '1';
    try {
      video.load();
    } catch (_error) {
      /* ignore */
    }
  }

  function warmSlide(slide) {
    Array.prototype.forEach.call(visibleVideos(slide), warmVideo);
  }

  function warmAll(root) {
    if (!root) return;
    Array.prototype.forEach.call(root.querySelectorAll('.swiper-slide'), warmSlide);
  }

  function markPlaying(slide) {
    var card = slide && slide.querySelector('.xtu-vs__card');
    if (card) card.classList.add('is-playing');
  }

  function playHosted(slide) {
    var videos = visibleVideos(slide);
    var played = false;
    Array.prototype.forEach.call(videos, function (video) {
      warmVideo(video);
      function onPlaying() {
        markPlaying(slide);
      }
      video.addEventListener('playing', onPlaying, { once: true });
      function tryPlay() {
        var playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(function () {});
        }
        if (!video.paused) markPlaying(slide);
      }
      tryPlay();
      if (video.readyState < 2) {
        video.addEventListener('canplay', tryPlay, { once: true });
      }
      played = true;
    });
    return played;
  }

  function playEmbed(slide) {
    var card = slide.querySelector('.xtu-vs__card');
    var media = slide.querySelector('[data-xtu-vs-media]');
    if (!card || !media) return false;
    var embedId = String(media.getAttribute('data-embed-id') || '').trim();
    var embedType = String(media.getAttribute('data-embed-type') || 'youtube').trim();
    if (!embedId) return false;
    if (media.querySelector('iframe.xtu-vs__iframe')) return true;

    var iframe = document.createElement('iframe');
    iframe.className = 'xtu-vs__iframe';
    iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('title', media.getAttribute('data-title') || 'Video');
    if (embedType === 'vimeo') {
      iframe.src =
        'https://player.vimeo.com/video/' +
        encodeURIComponent(embedId) +
        '?autoplay=1&muted=1&loop=1&background=1';
    } else {
      iframe.src =
        'https://www.youtube.com/embed/' +
        encodeURIComponent(embedId) +
        '?autoplay=1&mute=1&loop=1&playlist=' +
        encodeURIComponent(embedId) +
        '&controls=0&rel=0&modestbranding=1&playsinline=1';
    }
    media.appendChild(iframe);
    return true;
  }

  function stripLoopClones(wrapper) {
    if (!wrapper) return;
    Array.prototype.forEach.call(wrapper.querySelectorAll('[data-xtu-vs-clone]'), function (node) {
      if (node.parentNode) node.parentNode.removeChild(node);
    });
  }

  function cleanClone(node) {
    node.setAttribute('data-xtu-vs-clone', 'true');
    node.removeAttribute('id');
    node.removeAttribute('data-swiper-slide-index');
    node.removeAttribute('data-shopify-editor-block');
    Array.prototype.forEach.call(node.querySelectorAll('[id]'), function (el) {
      el.removeAttribute('id');
    });
    return node;
  }

  function prepareLoopClones(wrapper) {
    stripLoopClones(wrapper);
    var originals = Array.prototype.slice.call(
      wrapper.querySelectorAll('.swiper-slide:not([data-xtu-vs-clone])')
    );
    if (originals.length < 2) return originals.length;
    var head = cleanClone(originals[originals.length - 1].cloneNode(true));
    var tail = cleanClone(originals[0].cloneNode(true));
    wrapper.insertBefore(head, originals[0]);
    wrapper.appendChild(tail);
    return originals.length;
  }

  function mappedIndex(swiper, originalCount) {
    if (!swiper || originalCount < 2) return swiper ? swiper.activeIndex || 0 : 0;
    var idx = swiper.activeIndex || 0;
    if (idx <= 0) return originalCount - 1;
    if (idx >= originalCount + 1) return 0;
    return idx - 1;
  }

  function syncActive(root, swiper, originalCount, flags) {
    flags = flags || {};
    var shouldPlay = !!flags.play;
    var slides = root.querySelectorAll('.swiper-slide:not([data-xtu-vs-clone])');
    var realIndex = mappedIndex(swiper, originalCount);
    var active = swiper.slides && swiper.slides[swiper.activeIndex];

    warmAll(root);

    Array.prototype.forEach.call(root.querySelectorAll('.swiper-slide'), function (slide) {
      if (slide === active && shouldPlay && !prefersReducedMotion()) return;
      pauseSlide(slide, slide !== active);
    });

    Array.prototype.forEach.call(slides, function (slide, index) {
      slide.setAttribute('aria-hidden', index === realIndex ? 'false' : 'true');
    });

    if (!active) return;
    if (!shouldPlay || prefersReducedMotion()) return;

    var played = playHosted(active);
    if (!played) {
      played = playEmbed(active);
      if (played) markPlaying(active);
    }
  }

  function unlockSwiper(swiper) {
    if (!swiper) return;
    swiper.allowSlideNext = true;
    swiper.allowSlidePrev = true;
    if (swiper.el) {
      swiper.el.classList.remove('swiper-locked');
    }
  }

  function goToReal(swiper, originalCount, index, speed) {
    if (!swiper || originalCount < 1) return;
    var target = ((index % originalCount) + originalCount) % originalCount;
    unlockSwiper(swiper);
    if (originalCount < 2) {
      swiper.slideTo(target, speed);
      return;
    }
    swiper.slideTo(target + 1, speed);
  }

  function goDir(swiper, dir) {
    unlockSwiper(swiper);
    if (dir > 0) swiper.slideNext();
    else swiper.slidePrev();
  }

  function renderPager(pagerEl, originalCount, swiper) {
    if (!pagerEl) return;
    pagerEl.innerHTML = '';
    if (originalCount < 2) return;

    var current = mappedIndex(swiper, originalCount);
    for (var i = 0; i < originalCount; i += 1) {
      var bullet = document.createElement('button');
      bullet.type = 'button';
      bullet.className = 'xtu-vs__bullet' + (i === current ? ' is-active' : '');
      bullet.setAttribute('aria-label', 'Go to slide ' + (i + 1));
      bullet.setAttribute('aria-current', i === current ? 'true' : 'false');
      bullet.addEventListener('click', function (index) {
        return function (event) {
          event.preventDefault();
          event.stopPropagation();
          goToReal(swiper, originalCount, index);
        };
      }(i));
      pagerEl.appendChild(bullet);
    }
  }

  function updatePager(pagerEl, swiper, originalCount) {
    if (!pagerEl) return;
    var current = mappedIndex(swiper, originalCount);
    var bullets = pagerEl.querySelectorAll('.xtu-vs__bullet');
    Array.prototype.forEach.call(bullets, function (bullet, index) {
      var on = index === current;
      bullet.classList.toggle('is-active', on);
      bullet.setAttribute('aria-current', on ? 'true' : 'false');
    });
  }

  function bindNav(el, swiper, dir) {
    if (!el || !el.parentNode) return;
    var fresh = el.cloneNode(true);
    el.parentNode.replaceChild(fresh, el);
    fresh.classList.remove('swiper-button-disabled', 'swiper-button-lock');
    fresh.removeAttribute('disabled');
    fresh.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      goDir(swiper, dir);
    });
  }

  function bindFirstFrame(root) {
    var posters = root.querySelectorAll('video.xtu-vs__cover-fallback');
    Array.prototype.forEach.call(posters, function (video) {
      var src = playableVideoUrl(video.getAttribute('data-src') || video.getAttribute('src') || '');
      if (!src) return;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';
      if (src.indexOf('#') === -1) video.src = src + '#t=0.1';
      else video.src = src;
      function freeze() {
        try {
          if (video.duration && video.currentTime < 0.05) {
            video.currentTime = Math.min(0.15, Math.max(0.05, video.duration * 0.01));
          }
        } catch (_error) {
          /* ignore */
        }
        video.pause();
      }
      video.addEventListener('loadedmetadata', freeze);
      video.addEventListener('loadeddata', freeze);
    });
  }

  function destroy(root) {
    var inst = instances.get(root);
    if (!inst) return;
    if (inst.observer) inst.observer.disconnect();
    if (inst.swiper && typeof inst.swiper.destroy === 'function') {
      inst.swiper.destroy(true, true);
    }
    var wrapper = root.querySelector('.swiper-wrapper');
    stripLoopClones(wrapper);
    if (inst.onResize) window.removeEventListener('resize', inst.onResize);
    instances.delete(root);
  }

  function initRoot(root) {
    if (!root) return;
    destroy(root);

    var container = root.querySelector('[data-xtu-vs-swiper]');
    if (!container) return;

    var gapDesktop = Number(root.getAttribute('data-gap') || 16);
    var gapMobile = Number(root.getAttribute('data-gap-mobile') || 8);
    var autoplayMs = Number(root.getAttribute('data-autoplay') || 0);
    var prevEl = root.querySelector('[data-xtu-vs-prev]');
    var nextEl = root.querySelector('[data-xtu-vs-next]');
    var pagerEl = root.querySelector('[data-xtu-vs-pager]');
    var wrapper = container.querySelector('.swiper-wrapper');
    var originalCount = prepareLoopClones(wrapper);
    var canLoop = originalCount > 1;
    var jumping = false;
    var loopReady = false;
    var playbackLive = sectionOnScreen(root);

    function flags() {
      return { play: playbackLive };
    }

    function setPlaybackLive(next) {
      playbackLive = next;
      if (!swiper || swiper.destroyed) return;
      syncActive(root, swiper, originalCount, flags());
      if (!swiper.autoplay) return;
      if (playbackLive && autoplay) swiper.autoplay.start();
      else swiper.autoplay.stop();
    }

    function snapLoop() {
      var instSwiper = this;
      if (!loopReady || !canLoop || jumping || !instSwiper || instSwiper.destroyed) return;
      var idx = instSwiper.activeIndex;
      if (idx === 0) {
        jumping = true;
        instSwiper.slideTo(originalCount, 0);
        jumping = false;
        syncActive(root, instSwiper, originalCount, flags());
        return;
      }
      if (idx === originalCount + 1) {
        jumping = true;
        instSwiper.slideTo(1, 0);
        jumping = false;
        syncActive(root, instSwiper, originalCount, flags());
      }
    }

    bindFirstFrame(root);

    var autoplay =
      autoplayMs > 0 && canLoop && !prefersReducedMotion()
        ? {
            delay: autoplayMs,
            disableOnInteraction: false,
            pauseOnMouseEnter: true,
            stopOnLastSlide: false,
          }
        : false;

    var swiper = new window.Swiper(container, {
      slidesPerView: 'auto',
      spaceBetween: gapMobile,
      centeredSlides: true,
      centeredSlidesBounds: false,
      initialSlide: canLoop ? 1 : 0,
      loop: false,
      rewind: false,
      speed: 650,
      watchOverflow: false,
      grabCursor: canLoop,
      allowTouchMove: canLoop,
      resistanceRatio: 0.65,
      mousewheel: {
        forceToAxis: true,
        releaseOnEdges: false,
      },
      autoplay: autoplay,
      breakpoints: {
        750: {
          slidesPerView: 'auto',
          spaceBetween: gapDesktop,
        },
      },
      on: {
        init: function () {
          unlockSwiper(this);
          renderPager(pagerEl, originalCount, this);
          playbackLive = sectionOnScreen(root);
          warmAll(root);
          syncActive(root, this, originalCount, flags());
          loopReady = true;
          if (this.autoplay) {
            if (playbackLive && autoplay) this.autoplay.start();
            else this.autoplay.stop();
          }
        },
        slideChange: function () {
          unlockSwiper(this);
          updatePager(pagerEl, this, originalCount);
          if (!jumping) syncActive(root, this, originalCount, flags());
        },
        slideChangeTransitionEnd: snapLoop,
        transitionEnd: snapLoop,
      },
    });

    bindNav(prevEl, swiper, -1);
    bindNav(nextEl, swiper, 1);

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!swiper || swiper.destroyed) return;
          setPlaybackLive(entry.isIntersecting);
        });
      },
      { root: null, rootMargin: '25% 0px', threshold: 0 }
    );
    observer.observe(root);
    if (sectionOnScreen(root)) setPlaybackLive(true);

    var resizeTimer;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (swiper && !swiper.destroyed) {
          swiper.update();
          unlockSwiper(swiper);
          syncActive(root, swiper, originalCount, flags());
        }
      }, 150);
    }
    window.addEventListener('resize', onResize);

    instances.set(root, {
      swiper: swiper,
      onResize: onResize,
      observer: observer,
    });
  }

  function boot(scope) {
    var roots = (scope || document).querySelectorAll('[data-xtu-video-swiper]');
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
    var root = event.target.querySelector('[data-xtu-video-swiper]') || event.target;
    if (root && root.hasAttribute && root.hasAttribute('data-xtu-video-swiper')) {
      destroy(root);
    }
  });

  document.addEventListener('shopify:block:select', function (event) {
    var slide = event.target.closest('.swiper-slide');
    var root = event.target.closest('[data-xtu-video-swiper]');
    if (!slide || !root) return;
    var inst = instances.get(root);
    if (!inst || !inst.swiper || inst.swiper.destroyed) return;
    var originals = root.querySelectorAll('.swiper-slide:not([data-xtu-vs-clone])');
    var index = Array.prototype.indexOf.call(originals, slide);
    if (index < 0) return;
    goToReal(inst.swiper, originals.length, index);
  });
})();
