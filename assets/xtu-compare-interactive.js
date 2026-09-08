(function initXtuCompareInteractive() {
  /**
   * @param {unknown} value
   * @returns {Record<string, unknown> | null}
   */
  function asObject(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return /** @type {Record<string, unknown>} */ (value);
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
      } catch (_error) {
        return null;
      }
    }
    return null;
  }

  var META_KEYS = ['title', 'slogan', 'tagline', 'moreUrl', 'more_url', 'learnMore', 'moreLink'];

  /**
   * Pull shared product fields out of compare_specs JSON.
   * @param {unknown} raw
   */
  function extractMeta(raw) {
    const obj = asObject(raw) || {};
    const title = typeof obj.title === 'string' ? obj.title.trim() : '';
    const sloganRaw = obj.slogan || obj.tagline;
    const slogan = typeof sloganRaw === 'string' ? sloganRaw.trim() : '';
    const moreRaw = obj.moreUrl || obj.more_url || obj.learnMore || obj.moreLink;
    const moreUrl = typeof moreRaw === 'string' ? moreRaw.trim() : '';

    /** @type {Record<string, unknown>} */
    const specsRaw = {};
    Object.keys(obj).forEach(function (key) {
      if (META_KEYS.indexOf(key) === -1) specsRaw[key] = obj[key];
    });

    return { title: title, slogan: slogan, moreUrl: moreUrl, specsRaw: specsRaw };
  }

  /**
   * Supports flat `{ "Weight": "138g" }` and nested
   * `{ "电池": { "Weight": "138g" } }` (groups as classification).
   * @param {unknown} raw
   */
  function normalizeSpecs(raw) {
    const obj = asObject(raw) || {};
    /** @type {Record<string, Record<string, unknown>>} */
    const nested = {};
    /** @type {Record<string, unknown>} */
    const flat = {};

    Object.keys(obj).forEach(function (key) {
      const val = obj[key];
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const groupObj = /** @type {Record<string, unknown>} */ (val);
        nested[key] = groupObj;
        Object.keys(groupObj).forEach(function (childKey) {
          flat[childKey] = groupObj[childKey];
        });
      } else {
        flat[key] = val;
      }
    });

    return { nested: nested, flat: flat };
  }

  /**
   * Resolve a cell value. When groupTitle is set, only that group is used —
   * never fall back to another group's same label (e.g. Battery vs Battery2 Capacity).
   * @param {{ nested: Record<string, Record<string, unknown>>, flat: Record<string, unknown> }} specs
   * @param {string} label
   * @param {string} [groupTitle]
   */
  function getSpecValue(specs, label, groupTitle) {
    if (!specs || !label) return null;
    if (groupTitle) {
      const group = specs.nested[groupTitle];
      if (!group || group[label] === undefined || group[label] === null || group[label] === '') {
        return null;
      }
      return group[label];
    }
    if (specs.flat[label] === undefined || specs.flat[label] === null || specs.flat[label] === '') {
      return null;
    }
    return specs.flat[label];
  }

  /**
   * @param {HTMLElement} root
   */
  function initRoot(root) {
    const catalogEl = root.querySelector('[data-xtu-ci-catalog]');
    if (!(catalogEl instanceof HTMLScriptElement) && !(catalogEl instanceof HTMLElement)) return;

    let catalog;
    try {
      catalog = JSON.parse(catalogEl.textContent || '{}');
    } catch (_error) {
      return;
    }

    const categories = Array.isArray(catalog.categories) ? catalog.categories : [];
    const products = (Array.isArray(catalog.products) ? catalog.products : [])
      .map(function (item) {
        const meta = extractMeta(item.specs);
        const specs = normalizeSpecs(meta.specsRaw);
        const title = meta.title || item.title || item.id;
        const slogan = meta.slogan || item.subtitle || '';
        const moreUrl = meta.moreUrl || item.moreUrl || item.buyUrl || '#';
        return Object.assign({}, item, {
          title: title,
          slogan: slogan,
          moreUrl: moreUrl,
          specs: specs,
        });
      })
      .filter(function (item) {
        return item && item.id;
      });

    const emptyValue = catalog.emptyValue || '—';
    const buyLabel = catalog.buyLabel || 'Buy now';
    const moreLabel = catalog.moreLabel || 'Learn more';

    const categoriesEl = root.querySelector('[data-xtu-ci-categories]');
    const specsEl = root.querySelector('[data-xtu-ci-specs]');
    const emptyEl = root.querySelector('[data-xtu-ci-empty]');
    const scroller = root.querySelector('[data-xtu-ci-scroller]');
    const cols = Array.from(root.querySelectorAll('[data-xtu-ci-col]'));

    if (!categoriesEl || !specsEl || cols.length !== 3) return;

    /** @type {string} */
    let activeCategory = '';
    /** @type {(string | null)[]} */
    let selected = [null, null, null];
    /** @type {number} */
    let activeColCount = 3;

    function isMobileLayout() {
      return window.matchMedia('(max-width: 749px)').matches;
    }

    function columnCount() {
      return isMobileLayout() ? 2 : 3;
    }

    function syncColCountMode() {
      activeColCount = columnCount();
      root.dataset.xtuCiCols = String(activeColCount);
      cols.forEach(function (col, index) {
        if (!(col instanceof HTMLElement)) return;
        col.hidden = index >= activeColCount;
      });
    }

    function productsInCategory(categoryId) {
      return products.filter(function (product) {
        return String(product.category || '') === String(categoryId || '');
      });
    }

    function categoryById(categoryId) {
      return categories.find(function (category) {
        return category.id === categoryId;
      });
    }

    function productById(productId) {
      return products.find(function (product) {
        return product.id === productId;
      });
    }

    function resolveCategory() {
      const preferred = catalog.defaultCategory || '';
      if (preferred && categoryById(preferred) && productsInCategory(preferred).length) {
        return preferred;
      }
      for (let i = 0; i < categories.length; i += 1) {
        if (productsInCategory(categories[i].id).length) return categories[i].id;
      }
      if (categories[0]) return categories[0].id;
      const firstProduct = products[0];
      return firstProduct ? String(firstProduct.category || '') : '';
    }

    function selectedProductsInCategory(categoryId) {
      /** @type {typeof products} */
      const list = [];
      /** @type {Record<string, boolean>} */
      const seen = {};
      selected.forEach(function (id, index) {
        if (index >= activeColCount) return;
        if (!id || seen[id]) return;
        const product = productById(id);
        if (!product) return;
        if (String(product.category || '') !== String(categoryId || '')) return;
        seen[id] = true;
        list.push(product);
      });
      return list;
    }

    function buildSchema(categoryId) {
      /** @type {string[]} */
      const groupOrder = [];
      /** @type {Record<string, string[]>} */
      const groupRows = {};
      /** @type {Record<string, boolean>} */
      const seenRows = {};

      function ensureGroup(groupTitle) {
        const key = groupTitle || '';
        if (groupOrder.indexOf(key) === -1) {
          groupOrder.push(key);
          groupRows[key] = [];
        }
      }

      function addRow(label, group) {
        if (!label) return;
        const groupTitle = group || '';
        ensureGroup(groupTitle);
        const rowKey = groupTitle + '::' + label;
        if (seenRows[rowKey]) return;
        seenRows[rowKey] = true;
        groupRows[groupTitle].push(label);
      }

      // Spec rows: union ONLY currently selected columns' products.
      // Unselected pool products must not add groups/rows.
      // Emit per-group so late-discovered keys stay under the correct header.
      selectedProductsInCategory(categoryId).forEach(function (product) {
        if (!product || !product.specs) return;
        const nested = product.specs.nested || {};
        Object.keys(nested).forEach(function (groupTitle) {
          Object.keys(nested[groupTitle] || {}).forEach(function (label) {
            addRow(label, groupTitle);
          });
        });

        const flat = product.specs.flat || {};
        Object.keys(flat).forEach(function (label) {
          let inNested = false;
          Object.keys(nested).forEach(function (groupTitle) {
            if (nested[groupTitle] && nested[groupTitle][label] !== undefined) inNested = true;
          });
          if (inNested) return;
          addRow(label, '');
        });
      });

      /** @type {Array<{type: string, title?: string, label?: string, group?: string}>} */
      const schema = [];
      groupOrder.forEach(function (groupTitle) {
        if (groupTitle) {
          schema.push({ type: 'group', title: groupTitle });
        }
        (groupRows[groupTitle] || []).forEach(function (label) {
          schema.push({ type: 'row', label: label, group: groupTitle });
        });
      });
      return schema;
    }

    function clearMenuLayout(menu) {
      if (!(menu instanceof HTMLElement)) return;
      menu.style.position = '';
      menu.style.top = '';
      menu.style.left = '';
      menu.style.right = '';
      menu.style.width = '';
      menu.style.maxWidth = '';
      menu.style.maxHeight = '';
      menu.classList.remove('is-fullwidth');
    }

    function layoutOpenMenu(menu, trigger) {
      if (!(menu instanceof HTMLElement) || !(trigger instanceof HTMLElement)) return;
      if (!isMobileLayout()) {
        clearMenuLayout(menu);
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const styles = getComputedStyle(document.documentElement);
      const marginRaw = parseFloat(styles.getPropertyValue('--page-margin'));
      const margin = Number.isFinite(marginRaw) && marginRaw > 0 ? marginRaw : 15;
      const gap = 6;
      const top = Math.round(rect.bottom + gap);
      const maxHeight = Math.max(160, Math.floor(window.innerHeight - top - margin));

      menu.classList.add('is-fullwidth');
      menu.style.position = 'fixed';
      menu.style.left = margin + 'px';
      menu.style.right = margin + 'px';
      menu.style.width = 'auto';
      menu.style.maxWidth = 'none';
      menu.style.top = top + 'px';
      menu.style.maxHeight = maxHeight + 'px';
    }

    function syncOpenMenusLayout() {
      cols.forEach(function (col) {
        const dropdown = col.querySelector('[data-xtu-ci-dropdown]');
        const menu = col.querySelector('[data-xtu-ci-menu]');
        const trigger = col.querySelector('[data-xtu-ci-trigger]');
        if (!(dropdown instanceof HTMLElement) || !(menu instanceof HTMLElement) || !(trigger instanceof HTMLElement)) {
          return;
        }
        if (!dropdown.classList.contains('is-open') || menu.hidden) return;
        layoutOpenMenu(menu, trigger);
      });
    }

    function closeAllMenus(except) {
      cols.forEach(function (col) {
        const dropdown = col.querySelector('[data-xtu-ci-dropdown]');
        const menu = col.querySelector('[data-xtu-ci-menu]');
        const trigger = col.querySelector('[data-xtu-ci-trigger]');
        if (!dropdown || !menu || !trigger) return;
        if (except && dropdown === except) return;
        dropdown.classList.remove('is-open');
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        clearMenuLayout(menu);
      });
    }

    function renderCategories() {
      categoriesEl.innerHTML = '';
      const usable = categories.filter(function (category) {
        return productsInCategory(category.id).length > 0;
      });

      if (usable.length <= 1) {
        categoriesEl.hidden = true;
        return;
      }

      categoriesEl.hidden = false;
      usable.forEach(function (category) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'xtu-ci__cat' + (category.id === activeCategory ? ' is-active' : '');
        button.textContent = category.label || category.id;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', category.id === activeCategory ? 'true' : 'false');
        button.addEventListener('click', function () {
          if (category.id === activeCategory) return;
          setCategory(category.id);
        });
        categoriesEl.appendChild(button);
      });
    }

    function renderMenu(colIndex) {
      const col = cols[colIndex];
      const menu = col.querySelector('[data-xtu-ci-menu]');
      if (!menu) return;

      const pool = productsInCategory(activeCategory);
      menu.innerHTML = '';

      pool.forEach(function (product) {
        const takenElsewhere = selected.some(function (id, index) {
          return index < activeColCount && index !== colIndex && id === product.id;
        });
        const isSelected = selected[colIndex] === product.id;

        const li = document.createElement('li');
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'xtu-ci__option';
        if (isSelected) option.classList.add('is-selected');
        if (takenElsewhere) {
          option.classList.add('is-disabled');
          option.disabled = true;
        }
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        option.dataset.productId = product.id;

        const title = document.createElement('span');
        title.className = 'xtu-ci__option-title';
        title.textContent = product.title || product.id;
        option.appendChild(title);

        if (product.slogan) {
          const sub = document.createElement('span');
          sub.className = 'xtu-ci__option-sub';
          sub.textContent = product.slogan;
          option.appendChild(sub);
        }

        option.addEventListener('click', function () {
          if (option.disabled) return;
          selected[colIndex] = product.id;
          closeAllMenus();
          renderAll();
        });

        li.appendChild(option);
        menu.appendChild(li);
      });
    }

    function renderColumn(colIndex) {
      const col = cols[colIndex];
      const product = productById(selected[colIndex]);

      const titleEl = col.querySelector('[data-xtu-ci-trigger-title]');
      const subEl = col.querySelector('[data-xtu-ci-trigger-sub]');
      const imageEl = col.querySelector('[data-xtu-ci-image]');
      const placeholder = col.querySelector('.xtu-ci__placeholder');
      const productTitle = col.querySelector('[data-xtu-ci-title]');
      const productSub = col.querySelector('[data-xtu-ci-subtitle]');
      const buyEl = col.querySelector('[data-xtu-ci-buy]');
      const moreEl = col.querySelector('[data-xtu-ci-more]');
      const buyLabelEl = col.querySelector('[data-xtu-ci-buy-label]');
      const moreLabelEl = col.querySelector('[data-xtu-ci-more-label]');

      if (titleEl) titleEl.textContent = product ? product.title || product.id : 'Select product';
      if (subEl) subEl.textContent = product && product.slogan ? product.slogan : '';

      if (imageEl instanceof HTMLImageElement) {
        if (product && product.image) {
          imageEl.src = product.image;
          imageEl.alt = product.title || '';
          imageEl.hidden = false;
          if (placeholder) placeholder.hidden = true;
        } else {
          imageEl.removeAttribute('src');
          imageEl.hidden = true;
          if (placeholder) placeholder.hidden = false;
        }
      }

      if (productTitle) productTitle.textContent = product ? product.title || '' : '';
      if (productSub) productSub.textContent = product && product.slogan ? product.slogan : '';

      if (buyEl instanceof HTMLAnchorElement) {
        buyEl.href = product && product.buyUrl ? product.buyUrl : '#';
        buyEl.style.visibility = product ? 'visible' : 'hidden';
      }
      if (moreEl instanceof HTMLAnchorElement) {
        moreEl.href = product && product.moreUrl ? product.moreUrl : '#';
        moreEl.style.visibility = product ? 'visible' : 'hidden';
      }
      if (buyLabelEl) buyLabelEl.textContent = buyLabel;
      if (moreLabelEl) moreLabelEl.textContent = moreLabel;

      renderMenu(colIndex);
    }

    function renderSpecs() {
      const schema = buildSchema(activeCategory);
      specsEl.innerHTML = '';
      let currentGroup = '';

      schema.forEach(function (item) {
        if (item.type === 'group') {
          if (!item.title) return;
          currentGroup = item.title;
          const group = document.createElement('div');
          group.className = 'xtu-ci__group';
          group.textContent = item.title;
          specsEl.appendChild(group);
          return;
        }

        if (item.type !== 'row' || !item.label) return;
        const groupTitle = item.group || currentGroup || '';

        const label = document.createElement('div');
        label.className = 'xtu-ci__label';
        label.dataset.xtuCiEq = 'row:' + groupTitle + ':' + item.label;
        label.textContent = item.label;
        specsEl.appendChild(label);

        for (let i = 0; i < activeColCount; i += 1) {
          const product = productById(selected[i]);
          const value = document.createElement('div');
          value.className = 'xtu-ci__value';
          value.dataset.xtuCiEq = 'row:' + groupTitle + ':' + item.label;

          const raw = product ? getSpecValue(product.specs, item.label, groupTitle) : null;
          if (raw === null || raw === undefined || raw === '') {
            value.innerHTML = '<span class="xtu-ci__empty-cell">' + emptyValue + '</span>';
          } else {
            value.textContent = String(raw);
          }
          specsEl.appendChild(value);
        }
      });
    }

    function equalize() {
      const keys = new Set();
      root.querySelectorAll('[data-xtu-ci-eq]').forEach(function (node) {
        if (node instanceof HTMLElement && node.dataset.xtuCiEq) {
          const col = node.closest('[data-xtu-ci-col]');
          if (col instanceof HTMLElement && col.hidden) return;
          keys.add(node.dataset.xtuCiEq);
        }
      });

      keys.forEach(function (key) {
        const nodes = Array.from(root.querySelectorAll('[data-xtu-ci-eq="' + key + '"]')).filter(function (node) {
          if (!(node instanceof HTMLElement)) return false;
          const col = node.closest('[data-xtu-ci-col]');
          if (col instanceof HTMLElement && col.hidden) return false;
          return true;
        });
        nodes.forEach(function (node) {
          if (node instanceof HTMLElement) node.style.minHeight = '';
        });

        let max = 0;
        nodes.forEach(function (node) {
          if (node instanceof HTMLElement) {
            max = Math.max(max, node.getBoundingClientRect().height);
          }
        });

        if (max > 0) {
          nodes.forEach(function (node) {
            if (node instanceof HTMLElement) node.style.minHeight = Math.ceil(max) + 'px';
          });
        }
      });
    }

    function fillDefaultSelection() {
      const pool = productsInCategory(activeCategory);
      selected = [null, null, null];
      for (let i = 0; i < activeColCount; i += 1) {
        selected[i] = pool[i] ? pool[i].id : null;
      }
    }

    function renderAll() {
      cols.forEach(function (_col, index) {
        if (index >= activeColCount) return;
        renderColumn(index);
      });
      renderSpecs();
      requestAnimationFrame(function () {
        equalize();
      });
    }

    function setCategory(categoryId) {
      activeCategory = categoryId;
      syncColCountMode();
      fillDefaultSelection();
      closeAllMenus();
      renderCategories();
      renderAll();

      const pool = productsInCategory(activeCategory);
      if (emptyEl) {
        emptyEl.hidden = pool.length > 0;
      }
    }

    cols.forEach(function (col, colIndex) {
      const dropdown = col.querySelector('[data-xtu-ci-dropdown]');
      const trigger = col.querySelector('[data-xtu-ci-trigger]');
      const menu = col.querySelector('[data-xtu-ci-menu]');
      if (!dropdown || !trigger || !menu) return;

      trigger.addEventListener('click', function () {
        const willOpen = menu.hidden;
        closeAllMenus(willOpen ? dropdown : null);
        if (willOpen) {
          renderMenu(colIndex);
          dropdown.classList.add('is-open');
          menu.hidden = false;
          trigger.setAttribute('aria-expanded', 'true');
          layoutOpenMenu(menu, trigger);
        } else {
          clearMenuLayout(menu);
        }
      });
    });

    document.addEventListener('click', function (event) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (root.contains(target) && target instanceof Element && target.closest('[data-xtu-ci-dropdown]')) {
        return;
      }
      closeAllMenus();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeAllMenus();
    });

    if (scroller instanceof HTMLElement) {
      const syncScroll = function () {
        root.classList.toggle('is-scrolled', scroller.scrollLeft > 2);
        syncOpenMenusLayout();
      };
      scroller.addEventListener('scroll', syncScroll, { passive: true });
      syncScroll();
    }

    const pageScroller = document.querySelector('.page-wrapper');
    const onViewportMove = function () {
      syncOpenMenusLayout();
    };
    window.addEventListener('scroll', onViewportMove, { passive: true });
    if (pageScroller instanceof HTMLElement) {
      pageScroller.addEventListener('scroll', onViewportMove, { passive: true });
    }

    let resizeTimer = 0;
    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        const nextCount = columnCount();
        if (nextCount !== activeColCount) {
          syncColCountMode();
          if (nextCount < 3) {
            selected[2] = null;
            closeAllMenus();
          } else if (!selected[2]) {
            const pool = productsInCategory(activeCategory);
            const used = {};
            selected.forEach(function (id, index) {
              if (index < nextCount && id) used[id] = true;
            });
            const next = pool.find(function (product) {
              return product && !used[product.id];
            });
            selected[2] = next ? next.id : null;
          }
          renderAll();
        } else {
          equalize();
        }
        syncOpenMenusLayout();
      }, 120);
    });

    if (!products.length && !categories.length) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }

    setCategory(resolveCategory());
  }

  document.querySelectorAll('[data-xtu-compare-interactive]').forEach(function (root) {
    if (root instanceof HTMLElement) initRoot(root);
  });
})();
