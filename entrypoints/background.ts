import {
  RedirectHeader,
  RedirectItem,
  RedirectTiming,
  TabRedirectPath,
  generateId,
  getStatusObject,
} from '../types/redirect';
import { getSettings, saveHistoryEntry } from '../utils/storage';

// Store redirect paths for each tab
const tabPaths: Map<number, TabRedirectPath> = new Map();
let isStorageInitialized = false;
let storageInitPromise: Promise<void> | null = null;

async function saveTabPathToSession(tabId: number, path: TabRedirectPath) {
  try {
    await chrome.storage.session.set({ [`tabPath_${tabId}`]: path });
  } catch (e) {
    console.error('[RedirectWise] Failed to save to session storage', e);
  }
}

async function removeTabPathFromSession(tabId: number) {
  try {
    await chrome.storage.session.remove(`tabPath_${tabId}`);
  } catch (e) {
    console.error('[RedirectWise] Failed to remove from session storage', e);
  }
}

interface PendingRequest {
  startTime: number;
  ip?: string;
  itemId?: string;
}

const requestMetadata: Map<string, PendingRequest> = new Map();

// Cleanup stale request timings older than 60 seconds
const TIMING_CLEANUP_INTERVAL = 60000;
const TIMING_MAX_AGE = 60000;

setInterval(() => {
  const now = Date.now();
  for (const [key, metadata] of requestMetadata) {
    if (now - metadata.startTime > TIMING_MAX_AGE) {
      requestMetadata.delete(key);
    }
  }
}, TIMING_CLEANUP_INTERVAL);

// Broadcast message to all extension pages (popup, sidepanel, etc.)
function broadcastMessage(message: Record<string, unknown>): void {
  chrome.runtime.sendMessage(message).catch(() => {
    // Ignore errors when no listeners are available
  });
}

// Update extension badge with status code
function updateBadge(tabId: number, statusCode: number): void {
  // Determine badge color based on status
  let color: string;
  if (statusCode >= 200 && statusCode < 300) {
    color = '#22c55e'; // green
  } else if (statusCode >= 300 && statusCode < 400) {
    color = '#f59e0b'; // amber
  } else if (statusCode >= 400 && statusCode < 500) {
    color = '#ef4444'; // red
  } else if (statusCode >= 500) {
    color = '#dc2626'; // dark red
  } else {
    color = '#6b7280'; // gray
  }

  // Always show the status code
  const badgeText = `${statusCode}`;

  chrome.action.setBadgeBackgroundColor({ color, tabId });
  chrome.action.setBadgeText({ text: badgeText, tabId });
  chrome.action.setBadgeTextColor({ color: '#ffffff', tabId });
}

// Clear badge for a tab
function clearBadge(tabId: number): void {
  chrome.action.setBadgeText({ text: '', tabId });
}

// Helper to get or create a tab path
async function getOrCreateTabPath(tabId: number): Promise<TabRedirectPath> {
  if (!isStorageInitialized && storageInitPromise) await storageInitPromise;
  if (!tabPaths.has(tabId)) {
    tabPaths.set(tabId, {
      tabId,
      path: [],
      startTime: Date.now(),
    });
  }
  return tabPaths.get(tabId)!;
}

// Clear tab path on new navigation
async function clearTabPath(tabId: number): Promise<void> {
  if (!isStorageInitialized && storageInitPromise) await storageInitPromise;
  const newPath = {
    tabId,
    path: [],
    startTime: Date.now(),
  };
  tabPaths.set(tabId, newPath);
  saveTabPathToSession(tabId, newPath);
}

