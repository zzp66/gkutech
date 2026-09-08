/**
 * XTU product gallery — Swiper main/thumbs/zoom with loop, Photos/Videos tabs, variant morph re-init.
 */
(() => {
  const SELECTOR = 'media-gallery.xtu-media-gallery';
  const instances = new WeakMap();

  /**
   * @param {() => void} cb
   */
  function whenSwiperReady(cb) {
    if (typeof window.Swiper !== 'undefined') {
      cb();
      return;
    }
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (typeof window.Swiper !== 'undefined' || tries > 40) {
        clearInterval(timer);
        if (typeof window.Swiper !== 'undefined') cb();
      }
    }, 50);
  }

  /**
   * @param {string | undefined} mediaKind
   * @param {'photo' | 'video'} filterKind
   */
  function matchesKind(mediaKind, filterKind) {
    if (filterKind === 'video') return mediaKind === 'video';
    return mediaKind === 'photo' || mediaKind === 'model';
  }

  /**
   * @param {import('swiper').Swiper | null | undefined} swiper
   */
  function destroySwiper(swiper) {
    if (swiper && typeof swiper.destroy === 'function') {
      try {
        swiper.destroy(true, true);
      } catch {
        /* already destroyed */
      }
    }
  }

  /**
   * @param {HTMLElement} root
   * @param {number} realIndex
   */
  function syncThumbButtons(root, realIndex) {
    const slides = Array.from(root.querySelectorAll('.swiper-wrapper > .swiper-slide[data-xtu-media-kind]'));
    slides.forEach((slide, index) => {
      const btn = slide.querySelector('.xtu-pdp-thumbs__btn, .xtu-zoom-dialog__thumb-btn');
      if (!(btn instanceof HTMLElement)) return;
      btn.setAttribute('aria-selected', index === realIndex ? 'true' : 'false');
    });
  }

  /**
   * @param {HTMLElement} gallery
   * @param {number} realIndex
   * @param {number} total
   */
  function syncCounter(gallery, realIndex, total) {
    const current = Math.max(1, realIndex + 1);
    const totalSafe = Math.max(1, total);
    gallery.querySelectorAll('[data-xtu-counter-current], [data-xtu-zoom-counter-current]').forEach((el) => {
      el.textContent = String(current);
    });
    gallery.querySelectorAll('[data-xtu-counter-total], [data-xtu-zoom-counter-total]').forEach((el) => {
      el.textContent = String(totalSafe);
    });
  }

  /**
   * @param {HTMLElement} swiperEl
   * @param {number} realIndex
   */
  function pauseInactiveVideos(swiperEl, realIndex) {
    const slides = Array.from(swiperEl.querySelectorAll('.swiper-wrapper > .swiper-slide[data-xtu-media-kind]'));
    slides.forEach((slide, index) => {
      if (!(slide instanceof HTMLElement) || index === realIndex) return;
      slide.querySelectorAll('video').forEach((video) => {
        if (video instanceof HTMLVideoElement && !video.paused) video.pause();
      });
    });
  }

  /**
   * @param {HTMLElement} gallery
   * @returns {HTMLElement}
   */
  function getSlideStash(gallery) {
    let stash = gallery.querySelector('[data-xtu-slide-stash]');
    if (!(stash instanceof HTMLElement)) {
      stash = document.createElement('div');
      stash.hidden = true;
      stash.setAttribute('data-xtu-slide-stash', '');
      gallery.appendChild(stash);
    }
    return stash;
  }

  /**
   * Restore every original slide into its swiper-wrapper in media-index order.
   * @param {HTMLElement} gallery
   */
  function restoreSlides(gallery) {
    const stash = getSlideStash(gallery);
    const roots = [
      gallery.querySelector('[data-xtu-pdp-main]'),
      gallery.querySelector('[data-xtu-pdp-thumbs]'),
      gallery.querySelector('[data-xtu-pdp-zoom]'),
      gallery.querySelector('[data-xtu-pdp-zoom-thumbs]'),
    ].filter((el) => el instanceof HTMLElement);

    roots.forEach((root) => {
      const wrapper = root.querySelector('.swiper-wrapper');
      if (!(wrapper instanceof HTMLElement)) return;
      const key = root.getAttribute('data-xtu-pdp-main') != null
        ? 'main'
        : root.getAttribute('data-xtu-pdp-thumbs') != null
          ? 'thumbs'
          : root.getAttribute('data-xtu-pdp-zoom') != null
            ? 'zoom'
            : 'zoom-thumbs';

      const fromStash = Array.from(stash.querySelectorAll(`[data-xtu-stash-owner="${key}"]`));
      fromStash.forEach((slide) => {
        slide.removeAttribute('data-xtu-stash-owner');
        wrapper.appendChild(slide);
      });

      const slides = Array.from(wrapper.querySelectorAll(':scope > .swiper-slide[data-xtu-media-kind]'));
      slides
        .sort((a, b) => Number(a.dataset.xtuMediaIndex) - Number(b.dataset.xtuMediaIndex))
        .forEach((slide) => wrapper.appendChild(slide));
    });
  }

  /**
   * @param {HTMLElement} gallery
   * @param {'photo' | 'video' | 'all'} filter
   */
  function applyFilter(gallery, filter) {
    destroySwipersOnly(gallery);
    restoreSlides(gallery);

    if (filter === 'all') return;

    const stash = getSlideStash(gallery);
    const roots = [
      ['main', gallery.querySelector('[data-xtu-pdp-main]')],
      ['thumbs', gallery.querySelector('[data-xtu-pdp-thumbs]')],
      ['zoom', gallery.querySelector('[data-xtu-pdp-zoom]')],
      ['zoom-thumbs', gallery.querySelector('[data-xtu-pdp-zoom-thumbs]')],
    ];

    roots.forEach(([key, root]) => {
      if (!(root instanceof HTMLElement)) return;
      const wrapper = root.querySelector('.swiper-wrapper');
      if (!(wrapper instanceof HTMLElement)) return;
      Array.from(wrapper.querySelectorAll(':scope > .swiper-slide[data-xtu-media-kind]')).forEach((slide) => {
        if (!(slide instanceof HTMLElement)) return;
        if (matchesKind(slide.dataset.xtuMediaKind, filter)) return;
        slide.setAttribute('data-xtu-stash-owner', key);
        stash.appendChild(slide);
      });
    });
  }

  /**
   * @param {HTMLElement} gallery
   * @returns {number}
   */
  function visibleSlideCount(gallery) {
    const main = gallery.querySelector('[data-xtu-pdp-main]');
    if (!main) return 0;
    return main.querySelectorAll('.swiper-wrapper > .swiper-slide[data-xtu-media-kind]').length;
  }

  /**
   * Destroy only Swiper instances (keep gallery event bindings).
   * @param {HTMLElement} gallery
   */
  function destroySwipersOnly(gallery) {
    const state = instances.get(gallery);
    if (!state) return;
    destroySwiper(state.main);
    destroySwiper(state.thumbs);
    destroySwiper(state.zoom);
    destroySwiper(state.zoomThumbs);
    state.main = null;
    state.thumbs = null;
    state.zoom = null;
    state.zoomThumbs = null;
  }

  /**
   * @param {HTMLElement} gallery
   * @param {number} [startIndex]
   */
  function buildSwipers(gallery, startIndex = 0) {
    const Swiper = window.Swiper;
    if (typeof Swiper === 'undefined') return;

    destroySwipersOnly(gallery);

    const mainEl = gallery.querySelector('[data-xtu-pdp-main]');
    if (!(mainEl instanceof HTMLElement)) return;

    const thumbsEl = gallery.querySelector('[data-xtu-pdp-thumbs]');
    const prevEl = gallery.querySelector('[data-xtu-gallery-prev]');
    const nextEl = gallery.querySelector('[data-xtu-gallery-next]');
    const zoomPrev = gallery.querySelector('[data-xtu-zoom-prev]');
    const zoomNext = gallery.querySelector('[data-xtu-zoom-next]');
    const zoomThumbsEl = gallery.querySelector('[data-xtu-pdp-zoom-thumbs]');

    const visibleCount = visibleSlideCount(gallery);
    const canLoop = visibleCount > 1;
    const safeIndex = Math.min(Math.max(0, startIndex), Math.max(0, visibleCount - 1));

    if (thumbsEl instanceof HTMLElement) {
      thumbsEl.hidden = visibleCount <= 1;
    }
    if (zoomThumbsEl instanceof HTMLElement) {
      const zoomThumbsWrap = zoomThumbsEl.closest('.xtu-zoom-dialog__thumbs');
      if (zoomThumbsWrap instanceof HTMLElement) zoomThumbsWrap.hidden = visibleCount <= 1;
    }
    [prevEl, nextEl, zoomPrev, zoomNext].forEach((el) => {
      if (el instanceof HTMLElement) el.hidden = visibleCount <= 1;
    });
    const counters = gallery.querySelectorAll('[data-xtu-pdp-counter], [data-xtu-zoom-counter]');
    counters.forEach((el) => {
      if (el instanceof HTMLElement) el.hidden = visibleCount <= 1;
    });

    /** @type {import('swiper').Swiper | null} */
    let thumbs = null;
    if (thumbsEl instanceof HTMLElement && visibleCount > 1) {
      thumbs = new Swiper(thumbsEl, {
        slidesPerView: 'auto',
        spaceBetween: 8,
        watchSlidesProgress: true,
        slideToClickedSlide: true,
        centerInsufficientSlides: true,
        resistanceRatio: 0,
        watchOverflow: true,
      });
    }

    // Zoom / zoom-thumbs Swipers are created lazily on first open (see ensureZoomSwipers).

    const main = new Swiper(mainEl, {
      loop: canLoop,
      speed: 350,
      slidesPerView: 1,
      spaceBetween: 0,
      resistanceRatio: 0,
      watchOverflow: true,
      grabCursor: canLoop,
      simulateTouch: true,
      allowTouchMove: visibleCount > 1,
      mousewheel: {
        enabled: true,
        forceToAxis: true,
        sensitivity: 1,
        releaseOnEdges: true,
      },
      navigation:
        prevEl && nextEl
          ? {
              prevEl,
              nextEl,
            }
          : undefined,
      thumbs: thumbs
        ? {
            swiper: thumbs,
          }
        : undefined,
      on: {
        sliderFirstMove() {
          const state = instances.get(gallery);
          if (state) state.didSwipe = true;
        },
        touchEnd() {
          const state = instances.get(gallery);
          if (!state) return;
          window.setTimeout(() => {
            state.didSwipe = false;
          }, 120);
        },
        slideChange(swiper) {
          syncCounter(gallery, swiper.realIndex, visibleCount);
          if (thumbsEl instanceof HTMLElement) syncThumbButtons(thumbsEl, swiper.realIndex);
          pauseInactiveVideos(mainEl, swiper.realIndex);
        },
      },
    });

    const state = instances.get(gallery) || {};
    state.main = main;
    state.thumbs = thumbs;
    state.zoom = state.zoom || null;
    state.zoomThumbs = state.zoomThumbs || null;
    state.visibleCount = visibleCount;
    state.canLoop = canLoop;
    instances.set(gallery, state);

    goTo(gallery, safeIndex, false);
    syncCounter(gallery, safeIndex, visibleCount);
    if (thumbsEl instanceof HTMLElement) syncThumbButtons(thumbsEl, safeIndex);
  }

  /**
   * Lazily create zoom Swipers on first zoom open.
   * @param {HTMLElement} gallery
   */
  function ensureZoomSwipers(gallery) {
    const Swiper = window.Swiper;
    const state = instances.get(gallery);
    if (typeof Swiper === 'undefined' || !state?.main || state.zoom) return;

    const zoomEl = gallery.querySelector('[data-xtu-pdp-zoom]');
    const zoomThumbsEl = gallery.querySelector('[data-xtu-pdp-zoom-thumbs]');
    const zoomPrev = gallery.querySelector('[data-xtu-zoom-prev]');
    const zoomNext = gallery.querySelector('[data-xtu-zoom-next]');
    const visibleCount = state.visibleCount || visibleSlideCount(gallery);
    const canLoop = Boolean(state.canLoop);

    /** @type {import('swiper').Swiper | null} */
    let zoomThumbs = null;
    if (zoomThumbsEl instanceof HTMLElement && visibleCount > 1) {
      zoomThumbs = new Swiper(zoomThumbsEl, {
        slidesPerView: 'auto',
        spaceBetween: 10,
        watchSlidesProgress: true,
        slideToClickedSlide: true,
        centerInsufficientSlides: true,
        resistanceRatio: 0,
        watchOverflow: true,
      });
    }

    if (!(zoomEl instanceof HTMLElement)) return;

    const zoom = new Swiper(zoomEl, {
      loop: canLoop,
      speed: 350,
      slidesPerView: 1,
      spaceBetween: 0,
      resistanceRatio: 0,
      watchOverflow: true,
      grabCursor: canLoop,
      simulateTouch: true,
      allowTouchMove: visibleCount > 1,
      mousewheel: {
        enabled: true,
        forceToAxis: true,
        sensitivity: 1,
        releaseOnEdges: true,
      },
      navigation:
        zoomPrev && zoomNext
          ? {
              prevEl: zoomPrev,
              nextEl: zoomNext,
            }
          : undefined,
      thumbs: zoomThumbs
        ? {
            swiper: zoomThumbs,
          }
        : undefined,
      on: {
        slideChange(swiper) {
          syncCounter(gallery, swiper.realIndex, visibleCount);
          if (zoomThumbsEl instanceof HTMLElement) syncThumbButtons(zoomThumbsEl, swiper.realIndex);
          pauseInactiveVideos(zoomEl, swiper.realIndex);
        },
      },
    });

    state.zoom = zoom;
    state.zoomThumbs = zoomThumbs;
  }

  /**
   * @param {HTMLElement} gallery
   * @param {number} index
   * @param {boolean} [animate]
   */
  function goTo(gallery, index, animate = true) {
    const state = instances.get(gallery);
    if (!state?.main) return;
    const speed = animate ? 350 : 0;
    const { main, zoom, canLoop } = state;
    if (canLoop && typeof main.slideToLoop === 'function') main.slideToLoop(index, speed);
    else main.slideTo(index, speed);
    if (zoom) {
      if (canLoop && typeof zoom.slideToLoop === 'function') zoom.slideToLoop(index, 0);
      else zoom.slideTo(index, 0);
    }
  }

  /**
   * @param {HTMLElement} gallery
   * @param {number} index
   */
  function openZoom(gallery, index) {
    ensureZoomSwipers(gallery);
    const state = instances.get(gallery);
    const zoomDialog = gallery.querySelector('[data-xtu-zoom-dialog]');
    if (!(zoomDialog instanceof HTMLDialogElement) || !state?.zoom) return;

    goTo(gallery, index, false);
    if (!zoomDialog.open) {
      zoomDialog.showModal();
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    }
    requestAnimationFrame(() => {
      state.zoom?.update();
      goTo(gallery, index, false);
    });
  }

  /**
   * @param {HTMLElement} gallery
   */
  function closeZoom(gallery) {
    const state = instances.get(gallery);
    const zoomDialog = gallery.querySelector('[data-xtu-zoom-dialog]');
    if (!(zoomDialog instanceof HTMLDialogElement) || !zoomDialog.open) return;
    const idx = state?.zoom?.realIndex ?? state?.main?.realIndex ?? 0;
    zoomDialog.close();
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    goTo(gallery, idx, false);
  }

  /**
   * @param {HTMLElement} gallery
   */
  function bindGalleryEvents(gallery) {
    /** Drag vs click: avoid opening zoom after a swipe on the main gallery. */
    let pointerStart = /** @type {{ x: number, y: number } | null} */ (null);
    let pointerMoved = false;
    const DRAG_THRESHOLD = 8;

    gallery.addEventListener(
      'pointerdown',
      (event) => {
        if (!(event instanceof PointerEvent)) return;
        if (!(event.target instanceof Element)) return;
        if (!event.target.closest('[data-xtu-pdp-main] [data-xtu-zoom-open]')) return;
        pointerStart = { x: event.clientX, y: event.clientY };
        pointerMoved = false;
      },
      true
    );

    gallery.addEventListener(
      'pointermove',
      (event) => {
        if (!(event instanceof PointerEvent) || !pointerStart) return;
        if (
          Math.abs(event.clientX - pointerStart.x) > DRAG_THRESHOLD ||
          Math.abs(event.clientY - pointerStart.y) > DRAG_THRESHOLD
        ) {
          pointerMoved = true;
        }
      },
      true
    );

    gallery.addEventListener(
      'pointerup',
      () => {
        /* keep pointerMoved until click handler reads it */
        window.setTimeout(() => {
          pointerStart = null;
          pointerMoved = false;
        }, 0);
      },
      true
    );

    gallery.addEventListener(
      'pointercancel',
      () => {
        pointerStart = null;
        pointerMoved = false;
      },
      true
    );

    gallery.addEventListener(
      'click',
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const openEl = target.closest('[data-xtu-zoom-open]');
        if (openEl instanceof HTMLElement && gallery.contains(openEl)) {
          const state = instances.get(gallery);
          // Swipe / drag should change slides, not open zoom
          if (pointerMoved || state?.didSwipe) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          event.preventDefault();
          const slide = openEl.closest('.swiper-slide');
          const mainEl = gallery.querySelector('[data-xtu-pdp-main]');
          let index = state?.main?.realIndex || 0;
          if (slide instanceof HTMLElement && mainEl instanceof HTMLElement) {
            const slides = Array.from(
              mainEl.querySelectorAll('.swiper-wrapper > .swiper-slide[data-xtu-media-kind]')
            );
            const pos = slides.indexOf(slide);
            if (pos >= 0) index = pos;
          }
          openZoom(gallery, index);
          return;
        }

        if (target.closest('[data-xtu-zoom-close], [data-xtu-zoom-close-media]')) {
          event.preventDefault();
          closeZoom(gallery);
        }
      },
      true
    );

    gallery.addEventListener('keydown', (event) => {
      if (!(event instanceof KeyboardEvent)) return;
      const zoomDialog = gallery.querySelector('[data-xtu-zoom-dialog]');
      if (event.key === 'Escape' && zoomDialog instanceof HTMLDialogElement && zoomDialog.open) {
        event.preventDefault();
        closeZoom(gallery);
        return;
      }
      const openEl = event.target;
      if (
        event.key === 'Enter' &&
        openEl instanceof HTMLElement &&
        openEl.hasAttribute('data-xtu-zoom-open')
      ) {
        const state = instances.get(gallery);
        event.preventDefault();
        openZoom(gallery, Number(openEl.dataset.xtuZoomOpen) || state?.main?.realIndex || 0);
      }
    });

    const zoomDialog = gallery.querySelector('[data-xtu-zoom-dialog]');
    if (zoomDialog instanceof HTMLDialogElement) {
      zoomDialog.addEventListener('click', (event) => {
        if (event.target === zoomDialog) closeZoom(gallery);
      });
      zoomDialog.addEventListener('close', () => {
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
      });
    }

    const tabs = gallery.querySelectorAll('[data-xtu-media-tab]');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        if (!(tab instanceof HTMLElement)) return;
        const kind = tab.dataset.xtuMediaTab === 'video' ? 'video' : 'photo';
        tabs.forEach((t) => t.setAttribute('aria-selected', t === tab ? 'true' : 'false'));
        applyFilter(gallery, kind);
        buildSwipers(gallery, 0);
      });
    });

    /**
     * @param {number} index
     */
    gallery.select = (index) => {
      goTo(gallery, Number(index) || 0, false);
    };
  }

  /**
   * @param {HTMLElement} gallery
   */
  function initGallery(gallery) {
    if (gallery.dataset.xtuGalleryReady === 'true') return;

    const shell = gallery.querySelector('[data-xtu-pdp-gallery]');
    if (!shell) return;

    gallery.dataset.xtuGalleryReady = 'true';

    whenSwiperReady(() => {
      applyFilter(gallery, 'all');
      instances.set(gallery, {});
      bindGalleryEvents(gallery);
      buildSwipers(gallery, 0);
    });
  }

  /**
   * @param {ParentNode} [root]
   */
  function mount(root = document) {
    root.querySelectorAll(SELECTOR).forEach((gallery) => {
      if (gallery instanceof HTMLElement) initGallery(gallery);
    });
  }

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  onReady(() => whenSwiperReady(() => mount()));

  document.addEventListener('shopify:section:load', (event) => {
    if (event.target instanceof Element) mount(event.target);
  });

  const bodyObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches?.(SELECTOR)) initGallery(/** @type {HTMLElement} */ (node));
        else if (node.querySelector?.(SELECTOR)) mount(node);
      });
    }
  });
  // Scope to main content to avoid scanning the whole document on every cart/drawer morph.
  const observeRoot =
    document.getElementById('MainContent') ||
    document.querySelector('main') ||
    document.body;
  bodyObserver.observe(observeRoot, { childList: true, subtree: true });
})();
