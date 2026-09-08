/**
 * Side-by-side Note / Discount triggers with exclusive full-width panels.
 *
 * Click handling is bound on `document` (not the host) so it keeps working when:
 * - cart-actions.js loads after the drawer markup (module inside closed <dialog>)
 * - morph/hydration replaces trigger nodes
 * - a parent uses `display: contents` (known CE event/box quirks)
 */
const HOST_SEL = 'cart-actions-toggle';
const TRIGGER_SEL = '[data-cart-action-trigger]';
const PANEL_SEL = '[data-cart-action-panel]';

/**
 * @param {HTMLElement} host
 */
function closeAll(host) {
  host.querySelectorAll(TRIGGER_SEL).forEach((trigger) => {
    if (!(trigger instanceof HTMLElement)) return;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.classList.remove('is-open');
  });
  host.querySelectorAll(PANEL_SEL).forEach((panel) => {
    if (!(panel instanceof HTMLElement)) return;
    panel.hidden = true;
  });
}

/**
 * @param {HTMLElement} host
 * @param {HTMLElement} trigger
 */
function openPanel(host, trigger) {
  const panelId = trigger.getAttribute('aria-controls');
  if (!panelId) return;

  const panel = host.querySelector(`#${CSS.escape(panelId)}`);
  if (!(panel instanceof HTMLElement)) return;

  trigger.setAttribute('aria-expanded', 'true');
  trigger.classList.add('is-open');
  panel.hidden = false;
}

/**
 * @param {MouseEvent} event
 */
function onDocumentClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const trigger = target.closest(TRIGGER_SEL);
  if (!(trigger instanceof HTMLElement)) return;

  const host = trigger.closest(HOST_SEL);
  if (!(host instanceof HTMLElement)) return;

  // Ignore clicks that bubbled from inside an open panel (e.g. textarea).
  if (target.closest(PANEL_SEL)) return;

  event.preventDefault();

  const willOpen = trigger.getAttribute('aria-expanded') !== 'true';
  closeAll(host);
  if (willOpen) openPanel(host, trigger);
}

if (!window.__xtuCartActionsClickBound) {
  window.__xtuCartActionsClickBound = true;
  document.addEventListener('click', onDocumentClick);
}

/**
 * Marker element for markup / styling. Click logic lives on document above.
 */
class CartActionsToggle extends HTMLElement {
  connectedCallback() {
    // Ensure any deferred upgrade still participates; sync open-by-default panels.
    this.querySelectorAll(`${TRIGGER_SEL}[aria-expanded='true']`).forEach((trigger) => {
      if (!(trigger instanceof HTMLElement)) return;
      const panelId = trigger.getAttribute('aria-controls');
      if (!panelId) return;
      const panel = this.querySelector(`#${CSS.escape(panelId)}`);
      if (panel instanceof HTMLElement) {
        panel.hidden = false;
        trigger.classList.add('is-open');
      }
    });
  }
}

if (!customElements.get('cart-actions-toggle')) {
  customElements.define('cart-actions-toggle', CartActionsToggle);
}
