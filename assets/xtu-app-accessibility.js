/* Complete missing accessibility attributes on third-party widget hosts. */
(function () {
  'use strict';

  var imageSelector = '.hiifans-plugin-chat-container img:not([alt])';
  var frameSelector = 'iframe#PBarNextFrame, iframe#merchantwidgetiframe, iframe.hiifans-plugin-chat-iframe';
  var reviewSelector = 'a.jdgm-popup-card__full-rev-link';
  var selector = imageSelector + ', ' + frameSelector + ', ' + reviewSelector;

  function fixReviewLink(link) {
    var hasName = ['aria-label', 'aria-labelledby', 'title'].some(function (attribute) {
      return (link.getAttribute(attribute) || '').trim();
    });
    if (hasName || link.textContent.trim() || link.querySelector('img[alt]:not([alt=""])')) return;

    var card = link.closest('.jdgm-popup-card');
    var product = card && card.querySelector('.jdgm-popup-card__prod-title');
    var title = product ? product.textContent.trim() : '';
    link.setAttribute('aria-label', 'Read full review' + (title ? ' for ' + title : ''));
  }

  function fixElement(element) {
    if (element.matches(imageSelector)) element.setAttribute('alt', '');
    if (element.matches(reviewSelector)) fixReviewLink(element);
    if (element.tagName !== 'IFRAME' || (element.getAttribute('title') || '').trim()) return;

    if (element.id === 'PBarNextFrame') element.setAttribute('title', 'Shopify theme preview');
    else if (element.id === 'merchantwidgetiframe') element.setAttribute('title', 'Google store information');
    else if (element.classList.contains('hiifans-plugin-chat-iframe')) element.setAttribute('title', 'Customer support');
  }

  function fixWithin(root) {
    if (root.nodeType === 1) fixElement(root);
    if (root.querySelectorAll) root.querySelectorAll(selector).forEach(fixElement);
  }

  fixWithin(document);
  // Widgets can rebuild their icons and iframes after loading or resizing.
  // Inspect added subtrees only, rather than rescanning the whole page.
  new MutationObserver(function (records) {
    records.forEach(function (record) { record.addedNodes.forEach(fixWithin); });
  }).observe(document.body, { childList: true, subtree: true });
})();
