(function initXtuBlogList() {
  /** @type {string[]} */
  const prefetched = [];

  /**
   * @param {string} url
   */
  function prefetchUrl(url) {
    if (!url || prefetched.includes(url)) return;
    prefetched.push(url);
    fetch(url, {
      credentials: 'same-origin',
      headers: { Accept: 'text/html' },
    }).catch(function () {
      /* ignore prefetch errors */
    });
  }

  /**
   * @param {ParentNode} root
   * @param {string} selector
   * @returns {HTMLElement | null}
   */
  function pick(root, selector) {
    const node = root.querySelector(selector);
    return node instanceof HTMLElement ? node : null;
  }

  /**
   * @param {HTMLElement} section
   * @param {HTMLElement} nextSection
   * @param {string} selector
   * @param {HTMLElement | null} [insertBefore]
   */
  function replaceBlock(section, nextSection, selector, insertBefore) {
    const target = pick(section, selector);
    const source = pick(nextSection, selector);

    if (target && source) {
      target.replaceWith(source.cloneNode(true));
      return;
    }

    if (target && !source) {
      target.remove();
      return;
    }

    if (!target && source && insertBefore) {
      insertBefore.before(source.cloneNode(true));
    }
  }

  /**
   * @param {HTMLElement} section
   * @param {string} url
   * @param {{ push?: boolean }} [options]
   */
  async function navigateSection(section, url, options) {
    const push = options?.push !== false;
    if (section.classList.contains('is-loading')) return;

    section.classList.add('is-loading');
    section.setAttribute('aria-busy', 'true');

    try {
      const response = await fetch(url, {
        credentials: 'same-origin',
        headers: { Accept: 'text/html' },
      });

      if (!response.ok) throw new Error('fetch failed');

      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const nextSection = pick(doc, '[data-xtu-blog-list]');

      if (!nextSection) {
        window.location.assign(url);
        return;
      }

      const panel = pick(section, '[data-xtu-blog-panel]');

      replaceBlock(section, nextSection, '[data-xtu-blog-heading]');
      replaceBlock(section, nextSection, '[data-xtu-blog-tabs]');
      replaceBlock(section, nextSection, '[data-xtu-blog-filter]', panel);

      const nextPanel = pick(nextSection, '[data-xtu-blog-panel]');
      const currentPanel = pick(section, '[data-xtu-blog-panel]');
      if (currentPanel && nextPanel) {
        currentPanel.replaceWith(nextPanel.cloneNode(true));
      }

      const nextTitle = doc.querySelector('title');
      if (nextTitle?.textContent) {
        document.title = nextTitle.textContent;
      }

      if (push) {
        history.pushState({ xtuBlog: url }, '', url);
      }

      bindSection(section);

      const head = pick(section, '.xtu-blog-list__inner--head');
      if (head) {
        head.scrollIntoView({ block: 'start', behavior: 'instant' in window ? 'instant' : 'auto' });
      }
    } catch (_error) {
      window.location.assign(url);
    } finally {
      section.classList.remove('is-loading');
      section.removeAttribute('aria-busy');
    }
  }

  /**
   * @param {HTMLElement} section
   */
  function bindSection(section) {
    section.querySelectorAll('[data-xtu-blog-tab]').forEach(function (link) {
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.dataset.xtuBlogTabBound === 'true') return;

      link.dataset.xtuBlogTabBound = 'true';

      link.addEventListener('mouseenter', function () {
        prefetchUrl(link.href);
      });

      link.addEventListener('focus', function () {
        prefetchUrl(link.href);
      });

      link.addEventListener('click', function (event) {
        if (link.classList.contains('is-active')) {
          event.preventDefault();
          return;
        }

        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
          return;
        }

        event.preventDefault();
        navigateSection(section, link.href);
      });
    });

    section.querySelectorAll('[data-xtu-blog-tag-select]').forEach(function (select) {
      if (!(select instanceof HTMLSelectElement)) return;
      if (select.dataset.xtuBlogTagBound === 'true') return;

      select.dataset.xtuBlogTagBound = 'true';
      select.addEventListener('change', function () {
        const url = select.value;
        if (!url) return;
        navigateSection(section, url);
      });
    });
  }

  document.querySelectorAll('[data-xtu-blog-list]').forEach(function (section) {
    if (!(section instanceof HTMLElement)) return;

    bindSection(section);

    section.querySelectorAll('[data-xtu-blog-tab]').forEach(function (link) {
      if (link instanceof HTMLAnchorElement && !link.classList.contains('is-active')) {
        prefetchUrl(link.href);
      }
    });

    if (!history.state?.xtuBlog) {
      history.replaceState({ xtuBlog: window.location.href }, '', window.location.href);
    }
  });

  window.addEventListener('popstate', function (event) {
    const url = event.state?.xtuBlog;
    if (!url) return;

    const section = document.querySelector('[data-xtu-blog-list]');
    if (!(section instanceof HTMLElement)) return;

    navigateSection(section, url, { push: false });
  });
})();
