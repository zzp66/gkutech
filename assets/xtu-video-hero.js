/**
 * XTU Video Hero — full-screen bg image/video + modal video playback
 */
(function () {
  'use strict';

  function boot(scope) {
    var roots = (scope || document).querySelectorAll('[data-xtu-video-hero]');
    Array.prototype.forEach.call(roots, function (root) {
      initRoot(root);
    });
  }

  function initRoot(root) {
    if (root.getAttribute('data-xtu-vh-bound') === 'true') return;
    root.setAttribute('data-xtu-vh-bound', 'true');

    var trigger = root.querySelector('[data-xtu-vh-play-trigger]');
    var modal = root.querySelector('[data-xtu-vh-modal]');
    if (!modal) return;

    var closeBtn = modal.querySelector('[data-xtu-vh-modal-close]');
    var videoWrap = modal.querySelector('[data-xtu-vh-modal-content]');
    var hostedVideo = modal.querySelector('video[data-xtu-vh-hosted]');
    var externalUrl = root.getAttribute('data-video-url') || '';

    function openModal() {
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';

      if (hostedVideo) {
        hostedVideo.play().catch(function () {});
      } else if (externalUrl && videoWrap) {
        var existingIframe = videoWrap.querySelector('iframe');
        if (!existingIframe) {
          var iframe = document.createElement('iframe');
          iframe.className = 'xtu-video-hero__iframe';
          iframe.setAttribute('allowfullscreen', '');
          iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
          iframe.src = parseVideoUrl(externalUrl);
          videoWrap.appendChild(iframe);
        }
      }

      if (closeBtn) closeBtn.focus();
    }

    function closeModal() {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';

      if (hostedVideo) {
        hostedVideo.pause();
        hostedVideo.currentTime = 0;
      }

      var iframe = videoWrap && videoWrap.querySelector('iframe');
      if (iframe) {
        iframe.parentNode.removeChild(iframe);
      }

      if (trigger) trigger.focus();
    }

    if (trigger) {
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        openModal();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }

    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) {
        closeModal();
      }
    });
  }

  function parseVideoUrl(url) {
    if (!url) return '';
    var ytMatch = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    if (ytMatch) {
      return 'https://www.youtube.com/embed/' + ytMatch[1] + '?autoplay=1&rel=0';
    }
    var vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      return 'https://player.vimeo.com/video/' + vimeoMatch[1] + '?autoplay=1';
    }
    return url;
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
    boot(event.target);
  });
})();
