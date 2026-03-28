/**
 * Content script — isolated world.
 * Relays capture results from inject (page context) to background.
 * Generation counter prevents zombie handlers.
 */

import { isInjectCaptureMessage, type ContentMessage } from '../../shared/types';

declare global {
  interface Window {
    __siteSenseContentInstalled?: boolean;
    __siteSenseGeneration?: number;
  }
}

// Generation counter: newer injections supersede older ones
window.__siteSenseGeneration = (window.__siteSenseGeneration ?? 0) + 1;
const myGeneration = window.__siteSenseGeneration;

if (!window.__siteSenseContentInstalled) {
  window.__siteSenseContentInstalled = true;
}

window.addEventListener('message', (event) => {
  if (window.__siteSenseGeneration !== myGeneration) return; // zombie check
  if (event.source !== window) return; // only accept same-window messages
  // Note: origin check is not effective for same-page postMessage (both share origin).
  // Protection comes from isInjectCaptureMessage() validating message structure.
  if (!isInjectCaptureMessage(event.data)) return;

  const message: ContentMessage = {
    type: 'capture_result',
    tree: event.data.tree,
    url: window.location.href,
    title: document.title,
  };

  chrome.runtime.sendMessage(message).catch(() => {});
});

// Respond to ping from background
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (window.__siteSenseGeneration !== myGeneration) return false; // zombie
  if (msg.type === 'ping') {
    sendResponse({ ok: true });
    return true;
  }
});
