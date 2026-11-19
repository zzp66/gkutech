/** Start reveal dependencies only when an editorial page actually contains reveal media. */
(() => {
  const config = document.currentScript?.dataset;
  if (!config || window.XtuMotionLoader) return;

  const selector = '[data-xtu-reveal]';
  let pending;
  let observer;

  function load(src, ready) {
    if (ready()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => {
        script.remove();
        reject(new Error('Reveal dependency could not be loaded'));
      };
      document.head.appendChild(script);
    });
  }

  function containsReveal(root) {
    return root.matches?.(selector) || Boolean(root.querySelector?.(selector));
  }

  function activate(root = document) {
    if (pending || !containsReveal(root)) return;
    pending = load(config.gsap, () => Boolean(window.gsap))
      .then(() => load(config.scrollTrigger, () => Boolean(window.ScrollTrigger)))
      .then(() => load(config.reveal, () => Boolean(window.XtuReveal)))
      .then(() => observer?.disconnect())
      .catch(() => { pending = undefined; });
  }

  function boot() {
    observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (containsReveal(node)) {
            activate(node);
            return;
          }
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('shopify:section:load', (event) => activate(event.target));
    activate();
  }

  window.XtuMotionLoader = { activate };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