async function addRedirectItem(
  tabId: number,
  item: Partial<RedirectItem> & { timing?: Partial<RedirectTiming> },
  options?: { requestId?: string; eventTime?: number }
): Promise<RedirectItem> {
  const tabPath = await getOrCreateTabPath(tabId);
  const metadata = options?.requestId ? requestMetadata.get(options.requestId) : undefined;
  const rawStartTime = item.timing?.startTime ?? metadata?.startTime ?? options?.eventTime ?? Date.now();
  const rawEndTime = item.timing?.endTime ?? options?.eventTime ?? Date.now();
  const startTime = Math.round(rawStartTime);
  const endTime = Math.max(startTime, Math.round(rawEndTime));
  const duration = Math.max(0, Math.round(item.timing?.duration ?? endTime - startTime));

  const fullItem: RedirectItem = {
    id: generateId(),
    url: item.url || '',
    status_code: item.status_code || 0,
    status_line: item.status_line || '',
    ip: item.ip || 'Unknown',
    type: item.type || 'navigation',
    redirect_type: item.redirect_type,
    redirect_url: item.redirect_url,
    headers: item.headers || [],
    timestamp: endTime,
    timing: {
      startTime,
      endTime,
      duration,
    },
    statusObject: getStatusObject(item.status_code || 0),
  };

  tabPath.path.push(fullItem);

  if (options?.requestId) {
    const pendingRequest = requestMetadata.get(options.requestId);
    if (pendingRequest) {
      pendingRequest.itemId = fullItem.id;
      requestMetadata.set(options.requestId, pendingRequest);
    }
  }

  // Broadcast realtime update to sidepanel
  broadcastMessage({
    name: 'redirectUpdate',
    tabId,
    item: fullItem,
    url: tabPath.path[0]?.url,
  });

  console.log('[RedirectWise] Added redirect item:', fullItem);
  saveTabPathToSession(tabId, tabPath);
  return fullItem;
}

// Parse headers from Chrome's format
function parseHeaders(headers: chrome.webRequest.HttpHeader[]): RedirectHeader[] {
  return headers.map(h => ({
    name: h.name,
    value: h.value || '',
  }));
}

// Get redirect type based on status code and headers
function getRedirectType(
  statusCode: number,
  headers: RedirectHeader[]
): 'permanent' | 'temporary' | 'hsts' {
  // Check for HSTS redirect
  if (statusCode === 307) {
    const hstsHeader = headers.find(
      h => h.name.toLowerCase() === 'non-authoritative-reason' && h.value === 'HSTS'
    );
    if (hstsHeader) return 'hsts';
  }

  // Permanent redirects
  if (statusCode === 301 || statusCode === 308) {
    return 'permanent';
  }

  // Temporary redirects
  return 'temporary';
}

// Get Location header for redirect URL
function getLocationHeader(headers: RedirectHeader[]): string | undefined {
  const location = headers.find(h => h.name.toLowerCase() === 'location');
  return location?.value;
}

