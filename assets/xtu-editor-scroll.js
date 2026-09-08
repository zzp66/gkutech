/**
 * Theme-editor scroll fix (loaded only when needed via design-mode class present).
 * Ensures Shopify section:select can scroll the document after undoing page-wrapper trap.
 */
(function () {
  if (!document.documentElement.classList.contains('shopify-design-mode')) return;

  function unlock() {
    document.documentElement.removeAttribute('scroll-lock');
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.height = '';
    var wrap = document.querySelector('.page-wrapper');
    if (wrap) {
      wrap.style.overflow = '';
      wrap.style.height = '';
      wrap.style.maxHeight = '';
    }
  }

  function onSelect(event) {
    unlock();
    var target = event.target;
    if (!(target instanceof HTMLElement)) return;
    /* Defer so Shopify finishes its own scroll attempt, then correct into view */
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        try {
          target.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'auto' });
        } catch (_) {}
      });
    });
  }

  unlock();
  document.addEventListener('shopify:section:select', onSelect);
  document.addEventListener('shopify:block:select', onSelect);
  document.addEventListener('shopify:section:load', unlock);
})();
