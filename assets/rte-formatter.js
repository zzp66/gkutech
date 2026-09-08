import { Component } from '@theme/component';

/**
 * A custom element that formats rte content for easier styling
 */
class RTEFormatter extends Component {
  connectedCallback() {
    super.connectedCallback();
    this.querySelectorAll('table').forEach(this.#formatTable);
    this.querySelectorAll('iframe, video').forEach(this.#formatEmbed);
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
