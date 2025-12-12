import {
  RedirectHeader,
  RedirectItem,
  TabRedirectPath,
  generateId,
  getStatusObject,
} from '../types/redirect';
import { getSettings, saveHistoryEntry } from '../utils/storage';

// Store redirect paths for each tab
const tabPaths: Map<number, TabRedirectPath> = new Map();
const requestTimings: Map<string, number> = new Map();

// Cleanup stale request timings older than 60 seconds
const TIMING_CLEANUP_INTERVAL = 60000;
const TIMING_MAX_AGE = 60000;

setInterval(() => {
  const now = Date.now();
  for (const [key, startTime] of requestTimings) {
    if (now - startTime > TIMING_MAX_AGE) {
      requestTimings.delete(key);
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
function getOrCreateTabPath(tabId: number): TabRedirectPath {
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
function clearTabPath(tabId: number): void {
  tabPaths.set(tabId, {
    tabId,
    path: [],
    startTime: Date.now(),
  });
}

// Add a redirect item to the tab path
function addRedirectItem(tabId: number, item: Partial<RedirectItem>): void {
  const tabPath = getOrCreateTabPath(tabId);
  const requestKey = `${tabId}-${item.url}`;
  const startTime = requestTimings.get(requestKey) || Date.now();
  const endTime = Date.now();

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
    timestamp: Date.now(),
    timing: {
      startTime,
      endTime,
      duration: endTime - startTime,
    },
    statusObject: getStatusObject(item.status_code || 0),
  };

  tabPath.path.push(fullItem);
  requestTimings.delete(requestKey);

  // Broadcast realtime update to sidepanel
  broadcastMessage({
    name: 'redirectUpdate',
    tabId,
    item: fullItem,
    url: tabPath.path[0]?.url,
  });

  console.log('[RedirectWise] Added redirect item:', fullItem);
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

  // Enable sidepanel to open on action click (optional - can also be opened programmatically)
  if (chrome.sidePanel) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {
      // Ignore if not supported
    });
  }

  // Update badge when tab is activated (switched to)
  chrome.tabs.onActivated.addListener(activeInfo => {
    const tabPath = tabPaths.get(activeInfo.tabId);
    if (tabPath && tabPath.path.length > 0) {
      const firstItem = tabPath.path[0];
      updateBadge(activeInfo.tabId, firstItem.status_code);
    } else {
      clearBadge(activeInfo.tabId);
    }
  });

  // Clean up when tab is closed
  chrome.tabs.onRemoved.addListener(tabId => {
    tabPaths.delete(tabId);
  });

  // Store IP addresses from onResponseStarted (more reliable for IP)
  const requestIPs: Map<string, string> = new Map();

  // Listen for request start to track timing
  chrome.webRequest.onBeforeRequest.addListener(
    details => {
      if (details.type !== 'main_frame') return;
      const requestKey = `${details.tabId}-${details.url}`;
      requestTimings.set(requestKey, Date.now());
    },
    { urls: ['<all_urls>'] }
  );

  // Listen for response started - this is where we reliably get the IP address
  chrome.webRequest.onResponseStarted.addListener(
    details => {
      if (details.type !== 'main_frame') return;
      if (details.ip) {
        const requestKey = `${details.tabId}-${details.url}`;
        requestIPs.set(requestKey, details.ip);
        console.log('[RedirectWise] Captured IP for', details.url, ':', details.ip);

        // Also update the existing path item if it exists with Unknown IP
        const tabPath = tabPaths.get(details.tabId);
        if (tabPath) {
          const item = tabPath.path.find(p => p.url === details.url && p.ip === 'Unknown');
          if (item) {
            item.ip = details.ip;
            console.log('[RedirectWise] Updated IP for existing item:', details.url);
          }
        }
      }
    },
    { urls: ['<all_urls>'] }
  );

  // Track pending navigations to detect new navigation vs same-page events
  const pendingNavigations: Map<number, string> = new Map();

  // Listen for new navigations - clear the path only for new navigations
  chrome.webNavigation.onBeforeNavigate.addListener(async details => {
    // Only track main frame navigations
    if (details.frameId !== 0) return;

    const currentPath = tabPaths.get(details.tabId);
    const isNewNavigation =
      !currentPath ||
      currentPath.path.length === 0 ||
      !details.url.startsWith(currentPath.path[0]?.url?.split('?')[0] || '');

    // Only clear if this is a genuinely new navigation (not a redirect in chain)
    if (isNewNavigation) {
      console.log('[RedirectWise] New navigation started:', details.url);
      clearTabPath(details.tabId);
      clearBadge(details.tabId);
      pendingNavigations.set(details.tabId, details.url);
    } else {
      console.log('[RedirectWise] Continuing redirect chain:', details.url);
    }

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

      // Try to get IP from details, or from our stored IPs map
      const requestKey = `${details.tabId}-${details.url}`;
      const detailsWithIP = details as chrome.webRequest.WebResponseHeadersDetails & {
        ip?: string;
      };
      const ip = detailsWithIP.ip || requestIPs.get(requestKey) || 'Unknown';

      addRedirectItem(details.tabId, {
        url: details.url,
        status_code: details.statusCode,
        status_line: details.statusLine,
        ip,
        type: isRedirect ? 'server_redirect' : 'navigation',
        redirect_type: isRedirect ? getRedirectType(details.statusCode, headers) : undefined,
        redirect_url: redirectUrl,
        headers,
      });

      // Clean up the IP from our map after using it
      requestIPs.delete(requestKey);
    },
    { urls: ['<all_urls>'] },
    ['responseHeaders', 'extraHeaders']
  );

  // Also listen to webRequest.onCompleted for additional IP capture
  chrome.webRequest.onCompleted.addListener(
    details => {
      if (details.type !== 'main_frame') return;

      // Update IP if we got one and the item exists with Unknown IP
      if (details.ip) {
        const tabPath = tabPaths.get(details.tabId);
        if (tabPath) {
          const item = tabPath.path.find(p => p.url === details.url && p.ip === 'Unknown');
          if (item) {
            item.ip = details.ip;
            console.log('[RedirectWise] Updated IP from onCompleted:', details.url, details.ip);
          }
        }
      }
    },
    { urls: ['<all_urls>'] }
  );

  // Save to history when navigation completes
  chrome.webNavigation.onCompleted.addListener(async details => {
    if (details.frameId !== 0) return;

    // Clear pending navigation
    pendingNavigations.delete(details.tabId);

    const tabPath = tabPaths.get(details.tabId);

    // If we have no path items yet but navigation completed, the page loaded without any tracked headers
    // This can happen on some cached pages or internal pages - try to add the final URL
    if (!tabPath || tabPath.path.length === 0) {
      console.log('[RedirectWise] Navigation completed but no path captured, adding final URL');
      addRedirectItem(details.tabId, {
        url: details.url,
        status_code: 200,
        status_line: 'HTTP/1.1 200 OK',
        type: 'navigation',
        headers: [],
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

    if (message.name === 'getTabPath') {
      const tabPath = tabPaths.get(message.tabId);
      sendResponse({
        path: tabPath?.path || [],
      });
    }

    if (message.name === 'clearTabPath') {
      clearTabPath(message.tabId);
      sendResponse({ success: true });
    }

    if (message.name === 'openDashboard') {
      chrome.tabs.create({ url: chrome.runtime.getURL('/dashboard.html') });
      sendResponse({ success: true });
    }

    if (message.name === 'openSidepanel') {
      if (chrome.sidePanel) {
        chrome.sidePanel
          .open({ windowId: message.windowId })
          .then(() => {
            sendResponse({ success: true });
          })
          .catch(error => {
            console.error('[RedirectWise] Error opening sidepanel:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // Keep channel open for async
      }
      sendResponse({ success: false, error: 'Sidepanel not supported' });
    }

    if (message.name === 'saveToHistory') {
      const tabPath = tabPaths.get(message.tabId);
      if (tabPath && tabPath.path.length > 0) {
        saveHistoryEntry(tabPath.path).then(entry => {
          sendResponse({ success: true, entry });
        });
        return true; // Keep channel open for async
      }
      sendResponse({ success: false });
    }

    return true; // Keep the message channel open for async response
  });

  // Clean up when tabs are closed
  chrome.tabs.onRemoved.addListener(tabId => {
    tabPaths.delete(tabId);
    console.log('[RedirectWise] Cleaned up tab:', tabId);
  });
});
