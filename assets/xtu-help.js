/**
 * XTU Help Center
 *
 * 读取 [data-xtu-help-catalog] JSON，渲染左侧产品与右侧内容。
 * URL ?s= 产品码用 pushState 同步，不刷新页面。
 * 顶栏 [data-help-nav-link] 跳转时带上当前 s。
 * 无内容的产品不出现在侧栏 / 移动端 chips。
 * 左侧列表：products[].image（关联商品主图）显示在标题左侧。
 * Video / FAQ：语言 Tab；Manual：语言卡。默认 emoji 旗帜；Windows 用内联 SVG；Metaobject 上传 icon 优先。
 *
 * catalog: { type, products[], languages[], items[], emptyText, columns, perPage, openFirst }
 */
(function initXtuHelp() {
  'use strict';

  var MAX_LANGS = 6;
  var DEFAULT_SOFTWARE_CODE = '__default';
  var DEFAULT_LANG = 'default';

  /** Built-in labels；默认 emoji 旗帜，Windows 回退内联 SVG（见 langIconHtml） */
  var LANG_DEFAULTS = {
    en: { label: 'English', country: 'us', emoji: '🇺🇸' },
    'zh-cn': { label: '中文', country: 'cn', emoji: '🇨🇳' },
    'zh-tw': { label: '繁體中文', country: 'tw', emoji: '🇹🇼' },
    de: { label: 'Deutsch', country: 'de', emoji: '🇩🇪' },
    fr: { label: 'Français', country: 'fr', emoji: '🇫🇷' },
    es: { label: 'Español', country: 'es', emoji: '🇪🇸' },
    ja: { label: '日本語', country: 'jp', emoji: '🇯🇵' },
    jp: { label: '日本語', country: 'jp', emoji: '🇯🇵' },
    it: { label: 'Italiano', country: 'it', emoji: '🇮🇹' },
    ko: { label: '한국어', country: 'kr', emoji: '🇰🇷' },
    pt: { label: 'Português', country: 'pt', emoji: '🇵🇹' },
    nl: { label: 'Nederlands', country: 'nl', emoji: '🇳🇱' },
    ru: { label: 'Русский', country: 'ru', emoji: '🇷🇺' },
    default: { label: 'Default', country: '', emoji: '' },
  };

  /** Windows 上 emoji 国旗常为方框，用内联 SVG 替代 */
  var LANG_FLAG_SVGS = {
    us: '<svg viewBox="0 0 20 15" width="20" height="15" aria-hidden="true"><rect width="20" height="15" fill="#b22234"/><path d="M0 1.15h20M0 3.46h20M0 5.77h20M0 8.08h20M0 10.38h20M0 12.69h20" stroke="#fff" stroke-width="1.15"/><rect width="8" height="8.08" fill="#3c3b6e"/><g fill="#fff"><circle cx="1.6" cy="1.35" r=".55"/><circle cx="3.2" cy="1.35" r=".55"/><circle cx="4.8" cy="1.35" r=".55"/><circle cx="6.4" cy="1.35" r=".55"/><circle cx="2.4" cy="2.7" r=".55"/><circle cx="4" cy="2.7" r=".55"/><circle cx="5.6" cy="2.7" r=".55"/></g></svg>',
    cn: '<svg viewBox="0 0 20 15" width="20" height="15" aria-hidden="true"><rect width="20" height="15" fill="#de2910"/><polygon points="4,2.2 4.55,3.9 6.35,3.9 4.9,5 5.45,6.7 4,5.6 2.55,6.7 3.1,5 1.65,3.9 3.45,3.9" fill="#ffde00"/></svg>',
    tw: '<svg viewBox="0 0 20 15" width="20" height="15" aria-hidden="true"><rect width="20" height="15" fill="#fe0000"/><rect width="10" height="7.5" fill="#000095"/><circle cx="5" cy="3.75" r="2.2" fill="#fff"/><circle cx="5" cy="3.75" r="1.5" fill="#000095"/></svg>',
    de: '<svg viewBox="0 0 20 15" width="20" height="15" aria-hidden="true"><rect width="20" height="5" fill="#000"/><rect y="5" width="20" height="5" fill="#dd0000"/><rect y="10" width="20" height="5" fill="#ffce00"/></svg>',
    fr: '<svg viewBox="0 0 20 15" width="20" height="15" aria-hidden="true"><rect width="6.67" height="15" fill="#002395"/><rect x="6.67" width="6.66" height="15" fill="#fff"/><rect x="13.33" width="6.67" height="15" fill="#ed2939"/></svg>',
    es: '<svg viewBox="0 0 20 15" width="20" height="15" aria-hidden="true"><rect width="20" height="15" fill="#c60b1e"/><rect y="3.75" width="20" height="7.5" fill="#ffc400"/></svg>',
    jp: '<svg viewBox="0 0 20 15" width="20" height="15" aria-hidden="true"><rect width="20" height="15" fill="#fff"/><circle cx="10" cy="7.5" r="4.5" fill="#bc002d"/></svg>',
    it: '<svg viewBox="0 0 20 15" width="20" height="15" aria-hidden="true"><rect width="6.67" height="15" fill="#009246"/><rect x="6.67" width="6.66" height="15" fill="#fff"/><rect x="13.33" width="6.67" height="15" fill="#ce2b37"/></svg>',
    kr: '<svg viewBox="0 0 20 15" width="20" height="15" aria-hidden="true"><rect width="20" height="15" fill="#fff"/><circle cx="10" cy="7.5" r="3.5" fill="#c60c30"/><circle cx="10" cy="7.5" r="2.8" fill="#003478" clip-path="inset(0 50% 0 0)"/></svg>',
    pt: '<svg viewBox="0 0 20 15" width="20" height="15" aria-hidden="true"><rect width="8" height="15" fill="#006600"/><rect x="8" width="12" height="15" fill="#ff0000"/><circle cx="8" cy="7.5" r="2.5" fill="#ffcc29"/></svg>',
    nl: '<svg viewBox="0 0 20 15" width="20" height="15" aria-hidden="true"><rect width="20" height="5" fill="#ae1c28"/><rect y="5" width="20" height="5" fill="#fff"/><rect y="10" width="20" height="5" fill="#21468b"/></svg>',
    ru: '<svg viewBox="0 0 20 15" width="20" height="15" aria-hidden="true"><rect width="20" height="5" fill="#fff"/><rect y="5" width="20" height="5" fill="#0039a6"/><rect y="10" width="20" height="5" fill="#d52b1e"/></svg>',
  };

  function langCountryCode(code) {
    var key = normalizeLangCode(code);
    if (LANG_DEFAULTS[key] && LANG_DEFAULTS[key].country) return LANG_DEFAULTS[key].country;
    if (key.indexOf('-') !== -1) return key.split('-').pop();
    return key.length === 2 ? key : '';
  }

  function langFlagEmoji(code) {
    var key = normalizeLangCode(code);
    if (LANG_DEFAULTS[key] && LANG_DEFAULTS[key].emoji) return LANG_DEFAULTS[key].emoji;
    return '';
  }

  function prefersSvgFlag() {
    try {
      return /Windows/i.test(navigator.userAgent || '');
    } catch (_error) {
      return false;
    }
  }

  function langFlagSvgHtml(code) {
    var country = langCountryCode(code);
    var svg = country && LANG_FLAG_SVGS[country];
    if (!svg) return '';
    return '<span class="xtu-help-lang-icon xtu-help-lang-icon--flag-svg" aria-hidden="true">' + svg + '</span>';
  }

  function asUrl(value) {
    if (!value) return '';
    if (typeof value === 'object' && value.url) return String(value.url);
    return String(value);
  }

  function youtubeIdFromUrl(url) {
    var str = asUrl(url);
    if (!str) return '';
    var match = str.match(
      /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return match ? match[1] : '';
  }

  function playableVideoUrl(url) {
    var str = asUrl(url).trim();
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

  function getS() {
    try {
      return String(new URL(window.location.href).searchParams.get('s') || '')
        .trim()
        .toLowerCase();
    } catch (_error) {
      return '';
    }
  }

  function setS(code, replace) {
    var url = new URL(window.location.href);
    if (code) url.searchParams.set('s', code);
    else url.searchParams.delete('s');
    if (replace) history.replaceState(null, '', url.toString());
    else history.pushState(null, '', url.toString());
  }

  function sortBySort(a, b) {
    return (Number(a.sort) || 0) - (Number(b.sort) || 0);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function platformLabel(code) {
    var map = {
      ios: 'iOS',
      android: 'Android',
      windows: 'Windows',
      macos: 'macOS',
    };
    var key = String(code || '').toLowerCase();
    return map[key] || code || '';
  }

  function normalizeLangCode(value) {
    var code = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/_/g, '-');
    return code || DEFAULT_LANG;
  }

  /**
   * @param {Array<{code?: string, label?: string, icon?: string, sort?: number}>} catalogLangs
   */
  function buildLangMap(catalogLangs) {
    /** @type {Record<string, {code: string, label: string, icon: string, country: string, sort: number}>} */
    var map = {};
    Object.keys(LANG_DEFAULTS).forEach(function (code) {
      map[code] = {
        code: code,
        label: LANG_DEFAULTS[code].label,
        icon: '',
        country: LANG_DEFAULTS[code].country || '',
        sort: 1000,
      };
    });
    (Array.isArray(catalogLangs) ? catalogLangs : []).forEach(function (entry) {
      var code = normalizeLangCode(entry && entry.code);
      if (!code || code === DEFAULT_LANG) return;
      var prev = map[code] || {
        code: code,
        label: code,
        icon: '',
        country: langCountryCode(code),
        sort: 1000,
      };
      map[code] = {
        code: code,
        label: (entry.label && String(entry.label).trim()) || prev.label,
        icon: (entry.icon && String(entry.icon).trim()) || prev.icon,
        country: prev.country || langCountryCode(code),
        sort: entry.sort != null ? Number(entry.sort) || 0 : prev.sort,
      };
    });
    return map;
  }

  function resolveLang(langMap, code, labelOverride) {
    var key = normalizeLangCode(code);
    var base = langMap[key] || {
      code: key,
      label: key === DEFAULT_LANG ? 'Default' : key,
      icon: '',
      country: langCountryCode(key),
      sort: 2000,
    };
    return {
      code: key,
      label: (labelOverride && String(labelOverride).trim()) || base.label,
      icon: base.icon,
      country: base.country,
      sort: base.sort,
    };
  }

  function langIconHtml(lang) {
    if (lang.icon) {
      return (
        '<img class="xtu-help-lang-icon" src="' +
        escapeHtml(lang.icon) +
        '" alt="" width="20" height="20" loading="lazy" decoding="async">'
      );
    }
    if (prefersSvgFlag()) {
      var svgHtml = langFlagSvgHtml(lang.code);
      if (svgHtml) return svgHtml;
    }
    var emoji = langFlagEmoji(lang.code);
    if (emoji) {
      return '<span class="xtu-help-lang-icon xtu-help-lang-icon--emoji" aria-hidden="true">' + emoji + '</span>';
    }
    return (
      '<span class="xtu-help-lang-icon xtu-help-lang-icon--globe" aria-hidden="true">' +
      '<svg viewBox="0 0 20 20" fill="none" width="20" height="20"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.4"/><path d="M2 10h16M10 2c2.2 2.4 3.4 5.1 3.4 8s-1.2 5.6-3.4 8M10 2C7.8 4.4 6.6 7.1 6.6 10s1.2 5.6 3.4 8" stroke="currentColor" stroke-width="1.2"/></svg>' +
      '</span>'
    );
  }

  function collectLangs(items, langMap) {
    /** @type {Record<string, {code: string, label: string, icon: string, country: string, sort: number}>} */
    var langs = {};
    (Array.isArray(items) ? items : []).forEach(function (item) {
      var meta = resolveLang(langMap, item.language, item.languageLabel || item.label);
      var itemSort = item.langSort != null ? Number(item.langSort) : NaN;
      var sort = !isNaN(itemSort) ? itemSort : meta.sort;
      if (!langs[meta.code]) {
        langs[meta.code] = {
          code: meta.code,
          label: meta.label,
          icon: meta.icon,
          country: meta.country,
          sort: sort,
        };
      } else if (sort < langs[meta.code].sort) {
        langs[meta.code].sort = sort;
      }
    });
    return Object.keys(langs)
      .map(function (code) {
        return langs[code];
      })
      .sort(function (a, b) {
        return (a.sort || 0) - (b.sort || 0) || a.label.localeCompare(b.label);
      })
      .slice(0, MAX_LANGS);
  }

  function bindNavLinks() {
    document.querySelectorAll('[data-help-nav-link]').forEach(function (link) {
      if (link.getAttribute('data-help-nav-bound') === 'true') return;
      link.setAttribute('data-help-nav-bound', 'true');
      link.addEventListener('click', function (event) {
        var code = getS();
        if (!code) return;
        var href = link.getAttribute('href');
        if (!href) return;
        event.preventDefault();
        var url = new URL(href, window.location.origin);
        url.searchParams.set('s', code);
        window.location.href = url.toString();
      });
    });
  }

  /**
   * Scroll only within a horizontal strip — never element.scrollIntoView (avoids page X-scroll on iOS).
   * Active items toward the end snap to the right edge so FAQ etc. stay on-screen.
   * @param {Element | null} scroller
   * @param {Element | null} child
   * @param {{ behavior?: ScrollBehavior }} [opts]
   */
  function scrollStripToChild(scroller, child, opts) {
    if (!(scroller instanceof HTMLElement) || !(child instanceof HTMLElement)) return;
    if (!(scroller.contains(child))) return;

    var max = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    if (max <= 0) return;

    var behavior = (opts && opts.behavior) || 'auto';
    var pad = 8;
    var childLeft = child.offsetLeft;
    var childRight = childLeft + child.offsetWidth;
    var mid = scroller.scrollWidth / 2;
    var nextLeft;

    /* Prefer right-align when active item sits in the right half of the strip */
    if (childLeft + child.offsetWidth / 2 >= mid) {
      nextLeft = Math.min(max, Math.max(0, childRight - scroller.clientWidth + pad));
    } else {
      nextLeft = Math.min(max, Math.max(0, childLeft + child.offsetWidth / 2 - scroller.clientWidth / 2));
    }

    scroller.scrollTo({ left: nextLeft, behavior: behavior });
  }

  function syncActiveHelpNavTab() {
    document.querySelectorAll('[data-xtu-help-nav]').forEach(function (nav) {
      if (!(nav instanceof HTMLElement)) return;
      var tabs = nav.querySelector('.xtu-help-nav__tabs');
      var active =
        nav.querySelector('.xtu-help-nav__tab.is-active') ||
        nav.querySelector('.xtu-help-nav__tab[aria-current="page"]');
      scrollStripToChild(tabs, active, { behavior: 'auto' });
    });
  }

  function itemsForProduct(type, items, code) {
    var own = items.filter(function (item) {
      return String(item.productCode || '') === String(code);
    });
    if (type === 'software' && !own.length) {
      return items.filter(function (item) {
        return String(item.productCode || '') === DEFAULT_SOFTWARE_CODE;
      });
    }
    return own;
  }

  function renderManual(items, langMap) {
    if (!items.length) return '';
    return (
      '<div class="xtu-help-card-grid">' +
      items
        .slice()
        .sort(sortBySort)
        .map(function (item) {
          var lang = resolveLang(langMap, item.language, item.label || item.languageLabel);
          var href = item.url || '#';
          return (
            '<a class="xtu-help-card" href="' +
            escapeHtml(href) +
            '" target="_blank" rel="noopener">' +
            '<span class="xtu-help-card__row">' +
            langIconHtml(lang) +
            '<span class="xtu-help-card__label">' +
            escapeHtml(lang.label || item.label || item.language || 'Download') +
            '</span>' +
            '</span>' +
            (item.language && item.label && item.label !== lang.label
              ? '<span class="xtu-help-card__meta">' + escapeHtml(item.language) + '</span>'
              : '') +
            '</a>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function renderFirmware(items) {
    if (!items.length) return '';
    return (
      '<div class="xtu-help-fw">' +
      items
        .slice()
        .sort(sortBySort)
        .map(function (item) {
          var href = item.url || '';
          return (
            '<article class="xtu-help-fw__item">' +
            '<div class="xtu-help-fw__top">' +
            '<div><h3 class="xtu-help-fw__version">' +
            escapeHtml(item.version || '') +
            '</h3>' +
            (item.releasedAt
              ? '<p class="xtu-help-fw__date">' + escapeHtml(item.releasedAt) + '</p>'
              : '') +
            '</div>' +
            (item.latest ? '<span class="xtu-help-fw__badge">Latest</span>' : '') +
            '</div>' +
            (item.notes ? '<div class="xtu-help-fw__notes">' + item.notes + '</div>' : '') +
            (href
              ? '<div class="xtu-help-fw__actions"><a class="xtu-btn" href="' +
                escapeHtml(href) +
                '" target="_blank" rel="noopener"><span class="xtu-btn__label">Download</span></a></div>'
              : '') +
            '</article>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function renderSoftware(items) {
    if (!items.length) return '';
    return (
      '<div class="xtu-help-sw">' +
      items
        .slice()
        .sort(sortBySort)
        .map(function (item) {
          var actions = '';
          if (item.storeUrl) {
            actions +=
              '<a class="xtu-btn xtu-btn--sm" href="' +
              escapeHtml(item.storeUrl) +
              '" target="_blank" rel="noopener"><span class="xtu-btn__label">Get app</span></a>';
          }
          if (item.fileUrl) {
            actions +=
              '<a class="xtu-btn xtu-btn--sm" href="' +
              escapeHtml(item.fileUrl) +
              '" target="_blank" rel="noopener"><span class="xtu-btn__label">Download</span></a>';
          }
          return (
            '<article class="xtu-help-sw__item">' +
            (item.image
              ? '<img class="xtu-help-sw__image" src="' +
                escapeHtml(item.image) +
                '" alt="" width="72" height="72" loading="lazy">'
              : '') +
            '<div>' +
            '<h3 class="xtu-help-sw__title">' +
            escapeHtml(item.title || '') +
            '</h3>' +
            (item.platform
              ? '<p class="xtu-help-sw__platform">' + escapeHtml(platformLabel(item.platform)) + '</p>'
              : '') +
            (item.description ? '<div class="xtu-help-sw__desc">' + item.description + '</div>' : '') +
            (item.qrCode
              ? '<img class="xtu-help-sw__qr" src="' +
                escapeHtml(item.qrCode) +
                '" alt="" width="120" height="120" loading="lazy" decoding="async">'
              : '') +
            (actions ? '<div class="xtu-help-sw__actions">' + actions + '</div>' : '') +
            '</div></article>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function renderLangTabs(langs, activeCode) {
    if (langs.length <= 1) return '';
    return (
      '<div class="xtu-help-lang-tabs" role="tablist">' +
      langs
        .map(function (lang) {
          var on = lang.code === activeCode;
          return (
            '<button type="button" class="xtu-help-lang-tab' +
            (on ? ' is-active' : '') +
            '" data-help-lang-tab="' +
            escapeHtml(lang.code) +
            '" role="tab" aria-selected="' +
            (on ? 'true' : 'false') +
            '">' +
            '<span class="xtu-help-lang-tab__label">' +
            escapeHtml(lang.label) +
            '</span>' +
            langIconHtml(lang) +
            '</button>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function renderFaq(items, openFirst, langMap) {
    var langs = collectLangs(items, langMap);
    if (!langs.length) return '';
    var active = langs[0].code;

    var tabs = renderLangTabs(langs, active);

    var panels = langs
      .map(function (lang, langIndex) {
        var questions = items
          .filter(function (item) {
            return normalizeLangCode(item.language) === lang.code;
          })
          .sort(sortBySort);
        return (
          '<div class="xtu-help-faq__lang" data-help-lang-panel="' +
          escapeHtml(lang.code) +
          '"' +
          (langIndex === 0 ? '' : ' hidden') +
          '>' +
          questions
            .map(function (item, index) {
              return (
                '<details class="xtu-help-faq__item"' +
                (openFirst && index === 0 ? ' open' : '') +
                '>' +
                '<summary class="xtu-help-faq__question"><span>' +
                escapeHtml(item.question || '') +
                '</span><span class="xtu-help-faq__icon" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none"><path d="M4 6.5 8 10.5 12 6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span></summary>' +
                (item.answer ? '<div class="xtu-help-faq__answer">' + item.answer + '</div>' : '') +
                '</details>'
              );
            })
            .join('') +
          '</div>'
        );
      })
      .join('');

    return tabs + panels;
  }

  function videoCover(item) {
    if (item.cover) return item.cover;
    if (item.youtubeId) return 'https://img.youtube.com/vi/' + item.youtubeId + '/hqdefault.jpg';
    return '';
  }

  function renderVideoCards(items, pageIndex, perPage, columns) {
    var total = Math.max(1, Math.ceil(items.length / perPage) || 1);
    var page = Math.min(Math.max(0, pageIndex), total - 1);
    if (!items.length) return '';

    var slice = items.slice(page * perPage, page * perPage + perPage);
    var cards = slice
      .map(function (item, index) {
        var cover = videoCover(item);
        var posterHtml = '';
        if (cover) {
          posterHtml =
            '<img src="' +
            escapeHtml(cover) +
            '" alt="" loading="lazy" width="640" height="360">';
        } else if (item.videoUrl) {
          posterHtml =
            '<video class="xtu-help-video__cover-media" muted playsinline preload="metadata" aria-hidden="true" src="' +
            escapeHtml(item.videoUrl) +
            '"></video>';
        } else {
          posterHtml = '<span class="xtu-help-video__placeholder"></span>';
        }
        return (
          '<article class="xtu-help-video__card">' +
          '<div class="xtu-help-video__stage" data-help-video-stage>' +
          '<button type="button" class="xtu-help-video__cover" data-help-video-play data-help-video-index="' +
          index +
          '" aria-label="Play ' +
          escapeHtml(item.title || 'video') +
          '">' +
          posterHtml +
          '<span class="xtu-help-video__play" aria-hidden="true"><span class="xtu-help-video__play-icon"><svg viewBox="0 0 12 12" fill="currentColor"><path d="M3 1.8v8.4L10.2 6 3 1.8Z"/></svg></span></span>' +
          '</button></div>' +
          '<p class="xtu-help-video__title">' +
          escapeHtml(item.title || 'Video') +
          '</p></article>'
        );
      })
      .join('');

    var pager =
      items.length > perPage
        ? '<div class="xtu-help-video__pager">' +
          '<button type="button" class="xtu-help-video__btn" data-help-video-prev aria-label="Previous"' +
          (page === 0 ? ' disabled' : '') +
          '>&lsaquo;</button>' +
          '<span class="xtu-help-video__page">' +
          (page + 1) +
          ' / ' +
          total +
          '</span>' +
          '<button type="button" class="xtu-help-video__btn" data-help-video-next aria-label="Next"' +
          (page >= total - 1 ? ' disabled' : '') +
          '>&rsaquo;</button></div>'
        : '';

    return (
      '<div class="xtu-help-video" style="--xtu-help-video-cols:' +
      columns +
      '">' +
      '<div class="xtu-help-video__grid">' +
      cards +
      '</div>' +
      pager +
      '</div>'
    );
  }

  function renderVideo(items, pageIndex, perPage, columns, langMap, activeLang) {
    var langs = collectLangs(items, langMap);
    if (!langs.length) return '';

    var langCode = activeLang;
    if (!langCode || !langs.some(function (lang) {
      return lang.code === langCode;
    })) {
      langCode = langs[0].code;
    }

    var filtered = items.filter(function (item) {
      return normalizeLangCode(item.language) === langCode;
    });

    return (
      renderLangTabs(langs, langCode) +
      '<div class="xtu-help-video-lang" data-help-lang-panel="' +
      escapeHtml(langCode) +
      '">' +
      renderVideoCards(filtered, pageIndex, perPage, columns) +
      '</div>'
    );
  }

  function playVideo(card, item) {
    var stage = card.querySelector('[data-help-video-stage]');
    var cover = card.querySelector('[data-help-video-play]');
    if (!stage || card.classList.contains('is-playing')) return;

    var youtubeId = item.youtubeId || youtubeIdFromUrl(item.youtubeUrl);
    var videoUrl = playableVideoUrl(item.videoUrl);
    if (!youtubeId && !videoUrl) return;

    if (youtubeId) {
      var iframe = document.createElement('iframe');
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute(
        'allow',
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
      );
      iframe.title = item.title || 'Video';
      iframe.src =
        'https://www.youtube.com/embed/' +
        encodeURIComponent(youtubeId) +
        '?autoplay=1&rel=0&modestbranding=1';
      stage.appendChild(iframe);
    } else {
      var video = document.createElement('video');
      video.className = 'xtu-help-video__player';
      video.setAttribute('controls', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('preload', 'metadata');
      if (item.cover) video.setAttribute('poster', item.cover);
      video.src = videoUrl;
      stage.appendChild(video);
      var playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(function () {});
    }

    if (cover) cover.hidden = true;
    card.classList.add('is-playing');
  }

  function stopVideos(root) {
    root.querySelectorAll('video.xtu-help-video__player').forEach(function (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
      if (video.parentNode) video.parentNode.removeChild(video);
    });
    root.querySelectorAll('iframe').forEach(function (iframe) {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    });
    root.querySelectorAll('.xtu-help-video__card').forEach(function (card) {
      card.classList.remove('is-playing');
    });
    root.querySelectorAll('[data-help-video-play]').forEach(function (el) {
      el.hidden = false;
    });
  }

  function initRoot(root) {
    if (root.getAttribute('data-xtu-help-bound') === 'true') return;

    var catalogEl = root.querySelector('[data-xtu-help-catalog]');
    if (!catalogEl) return;

    var catalog;
    try {
      catalog = JSON.parse(catalogEl.textContent || '{}');
    } catch (_error) {
      return;
    }

    root.setAttribute('data-xtu-help-bound', 'true');

    function startHelpRoot() {
      bindHelpRoot(root, catalog);
    }

    var catalogUrl = catalog.catalogUrl;
    if (!catalogUrl) {
      startHelpRoot();
      return;
    }

    fetch(catalogUrl)
      .then(function (res) {
        if (!res.ok) throw new Error('catalog fetch failed');
        return res.json();
      })
      .then(function (remote) {
        if (remote && Array.isArray(remote.items) && remote.items.length) {
          catalog.items = remote.items;
        }
        if (remote && Array.isArray(remote.languages) && remote.languages.length) {
          catalog.languages = remote.languages;
        }
        startHelpRoot();
      })
      .catch(function () {
        startHelpRoot();
      });
  }

  function bindHelpRoot(root, catalog) {
    var type = catalog.type || 'manual';
    var langMap = buildLangMap(catalog.languages);
    var allProducts = (Array.isArray(catalog.products) ? catalog.products : [])
      .filter(function (item) {
        return item && item.code;
      })
      .sort(sortBySort);
    var items = (Array.isArray(catalog.items) ? catalog.items : []).map(function (item) {
      var youtubeId = item.youtubeId || youtubeIdFromUrl(item.youtubeUrl || item.youtube_url);
      var videoUrl = playableVideoUrl(item.videoUrl);
      var mediaType = item.type;
      if (!mediaType) {
        if (youtubeId) mediaType = 'youtube';
        else if (videoUrl) mediaType = 'video';
      }
      return Object.assign({}, item, {
        youtubeId: youtubeId,
        videoUrl: videoUrl,
        type: mediaType,
        language: normalizeLangCode(item.language),
      });
    });

    /* 仅展示当前类型下确有内容的产品 */
    var products = allProducts.filter(function (product) {
      return itemsForProduct(type, items, product.code).length > 0;
    });

    var emptyText = catalog.emptyText || 'No content for this product yet.';
    var columns = Math.max(1, Math.min(3, Number(catalog.columns) || 2));
    var perPage = Math.max(1, Math.min(24, Number(catalog.perPage) || 8));
    var openFirst = Boolean(catalog.openFirst);
    var videoPage = 0;
    var activeVideoLang = '';

    var listEl = root.querySelector('[data-xtu-help-list]');
    var chipsEl = root.querySelector('[data-xtu-help-chips]');
    var stageEl = root.querySelector('[data-xtu-help-stage]');
    var emptyEl = root.querySelector('[data-xtu-help-empty]');
    if (!listEl || !stageEl) return;
    if (emptyEl) emptyEl.textContent = emptyText;

    if (!products.length) {
      listEl.innerHTML = '';
      if (chipsEl) chipsEl.innerHTML = '';
      stageEl.innerHTML = '';
      if (emptyEl) emptyEl.hidden = false;
      return;
    }

    function currentItems(code) {
      return itemsForProduct(type, items, code).slice().sort(sortBySort);
    }

    function bindLangTabs(code) {
      var tabsEl = stageEl.querySelector('.xtu-help-lang-tabs');
      stageEl.querySelectorAll('[data-help-lang-tab]').forEach(function (tab) {
        tab.addEventListener('click', function () {
          var lang = tab.getAttribute('data-help-lang-tab') || '';
          if (type === 'video') {
            activeVideoLang = lang;
            videoPage = 0;
            renderPanel(code);
            return;
          }
          stageEl.querySelectorAll('[data-help-lang-tab]').forEach(function (btn) {
            var on = btn === tab;
            btn.classList.toggle('is-active', on);
            btn.setAttribute('aria-selected', on ? 'true' : 'false');
          });
          stageEl.querySelectorAll('[data-help-lang-panel]').forEach(function (panel) {
            panel.hidden = panel.getAttribute('data-help-lang-panel') !== lang;
          });
          scrollStripToChild(tabsEl, tab, { behavior: 'smooth' });
          if (lang) {
            var url = new URL(window.location.href);
            url.hash = lang;
            history.replaceState(null, '', url.toString());
          }
        });
      });

      var hashLang = (window.location.hash || '').replace('#', '').toLowerCase();
      if (hashLang) {
        var hashTab = stageEl.querySelector('[data-help-lang-tab="' + hashLang + '"]');
        if (hashTab instanceof HTMLElement) hashTab.click();
      } else {
        var activeTab = stageEl.querySelector('.xtu-help-lang-tab.is-active');
        scrollStripToChild(tabsEl, activeTab, { behavior: 'auto' });
      }
    }

    function bindVideoControls(code, panelItems) {
      var langs = collectLangs(panelItems, langMap);
      var langCode = activeVideoLang;
      if (!langCode || !langs.some(function (lang) {
        return lang.code === langCode;
      })) {
        langCode = langs[0] ? langs[0].code : DEFAULT_LANG;
      }
      var filtered = panelItems.filter(function (item) {
        return normalizeLangCode(item.language) === langCode;
      });
      var total = Math.max(1, Math.ceil(filtered.length / perPage) || 1);
      videoPage = Math.min(videoPage, total - 1);
      var visible = filtered.slice(videoPage * perPage, videoPage * perPage + perPage);

      stageEl.querySelectorAll('.xtu-help-video__cover-media').forEach(function (poster) {
        bindFirstFramePoster(poster);
      });
      stageEl.querySelectorAll('[data-help-video-play]').forEach(function (button) {
        button.addEventListener('click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          var index = Number(button.getAttribute('data-help-video-index')) || 0;
          var card = button.closest('.xtu-help-video__card');
          if (!card) return;
          stopVideos(stageEl);
          playVideo(card, visible[index] || {});
        });
      });
      var prev = stageEl.querySelector('[data-help-video-prev]');
      var next = stageEl.querySelector('[data-help-video-next]');
      if (prev) {
        prev.addEventListener('click', function () {
          videoPage = Math.max(0, videoPage - 1);
          renderPanel(code);
        });
      }
      if (next) {
        next.addEventListener('click', function () {
          videoPage = Math.min(total - 1, videoPage + 1);
          renderPanel(code);
        });
      }
    }

    function renderPanel(code) {
      stopVideos(stageEl);
      var panelItems = currentItems(code);
      var html = '';
      if (type === 'manual') html = renderManual(panelItems, langMap);
      else if (type === 'firmware') html = renderFirmware(panelItems);
      else if (type === 'software') html = renderSoftware(panelItems);
      else if (type === 'faq') html = renderFaq(panelItems, openFirst, langMap);
      else if (type === 'video') {
        html = renderVideo(panelItems, videoPage, perPage, columns, langMap, activeVideoLang);
      }

      if (!html) {
        stageEl.innerHTML = '';
        if (emptyEl) emptyEl.hidden = false;
        return;
      }
      if (emptyEl) emptyEl.hidden = true;
      stageEl.innerHTML = html;

      if (type === 'faq' || type === 'video') bindLangTabs(code);
      if (type === 'video') bindVideoControls(code, panelItems);
    }

    function activate(code, writeUrl, replace) {
      if (!code && products[0]) code = products[0].code;
      if (!code) return;
      videoPage = 0;
      activeVideoLang = '';
      listEl.querySelectorAll('[data-help-id]').forEach(function (btn) {
        btn.classList.toggle('is-active', btn.getAttribute('data-help-id') === code);
      });
      if (chipsEl) {
        chipsEl.querySelectorAll('[data-help-id]').forEach(function (btn) {
          var on = btn.getAttribute('data-help-id') === code;
          btn.classList.toggle('is-active', on);
          if (on) scrollStripToChild(chipsEl, btn, { behavior: 'smooth' });
        });
      }
      renderPanel(code);
      if (writeUrl) setS(code, replace);
    }

    listEl.innerHTML = products
      .map(function (product) {
        var thumb = product.image
          ? '<img class="xtu-help__list-thumb" src="' +
            escapeHtml(product.image) +
            '" alt="" width="40" height="40" loading="lazy" decoding="async">'
          : '<span class="xtu-help__list-thumb xtu-help__list-thumb--empty" aria-hidden="true"></span>';
        return (
          '<li><button type="button" class="xtu-help__list-item" data-help-id="' +
          escapeHtml(product.code) +
          '">' +
          thumb +
          '<span class="xtu-help__list-label">' +
          escapeHtml(product.title) +
          '</span></button></li>'
        );
      })
      .join('');

    if (chipsEl) {
      chipsEl.innerHTML = products
        .map(function (product) {
          return (
            '<button type="button" class="xtu-help__chip" data-help-id="' +
            escapeHtml(product.code) +
            '">' +
            escapeHtml(product.title) +
            '</button>'
          );
        })
        .join('');
    }

    root.addEventListener('click', function (event) {
      var target = event.target.closest('[data-help-id]');
      if (!target || !root.contains(target)) return;
      if (target.closest('[data-xtu-help-nav]')) return;
      activate(target.getAttribute('data-help-id'), true, false);
    });

    var initial = getS();
    var known = products.some(function (product) {
      return product.code === initial;
    });
    activate(known ? initial : products[0] && products[0].code, true, !known || !initial);

    window.addEventListener('popstate', function () {
      var code = getS();
      var exists = products.some(function (product) {
        return product.code === code;
      });
      activate(exists ? code : products[0] && products[0].code, false, true);
    });
  }

  function boot() {
    bindNavLinks();
    document.querySelectorAll('[data-xtu-help]').forEach(initRoot);
    /* After layout: bring active Help type tab (e.g. FAQ) into the visible strip */
    requestAnimationFrame(function () {
      syncActiveHelpNavTab();
      requestAnimationFrame(syncActiveHelpNavTab);
    });
    window.addEventListener('resize', syncActiveHelpNavTab, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
