/** Load only the visible hosted-video variant, close to the viewport or on interaction. */
(() => {
  if (window.XtuDeferredMedia) return;

  const selector = 'video[data-xtu-deferred-media]';
  const states = new Map();
  const queries = new Map();
  const margin = 800;
  let observer;
  let mutations;
  let frame;

  function queryFor(video) {
    const query = video.dataset.xtuMediaQuery;
    if (!query) return null;
    if (!queries.has(query)) {
      const media = window.matchMedia(query);
      if (media.addEventListener) media.addEventListener('change', scheduleSync);
      else media.addListener(scheduleSync);
      queries.set(query, media);
    }
    return queries.get(query);
  }

  function matchesViewport(video) {
    const media = queryFor(video);
    return !media || media.matches;
  }

  function isVisible(video) {
    if (!video.isConnected || video.closest('[hidden]') || !video.getClientRects().length) return false;
    return getComputedStyle(video).visibility !== 'hidden';
  }

  function isNear(video) {
    const rect = video.getBoundingClientRect();
    return rect.bottom >= -margin && rect.top <= window.innerHeight + margin &&
      rect.right >= 0 && rect.left <= window.innerWidth;
  }

  function pause(video) {
    if (!video.paused) video.pause();
  }

  function play(video) {
    if (!video.paused) return;
    const promise = video.play();
    if (promise && typeof promise.catch === 'function') promise.catch(() => {});
  }

  function activate(video, options = {}) {
    if (!(video instanceof HTMLVideoElement) || !matchesViewport(video) || !isVisible(video)) return false;
    if (!states.has(video)) register(video);
    const state = states.get(video);

    if (!state.loaded) {
      if (video.dataset.poster) video.setAttribute('poster', video.dataset.poster);
      if (video.dataset.src) video.setAttribute('src', video.dataset.src);
      video.querySelectorAll('source[data-src], img[data-src]').forEach((source) => {
        source.setAttribute('src', source.dataset.src);
      });
      state.loaded = true;
      video.preload = video.dataset.xtuAutoplay === 'true' || options.play ? 'auto' : 'metadata';
      video.load();

      if (state.currentTime > 0) {
        video.addEventListener('loadedmetadata', () => {
          if (Number.isFinite(video.duration) && state.currentTime < video.duration) {
            video.currentTime = state.currentTime;
          }
        }, { once: true });
      }
    }

    if (video.dataset.xtuAutoplay === 'true') video.autoplay = true;
    if (options.play || video.dataset.xtuAutoplay === 'true') play(video);
    return true;
  }

  function unloadVariant(video, state) {
    pause(video);
    if (!state.loaded) return;
    state.currentTime = video.currentTime;
    video.autoplay = false;
    video.removeAttribute('src');
    video.querySelectorAll('source[data-src], img[data-src]').forEach((source) => source.removeAttribute('src'));
    video.removeAttribute('poster');
    state.loaded = false;
    video.load();
  }

  function sync() {
    frame = undefined;
    states.forEach((state, video) => {
      if (!video.isConnected) {
        observer?.unobserve(video);
        states.delete(video);
      } else if (!matchesViewport(video)) {
        unloadVariant(video, state);
      } else if (!isVisible(video)) {
        pause(video);
      } else if (isNear(video)) {
        activate(video);
      }
    });
  }

  function scheduleSync() {
    if (frame === undefined) frame = requestAnimationFrame(sync);
  }

  function ensureObservers() {
    if (mutations) return;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) activate(entry.target);
        });
      }, { rootMargin: `${margin}px 0px` });
    } else {
      window.addEventListener('scroll', scheduleSync, { passive: true, capture: true });
    }
    mutations = new MutationObserver((records) => {
      let needsSync = false;
      records.forEach((record) => {
        if (record.type === 'attributes' &&
            (record.target.matches(selector) || record.target.querySelector(selector))) {
          needsSync = true;
        }
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) boot(node);
        });
        record.removedNodes.forEach((node) => {
          if (node instanceof Element && (node.matches(selector) || node.querySelector(selector))) {
            needsSync = true;
          }
        });
      });
      if (needsSync) scheduleSync();
    });
    mutations.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden'],
    });
  }

  function register(video) {
    if (states.has(video)) return;
    ensureObservers();
    states.set(video, {
      loaded: video.hasAttribute('src') || Boolean(video.querySelector('source[src]')),
      currentTime: 0,
    });
    queryFor(video);
    video.addEventListener('play', () => activate(video));
    video.addEventListener('pointerdown', () => activate(video), { passive: true });
    video.addEventListener('focus', () => activate(video));
    video.addEventListener('xtu:media:activate', () => activate(video, { play: true }));
    observer?.observe(video);
  }

  function boot(root = document) {
    const videos = [...root.querySelectorAll(selector)];
    if (root instanceof HTMLVideoElement && root.matches(selector)) videos.unshift(root);
    videos.forEach(register);
    if (videos.length) scheduleSync();
  }

  window.XtuDeferredMedia = { activate };
  window.addEventListener('resize', scheduleSync, { passive: true });
  document.addEventListener('shopify:section:load', (event) => boot(event.target));
  document.addEventListener('shopify:section:unload', scheduleSync);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot());
  else boot();
})();
