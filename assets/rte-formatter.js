import { Component } from '@theme/component';

const SOCIAL_LINK_LABELS = {
  'https://www.facebook.com/gkutech': 'GKU on Facebook',
  'https://www.instagram.com/gku_dashcam': 'GKU on Instagram',
};

/**
 * A custom element that formats rte content for easier styling
 */
class RTEFormatter extends Component {
  connectedCallback() {
    super.connectedCallback();
    this.querySelectorAll('table').forEach(this.#formatTable);
    this.querySelectorAll('iframe, video').forEach(this.#formatEmbed);
    this.querySelectorAll('a[href]').forEach(this.#labelSocialLink);
  }

  /**
   * Gives unnamed social icons pasted into rich text an accessible name.
   * @param {HTMLAnchorElement} link
   */
  #labelSocialLink(link) {
    const label = SOCIAL_LINK_LABELS[link.href.replace(/\/$/, '')];
    if (!label) return;

    const hasName = ['aria-label', 'aria-labelledby', 'title'].some((attribute) =>
      (link.getAttribute(attribute) || '').trim()
    );
    if (hasName || link.textContent.trim() || link.querySelector('img[alt]:not([alt=""])')) return;

    link.setAttribute('aria-label', label);
  }

  /**
   * Formats a table for easier styling
   * @param {HTMLTableElement} table
   */
  #formatTable(table) {
    if (table.closest('.rte-table-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.classList.add('rte-table-wrapper');
    const parent = table.parentNode;
    if (parent) {
      parent.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    }
  }

  /**
   * Wraps iframes / videos so they stay within the RTE container width
   * @param {HTMLIFrameElement | HTMLVideoElement} el
   */
  #formatEmbed(el) {
    if (el.closest('.rte-embed-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.classList.add('rte-embed-wrapper');
    const parent = el.parentNode;
    if (parent) {
      parent.insertBefore(wrapper, el);
      wrapper.appendChild(el);
    }
  }
}

if (!customElements.get('rte-formatter')) {
  customElements.define('rte-formatter', RTEFormatter);
}
