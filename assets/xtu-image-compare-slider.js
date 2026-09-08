/**
 * XTU Image Compare Slider
 *
 * 双图对比：拖动/触摸 handle 更新 --xtu-ics-split；支持键盘左右微调。
 * stage 上读取 data-initial；clip 宽度与 handle left 同步。
 */
(function initXtuImageCompareSlider() {
  'use strict';

  var instances = new WeakMap();

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function setSplit(root, percent) {
    var value = clamp(Math.round(percent), 0, 100) + '%';
    root.style.setProperty('--xtu-ics-split', value);
    var handle = root.querySelector('[data-xtu-ics-handle]');
    if (handle) handle.setAttribute('aria-valuenow', String(Math.round(percent)));
  }

  function positionFromEvent(stage, clientX) {
    var rect = stage.getBoundingClientRect();
    if (!rect.width) return 50;
    return clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
  }

  function bindStage(stage) {
    if (!stage || stage.dataset.xtuIcsBound === '1') return;
    stage.dataset.xtuIcsBound = '1';

    var handle = stage.querySelector('[data-xtu-ics-handle]');
    if (!handle) return;

    var dragging = false;

    function update(clientX) {
      setSplit(stage, positionFromEvent(stage, clientX));
    }

    function onPointerDown(event) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      dragging = true;
      stage.classList.add('is-dragging');
      if (handle.setPointerCapture && event.target === handle) {
        handle.setPointerCapture(event.pointerId);
      }
      update(event.clientX);
      event.preventDefault();
    }

    function onPointerMove(event) {
      if (!dragging) return;
      update(event.clientX);
      event.preventDefault();
    }

    function onPointerUp(event) {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove('is-dragging');
      if (handle.releasePointerCapture) {
        try {
          handle.releasePointerCapture(event.pointerId);
        } catch (_error) {
          /* ignore */
        }
      }
    }

    function onStagePointerDown(event) {
      if (event.target === handle || handle.contains(event.target)) return;
      dragging = true;
      stage.classList.add('is-dragging');
      update(event.clientX);
      event.preventDefault();
    }

    function onKeyDown(event) {
      var computed = getComputedStyle(stage).getPropertyValue('--xtu-ics-split').trim();
      var current = parseFloat(computed) || 50;
      var step = event.shiftKey ? 10 : 2;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        setSplit(stage, current - step);
        event.preventDefault();
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        setSplit(stage, current + step);
        event.preventDefault();
      } else if (event.key === 'Home') {
        setSplit(stage, 0);
        event.preventDefault();
      } else if (event.key === 'End') {
        setSplit(stage, 100);
        event.preventDefault();
      }
    }

    handle.addEventListener('pointerdown', onPointerDown);
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerUp);
    handle.addEventListener('pointercancel', onPointerUp);
    handle.addEventListener('keydown', onKeyDown);
    stage.addEventListener('pointerdown', onStagePointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', onPointerUp);

    stage.addEventListener(
      'dragstart',
      function (event) {
        event.preventDefault();
      },
      true
    );
  }

  function applyAutoRatio(stage) {
    var mobile = window.matchMedia('(max-width: 749px)').matches;
    var img =
      (mobile && stage.querySelector('.xtu-ics__media--after .xtu-ics__img--mobile')) ||
      stage.querySelector('.xtu-ics__media--after .xtu-ics__img--desktop') ||
      stage.querySelector('.xtu-ics__media--after .xtu-ics__img');
    if (!img || !img.naturalWidth || !img.naturalHeight) return;
    stage.style.setProperty('--xtu-ics-ratio-auto', img.naturalWidth + ' / ' + img.naturalHeight);
    stage.dataset.ratioReady = 'true';
  }

  function initRoot(root) {
    if (!root) return;
    var stage = root.querySelector('[data-xtu-ics-stage]');
    if (!stage) return;

    var initial = Number(root.getAttribute('data-initial') || 50);
    setSplit(stage, initial);
    bindStage(stage);

    if (root.classList.contains('xtu-ics--ratio-auto')) {
      var imgs = stage.querySelectorAll('.xtu-ics__img');
      Array.prototype.forEach.call(imgs, function (img) {
        if (img.complete) applyAutoRatio(stage);
        else {
          img.addEventListener(
            'load',
            function () {
              applyAutoRatio(stage);
            },
            { once: true }
          );
        }
      });
    }
  }

  function boot(scope) {
    var roots = (scope || document).querySelectorAll('[data-xtu-image-compare-slider]');
    Array.prototype.forEach.call(roots, function (root) {
      initRoot(root);
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
