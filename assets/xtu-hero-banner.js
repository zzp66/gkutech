/**
 * XtuCam full-screen hero banner with Swiper + progress pagination.
 * Pagination active state syncs at slide-change start; progress fill starts after transition.
 */
(function () {
  'use strict';

  var instances = new WeakMap();

  function getDelay(root) {
    var delay = Number(root.getAttribute('data-autoplay-delay') || 5000);
    return Number.isFinite(delay) && delay > 0 ? delay : 5000;
  }

  function setProgressDuration(root, delay) {
    root.style.setProperty('--xtu-hero-progress-duration', delay + 'ms');
  }

  function resetProgressFills(root) {
    var bullets = root.querySelectorAll('.xtu-hero-banner__bullet');
    Array.prototype.forEach.call(bullets, function (bullet) {
      bullet.classList.remove('is-progressing');
      var fill = bullet.querySelector('.xtu-hero-banner__bullet-fill');
      if (fill) {
        fill.style.transition = 'none';
        fill.style.width = '0%';
        void fill.offsetWidth;
        fill.style.transition = '';
        fill.style.width = '';
      }
    });
  }

  function setActiveBullet(root, index) {
    var bullets = root.querySelectorAll('.xtu-hero-banner__bullet');
    Array.prototype.forEach.call(bullets, function (bullet, i) {
      bullet.classList.toggle('is-active', i === index);
    });
  }

  function beginProgressFill(root, index) {
    var bullets = root.querySelectorAll('.xtu-hero-banner__bullet');
    var active = bullets[index];
    if (!active) return;

    if (root.getAttribute('data-autoplay') === 'false') {
      active.classList.add('is-progressing');
      var fill = active.querySelector('.xtu-hero-banner__bullet-fill');
      if (fill) {
        fill.style.transition = 'none';
        fill.style.width = '100%';
      }
      return;
    }

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        active.classList.add('is-progressing');
      });
    });
  }

  /** Sync bullet expand + clear fills as soon as the slide changes. */
  function syncPagination(root, index) {
    resetProgressFills(root);
    setActiveBullet(root, index);
  }

  function renderBullets(root, titles) {
    var pagination = root.querySelector('[data-xtu-hero-pagination]');
    if (!pagination) return;

    pagination.innerHTML = '';
    titles.forEach(function (title, index) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'xtu-hero-banner__bullet';
      button.setAttribute('aria-label', title || 'Slide ' + (index + 1));
      button.dataset.index = String(index);

      if (title) {
        var label = document.createElement('span');
        label.className = 'xtu-hero-banner__bullet-label';
        label.textContent = title;
        button.appendChild(label);
      }

      var track = document.createElement('span');
      track.className = 'xtu-hero-banner__bullet-track';
      track.setAttribute('aria-hidden', 'true');
      var fill = document.createElement('span');
      fill.className = 'xtu-hero-banner__bullet-fill';
      track.appendChild(fill);
      button.appendChild(track);

      button.addEventListener('click', function () {
        var swiper = instances.get(root);
        if (swiper) swiper.slideToLoop(index);
      });

      pagination.appendChild(button);
    });
  }

  function initHero(root) {
    if (!root || instances.has(root) || typeof window.Swiper === 'undefined') return;

    var container = root.querySelector('[data-xtu-hero-swiper]');
    if (!container) return;

    var slides = root.querySelectorAll('.swiper-slide');
    if (!slides.length) return;

    var delay = getDelay(root);
    var effect = root.getAttribute('data-effect') || 'slide';
    var autoplay = root.getAttribute('data-autoplay') !== 'false';
    var titles = Array.prototype.map.call(slides, function (slide) {
      return slide.getAttribute('data-bullet-title') || '';
    });

    setProgressDuration(root, delay);
    renderBullets(root, titles);

    var swiper = new window.Swiper(container, {
      slidesPerView: 1,
      speed: 650,
      loop: slides.length > 1,
      effect: effect,
      fadeEffect: { crossFade: true },
      grabCursor: true,
      simulateTouch: true,
      mousewheel: {
        enabled: true,
        forceToAxis: true,
        sensitivity: 1,
        releaseOnEdges: true,
      },
      autoplay:
        autoplay && slides.length > 1
          ? {
              delay: delay,
              disableOnInteraction: false,
              pauseOnMouseEnter: true,
            }
          : false,
      navigation: {
        nextEl: root.querySelector('[data-xtu-hero-next]'),
        prevEl: root.querySelector('[data-xtu-hero-prev]'),
      },
      on: {
        init: function (instance) {
          syncPagination(root, instance.realIndex);
          beginProgressFill(root, instance.realIndex);
          root.classList.add('is-ready');
        },
        /* Fire as soon as the target slide is known — keep pagination in lockstep with media */
        slideChange: function (instance) {
          syncPagination(root, instance.realIndex);
        },
        slideChangeTransitionEnd: function (instance) {
          beginProgressFill(root, instance.realIndex);
        },
      },
    });

    instances.set(root, swiper);
  }

  function boot(scope) {
    var roots = (scope || document).querySelectorAll('[data-xtu-hero-banner]');
    Array.prototype.forEach.call(roots, initHero);
  }

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  onReady(function () {
    if (typeof window.Swiper === 'undefined') {
      var tries = 0;
      var timer = setInterval(function () {
        tries += 1;
        if (typeof window.Swiper !== 'undefined' || tries > 40) {
          clearInterval(timer);
          boot(document);
        }
      }, 50);
    } else {
      boot(document);
    }
  });

  document.addEventListener('shopify:section:load', function (event) {
    boot(event.target);
  });

  document.addEventListener('shopify:section:unload', function (event) {
    var root = event.target.querySelector('[data-xtu-hero-banner]');
    if (!root) return;
    var swiper = instances.get(root);
    if (swiper) {
      swiper.destroy(true, true);
      instances.delete(root);
    }
  });
})();
