/**
 * XTU Image Marquee
 *
 * 测量第一组宽度；不足视口时复制条目，保证无缝循环。
 * 按时长 = 组宽 / 速度(px/s) 设置 CSS animation-duration。
 * Hover / focus 暂停由 CSS :has 处理。
 */
(function initXtuImageMarquee() {
  'use strict';

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function disableCloneLinks(node) {
    if (!(node instanceof HTMLElement)) return;
    node.setAttribute('aria-hidden', 'true');
    node.querySelectorAll('a').forEach(function (link) {
      link.setAttribute('tabindex', '-1');
    });
  }

  function setup(root) {
    if (root.getAttribute('data-xtu-im-bound') === 'true') return;
    root.setAttribute('data-xtu-im-bound', 'true');

    var viewport = root.querySelector('[data-xtu-im-viewport]');
    var track = root.querySelector('[data-xtu-im-track]');
    var groups = track ? track.querySelectorAll('[data-xtu-im-group]') : [];
    if (!viewport || !track || groups.length < 2) return;
    if (prefersReducedMotion()) return;

    var first = groups[0];
    var second = groups[1];
    var speed = Math.max(10, Number(root.getAttribute('data-speed') || 40));

    function fill() {
      if (prefersReducedMotion()) return;
      var originals = Array.prototype.slice.call(first.querySelectorAll('[data-xtu-im-source]'));
      if (!originals.length) return;

      Array.prototype.slice.call(first.children).forEach(function (child) {
        if (!child.hasAttribute('data-xtu-im-source')) child.parentNode.removeChild(child);
      });

      var guard = 0;
      while (first.offsetWidth < viewport.clientWidth && guard < 12) {
        originals.forEach(function (node) {
          var clone = node.cloneNode(true);
          clone.removeAttribute('data-xtu-im-source');
          disableCloneLinks(clone);
          first.appendChild(clone);
        });
        guard += 1;
      }

      second.innerHTML = first.innerHTML;
      disableCloneLinks(second);

      var distance = first.offsetWidth;
      if (!distance) return;
      var duration = Math.max(8, distance / speed);
      track.style.setProperty('--xtu-im-duration', duration + 's');
    }

    var fillTimer;
    function scheduleFill() {
      clearTimeout(fillTimer);
      fillTimer = setTimeout(fill, 50);
    }

    viewport.querySelectorAll('img').forEach(function (img) {
      if (!img.complete) img.addEventListener('load', scheduleFill);
    });

    var resizeTimer;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fill, 150);
    }

    window.addEventListener('resize', onResize);

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(scheduleFill).catch(scheduleFill);
    }
    scheduleFill();
  }

  function boot(scope) {
    var roots = (scope || document).querySelectorAll('[data-xtu-image-marquee]');
    Array.prototype.forEach.call(roots, function (root) {
      if (root instanceof HTMLElement) setup(root);
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
})();
