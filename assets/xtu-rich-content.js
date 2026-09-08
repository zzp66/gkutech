/**
 * XTU Rich Content — 视频 block 点击播放。
 *
 * 读取 [data-xtu-rc-video]：embed-id / embed-type、video-url（优先 mp4）、
 * video-url-mobile。封面由 Liquid 输出；无封面时用暂停的 <video> 显示首帧。
 * 点击后才插入 iframe / 带控件的 <video>。
 */
(function initXtuRichContentVideo() {
  'use strict';

  function playableVideoUrl(url) {
    var str = String(url || '').trim();
    if (!str) return '';
    if (/\.m3u8(\?|#|$)/i.test(str)) return '';
    if (str.indexOf('//') === 0) str = (window.location.protocol || 'https:') + str;
    return str;
  }

  function bindFirstFramePoster(videoEl, url) {
    if (!(videoEl instanceof HTMLVideoElement)) return;
    var src = playableVideoUrl(url || videoEl.getAttribute('src') || '');
    if (!src) return;

    videoEl.muted = true;
    videoEl.defaultMuted = true;
    videoEl.playsInline = true;
    videoEl.controls = false;
    videoEl.preload = 'metadata';
    videoEl.setAttribute('muted', '');
    videoEl.setAttribute('playsinline', '');
    videoEl.setAttribute('aria-hidden', 'true');
    videoEl.removeAttribute('controls');

    var framed = src.indexOf('#') === -1 ? src + '#t=0.1' : src;
    if (videoEl.getAttribute('src') !== framed) videoEl.src = framed;

    function showFrame() {
      try {
        if (videoEl.duration && videoEl.currentTime < 0.05) {
          videoEl.currentTime = Math.min(0.15, Math.max(0.05, videoEl.duration * 0.01));
        }
      } catch (_error) {
        /* ignore seek errors on incomplete metadata */
      }
      videoEl.pause();
    }

    videoEl.addEventListener('loadedmetadata', showFrame);
    videoEl.addEventListener('loadeddata', showFrame);
    videoEl.addEventListener('seeked', function () {
      videoEl.pause();
    });
  }

  function resolveVideoUrl(player) {
    var mobile = window.matchMedia('(max-width: 749px)').matches;
    var mobileUrl = playableVideoUrl(player.getAttribute('data-video-url-mobile'));
    var desktopUrl = playableVideoUrl(player.getAttribute('data-video-url'));
    if (mobile && mobileUrl) return mobileUrl;
    return desktopUrl || mobileUrl;
  }

  function stopPlayer(player) {
    var host = player.querySelector('video.xtu-rc__player-video');
    if (host) {
      host.pause();
      host.removeAttribute('src');
      host.load();
      if (host.parentNode) host.parentNode.removeChild(host);
    }
    var iframe = player.querySelector('iframe.xtu-rc__player-iframe');
    if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
    player.classList.remove('is-playing');
    var cover = player.querySelector('[data-xtu-rc-cover]');
    if (cover) cover.hidden = false;
  }

  function playPlayer(player) {
    var root = player.closest('.xtu-rc');
    if (root) {
      root.querySelectorAll('[data-xtu-rc-video].is-playing').forEach(function (other) {
        if (other !== player) stopPlayer(other);
      });
    }

    var stage = player.querySelector('[data-xtu-rc-stage]');
    var cover = player.querySelector('[data-xtu-rc-cover]');
    if (!stage) return;

    var embedId = String(player.getAttribute('data-embed-id') || '').trim();
    var embedType = String(player.getAttribute('data-embed-type') || 'youtube').trim();
    var videoUrl = resolveVideoUrl(player);
    var coverSrc = player.getAttribute('data-cover') || '';

    if (embedId) {
      var iframe = document.createElement('iframe');
      iframe.className = 'xtu-rc__player-iframe';
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute(
        'allow',
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
      );
      iframe.setAttribute('title', player.getAttribute('data-title') || 'Video');
      if (embedType === 'vimeo') {
        iframe.src = 'https://player.vimeo.com/video/' + encodeURIComponent(embedId) + '?autoplay=1&dnt=1';
      } else {
        iframe.src =
          'https://www.youtube.com/embed/' +
          encodeURIComponent(embedId) +
          '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
      }
      stage.appendChild(iframe);
    } else if (videoUrl) {
      var video = document.createElement('video');
      video.className = 'xtu-rc__player-video';
      video.setAttribute('controls', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('preload', 'metadata');
      if (coverSrc) video.setAttribute('poster', coverSrc);
      video.src = videoUrl;
      stage.appendChild(video);
      var playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(function () {});
    } else {
      return;
    }

    if (cover) cover.hidden = true;
    player.classList.add('is-playing');
  }

  function initPlayer(player) {
    if (!(player instanceof HTMLElement)) return;
    if (player.getAttribute('data-xtu-rc-bound') === 'true') return;
    player.setAttribute('data-xtu-rc-bound', 'true');

    var cover = player.querySelector('[data-xtu-rc-cover]');
    var poster = player.querySelector('video.xtu-rc__cover-media');
    if (poster) bindFirstFramePoster(poster, resolveVideoUrl(player));

    if (cover) {
      cover.addEventListener('click', function () {
        playPlayer(player);
      });
    }
  }

  function boot(scope) {
    var roots = (scope || document).querySelectorAll('[data-xtu-rc-video]');
    Array.prototype.forEach.call(roots, initPlayer);
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
