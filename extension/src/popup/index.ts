/**
 * Popup — dual-mode session approval.
 *
 * Default: activeTab (click icon per page, zero install warning)
 * Power:   all-sites toggle (one-time prompt, seamless captures)
 */

import type { PopupStateResponse } from '../../shared/types';

const HOSTS = ['http://*/*', 'https://*/*'];

async function hasAllSites(): Promise<boolean> {
  return chrome.permissions.contains({ origins: HOSTS });
}

async function init() {
  const response: PopupStateResponse = await chrome.runtime.sendMessage({ type: 'get_state' });

  const statusEl = document.getElementById('connection-status')!;
  const approvalSection = document.getElementById('approval-section')!;
  const approvedSection = document.getElementById('approved-section')!;
  const allSitesToggle = document.getElementById('all-sites')! as HTMLInputElement;

  if (!response?.connected) {
    statusEl.textContent = '⚠ Not connected to CLI';
    statusEl.className = 'status disconnected';
    return;
  }

  statusEl.textContent = '● Connected to CLI';
  statusEl.className = 'status connected';

  if (response.sessionApproved) {
    approvedSection.classList.remove('hidden');
    allSitesToggle.checked = await hasAllSites();
  } else {
    approvalSection.classList.remove('hidden');
  }
}

// Allow button — approve session + inject into current tab via activeTab
document.getElementById('allow')!.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'session_approved' });
  window.close();
});

document.getElementById('deny')!.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'session_denied' });
  window.close();
});

// All-sites toggle — request/revoke optional host permissions
document.getElementById('all-sites')!.addEventListener('change', async (e) => {
  const checked = (e.target as HTMLInputElement).checked;

  if (checked) {
    const granted = await chrome.permissions.request({ origins: HOSTS });
    if (granted) {
      // Register content script for all sites
      await chrome.runtime.sendMessage({ type: 'enable_all_sites' });
    } else {
      (e.target as HTMLInputElement).checked = false;
    }
  } else {
    await chrome.permissions.remove({ origins: HOSTS });
    await chrome.runtime.sendMessage({ type: 'disable_all_sites' });
  }
});

init();
