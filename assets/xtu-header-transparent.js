/**
 * When home transparent header overlays XTU hero: solidify after leaving hero top.
 * Complements Horizon sticky-state; safe no-op if transparent header is off.
 *
 * Desktop scrolls `.page-wrapper` — must not use window.scrollY.
 */
(function () {
  'use strict';

  var THRESHOLD = 30;

  function getHeader() {
    return document.querySelector('#header-component[transparent]');
  }

  function getHero() {
    return document.querySelector('#MainContent > .shopify-section:first-child .xtu-hero-banner');
  }

  function getScrollTop() {
    var wrap = document.querySelector('.page-wrapper');
    if (wrap) {
      try {
        var htmlOverflow = window.getComputedStyle(document.documentElement).overflowY;
        var wrapOverflow = window.getComputedStyle(wrap).overflowY;
        if (
          (htmlOverflow === 'hidden' || htmlOverflow === 'clip') &&
          (wrapOverflow === 'auto' || wrapOverflow === 'scroll')
        ) {
          return wrap.scrollTop;
        }
      } catch (_) {}
    }
    return window.scrollY || document.documentElement.scrollTop || 0;
  }

  function sync() {
    var header = getHeader();
    if (!header) return;

    var hero = getHero();
    if (!hero) {
      header.removeAttribute('data-xtu-over-hero');
      return;
    }

    var overHero = getScrollTop() <= THRESHOLD;
    header.setAttribute('data-xtu-over-hero', overHero ? 'true' : 'false');
  }

  function boot() {
    if (!getHeader() || !getHero()) return;

    sync();

    var wrap = document.querySelector('.page-wrapper');
    var scrollTarget = wrap || window;
    try {
      var htmlOverflow = window.getComputedStyle(document.documentElement).overflowY;
      var wrapOverflow = wrap ? window.getComputedStyle(wrap).overflowY : '';
      if (
        !(
          wrap &&
          (htmlOverflow === 'hidden' || htmlOverflow === 'clip') &&
          (wrapOverflow === 'auto' || wrapOverflow === 'scroll')
        )
      ) {
        scrollTarget = window;
      }
    } catch (_) {
      scrollTarget = window;
    }

    scrollTarget.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync, { passive: true });
    document.addEventListener('shopify:section:load', sync);
    document.addEventListener('shopify:section:unload', sync);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
