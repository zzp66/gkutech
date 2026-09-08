/**
 * XTU Guide Video
 *
 * 读取 section 内 [data-xtu-gv-catalog] JSON，按品类筛选、分页渲染卡片。
 * 封面点击后才插入 YouTube iframe 或 <video>（懒播放）。
 * 无封面图时：YouTube 用官方缩略图；上传视频优先用 catalog.cover（含 Liquid 注入的
 * Shopify preview_image 首帧），仍空则用暂停的 <video> 显示第一帧。
 * 移动端 Tab 横向溢出时：向右选贴左、向左选贴右。
 *
 * 数据约定（catalog.videos[]）：
 *   title, category, type('youtube'|'video'), cover, youtubeUrl, videoUrl, sort
 * youtubeId 由 youtubeUrl 解析；type 也可由 URL / videoUrl 推断。
 */
(function initXtuGuideVideo() {
  'use strict';

  function asUrl(value) {
    if (!value) return '';
    if (typeof value === 'object' && value.url) return String(value.url);
    return String(value);
  }

  /**
   * @param {string} url
   * @returns {string}
   */
  function youtubeIdFromUrl(url) {
    var str = asUrl(url);
    if (!str) return '';
    var ytMatch = str.match(
      /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return ytMatch ? ytMatch[1] : '';
  }

  /**
   * Native <video> cannot play HLS playlists in Chrome/Firefox.
   * @param {string} url
   * @returns {string}
   */
  function playableVideoUrl(url) {
    var str = asUrl(url).trim();
    if (!str) return '';
    if (/\.m3u8(\?|#|$)/i.test(str)) return '';
    if (str.indexOf('//') === 0) str = (window.location.protocol || 'https:') + str;
    return str;
  }

  /**
   * Paint the first decoded frame onto a paused <video> used as cover.
   * Canvas is avoided because Shopify CDN videos may taint it.
   * @param {HTMLVideoElement} videoEl
   * @param {string} [url]
   */
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

  /**
   * @param {HTMLElement} root
   */
  function initRoot(root) {
    if (root.getAttribute('data-xtu-gv-bound') === 'true') return;
    root.setAttribute('data-xtu-gv-bound', 'true');

    var catalogEl = root.querySelector('[data-xtu-gv-catalog]');
    if (!catalogEl) return;

    var catalog;
    try {
      catalog = JSON.parse(catalogEl.textContent || '{}');
    } catch (_error) {
      return;
    }

    var categories = Array.isArray(catalog.categories) ? catalog.categories : [];
    var videos = (Array.isArray(catalog.videos) ? catalog.videos : []).map(function (item) {
      var youtubeId = item.youtubeId || youtubeIdFromUrl(item.youtubeUrl || item.youtube_url);
      var videoUrl = playableVideoUrl(item.videoUrl);
      var type = item.type;
      if (youtubeId) type = 'youtube';
      else if (videoUrl) type = 'video';
      return Object.assign({}, item, {
        youtubeId: youtubeId,
        videoUrl: videoUrl,
        type: type,
      });
    });
    var columns = Math.max(1, Math.min(4, Number(catalog.columns) || 2));
    var perPage = Math.max(1, Math.min(24, Number(catalog.perPage) || 6));
    var emptyText = catalog.emptyText || 'No videos in this category.';

    var tabsEl = root.querySelector('[data-xtu-gv-tabs]');
    var gridEl = root.querySelector('[data-xtu-gv-grid]');
    var pagerEl = root.querySelector('[data-xtu-gv-pager]');
    var emptyEl = root.querySelector('[data-xtu-gv-empty]');
    var prevBtn = root.querySelector('[data-xtu-gv-prev]');
    var nextBtn = root.querySelector('[data-xtu-gv-next]');
    var pageLabel = root.querySelector('[data-xtu-gv-page-label]');

    if (!tabsEl || !gridEl || !pagerEl) return;

    root.style.setProperty('--xtu-gv-columns', String(columns));

    var activeCategory = '';
    var pageIndex = 0;
    /** @type {number} */
    var activeTabIndex = 0;
    /** @type {HTMLElement | null} */
    var playingCard = null;

    function videosInCategory(categoryId) {
      return videos
        .filter(function (item) {
          return String(item.category || '') === String(categoryId || '');
        })
        .sort(function (a, b) {
          return (Number(a.sort) || 0) - (Number(b.sort) || 0);
        });
    }

    function resolveCategory() {
      for (var i = 0; i < categories.length; i += 1) {
        if (videosInCategory(categories[i].id).length) return categories[i].id;
      }
      return categories[0] ? categories[0].id : videos[0] ? String(videos[0].category || '') : '';
    }

    /**
     * @param {HTMLElement} tab
     * @param {'start' | 'end'} edge
     */
    function scrollTabToEdge(tab, edge) {
      if (!(tabsEl instanceof HTMLElement) || !(tab instanceof HTMLElement)) return;
      var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var styles = getComputedStyle(tabsEl);
      var padStart = parseFloat(styles.paddingInlineStart) || 0;
      var padEnd = parseFloat(styles.paddingInlineEnd) || 0;
      var maxScroll = Math.max(0, tabsEl.scrollWidth - tabsEl.clientWidth);
      var tabs = Array.from(tabsEl.querySelectorAll('[data-xtu-gv-tab]'));
      var isFirst = tabs[0] === tab;
      var isLast = tabs[tabs.length - 1] === tab;
      var targetLeft = 0;

      if (edge === 'end') {
        targetLeft = isLast ? maxScroll : tab.offsetLeft + tab.offsetWidth - tabsEl.clientWidth + padEnd;
      } else if (!isFirst) {
        targetLeft = tab.offsetLeft - padStart;
      }

      tabsEl.scrollTo({
        left: Math.max(0, Math.min(targetLeft, maxScroll)),
        behavior: reduced ? 'auto' : 'smooth',
      });
    }

    function stopPlaying() {
      if (!playingCard) return;
      var host = playingCard.querySelector('video.xtu-gv__video');
      if (host) {
        host.pause();
        host.removeAttribute('src');
        host.load();
        if (host.parentNode) host.parentNode.removeChild(host);
      }
      var iframe = playingCard.querySelector('iframe');
      if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
      playingCard.classList.remove('is-playing');
      var cover = playingCard.querySelector('[data-xtu-gv-cover]');
      if (cover) cover.hidden = false;
      playingCard = null;
    }

    /**
     * @param {HTMLElement} card
     * @param {object} item
     */
    function playCard(card, item) {
      stopPlaying();
      var stage = card.querySelector('[data-xtu-gv-stage]');
      var cover = card.querySelector('[data-xtu-gv-cover]');
      if (!stage) return;

      var youtubeId = item.youtubeId || youtubeIdFromUrl(item.youtubeUrl);
      var videoUrl = playableVideoUrl(item.videoUrl);

      if (youtubeId) {
        var iframe = document.createElement('iframe');
        iframe.className = 'xtu-gv__iframe';
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute(
          'allow',
          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
        );
        iframe.setAttribute('title', item.title || 'Video');
        iframe.src =
          'https://www.youtube.com/embed/' +
          encodeURIComponent(youtubeId) +
          '?autoplay=1&rel=0&modestbranding=1';
        stage.appendChild(iframe);
      } else if (videoUrl) {
        var video = document.createElement('video');
        video.className = 'xtu-gv__video';
        video.setAttribute('controls', '');
        video.setAttribute('playsinline', '');
        video.setAttribute('preload', 'metadata');
        if (item.cover) video.setAttribute('poster', item.cover);
        video.src = videoUrl;
        stage.appendChild(video);
        var playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(function () {});
      } else {
        return;
      }

      if (cover) cover.hidden = true;
      card.classList.add('is-playing');
      playingCard = card;
    }

    function renderTabs() {
      tabsEl.innerHTML = '';
      var usable = categories.filter(function (category) {
        return videosInCategory(category.id).length > 0;
      });

      if (!usable.length) {
        tabsEl.hidden = true;
        return;
      }

      tabsEl.hidden = false;
      usable.forEach(function (category, index) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'xtu-gv__tab' + (category.id === activeCategory ? ' is-active' : '');
        button.textContent = category.label || category.id;
        button.setAttribute('role', 'tab');
        button.setAttribute('data-xtu-gv-tab', '');
        button.setAttribute('aria-selected', category.id === activeCategory ? 'true' : 'false');
        button.addEventListener('click', function () {
          if (category.id === activeCategory) return;
          var prevIndex = activeTabIndex;
          activeCategory = category.id;
          activeTabIndex = index;
          pageIndex = 0;
          stopPlaying();
          renderTabs();
          renderGrid();
          var edge = index < prevIndex ? 'end' : 'start';
          if (prevIndex === usable.length - 1 && index === 0) edge = 'start';
          if (prevIndex === 0 && index === usable.length - 1) edge = 'end';
          scrollTabToEdge(button, edge);
        });
        tabsEl.appendChild(button);
      });
    }

    function renderGrid() {
      var pool = videosInCategory(activeCategory);
      var totalPages = Math.max(1, Math.ceil(pool.length / perPage));
      if (pageIndex > totalPages - 1) pageIndex = totalPages - 1;
      if (pageIndex < 0) pageIndex = 0;

      var start = pageIndex * perPage;
      var pageItems = pool.slice(start, start + perPage);

      gridEl.innerHTML = '';
      pageItems.forEach(function (item) {
        if (!item.youtubeId && !item.videoUrl) return;
        var card = document.createElement('article');
        card.className = 'xtu-gv__card';

        var stage = document.createElement('div');
        stage.className = 'xtu-gv__stage';
        stage.setAttribute('data-xtu-gv-stage', '');

        var coverWrap = document.createElement('button');
        coverWrap.type = 'button';
        coverWrap.className = 'xtu-gv__cover';
        coverWrap.setAttribute('data-xtu-gv-cover', '');
        coverWrap.setAttribute('aria-label', 'Play ' + (item.title || 'video'));

        var coverSrc = item.cover || '';
        if (!coverSrc && item.youtubeId) {
          coverSrc = 'https://i.ytimg.com/vi/' + item.youtubeId + '/hqdefault.jpg';
        }

        if (coverSrc) {
          var img = document.createElement('img');
          img.className = 'xtu-gv__cover-image';
          img.loading = 'lazy';
          img.decoding = 'async';
          img.alt = item.title || '';
          img.src = coverSrc;
          coverWrap.appendChild(img);
        } else if (item.videoUrl) {
          var poster = document.createElement('video');
          poster.className = 'xtu-gv__cover-image';
          bindFirstFramePoster(poster, item.videoUrl);
          coverWrap.appendChild(poster);
        } else {
          var fallback = document.createElement('img');
          fallback.className = 'xtu-gv__cover-image';
          fallback.alt = item.title || '';
          fallback.src =
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Crect fill='%23e8eaed' width='16' height='9'/%3E%3C/svg%3E";
          coverWrap.appendChild(fallback);
        }

        var play = document.createElement('span');
        play.className = 'xtu-gv__play';
        play.setAttribute('aria-hidden', 'true');
        play.innerHTML =
          '<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="24" fill="rgb(0 0 0 / 0.55)"/><path d="M20 16.5v15l12-7.5-12-7.5Z" fill="#fff"/></svg>';
        coverWrap.appendChild(play);

        coverWrap.addEventListener('click', function () {
          playCard(card, item);
        });

        stage.appendChild(coverWrap);
        card.appendChild(stage);

        if (item.title) {
          var title = document.createElement('h3');
          title.className = 'xtu-gv__title';
          title.textContent = item.title;
          card.appendChild(title);
        }

        gridEl.appendChild(card);
      });

      if (emptyEl) emptyEl.hidden = pageItems.length > 0;

      var showPager = pool.length > perPage;
      pagerEl.hidden = !showPager;
      if (pageLabel) {
        pageLabel.textContent = pool.length
          ? String(pageIndex + 1) + ' / ' + String(totalPages)
          : '0 / 0';
      }
      if (prevBtn instanceof HTMLButtonElement) {
        prevBtn.disabled = pageIndex <= 0;
      }
      if (nextBtn instanceof HTMLButtonElement) {
        nextBtn.disabled = pageIndex >= totalPages - 1;
      }
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        if (pageIndex <= 0) return;
        pageIndex -= 1;
        stopPlaying();
        renderGrid();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        var totalPages = Math.max(1, Math.ceil(videosInCategory(activeCategory).length / perPage));
        if (pageIndex >= totalPages - 1) return;
        pageIndex += 1;
        stopPlaying();
        renderGrid();
      });
    }

    activeCategory = resolveCategory();
    activeTabIndex = Math.max(
      0,
      categories.findIndex(function (category) {
        return category.id === activeCategory;
      })
    );
    renderTabs();
    renderGrid();
  }

  function boot(scope) {
    var roots = (scope || document).querySelectorAll('[data-xtu-guide-video]');
    Array.prototype.forEach.call(roots, function (root) {
      if (root instanceof HTMLElement) initRoot(root);
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
