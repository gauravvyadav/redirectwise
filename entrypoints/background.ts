import type {
  RedirectHeader,
  RedirectItem,
  RedirectTiming,
  TabRedirectPath,
} from '../types/redirect';
import { generateId, getStatusObject } from '../types/redirect';
import { getSettings, saveHistoryEntry } from '../utils/storage';

// Check if a URL should be tracked by the extension (exclude new tab and internal schemes)
function isTrackableUrl(url: string | undefined): boolean {
  if (!url) return false;
  if (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('devtools://') ||
    url.startsWith('view-source:') ||
    url.startsWith('blob:') ||
    url.startsWith('data:') ||
    url.startsWith('javascript:')
  ) {
    return false;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (host === 'newtab' || host === 'new-tab-page') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

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

// Pre-navigation stash: chains client-side hops and refreshes instead of wiping them.
interface StashedPath {
  path: TabRedirectPath;
  stashedAt: number;
}

const pendingNavigationStash: Map<number, StashedPath> = new Map();
// Tabs flagged by onCommitted as journey continuations (segment may land after commit).
const pendingClientContinuation: Map<number, { flaggedAt: number; isClientRedirect: boolean }> =
  new Map();
const STASH_MAX_AGE_MS = 15000;
const STASH_MAX_ITEMS = 50;
// Journey cap: restart fresh beyond this many hops.
const MAX_CHAIN_ITEMS = 100;

function stashTabPath(tabId: number): void {
  const existing = tabPaths.get(tabId);
  if (existing && existing.path.length > 0) {
    // Copy the array so live-path mutations don't corrupt the stash.
    pendingNavigationStash.set(tabId, {
      path: { ...existing, path: [...existing.path] },
      stashedAt: Date.now(),
    });
    // Bound memory usage
    if (pendingNavigationStash.size > STASH_MAX_ITEMS) {
      const oldestKey = pendingNavigationStash.keys().next().value;
      if (oldestKey !== undefined) pendingNavigationStash.delete(oldestKey);
    }
  }
  // Prune expired stashes opportunistically
  const now = Date.now();
  for (const [key, stash] of pendingNavigationStash) {
    if (now - stash.stashedAt > STASH_MAX_AGE_MS) {
      pendingNavigationStash.delete(key);
    }
  }
  for (const [key, flag] of pendingClientContinuation) {
    if (now - flag.flaggedAt > STASH_MAX_AGE_MS) {
      pendingClientContinuation.delete(key);
    }
  }
}

function getFreshStash(tabId: number): StashedPath | undefined {
  const stash = pendingNavigationStash.get(tabId);
  if (!stash) return undefined;
  if (Date.now() - stash.stashedAt > STASH_MAX_AGE_MS) {
    pendingNavigationStash.delete(tabId);
    return undefined;
  }
  return stash;
}

function isContinuationFlagged(tabId: number): boolean {
  const flag = pendingClientContinuation.get(tabId);
  if (flag === undefined) return false;
  if (Date.now() - flag.flaggedAt > STASH_MAX_AGE_MS) {
    pendingClientContinuation.delete(tabId);
    return false;
  }
  return true;
}

function isClientRedirectFlagged(tabId: number): boolean {
  const flag = pendingClientContinuation.get(tabId);
  if (flag === undefined) return false;
  if (Date.now() - flag.flaggedAt > STASH_MAX_AGE_MS) {
    pendingClientContinuation.delete(tabId);
    return false;
  }
  return flag.isClientRedirect;
}

function discardPendingContinuation(tabId: number): void {
  pendingNavigationStash.delete(tabId);
  pendingClientContinuation.delete(tabId);
}

// Prepend the stashed chain when this navigation continues the journey. Never
// consumes the stash unless the new segment was captured and qualifies.
async function tryMergePendingContinuation(tabId: number): Promise<boolean> {
  if (!isStorageInitialized && storageInitPromise) await storageInitPromise;
  const stash = getFreshStash(tabId);
  if (!stash || stash.path.path.length === 0) return false;
  const tabPath = tabPaths.get(tabId);
  // Segment not captured yet — keep the stash for a later event.
  if (!tabPath || tabPath.path.length === 0) return false;

  const flagged = isContinuationFlagged(tabId);
  const stashLast = stash.path.path[stash.path.path.length - 1];
  const currentFirst = tabPath.path[0];
  const isSameUrlRefresh = !!stashLast && !!currentFirst && stashLast.url === currentFirst.url;

  // No continuation signal: leave the stash for onCommitted/onCompleted.
  if (!flagged && !isSameUrlRefresh) return false;

  if (isSameUrlRefresh && stashLast.status_code === currentFirst.status_code) {
    // Same-URL refresh: swap in the fresh hop instead of duplicating it.
    tabPath.path = [...stash.path.path.slice(0, -1), ...tabPath.path];
  } else {
    // Beyond the cap, restart fresh with this segment.
    if (stash.path.path.length + tabPath.path.length > MAX_CHAIN_ITEMS) {
      discardPendingContinuation(tabId);
      return false;
    }
    const mergedPath = [...stash.path.path, ...tabPath.path];
    if (isClientRedirectFlagged(tabId)) {
      // Genuine client hop: label the segment's first hop; plain links stay 'navigation'.
      const continuationItem = mergedPath[stash.path.path.length];
      if (continuationItem && continuationItem.type === 'navigation') {
        continuationItem.type = 'client_redirect';
        if (!continuationItem.redirect_type) continuationItem.redirect_type = 'javascript';
        if (!continuationItem.redirect_url) continuationItem.redirect_url = continuationItem.url;
      }
    }
    tabPath.path = mergedPath;
  }
  // Preserve the original chain start time.
  tabPath.startTime = Math.min(stash.path.startTime, tabPath.startTime);
  discardPendingContinuation(tabId);
  await saveTabPathToSession(tabId, tabPath);

  // Re-broadcast the full chain; receivers dedupe by item id.
  for (const item of tabPath.path) {
    broadcastMessage({ name: 'redirectUpdate', tabId, item });
  }
  return true;
}

// Cross-tab lineage: new tabs (e.g. ad clicks) inherit the opener's chain on first capture.
interface TabLineage {
  parentTabId: number;
  recordedAt: number;
}

const tabLineage: Map<number, TabLineage> = new Map();
const LINEAGE_TTL_MS = 5 * 60 * 1000;

function recordLineage(childTabId: number, parentTabId: number): void {
  if (childTabId < 0 || parentTabId < 0 || childTabId === parentTabId) return;
  tabLineage.set(childTabId, { parentTabId, recordedAt: Date.now() });
  // Prune expired lineage opportunistically
  const now = Date.now();
  for (const [key, lineage] of tabLineage) {
    if (now - lineage.recordedAt > LINEAGE_TTL_MS) {
      tabLineage.delete(key);
    }
  }
}

// One-shot opener inheritance; reloads are covered by same-URL replace.
async function tryInheritOpenerChain(childTabId: number): Promise<boolean> {
  if (!isStorageInitialized && storageInitPromise) await storageInitPromise;
  const lineage = tabLineage.get(childTabId);
  if (!lineage) return false;
  if (Date.now() - lineage.recordedAt > LINEAGE_TTL_MS) {
    tabLineage.delete(childTabId);
    return false;
  }
  const childPath = tabPaths.get(childTabId);
  // Child segment not captured yet — keep lineage for a later event.
  if (!childPath || childPath.path.length === 0) return false;
  const parentPath = tabPaths.get(lineage.parentTabId);
  if (!parentPath || parentPath.path.length === 0) {
    tabLineage.delete(childTabId);
    return false;
  }
  // Already inherited: opener hop ids present in child.
  const parentIds = new Set(parentPath.path.map(item => item.id));
  if (childPath.path.some(item => parentIds.has(item.id))) {
    tabLineage.delete(childTabId);
    return true;
  }
  // Beyond the cap, keep the child's own segment.
  if (parentPath.path.length + childPath.path.length > MAX_CHAIN_ITEMS) {
    tabLineage.delete(childTabId);
    return false;
  }
  const openerUrl = parentPath.path[parentPath.path.length - 1]?.url;
  // Clone (don't share refs): the popup filters inherited hops out, and this
  // avoids cross-tab mutation aliasing.
  const inheritedHops = parentPath.path.map(item => ({ ...item, inherited: true }));
  childPath.path = [...inheritedHops, ...childPath.path];
  const firstChildHop = childPath.path[inheritedHops.length];
  if (firstChildHop && openerUrl && !firstChildHop.openedFrom) {
    firstChildHop.openedFrom = openerUrl;
  }
  childPath.startTime = Math.min(parentPath.startTime, childPath.startTime);
  tabLineage.delete(childTabId);
  await saveTabPathToSession(childTabId, childPath);

  for (const item of childPath.path) {
    broadcastMessage({ name: 'redirectUpdate', tabId: childTabId, item });
  }
  return true;
}

async function addRedirectItem(
  tabId: number,
  item: Partial<Omit<RedirectItem, 'timing'>> & { timing?: Partial<RedirectTiming> },
  options?: { requestId?: string; eventTime?: number }
): Promise<RedirectItem | null> {
  if (!isTrackableUrl(item.url)) {
    console.log('[RedirectWise] Skipped non-trackable URL:', item.url);
    return null;
  }
  const tabPath = await getOrCreateTabPath(tabId);
  const metadata = options?.requestId ? requestMetadata.get(options.requestId) : undefined;
  const rawStartTime =
    item.timing?.startTime ?? metadata?.startTime ?? options?.eventTime ?? Date.now();
  const rawEndTime = item.timing?.endTime ?? options?.eventTime ?? Date.now();
  const startTime = Math.round(rawStartTime);
  const endTime = Math.max(startTime, Math.round(rawEndTime));
  const duration = Math.max(0, Math.round(item.timing?.duration ?? endTime - startTime));

  const duplicate = tabPath.path.find(
    existing =>
      existing.url === (item.url || '') &&
      existing.status_code === (item.status_code || 0) &&
      Math.abs(existing.timestamp - endTime) < 500
  );

  if (duplicate) {
    console.log('[RedirectWise] Ignored duplicate redirect item:', item.url, item.status_code);
    return duplicate;
  }

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

  // First hop of a fresh segment: re-chain opener inheritance, then same-tab merge.
  if (tabPath.path.length === 1) {
    await tryInheritOpenerChain(tabId);
    await tryMergePendingContinuation(tabId);
  }

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
  chrome.runtime.onInstalled.addListener(details => {
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
      if (firstItem) updateBadge(activeInfo.tabId, firstItem.status_code);
    } else {
      clearBadge(activeInfo.tabId);
    }
  });

  // Listen for request start to track timing
  chrome.webRequest.onBeforeRequest.addListener(
    details => {
      if (details.type !== 'main_frame' || !isTrackableUrl(details.url)) return;
      requestMetadata.set(details.requestId, {
        startTime: Math.round(details.timeStamp),
      });
    },
    { urls: ['<all_urls>'] }
  );

  // Listen for response started - this is where we reliably get the IP address
  chrome.webRequest.onResponseStarted.addListener(
    async details => {
      if (details.type !== 'main_frame' || !isTrackableUrl(details.url)) return;
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

    if (!isTrackableUrl(details.url)) {
      clearBadge(details.tabId);
      discardPendingContinuation(details.tabId);
      await clearTabPath(details.tabId);
      return;
    }

    // Stash the previous path before resetting; onCommitted decides restore vs fresh.
    stashTabPath(details.tabId);

    // Reset previous tab redirect path upon starting a new top-level trackable navigation
    await clearTabPath(details.tabId);

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

  // Chain same-tab navigations into one journey (popup shows where the page came from).
  // onCommitted exposes transition type; merges run wherever the picture is complete.
  chrome.webNavigation.onCommitted.addListener(async details => {
    if (details.frameId !== 0) return;
    if (!isTrackableUrl(details.url)) return;
    if (!isStorageInitialized && storageInitPromise) await storageInitPromise;

    const qualifiers = details.transitionQualifiers ?? [];
    const transitionType = details.transitionType;
    // Explicit fresh start: address bar, bookmark, search, forward/back.
    // Everything else (link clicks, form submits, reloads, client/server
    // redirects, start pages) continues the tab's journey.
    const isExplicitFreshNavigation =
      transitionType === 'typed' ||
      transitionType === 'auto_bookmark' ||
      transitionType === 'generated' ||
      transitionType === 'keyword' ||
      qualifiers.includes('from_address_bar') ||
      qualifiers.includes('forward_back');

    if (isExplicitFreshNavigation) {
      discardPendingContinuation(details.tabId);
      tabLineage.delete(details.tabId);
      return;
    }

    // Continuation: flag it, then inherit + merge if the segment was captured.
    pendingClientContinuation.set(details.tabId, {
      flaggedAt: Date.now(),
      isClientRedirect: qualifiers.includes('client_redirect'),
    });
    await tryInheritOpenerChain(details.tabId);
    await tryMergePendingContinuation(details.tabId);
  });

  // Fires when a navigation creates a new tab (target=_blank, window.open).
  chrome.webNavigation.onCreatedNavigationTarget.addListener(details => {
    if (details.sourceTabId >= 0) {
      recordLineage(details.tabId, details.sourceTabId);
    }
  });

  // Fallback for new tabs that skip onCreatedNavigationTarget.
  chrome.tabs.onCreated.addListener(tab => {
    if (tab.id !== undefined && tab.openerTabId !== undefined) {
      if (!tabLineage.has(tab.id)) {
        recordLineage(tab.id, tab.openerTabId);
      }
    }
  });

  // Listen for completed requests with headers
  chrome.webRequest.onHeadersReceived.addListener(
    details => {
      // Only track main frame requests
      if (details.type !== 'main_frame' || !isTrackableUrl(details.url)) return;

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
      if (details.type !== 'main_frame' || !isTrackableUrl(details.url)) return;

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

  chrome.webRequest.onErrorOccurred.addListener(
    async details => {
      if (details.type !== 'main_frame' || details.tabId < 0) return;

      requestMetadata.delete(details.requestId);

      if (!isStorageInitialized && storageInitPromise) await storageInitPromise;

      broadcastMessage({
        name: 'navigationError',
        tabId: details.tabId,
        url: details.url,
        path: tabPaths.get(details.tabId)?.path || [],
        error: details.error,
      });
    },
    { urls: ['<all_urls>'] }
  );

  // Save to history when navigation completes
  chrome.webNavigation.onCompleted.addListener(async details => {
    if (details.frameId !== 0) return;

    if (!isTrackableUrl(details.url)) {
      clearBadge(details.tabId);
      return;
    }

    if (!isStorageInitialized && storageInitPromise) await storageInitPromise;
    const tabPath = tabPaths.get(details.tabId);

    // If we have no path items yet but navigation completed, the page loaded without any tracked headers
    // This can happen on some cached pages - try to add the final URL only if trackable
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

    // Final catch-up: inherit + merge before broadcasting and saving history.
    await tryInheritOpenerChain(details.tabId);
    await tryMergePendingContinuation(details.tabId);
    // Anything still unmerged here belongs to an unrelated fresh navigation.
    discardPendingContinuation(details.tabId);

    // Re-read after the merge so badge/history/broadcast use the full chain.
    const finalTabPath = tabPaths.get(details.tabId);

    // Update badge with final status
    if (finalTabPath && finalTabPath.path.length > 0) {
      const firstItem = finalTabPath.path[0];
      if (firstItem) updateBadge(details.tabId, firstItem.status_code);
    }

    // Broadcast navigation complete
    broadcastMessage({
      name: 'navigationComplete',
      tabId: details.tabId,
      path: finalTabPath?.path || [],
    });

    const settings = await getSettings();
    if (!settings.autoSaveHistory) return;

    if (finalTabPath && finalTabPath.path.length > 0) {
      await saveHistoryEntry(finalTabPath.path);
      console.log('[RedirectWise] Saved to history');
    }
  });

  // Handle messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[RedirectWise] Received message:', message);

    (async () => {
      if (!isStorageInitialized && storageInitPromise) await storageInitPromise;

      if (message.name === 'getTabPath') {
        // Sync pending merges so mid-navigation readers get the full chain.
        await tryInheritOpenerChain(message.tabId);
        await tryMergePendingContinuation(message.tabId);
        const tabPath = tabPaths.get(message.tabId);
        const fullPath = tabPath?.path || [];
        sendResponse({
          path: message.includeInherited === false ? fullPath.filter(i => !i.inherited) : fullPath,
        });
      }

      if (message.name === 'clearTabPath') {
        await clearTabPath(message.tabId);
        discardPendingContinuation(message.tabId);
        sendResponse({ success: true });
      }

      if (message.name === 'openDashboard') {
        const dashboardUrl = chrome.runtime.getURL('/dashboard.html');
        try {
          const tabs = await chrome.tabs.query({});
          const existingTab = tabs.find(t => t.url && t.url.startsWith(dashboardUrl));
          if (existingTab && existingTab.id) {
            await chrome.tabs.update(existingTab.id, { active: true });
            if (existingTab.windowId) {
              await chrome.windows.update(existingTab.windowId, { focused: true });
            }
          } else {
            await chrome.tabs.create({ url: dashboardUrl });
          }
          sendResponse({ success: true });
        } catch (error) {
          console.error('[RedirectWise] Error opening dashboard:', error);
          await chrome.tabs.create({ url: dashboardUrl });
          sendResponse({ success: true });
        }
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
    discardPendingContinuation(tabId);
    tabLineage.delete(tabId);
    removeTabPathFromSession(tabId);
    console.log('[RedirectWise] Cleaned up tab:', tabId);
  });
});
