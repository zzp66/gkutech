/**
 * XTU Product Nav — sticky anchors + scroll spy
 *
 * Horizon (≥990px) scrolls `.page-wrapper`, not `window`. Always scroll/listen
 * on the element that actually overflows (detect at click time — Theme Editor
 * may restore document scroll).
 */
import { scrollContainerMediaQuery } from '@theme/scroll-container';

const SECTION_SEL = '[data-xtu-product-nav]';
const LINK_SEL = '[data-xtu-product-nav-link]';

/**
 * Resolve a nav target from Theme Editor config.
 * Prefer stable section keys: `xtu_hero_banner_PAYr94`
 *
 * @param {string} raw
 * @returns {Element | null}
 */
function resolveTarget(raw) {
  if (!raw) return null;
  let value = String(raw).trim();
  if (!value) return null;

  try {
    if (value.startsWith('.') || value.startsWith('[')) {
      return document.querySelector(value);
    }

    if (value.startsWith('#')) {
      value = value.slice(1).trim();
      if (!value) return null;
    }

    const withoutSection = value.replace(/^shopify-section-/, '');
    const stableKey = withoutSection.replace(/^template--\d+__/, '');

    const idCandidates = [
      value,
      withoutSection,
      `shopify-section-${withoutSection}`,
      stableKey,
      `shopify-section-${stableKey}`,
    ];

    for (const id of idCandidates) {
      if (!id) continue;
      const el = document.getElementById(id);
      if (el) return el;
    }

    if (stableKey) {
      const escaped = CSS.escape(stableKey);
      /* Prefer the Shopify section wrapper (first match for __key suffix) */
      const bySuffix =
        document.querySelector(`.shopify-section[id$="__${escaped}"]`) ||
        document.querySelector(`[id$="__${escaped}"]`) ||
        document.querySelector(`.shopify-section[id*="${escaped}"]`);
      if (bySuffix) return bySuffix;

      const byNav = document.querySelector(`[data-xtu-nav="${escaped}"]`);
      if (byNav) return byNav;
    }

    return document.querySelector(`[data-xtu-nav="${CSS.escape(value)}"]`);
  } catch (_) {
    return null;
  }
}

/**
 * True when page scroll is the document root (mobile / Theme Editor),
 * not Horizon's desktop `.page-wrapper` scroller.
 * @param {Element} container
 * @returns {boolean}
 */
function isDocumentScrollContainer(container) {
  return (
    container === document.documentElement ||
    container === document.body ||
    container === document.scrollingElement
  );
}

/**
 * Element that currently owns page scroll (may differ in Theme Editor).
 * @returns {Element}
 */
function getNavScrollParent() {
  const wrap = document.querySelector('.page-wrapper');
  if (wrap instanceof HTMLElement) {
    const style = window.getComputedStyle(wrap);
    const oy = style.overflowY;
    const scrollable =
      (oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
      wrap.scrollHeight > wrap.clientHeight + 1;
    if (scrollable) return wrap;
  }
  return document.scrollingElement || document.documentElement;
}

/**
 * @param {Element} container
 * @returns {EventTarget}
 */
function getNavScrollEventTarget(container) {
  if (isDocumentScrollContainer(container)) {
    return document;
  }
  return container;
}

/**
 * Current scrollTop / viewport metrics for the active page scroller.
 * Root uses window — html.getBoundingClientRect() is unreliable vs scrollY.
 * @param {Element} container
 * @returns {{ scrollTop: number; clientHeight: number; scrollHeight: number }}
 */
function getScrollMetrics(container) {
  if (isDocumentScrollContainer(container)) {
    const root = document.documentElement;
    return {
      scrollTop: window.scrollY || root.scrollTop || 0,
      clientHeight: window.innerHeight || root.clientHeight,
      scrollHeight: Math.max(root.scrollHeight, document.body?.scrollHeight || 0),
    };
  }
  const el = /** @type {HTMLElement} */ (container);
  return {
    scrollTop: el.scrollTop,
    clientHeight: el.clientHeight,
    scrollHeight: el.scrollHeight,
  };
}

/**
 * Prefer the sticky shopify-section wrapper height when present.
 * @param {HTMLElement} nav
 * @returns {number}
 */
function getStickyOffset(nav) {
  const extra = Number(nav.dataset.offset) || 0;
  const section = nav.closest('.shopify-section.xtu-product-nav-section');
  const el = section instanceof HTMLElement ? section : nav;
  return Math.round(el.getBoundingClientRect().height) + extra;
}

/**
 * Exactly one active link at a time (clears stray .is-active / aria-current).
 * @param {HTMLElement} nav
 * @param {HTMLElement | null} link
 * @param {{ alignMobile?: boolean }} [opts]
 */
function setActive(nav, link, opts = {}) {
  const alignMobile = Boolean(opts.alignMobile);
  const links = nav.querySelectorAll(LINK_SEL);
  /** @type {HTMLElement | null} */
  let prevActive = null;

  links.forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    if (el.classList.contains('is-active')) prevActive = el;

    const on = el === link;
    el.classList.toggle('is-active', on);
    if (on) {
      el.setAttribute('aria-current', 'true');
    } else {
      el.removeAttribute('aria-current');
      if (el === document.activeElement) el.blur();
    }
  });

  /* Belt-and-suspenders: clear any leftover active outside the loop set */
  nav.querySelectorAll(`${LINK_SEL}.is-active`).forEach((el) => {
    if (el !== link) {
      el.classList.remove('is-active');
      el.removeAttribute('aria-current');
    }
  });

  /* Scroll only the horizontal tab strip — never scrollIntoView (moves the page on iOS). */
  if (
    alignMobile &&
    link &&
    link !== prevActive &&
    window.matchMedia('(max-width: 749px)').matches
  ) {
    const list = link.closest('.xtu-product-nav__list');
    if (list instanceof HTMLElement) {
      const nextLeft = Math.max(
        0,
        link.offsetLeft + link.offsetWidth / 2 - list.clientWidth / 2
      );
      list.scrollTo({ left: nextLeft, behavior: 'auto' });
    }
  }
}

