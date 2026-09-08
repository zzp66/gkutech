import { Component } from '@theme/component';
import { ThemeEvents, ZoomMediaSelectedEvent } from '@theme/events';
import { StandardEvents, ProductSelectEvent } from '@shopify/events';

/**
 * A custom element that renders a media gallery.
 *
 * @typedef {object} Refs
 * @property {import('./zoom-dialog').ZoomDialog} [zoomDialogComponent] - The zoom dialog component.
 * @property {import('./slideshow').Slideshow} [slideshow] - The slideshow component.
 * @property {HTMLElement[]} [media] - The media elements.
 *
 * @extends Component<Refs>
 */
export class MediaGallery extends Component {
  connectedCallback() {
    super.connectedCallback();

    const { signal } = this.#controller;
    const target = this.closest('.shopify-section, dialog');

    target?.addEventListener(StandardEvents.productSelect, this.#handleProductSelect, { signal });
    this.refs.zoomDialogComponent?.addEventListener(ThemeEvents.zoomMediaSelected, this.#handleZoomMediaSelected, {
      signal,
    });
  }

  #controller = new AbortController();

  disconnectedCallback() {
    super.disconnectedCallback();

    this.#controller.abort();
  }

  /**
   * Handles a product select event by replacing the current media gallery with a new one.
   * When the visible media set is unchanged, only jump to the featured slide (avoids Swiper rebuild).
   *
   * @param {ProductSelectEvent} event - The product select event.
   */
  #handleProductSelect = (event) => {
    if (!(event.target instanceof Element) || event.target.closest('product-card')) return;

    event.promise
      .then(({ detail }) => {
        if (!detail?.html) return;

        const { html } = detail;
        const newMediaGallery = html.querySelector('media-gallery');
        if (!newMediaGallery) return;

        const currentIds = this.#mediaIdSignature(this);
        const nextIds = this.#mediaIdSignature(newMediaGallery);
        const featuredId =
          newMediaGallery.getAttribute('data-featured-media-id') ||
          newMediaGallery.querySelector('[data-xtu-media-id]')?.getAttribute('data-xtu-media-id') ||
          '';

        if (currentIds && currentIds === nextIds && featuredId && typeof this.select === 'function') {
          const index = this.#indexOfMediaId(featuredId);
          if (index >= 0) {
            this.setAttribute('data-featured-media-id', featuredId);
            this.select(index);
            return;
          }
        }

        this.replaceWith(newMediaGallery);
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') console.warn('[media-gallery] Event promise rejected:', error);
      });
  };

  /**
   * Sorted unique media ids — order-independent set signature.
   * @param {Element} root
   */
  #mediaIdSignature(root) {
    const ids = Array.from(root.querySelectorAll('[data-xtu-media-id], [data-media-id]'))
      .map((el) => el.getAttribute('data-xtu-media-id') || el.getAttribute('data-media-id') || '')
      .filter(Boolean);
    return [...new Set(ids)].sort().join(',');
  }

  /**
   * @param {string} mediaId
   */
  #indexOfMediaId(mediaId) {
    const slides = this.querySelectorAll('[data-xtu-pdp-main] [data-xtu-media-id], [data-media-id]');
    for (let i = 0; i < slides.length; i++) {
      const id = slides[i].getAttribute('data-xtu-media-id') || slides[i].getAttribute('data-media-id');
      if (id === mediaId) return i;
    }
    return -1;
  }

  /**
   * Handles the 'zoom-media:selected' event.
   * @param {ZoomMediaSelectedEvent} event - The zoom-media:selected event.
   */
  #handleZoomMediaSelected = async (event) => {
    // XTU Swiper gallery exposes select(); Horizon slideshow uses refs.slideshow
    if (typeof this.select === 'function') {
      this.select(event.detail.index);
      return;
    }
    this.slideshow?.select(event.detail.index, undefined, { animate: false });
  };

  /**
   * Zooms the media gallery.
   *
   * @param {number} index - The index of the media to zoom.
   * @param {PointerEvent} event - The pointer event.
   */
  zoom(index, event) {
    this.refs.zoomDialogComponent?.open(index, event);
  }

  /**
   * Preloads an image.
   * @param {number} index - The index of the media to preload.
   */
  preloadImage(index) {
    const zoomDialogMedia = this.refs.zoomDialogComponent?.refs.media[index];
    if (!zoomDialogMedia) return;

    this.refs.zoomDialogComponent?.loadHighResolutionImage(zoomDialogMedia);
  }

  get slideshow() {
    return this.refs.slideshow;
  }

  get media() {
    return this.refs.media;
  }

  get presentation() {
    return this.dataset.presentation;
  }
}

if (!customElements.get('media-gallery')) {
  customElements.define('media-gallery', MediaGallery);
}
