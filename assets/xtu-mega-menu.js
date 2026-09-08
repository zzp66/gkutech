/**
 * XTU Mega Menu — tab switching for products / featured layouts.
 * Dispatches xtu-mega-menu:change for header submenu height recalc.
 */
class XtuMegaMenu extends HTMLElement {
  /** @type {number | undefined} */
  #hoverTab;

  connectedCallback() {
    this.#bindTabs();
  }

  #bindTabs() {
    const tabs = this.querySelectorAll('[data-xtu-mega-tab]');
    const panels = this.querySelectorAll('[data-xtu-mega-panel]');

    if (!tabs.length || !panels.length) return;

    tabs.forEach((tab) => {
      if (!(tab instanceof HTMLButtonElement)) return;

      tab.addEventListener('click', () => {
        this.#activate(tab.dataset.xtuMegaTab ?? '0');
      });

      tab.addEventListener('mouseenter', () => {
        if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        const index = tab.dataset.xtuMegaTab ?? '0';
        clearTimeout(this.#hoverTab);
        this.#hoverTab = window.setTimeout(() => {
          this.#activate(index);
        }, 80);
      });

      tab.addEventListener('mouseleave', () => {
        clearTimeout(this.#hoverTab);
      });
    });
  }

  /**
   * @param {string} index
   */
  #activate(index) {
    const tabs = this.querySelectorAll('[data-xtu-mega-tab]');
    const panels = this.querySelectorAll('[data-xtu-mega-panel]');

    tabs.forEach((tab) => {
      if (!(tab instanceof HTMLButtonElement)) return;
      const isActive = tab.dataset.xtuMegaTab === index;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    panels.forEach((panel) => {
      if (!(panel instanceof HTMLElement)) return;
      const isActive = panel.dataset.xtuMegaPanel === index;
      panel.classList.toggle('is-active', isActive);
      if (isActive) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
    });

    this.dispatchEvent(
      new CustomEvent('xtu-mega-menu:change', { bubbles: true, detail: { index } })
    );
  }
}

if (!customElements.get('xtu-mega-menu')) {
  customElements.define('xtu-mega-menu', XtuMegaMenu);
}

document.addEventListener('xtu-mega-menu:change', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const submenu = target.closest('.menu-list__submenu');
  if (!submenu) return;
  if (submenu.hasAttribute('data-xtu-dropdown')) return;

  const headerComponent = submenu.closest('header-component');
  if (!headerComponent) return;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (submenu.offsetHeight > 0) {
        headerComponent.style.setProperty('--submenu-height', `${submenu.offsetHeight}px`);
      }
    });
  });
});
