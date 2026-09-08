/**
 * XtuCam reveal via GSAP + ScrollTrigger (vendored).
 *
 * Why GSAP:
 * - Horizon scrolls inside `.page-wrapper` (html/body overflow:hidden ≥990px).
 *   ScrollTrigger supports `scroller: '.page-wrapper'`.
 *
 * Safety:
 * - Theme Editor: scripts not loaded (see scripts.liquid).
 * - CSS never pre-hides with opacity:0 — GSAP fromTo owns enter-state only.
 * - Product nav jumps call revealWithin() to clear tweens + force visible.
 *
 * Markup: data-xtu-reveal / data-xtu-stagger / data-xtu-reveal-child
 */
(function () {
  'use strict';

  var SELECTOR = '[data-xtu-reveal]';
  var REDUCE = '(prefers-reduced-motion: reduce)';
  var DURATION = 0.9;
  var STAGGER = 0.12;
  var EASE = 'power3.out';
  var START = 'top 82%';

  function isDesignMode() {
    try {
      return (
        Boolean(window.Shopify && window.Shopify.designMode) ||
        document.documentElement.classList.contains('shopify-design-mode')
      );
    } catch (_) {
      return false;
    }
  }

  function reducedMotion() {
    return window.matchMedia(REDUCE).matches;
  }

  function getScroller() {
    var wrap = document.querySelector('.page-wrapper');
    if (!wrap) return window;
    try {
      var htmlOverflow = window.getComputedStyle(document.documentElement).overflowY;
      var wrapOverflow = window.getComputedStyle(wrap).overflowY;
      if (
        (htmlOverflow === 'hidden' || htmlOverflow === 'clip') &&
        (wrapOverflow === 'auto' || wrapOverflow === 'scroll')
      ) {
        return wrap;
      }
    } catch (_) {}
    return window;
  }

  function clearElementMotion(el) {
    el.classList.add('is-revealed', 'is-revealed--instant');
    el.style.opacity = '';
    el.style.transform = '';
    el.style.visibility = '';
    el.style.pointerEvents = '';
    el.style.filter = '';

    if (window.gsap) {
      try {
        window.gsap.killTweensOf(el);
        window.gsap.set(el, { clearProps: 'transform,opacity,visibility,filter' });
      } catch (_) {}
    }
  }

  function collectRevealNodes(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var nodes = [];
    if (root && root.matches && root.matches(SELECTOR)) {
      nodes.push(root);
    }
    Array.prototype.forEach.call(scope.querySelectorAll(SELECTOR), function (el) {
      nodes.push(el);
    });
    Array.prototype.forEach.call(scope.querySelectorAll('[data-xtu-reveal-child]'), function (el) {
      nodes.push(el);
    });
    return nodes;
  }

  function clearInlineMotion(root) {
    collectRevealNodes(root).forEach(clearElementMotion);
  }

  /**
   * @param {ParentNode | Element | Document | null} [root]
   * @param {{ refresh?: boolean }} [opts]
   */
  function revealWithin(root, opts) {
    var doRefresh = !opts || opts.refresh !== false;
    var nodes = collectRevealNodes(root);

    nodes.forEach(function (el) {
      clearElementMotion(el);
      el.dataset.xtuGsapBound = '1';

      if (window.ScrollTrigger && typeof window.ScrollTrigger.getAll === 'function') {
        try {
          window.ScrollTrigger.getAll().forEach(function (st) {
            if (st && st.trigger === el) {
              st.kill(false);
            }
          });
        } catch (_) {}
      }
    });

    if (doRefresh && !isDesignMode() && window.ScrollTrigger) {
      try {
        window.ScrollTrigger.refresh();
      } catch (_) {}
    }
  }

  function revealVisible() {
    var vh = window.innerHeight || 0;
    Array.prototype.forEach.call(document.querySelectorAll(SELECTOR), function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.top < vh * 0.98 && rect.bottom > -40) {
        clearElementMotion(el);
        el.dataset.xtuGsapBound = '1';
        if (window.ScrollTrigger && typeof window.ScrollTrigger.getAll === 'function') {
          try {
            window.ScrollTrigger.getAll().forEach(function (st) {
              if (st && st.trigger === el) st.kill(false);
            });
          } catch (_) {}
        }
      }
    });
  }

  /**
   * Stronger presets — opacity is GSAP-only (CSS keeps opacity:1 as fallback).
   * @param {Element} el
   */
  function mapPreset(el) {
    var preset = (el.getAttribute('data-xtu-reveal') || 'fade-up').trim();
    if (preset === 'scale-in') {
      return { opacity: 0, y: 0, scale: 0.92 };
    }
    if (preset === 'fade') {
      return { opacity: 0, y: 18, scale: 1 };
    }
    /* fade-up (default) */
    return { opacity: 0, y: 48, scale: 0.97 };
  }

  function staggerChildren(parent) {
    var kids = parent.querySelectorAll('[data-xtu-reveal-child]');
    if (!kids.length) {
      kids = Array.prototype.filter.call(parent.children, function (n) {
        return n.nodeType === 1;
      });
    }
    return kids;
  }

  /**
   * @param {typeof window.gsap} gsap
   * @param {Element} el
   * @param {{ opacity: number; y: number; scale: number }} from
   * @param {boolean} isStagger
   * @param {number} [delay]
   */
  function playReveal(gsap, el, from, isStagger, delay) {
    el.classList.add('is-revealed');
    var d = delay || 0;

    if (isStagger) {
      var kids = staggerChildren(el);
      gsap.fromTo(
        kids.length ? kids : el,
        { opacity: from.opacity, y: from.y, scale: from.scale },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: DURATION,
          delay: d,
          ease: EASE,
          stagger: kids.length ? STAGGER : 0,
          overwrite: 'auto',
        }
      );
    } else {
      gsap.fromTo(
        el,
        { opacity: from.opacity, y: from.y, scale: from.scale },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: DURATION,
          delay: d,
          ease: EASE,
          overwrite: 'auto',
        }
      );
    }
  }

  function initStorefront() {
    if (!window.gsap || !window.ScrollTrigger) {
      clearInlineMotion(document);
      return;
    }

    var gsap = window.gsap;
    var ScrollTrigger = window.ScrollTrigger;
    gsap.registerPlugin(ScrollTrigger);

    var scroller = getScroller();
    ScrollTrigger.defaults({ scroller: scroller });

    var nodes = document.querySelectorAll(SELECTOR);
    var aboveFoldIndex = 0;

    Array.prototype.forEach.call(nodes, function (el) {
      if (el.dataset.xtuGsapBound === '1') return;
      el.dataset.xtuGsapBound = '1';

      var from = mapPreset(el);
      var isStagger = el.hasAttribute('data-xtu-stagger');
      var repeat = el.hasAttribute('data-xtu-reveal-repeat');

      var rect = el.getBoundingClientRect();
      var vh = window.innerHeight || 0;
      /* Above-fold: still animate (staggered), don't skip — skipping made first screen feel static */
      var inView = rect.top < vh * 0.88 && rect.bottom > 0;

      if (inView) {
        playReveal(gsap, el, from, isStagger, 0.08 + aboveFoldIndex * 0.1);
        aboveFoldIndex += 1;
        return;
      }

      ScrollTrigger.create({
        trigger: el,
        scroller: scroller,
        start: START,
        once: !repeat,
        onEnter: function () {
          playReveal(gsap, el, from, isStagger, 0);
        },
        onLeaveBack: repeat
          ? function () {
              el.classList.remove('is-revealed');
              gsap.set(el, {
                opacity: from.opacity,
                y: from.y,
                scale: from.scale,
              });
            }
          : undefined,
      });
    });

    ScrollTrigger.refresh();
  }

  function refresh() {
    if (isDesignMode() || reducedMotion()) {
      clearInlineMotion(document);
      return;
    }
    if (window.ScrollTrigger) {
      window.ScrollTrigger.refresh();
    }
  }

  function boot() {
    if (isDesignMode() || reducedMotion()) {
      clearInlineMotion(document);
      return;
    }

    initStorefront();

    document.addEventListener('shopify:section:load', function () {
      window.setTimeout(function () {
        if (window.ScrollTrigger) window.ScrollTrigger.refresh();
        initStorefront();
      }, 50);
    });

    window.addEventListener('resize', function () {
      window.setTimeout(refresh, 100);
    });

    var wrap = document.querySelector('.page-wrapper');
    if (wrap) {
      wrap.addEventListener(
        'scroll',
        function () {
          if (window.ScrollTrigger) window.ScrollTrigger.update();
        },
        { passive: true }
      );
    }

    window.addEventListener('xtu:nav:arrived', function () {
      window.setTimeout(function () {
        if (window.ScrollTrigger) window.ScrollTrigger.refresh();
      }, 50);
    });
  }

  function whenReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  whenReady(function () {
    var tries = 0;
    (function waitGsap() {
      if (isDesignMode() || reducedMotion() || (window.gsap && window.ScrollTrigger) || tries > 40) {
        boot();
        return;
      }
      tries += 1;
      window.setTimeout(waitGsap, 50);
    })();
  });

  window.XtuReveal = {
    refresh: refresh,
    revealWithin: revealWithin,
    revealVisible: revealVisible,
    revealAll: function () {
      clearInlineMotion(document);
    },
  };
})();
