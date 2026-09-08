import { morph } from '@theme/morph';

/**
 * Complementary addon bundle: checkbox multi-select + qty, syncs sticky ATC price.
 */
class XtuAddonBundle extends HTMLElement {
  /** @type {IntersectionObserver | null} */
  #observer = null;

  /** @type {AbortController | null} */
  #fetchAbort = null;

  /** @type {boolean} */
  #bound = false;

  connectedCallback() {
    if (this.dataset.recommendationsPerformed === 'true') {
      this.#afterRender();
      return;
    }

    this.#observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        this.#observer?.disconnect();
        this.#loadRecommendations();
      },
      { rootMargin: '0px 0px 200px 0px' }
    );
    this.#observer.observe(this);
  }

  disconnectedCallback() {
    this.#observer?.disconnect();
    this.#fetchAbort?.abort();
  }

  /**
   * @returns {{ variantId: string, quantity: number }[]}
   */
  getSelectedItems() {
    /** @type {{ variantId: string, quantity: number }[]} */
    const items = [];
    this.querySelectorAll('[data-xtu-addon-card].is-selected').forEach((card) => {
      if (!(card instanceof HTMLElement)) return;
      if (card.dataset.available === 'false') return;
      const variantId = card.dataset.variantId;
      if (!variantId) return;
      const input = card.querySelector('[data-xtu-addon-qty-input]');
      const quantity = Math.max(1, Number(/** @type {HTMLInputElement | null} */ (input)?.value) || 1);
      items.push({ variantId, quantity });
    });
    return items;
  }

  /**
   * @returns {number}
   */
  getSelectedTotalCents() {
    let total = 0;
    this.querySelectorAll('[data-xtu-addon-card].is-selected').forEach((card) => {
      if (!(card instanceof HTMLElement)) return;
      if (card.dataset.available === 'false') return;
      const unit = Number(card.dataset.price) || 0;
      const input = card.querySelector('[data-xtu-addon-qty-input]');
      const quantity = Math.max(1, Number(/** @type {HTMLInputElement | null} */ (input)?.value) || 1);
      total += unit * quantity;
    });
    return total;
  }

  async #loadRecommendations() {
    const { productId, sectionId, intent, url, blockId } = this.dataset;
    if (!productId || !sectionId || !url) return;

    this.#fetchAbort?.abort();
    this.#fetchAbort = new AbortController();

    try {
      const endpoint = `${url}&product_id=${productId}&section_id=${sectionId}&intent=${intent || 'complementary'}`;
      const response = await fetch(endpoint, { signal: this.#fetchAbort.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const text = await response.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const next = doc.querySelector(`#xtu-addon-bundle-${blockId}`);
      if (!(next instanceof HTMLElement)) {
        this.#markEmpty();
        return;
      }

      const nextList = next.querySelector('[data-xtu-addon-list]');
      const list = this.querySelector('[data-xtu-addon-list]');
      const hasCards = Boolean(nextList?.querySelector('[data-xtu-addon-card]'));
      if (!hasCards || !list || !nextList) {
        this.#markEmpty();
        return;
      }

      const nextHeading = next.querySelector('.xtu-addon-bundle__heading');
      const heading = this.querySelector('.xtu-addon-bundle__heading');
      if (nextHeading && heading) {
        morph(heading, nextHeading);
      }

      morph(list, nextList);
      this.dataset.recommendationsPerformed = 'true';
      this.#bound = false;
      this.#afterRender();
    } catch (error) {
      if (/** @type {Error} */ (error).name === 'AbortError') return;
      console.warn('[xtu-addon-bundle]', error);
      this.#markEmpty();
    }
  }

  #markEmpty() {
    this.classList.add('is-empty');
    this.#emitTotal(0);
  }

  #afterRender() {
    const list = this.querySelector('[data-xtu-addon-list]');
    if (!list?.querySelector('[data-xtu-addon-card]')) {
      this.#markEmpty();
      return;
    }

    this.classList.remove('is-empty');
    this.#bindEvents();
    this.#emitTotal(this.getSelectedTotalCents());
  }

  #bindEvents() {
    if (this.#bound) return;
    this.#bound = true;

    this.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (!target.matches('[data-xtu-addon-check]')) return;
      const card = target.closest('[data-xtu-addon-card]');
      if (!(card instanceof HTMLElement)) return;
      this.#syncCardState(card, target.checked);
      this.#emitTotal(this.getSelectedTotalCents());
    });

    this.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const dec = target.closest('[data-xtu-addon-qty-dec]');
      const inc = target.closest('[data-xtu-addon-qty-inc]');
      if (dec || inc) {
        const card = target.closest('[data-xtu-addon-card]');
        if (!(card instanceof HTMLElement) || !card.classList.contains('is-selected')) return;
        const input = /** @type {HTMLInputElement | null} */ (card.querySelector('[data-xtu-addon-qty-input]'));
        if (!input) return;

        let value = Number(input.value) || 1;
        if (dec) value = Math.max(1, value - 1);
        if (inc) value = Math.min(99, value + 1);
        input.value = String(value);
        this.#updateQtyButtons(card, value);
        this.#emitTotal(this.getSelectedTotalCents());
        return;
      }

      // Ignore interactive children (learn more / qty input); toggle via whole card.
      if (target.closest('.xtu-addon-card__more, [data-xtu-addon-qty]')) return;

      const card = target.closest('[data-xtu-addon-card]');
      if (!(card instanceof HTMLElement) || card.classList.contains('is-disabled')) return;
      if (card.dataset.available === 'false') return;

      const checkbox = /** @type {HTMLInputElement | null} */ (card.querySelector('[data-xtu-addon-check]'));
      if (!checkbox || checkbox.disabled) return;

      checkbox.checked = !checkbox.checked;
      this.#syncCardState(card, checkbox.checked);
      this.#emitTotal(this.getSelectedTotalCents());
    });

    this.addEventListener('input', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (!target.matches('[data-xtu-addon-qty-input]')) return;
      const card = target.closest('[data-xtu-addon-card]');
      if (!(card instanceof HTMLElement)) return;
      let value = Math.round(Number(target.value) || 1);
      value = Math.min(99, Math.max(1, value));
      target.value = String(value);
      this.#updateQtyButtons(card, value);
      this.#emitTotal(this.getSelectedTotalCents());
    });
  }

  /**
   * @param {HTMLElement} card
   * @param {boolean} selected
   */
  #syncCardState(card, selected) {
    card.classList.toggle('is-selected', selected);
    const qtyRoot = card.querySelector('[data-xtu-addon-qty]');
    qtyRoot?.querySelectorAll('button, input').forEach((el) => {
      if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) {
        el.disabled = !selected;
      }
    });
    if (selected) {
      const input = /** @type {HTMLInputElement | null} */ (card.querySelector('[data-xtu-addon-qty-input]'));
      this.#updateQtyButtons(card, Number(input?.value) || 1);
    }
  }

  /**
   * @param {HTMLElement} card
   * @param {number} value
   */
  #updateQtyButtons(card, value) {
    const dec = card.querySelector('[data-xtu-addon-qty-dec]');
    if (dec instanceof HTMLButtonElement) dec.disabled = value <= 1;
  }

  /**
   * @param {number} totalCents
   */
  #emitTotal(totalCents) {
    document.dispatchEvent(
      new CustomEvent('xtu:addon-bundle:update', {
        bubbles: true,
        detail: {
          totalCents,
          items: this.getSelectedItems(),
        },
      })
    );
  }
}

if (!customElements.get('xtu-addon-bundle')) {
  customElements.define('xtu-addon-bundle', XtuAddonBundle);
}