export default defineBackground(() => {
  console.log('[RedirectWise] Background script initialized');

  storageInitPromise = (async () => {
    try {
      const data = await chrome.storage.session.get(null);
      for (const [key, value] of Object.entries(data)) {
        if (key.startsWith('tabPath_')) {
          const tabId = parseInt(key.replace('tabPath_', ''), 10);
          tabPaths.set(tabId, value as TabRedirectPath);
        }
      }
      console.log('[RedirectWise] Restored tab paths:', tabPaths.size);
    } catch (e) {
      console.error('[RedirectWise] Failed to restore from session storage', e);
    }
    isStorageInitialized = true;
  })();

  // Set uninstall feedback URL
  if (chrome.runtime.setUninstallURL) {
    chrome.runtime.setUninstallURL('https://redirectwise.gauravlabs.com/uninstall.html');
  }

  // Open welcome page on installation
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      chrome.tabs.create({ url: 'https://redirectwise.gauravlabs.com/welcome.html' });
    }
  });

  // Enable sidepanel to open on action click (optional - can also be opened programmatically)
  if (chrome.sidePanel) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {
      // Ignore if not supported
    });
  }

  // Update badge when tab is activated (switched to)
  chrome.tabs.onActivated.addListener(async activeInfo => {
    if (!isStorageInitialized && storageInitPromise) await storageInitPromise;
    const tabPath = tabPaths.get(activeInfo.tabId);
    if (tabPath && tabPath.path.length > 0) {
      const firstItem = tabPath.path[0];
      updateBadge(activeInfo.tabId, firstItem.status_code);
    } else {
      clearBadge(activeInfo.tabId);
    }
  });

  // Listen for request start to track timing
  chrome.webRequest.onBeforeRequest.addListener(
    details => {
      if (details.type !== 'main_frame') return;
      requestMetadata.set(details.requestId, {
        startTime: Math.round(details.timeStamp),
      });
    },
    { urls: ['<all_urls>'] }
  );

  // Listen for response started - this is where we reliably get the IP address
  chrome.webRequest.onResponseStarted.addListener(
    async details => {
      if (details.type !== 'main_frame') return;
      if (details.ip) {
        const pendingRequest = requestMetadata.get(details.requestId);
        if (pendingRequest) {
          pendingRequest.ip = details.ip;
          requestMetadata.set(details.requestId, pendingRequest);
        }
        console.log('[RedirectWise] Captured IP for', details.url, ':', details.ip);

        // Also update the existing path item if it already exists with Unknown IP
        if (!isStorageInitialized && storageInitPromise) await storageInitPromise;
        const tabPath = tabPaths.get(details.tabId);
        if (tabPath) {
          const itemId = pendingRequest?.itemId;
          const item = itemId
            ? tabPath.path.find(pathItem => pathItem.id === itemId && pathItem.ip === 'Unknown')
            : undefined;
          if (item) {
            item.ip = details.ip;
            console.log('[RedirectWise] Updated IP for existing item:', details.url);
            saveTabPathToSession(details.tabId, tabPath);
          }
        }
      }
    },
    { urls: ['<all_urls>'] }
  );

  // Listen for new navigations to broadcast starting events
  chrome.webNavigation.onBeforeNavigate.addListener(async details => {
    // Only track main frame navigations
    if (details.frameId !== 0) return;

    // Get tab info for title
    try {
      const tab = await chrome.tabs.get(details.tabId);
      // Broadcast navigation start to sidepanel
      broadcastMessage({
        name: 'navigationStart',
        tabId: details.tabId,
        url: details.url,
        title: tab.title || details.url,
      });
    } catch {
      // Tab might not exist yet, broadcast with URL as title
      broadcastMessage({
        name: 'navigationStart',
        tabId: details.tabId,
        url: details.url,
        title: details.url,
      });
    }
  });

  // Listen for completed requests with headers
  chrome.webRequest.onHeadersReceived.addListener(
    details => {
      // Only track main frame requests
      if (details.type !== 'main_frame') return;

      const headers = parseHeaders(details.responseHeaders || []);
      const isRedirect = details.statusCode >= 300 && details.statusCode < 400;
      const redirectUrl = isRedirect ? getLocationHeader(headers) : undefined;

      // Try to get IP from details first, then fall back to the request metadata
      const detailsWithIP = details as chrome.webRequest.WebResponseHeadersDetails & {
        ip?: string;
      };
      const pendingRequest = requestMetadata.get(details.requestId);
      const ip = detailsWithIP.ip || pendingRequest?.ip || 'Unknown';

      void addRedirectItem(
        details.tabId,
        {
          url: details.url,
          status_code: details.statusCode,
          status_line: details.statusLine,
          ip,
          type: isRedirect ? 'server_redirect' : 'navigation',
          redirect_type: isRedirect ? getRedirectType(details.statusCode, headers) : undefined,
          redirect_url: redirectUrl,
          headers,
          timing: {
            startTime: pendingRequest?.startTime ?? details.timeStamp,
            endTime: details.timeStamp,
          },
        },
        {
          requestId: details.requestId,
          eventTime: details.timeStamp,
        }
      );
    },
    { urls: ['<all_urls>'] },
    ['responseHeaders', 'extraHeaders']
  );

  // Also listen to webRequest.onCompleted for additional IP capture
  chrome.webRequest.onCompleted.addListener(
    async details => {
      if (details.type !== 'main_frame') return;

      // Update IP if we got one and the item exists with Unknown IP
      if (details.ip) {
        if (!isStorageInitialized && storageInitPromise) await storageInitPromise;
        const tabPath = tabPaths.get(details.tabId);
        if (tabPath) {
          const itemId = requestMetadata.get(details.requestId)?.itemId;
          const item = itemId
            ? tabPath.path.find(pathItem => pathItem.id === itemId && pathItem.ip === 'Unknown')
            : undefined;
          if (item) {
            item.ip = details.ip;
            console.log('[RedirectWise] Updated IP from onCompleted:', details.url, details.ip);
            saveTabPathToSession(details.tabId, tabPath);
          }
        }
      }

      requestMetadata.delete(details.requestId);
    },
    { urls: ['<all_urls>'] }
  );

  // Save to history when navigation completes
  chrome.webNavigation.onCompleted.addListener(async details => {
    if (details.frameId !== 0) return;

    if (!isStorageInitialized && storageInitPromise) await storageInitPromise;
    const tabPath = tabPaths.get(details.tabId);

    // If we have no path items yet but navigation completed, the page loaded without any tracked headers
    // This can happen on some cached pages or internal pages - try to add the final URL
    if (!tabPath || tabPath.path.length === 0) {
      console.log('[RedirectWise] Navigation completed but no path captured, adding final URL');
      await addRedirectItem(details.tabId, {
        url: details.url,
        status_code: 200,
        status_line: 'HTTP/1.1 200 OK',
        type: 'navigation',
        headers: [],
        timing: {
          startTime: details.timeStamp,
          endTime: details.timeStamp,
        },
      });
    }

    // Update badge with final status
    const updatedTabPath = tabPaths.get(details.tabId);
    if (updatedTabPath && updatedTabPath.path.length > 0) {
      const firstItem = updatedTabPath.path[0];
      updateBadge(details.tabId, firstItem.status_code);
    }

    // Broadcast navigation complete
    broadcastMessage({
      name: 'navigationComplete',
      tabId: details.tabId,
      path: tabPaths.get(details.tabId)?.path || [],
    });

    const settings = await getSettings();
    if (!settings.autoSaveHistory) return;

    if (updatedTabPath && updatedTabPath.path.length > 0) {
      await saveHistoryEntry(updatedTabPath.path);
      console.log('[RedirectWise] Saved to history');
    }
  });

  // Handle messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[RedirectWise] Received message:', message);

    (async () => {
      if (!isStorageInitialized && storageInitPromise) await storageInitPromise;

      if (message.name === 'getTabPath') {
        const tabPath = tabPaths.get(message.tabId);
        sendResponse({
          path: tabPath?.path || [],
        });
      }

      if (message.name === 'clearTabPath') {
        await clearTabPath(message.tabId);
        sendResponse({ success: true });
      }

      if (message.name === 'openDashboard') {
        chrome.tabs.create({ url: chrome.runtime.getURL('/dashboard.html') });
        sendResponse({ success: true });
      }

      if (message.name === 'openSidepanel') {
        if (chrome.sidePanel) {
          try {
            await chrome.sidePanel.open({ windowId: message.windowId });
            sendResponse({ success: true });
          } catch (error: any) {
            console.error('[RedirectWise] Error opening sidepanel:', error);
            sendResponse({ success: false, error: error.message });
          }
        } else {
          sendResponse({ success: false, error: 'Sidepanel not supported' });
        }
      }

      if (message.name === 'saveToHistory') {
        const tabPath = tabPaths.get(message.tabId);
        if (tabPath && tabPath.path.length > 0) {
          saveHistoryEntry(tabPath.path).then(entry => {
            sendResponse({ success: true, entry });
          });
        } else {
          sendResponse({ success: false });
        }
      }
    })();

    return true; // Keep the message channel open for async response
  });

  // Clean up when tabs are closed
  chrome.tabs.onRemoved.addListener(tabId => {
    tabPaths.delete(tabId);
    removeTabPathFromSession(tabId);
    console.log('[RedirectWise] Cleaned up tab:', tabId);
  });
});
