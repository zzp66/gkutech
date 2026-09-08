/**
 * Free-shipping progress bar for the cart drawer.
 * Progress = cart total / threshold; updates live on cart line changes.
 */
import { StandardEvents } from '@shopify/events';
import { formatMoney } from '@theme/money-formatting';

class XtuCartFreeShipping extends HTMLElement {
  static #storageKey = 'xtu-fs-progress';

  static get observedAttributes() {
    return ['data-progress', 'data-unlocked', 'data-total'];
  }

  /** @type {boolean} */
  #ready = false;

  /** @type {boolean} */
  #syncing = false;

  connectedCallback() {
    this.#ready = true;
    this.#renderFromDataset({ celebrateIfNeeded: true });
    document.addEventListener(StandardEvents.cartLinesUpdate, this.#handleCartLinesUpdate);
  }

  disconnectedCallback() {
    document.removeEventListener(StandardEvents.cartLinesUpdate, this.#handleCartLinesUpdate);
  }

  /**
   * @param {string} _name
   * @param {string | null} oldValue
   * @param {string | null} newValue
   */
  attributeChangedCallback(_name, oldValue, newValue) {
    if (!this.#ready || this.#syncing || oldValue === newValue) return;
    this.#renderFromDataset({ celebrateIfNeeded: true });
  }

  /**
   * @param {import('@shopify/events').CartLinesUpdateEvent} event
   */
  #handleCartLinesUpdate = (event) => {
    event.promise
      ?.then((result) => {
        if (result?.cart) {
          this.#applyCartTotals(result.cart);
          return;
        }
        this.#renderFromDataset({ celebrateIfNeeded: true });
      })
      .catch(() => {});
  };

  /**
   * @param {NonNullable<import('@shopify/events').CartLinesUpdateResult['cart']>} cart
   */
  #applyCartTotals(cart) {
    const threshold = this.#readNumber(this.dataset.threshold, 0);
    if (threshold <= 0) return;

    const amount = Number.parseFloat(cart.cost?.totalAmount?.amount);
    // Ignore incomplete cart payloads (e.g. add-to-cart line-only responses).
    if (!Number.isFinite(amount) || !cart.cost?.totalAmount?.currencyCode) return;
    if (typeof cart.totalQuantity !== 'number') return;

    // Match Liquid cart.total_price (Shopify always uses *100, including JPY).
    const total = Math.round(amount * 100);
    const qty = cart.totalQuantity || 0;
    const remaining = Math.max(0, threshold - total);
    const unlocked = qty > 0 && total >= threshold;
    const progress =
      qty > 0 && threshold > 0 ? this.#clamp(Math.round((total / threshold) * 100), 0, 100) : 0;

    this.#syncing = true;
    this.setAttribute('data-progress', String(progress));
    this.setAttribute('data-unlocked', unlocked ? 'true' : 'false');
    this.setAttribute('data-total', String(total));
    this.#syncing = false;

    this.#paint({
      progress,
      unlocked,
      remaining,
      currencyCode: cart.cost.totalAmount.currencyCode,
      celebrateIfNeeded: unlocked,
    });
  }

  /**
   * @param {{ celebrateIfNeeded?: boolean }} [options]
   */
  #renderFromDataset({ celebrateIfNeeded = false } = {}) {
    const threshold = this.#readNumber(this.dataset.threshold, 0);
    const total = this.#readNumber(this.dataset.total, 0);
    const unlocked = this.dataset.unlocked === 'true';

    let progress = this.#clamp(this.#readNumber(this.dataset.progress, 0), 0, 100);
    if (!unlocked && threshold > 0 && total > 0) {
      progress = this.#clamp(Math.round((total / threshold) * 100), 0, 100);
    } else if (unlocked) {
      progress = 100;
    } else if (total <= 0) {
      progress = 0;
    }

    const remaining = Math.max(0, threshold - total);

    this.#paint({
      progress,
      unlocked,
      remaining,
      currencyCode: undefined,
      celebrateIfNeeded: celebrateIfNeeded && unlocked,
    });
  }

  /**
   * @param {{
   *   progress: number,
   *   unlocked: boolean,
   *   remaining: number,
   *   currencyCode?: string,
   *   celebrateIfNeeded?: boolean,
   * }} state
   */
  #paint({ progress, unlocked, remaining, currencyCode, celebrateIfNeeded = false }) {
    const fill = this.querySelector('.xtu-fs__fill');
    const track = this.querySelector('.xtu-fs__track');
    if (!(fill instanceof HTMLElement) || !(track instanceof HTMLElement)) return;

    const previous = this.#clamp(
      this.#readNumber(sessionStorage.getItem(XtuCartFreeShipping.#storageKey), progress),
      0,
      100
    );
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.classList.toggle('xtu-fs--unlocked', unlocked);

    const from = reduceMotion ? progress : this.#currentFillPercent(fill, track);
    fill.style.width = `${from}%`;
    requestAnimationFrame(() => {
      fill.style.width = `${progress}%`;
    });

    track.setAttribute('aria-valuenow', String(Math.round(progress)));
    this.#updateMessage(remaining, unlocked, currencyCode);

    sessionStorage.setItem(XtuCartFreeShipping.#storageKey, String(progress));

    if (celebrateIfNeeded && unlocked && previous < 100 && !reduceMotion) {
      this.classList.remove('is-celebrate');
      void this.offsetWidth;
      this.classList.add('is-celebrate');
    }
  }

  /**
   * @param {number} remainingShopifyUnits
   * @param {boolean} unlocked
   * @param {string} [currencyCode]
   */
  #updateMessage(remainingShopifyUnits, unlocked, currencyCode) {
    const messageEl = this.querySelector('.xtu-fs__message');
    if (!(messageEl instanceof HTMLElement)) return;

    if (unlocked) {
      const unlockedText = this.#templateText('[data-xtu-fs-message-unlocked]');
      if (unlockedText) messageEl.textContent = unlockedText;
      return;
    }

    const template = this.#templateText('[data-xtu-fs-message-progress]');
    const moneyFormat = this.dataset.moneyFormat;
    if (!template || !moneyFormat) return;

    const currency = currencyCode || this.#guessCurrency(moneyFormat);
    const precision = this.#currencyPrecision(currency);
    const remainingNative = Math.round((remainingShopifyUnits / 100) * Math.pow(10, precision));
    const formatted = formatMoney(remainingNative, moneyFormat, currency);
    messageEl.textContent = template.replaceAll('[[amount]]', formatted);
  }

  /**
   * @param {string} selector
   */
  #templateText(selector) {
    const template = this.querySelector(selector);
    if (!(template instanceof HTMLTemplateElement)) return '';
    return (template.content.textContent || '').trim();
  }

  /**
   * @param {string} moneyFormat
   */
  #guessCurrency(moneyFormat) {
    if (moneyFormat.includes('€')) return 'EUR';
    if (moneyFormat.includes('¥') || moneyFormat.includes('円')) return 'JPY';
    if (moneyFormat.includes('£')) return 'GBP';
    return 'USD';
  }

  /**
   * @param {string} currency
   */
  #currencyPrecision(currency) {
    const zeroDecimal = new Set([
      'BIF',
      'CLP',
      'DJF',
      'GNF',
      'ISK',
      'JPY',
      'KMF',
      'KRW',
      'PYG',
      'RWF',
      'UGX',
      'VND',
      'VUV',
      'XAF',
      'XOF',
      'XPF',
    ]);
    return zeroDecimal.has(String(currency).toUpperCase()) ? 0 : 2;
  }

  /**
   * @param {HTMLElement} fill
   * @param {HTMLElement} track
   */
  #currentFillPercent(fill, track) {
    const trackWidth = track.getBoundingClientRect().width;
    if (trackWidth <= 0) {
      return this.#readNumber(sessionStorage.getItem(XtuCartFreeShipping.#storageKey), 0);
    }
    return this.#clamp((fill.getBoundingClientRect().width / trackWidth) * 100, 0, 100);
  }

  /**
   * @param {string | null | undefined} value
   * @param {number} fallback
   */
  #readNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  /**
   * @param {number} value
   * @param {number} min
   * @param {number} max
   */
  #clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
}

if (!customElements.get('xtu-cart-free-shipping')) {
  customElements.define('xtu-cart-free-shipping', XtuCartFreeShipping);
}