/**
 * Sort entries by target position in the document (nav order may differ).
 * @param {{ link: HTMLElement; target: Element }[]} entries
 */
function sortEntriesByDocument(entries) {
  entries.sort((a, b) => {
    if (a.target === b.target) return 0;
    const pos = a.target.compareDocumentPosition(b.target);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
}

/**
 * Reveal destination without ScrollTrigger.refresh (refresh mid-scroll cancels smooth).
 * @param {Element | null} target
 * @param {{ refresh?: boolean }} [opts]
 */
function prepareDestination(target, opts = {}) {
  const refresh = Boolean(opts.refresh);

  if (window.XtuReveal) {
    if (typeof window.XtuReveal.revealWithin === 'function') {
      window.XtuReveal.revealWithin(target || document, { refresh });
    }
    if (typeof window.XtuReveal.revealVisible === 'function') {
      window.XtuReveal.revealVisible();
    }
  }

  if (target instanceof Element) {
    target.querySelectorAll('.swiper').forEach((el) => {
      const swiper = /** @type {HTMLElement & { swiper?: { destroyed?: boolean; update?: () => void } }} */ (el)
        .swiper;
      if (swiper && !swiper.destroyed && typeof swiper.update === 'function') {
        try {
          swiper.update();
        } catch (_) {}
      }
    });
  }

  if (refresh) {
    window.dispatchEvent(
      new CustomEvent('xtu:nav:arrived', {
        detail: { target },
      })
    );
  }
}

/**
 * @param {Element} container
 * @param {Element} target
 * @param {number} offset
 * @returns {number}
 */
function computeScrollTop(container, target, offset) {
  const tRect = target.getBoundingClientRect();
  const { scrollTop: current } = getScrollMetrics(container);

  /* Document root: viewport-relative top only — do NOT subtract html.getBoundingClientRect()
     (often ≈ -scrollY on mobile, which double-counts and jumps to the wrong place). */
  if (isDocumentScrollContainer(container)) {
    return Math.max(0, current + tRect.top - offset);
  }

  const cRect = container.getBoundingClientRect();
  return Math.max(0, current + (tRect.top - cRect.top) - offset);
}

/**
 * @param {Element} container
 * @param {number} top
 * @param {ScrollBehavior} behavior
 */
function applyScroll(container, top, behavior) {
  const el = /** @type {HTMLElement} */ (container);
  const { scrollHeight, clientHeight } = getScrollMetrics(container);
  const max = Math.max(0, scrollHeight - clientHeight);
  const clamped = Math.min(top, max);
  const isRoot = isDocumentScrollContainer(container);

  if (behavior === 'smooth') {
    if (isRoot) window.scrollTo({ top: clamped, behavior: 'smooth' });
    else el.scrollTo({ top: clamped, behavior: 'smooth' });
    return;
  }

  /* Override CSS scroll-behavior:smooth on .page-wrapper for instant jumps */
  const prev = el.style.scrollBehavior;
  el.style.scrollBehavior = 'auto';
  if (isRoot) window.scrollTo({ top: clamped, behavior: 'instant' });
  else el.scrollTo({ top: clamped, behavior: 'instant' });
  el.style.scrollBehavior = prev;
}

/**
 * Scroll so target sits just below sticky nav.
 * @param {HTMLElement} nav
 * @param {Element} target
 * @param {() => void} [onDone]
 */
function scrollToTarget(nav, target, onDone) {
  /* Soft reveal only — no ST.refresh / swiper storm before measuring */
  if (window.XtuReveal?.revealWithin) {
    window.XtuReveal.revealWithin(target, { refresh: false });
  }

  const container = getNavScrollParent();
  const offset = getStickyOffset(nav);
  const nextTop = computeScrollTop(container, target, offset);

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior = reduced ? 'auto' : 'smooth';

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    prepareDestination(target, { refresh: true });
    if (typeof onDone === 'function') onDone();
  };

  applyScroll(container, nextTop, behavior);

  if (behavior === 'smooth') {
    const scrollEvents = getNavScrollEventTarget(container);
    if (typeof scrollEvents.addEventListener === 'function') {
      scrollEvents.addEventListener('scrollend', finish, { once: true });
    }
    /* Fallback if scrollend never fires (distance 0 / older Safari) */
    window.setTimeout(finish, 800);
  } else {
    window.requestAnimationFrame(finish);
  }
}

/**
 * Pick the last section whose top has crossed the sticky activation line.
 * Guarantees a single active item; locks to last item at page bottom.
 * @param {HTMLElement} nav
 * @param {{ link: HTMLElement; target: Element }[]} entries
 */
function updateSpy(nav, entries) {
  if (nav.dataset.scrolling === 'true') return;
  if (!entries.length) return;

  const line = getStickyOffset(nav) + 8;
  const container = getNavScrollParent();
  const { scrollTop, clientHeight, scrollHeight } = getScrollMetrics(container);
  const atBottom = scrollTop + clientHeight >= scrollHeight - 4;

  let activeIndex = 0;
  if (atBottom) {
    activeIndex = entries.length - 1;
  } else {
    for (let i = 0; i < entries.length; i += 1) {
      if (entries[i].target.getBoundingClientRect().top <= line) {
        activeIndex = i;
      }
    }
  }

  setActive(nav, entries[activeIndex].link, { alignMobile: true });
}

/**
 * @param {HTMLElement} nav
 */
function initNav(nav) {
  if (nav.dataset.xtuNavReady === 'true') return;
  nav.dataset.xtuNavReady = 'true';

  const links = Array.from(nav.querySelectorAll(LINK_SEL));
  /** @type {{ link: HTMLElement; target: Element }[]} */
  const entries = [];

  links.forEach((link) => {
    if (!(link instanceof HTMLElement)) return;
    const target = resolveTarget(link.dataset.target || '');
    if (!target) return;
    entries.push({ link, target });

    link.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      nav.dataset.scrolling = 'true';
      setActive(nav, link, { alignMobile: true });
      scrollToTarget(nav, target, () => {
        nav.dataset.scrolling = 'false';
        updateSpy(nav, entries);
      });
    });
  });

  if (!entries.length) return;

  sortEntriesByDocument(entries);
  /* Clear Liquid's default first-item active, then spy once */
  setActive(nav, null);
  updateSpy(nav, entries);

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateSpy(nav, entries);
      ticking = false;
    });
  };

  /** @type {EventTarget | null} */
  let scrollTarget = null;

  const bindScroll = () => {
    if (scrollTarget) {
      scrollTarget.removeEventListener('scroll', onScroll);
    }
    scrollTarget = getNavScrollEventTarget(getNavScrollParent());
    scrollTarget.addEventListener('scroll', onScroll, { passive: true });
  };

  bindScroll();
  window.addEventListener('resize', onScroll, { passive: true });
  scrollContainerMediaQuery.addEventListener('change', () => {
    bindScroll();
    onScroll();
  });
}

function initAll() {
  document.querySelectorAll(SECTION_SEL).forEach((nav) => {
    if (nav instanceof HTMLElement) initNav(nav);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAll, { once: true });
} else {
  initAll();
}

document.addEventListener('shopify:section:load', (event) => {
  const root = /** @type {HTMLElement | null} */ (event.target);
  const nav =
    root?.querySelector?.(SECTION_SEL) ||
    root?.closest?.(SECTION_SEL) ||
    (root?.matches?.(SECTION_SEL) ? root : null);
  if (nav instanceof HTMLElement) {
    nav.dataset.xtuNavReady = 'false';
    initNav(nav);
  }
});
