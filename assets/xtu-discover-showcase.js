/**
 * XTU Discover Showcase — tabbed product stage with staggered slide-in
 */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initRoot(root) {
    if (!root || root.dataset.xtuDiscoverReady === '1') return;
    root.dataset.xtuDiscoverReady = '1';

    var tabs = Array.prototype.slice.call(root.querySelectorAll('[data-xtu-discover-tab]'));
    var dots = Array.prototype.slice.call(root.querySelectorAll('[data-xtu-discover-dot]'));
    var panels = Array.prototype.slice.call(root.querySelectorAll('[data-xtu-discover-panel]'));
    if (!panels.length) return;

    var autoplay = root.getAttribute('data-autoplay') === 'true';
    var delay = parseInt(root.getAttribute('data-autoplay-delay'), 10) || 5000;
    var index = Math.max(
      0,
      panels.findIndex(function (panel) {
        return panel.classList.contains('is-active');
      })
    );
    if (index < 0) index = 0;

    var timer = null;
    var animating = false;

    function setActiveControls(i) {
      tabs.forEach(function (tab, idx) {
        var on = idx === i;
        tab.classList.toggle('is-active', on);
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
        tab.tabIndex = on ? 0 : -1;
      });
      dots.forEach(function (dot, idx) {
        var on = idx === i;
        dot.classList.toggle('is-active', on);
        dot.setAttribute('aria-current', on ? 'true' : 'false');
      });
    }

    function activate(nextIndex, fromUser) {
      if (!panels.length) return;
      nextIndex = ((nextIndex % panels.length) + panels.length) % panels.length;
      if (nextIndex === index && panels[index].classList.contains('is-active')) {
        if (fromUser) restartAutoplay();
        return;
      }
      if (animating) return;
      animating = true;

      var prev = panels[index];
      var next = panels[nextIndex];

      if (prev) {
        prev.classList.remove('is-active', 'is-enter');
        prev.setAttribute('hidden', '');
        prev.setAttribute('aria-hidden', 'true');
      }

      next.removeAttribute('hidden');
      next.setAttribute('aria-hidden', 'false');
      next.classList.add('is-active');

      if (!REDUCED) {
        next.classList.remove('is-enter');
        // Force reflow so enter animation restarts
        void next.offsetWidth;
        next.classList.add('is-enter');
      }

      index = nextIndex;
      setActiveControls(index);

      window.setTimeout(
        function () {
          next.classList.remove('is-enter');
          animating = false;
        },
        REDUCED ? 0 : 700
      );

      if (fromUser) restartAutoplay();
    }

    function stopAutoplay() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function startAutoplay() {
      stopAutoplay();
      if (!autoplay || panels.length < 2 || REDUCED) return;
      timer = window.setInterval(function () {
        activate(index + 1, false);
      }, delay);
    }

    function restartAutoplay() {
      stopAutoplay();
      startAutoplay();
    }

    tabs.forEach(function (tab, idx) {
      tab.addEventListener('click', function () {
        activate(idx, true);
      });
      tab.addEventListener('keydown', function (event) {
        var target = idx;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault();
          target = idx + 1;
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault();
          target = idx - 1;
        } else if (event.key === 'Home') {
          event.preventDefault();
          target = 0;
        } else if (event.key === 'End') {
          event.preventDefault();
          target = tabs.length - 1;
        } else {
          return;
        }
        activate(target, true);
        if (tabs[target]) tabs[target].focus();
      });
    });

    dots.forEach(function (dot, idx) {
      dot.addEventListener('click', function () {
        activate(idx, true);
      });
    });

    root.addEventListener('mouseenter', stopAutoplay);
    root.addEventListener('mouseleave', startAutoplay);
    root.addEventListener('focusin', stopAutoplay);
    root.addEventListener('focusout', function (event) {
      if (!root.contains(event.relatedTarget)) startAutoplay();
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopAutoplay();
      else startAutoplay();
    });

    setActiveControls(index);
    startAutoplay();
  }

  function boot(scope) {
    var roots = (scope || document).querySelectorAll('[data-xtu-discover-showcase]');
    Array.prototype.forEach.call(roots, initRoot);
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

  document.addEventListener('shopify:section:load', function (event) {
    var root = event.target.querySelector('[data-xtu-discover-showcase]') || event.target;
    if (root && root.hasAttribute && root.hasAttribute('data-xtu-discover-showcase')) {
      root.dataset.xtuDiscoverReady = '';
    }
    boot(event.target);
  });
})();
