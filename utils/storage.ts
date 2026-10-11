// Storage utilities for persistent history

import { v4 as uuidv4 } from 'uuid';
import type { HistoryEntry, RedirectItem } from '../types/redirect';
import { calculateTotalDuration } from '../types/redirect';

const HISTORY_STORAGE_KEY = 'redirectwise_history';
const SETTINGS_STORAGE_KEY = 'redirectwise_settings';
const MAX_HISTORY_ENTRIES = 2000;

export interface Settings {
  darkMode: boolean;
  autoSaveHistory: boolean;
  maxHistoryEntries: number;
  language: string;
}

const defaultSettings: Settings = {
  darkMode: false,
  autoSaveHistory: true,
  maxHistoryEntries: MAX_HISTORY_ENTRIES,
  language: 'system',
};

// Get all history entries
export async function getHistory(): Promise<HistoryEntry[]> {
  try {
    const result = await chrome.storage.local.get(HISTORY_STORAGE_KEY);
    const rawHistory: HistoryEntry[] = result[HISTORY_STORAGE_KEY] || [];
    // Filter out internal and non-trackable URLs (e.g. legacy chrome://new-tab-page entries)
    return rawHistory.filter(
      entry =>
        entry.originalUrl &&
        (entry.originalUrl.startsWith('http://') || entry.originalUrl.startsWith('https://'))
    );
  } catch (error) {
    console.error('[RedirectWise] Error getting history:', error);
    return [];
  }
}

// Save a new history entry
export async function saveHistoryEntry(path: RedirectItem[]): Promise<HistoryEntry | null> {
  if (!path || path.length === 0) return null;

  const originalUrl = path[0]?.url || '';
  if (!originalUrl.startsWith('http://') && !originalUrl.startsWith('https://')) {
    return null;
  }

  try {
    const history = await getHistory();
    const finalUrl = path[path.length - 1]?.url || originalUrl;

    // Calculate total time
    const totalTime = calculateTotalDuration(path);

    const redirectCount = path.filter(
      p => p.type === 'server_redirect' || p.type === 'client_redirect'
    ).length;

    // Merge when the existing entry is a prefix of this path (ids are random
    // per capture, so compare url + status instead).
    let merged = false;
    const scanLimit = Math.min(history.length, 5);
    for (let i = 0; i < scanLimit; i++) {
      const recentEntry = history[i];
      if (!recentEntry) continue;
      if (
        recentEntry.path.length < path.length &&
        Math.abs(Date.now() - recentEntry.timestamp) < 5 * 60 * 1000 &&
        recentEntry.path.every(
          (item, idx) =>
            item.url === path[idx]?.url && item.status_code === path[idx]?.status_code
        )
      ) {
        // Update the existing entry in place
        recentEntry.path = path;
        recentEntry.finalUrl = finalUrl;
        recentEntry.totalTime = totalTime;
        recentEntry.redirectCount = redirectCount;
        recentEntry.timestamp = Date.now();

        // Move this updated entry to the top of the history list (most recent activity)
        if (i > 0) {
          history.splice(i, 1);
          history.unshift(recentEntry);
        }
        merged = true;
        console.log('[RedirectWise] Merged path into existing history entry:', recentEntry.id);
        break;
      }
    }

    let entry: HistoryEntry | undefined;
    if (merged) {
      entry = history[0];
    } else {
      entry = {
        id: uuidv4(),
        originalUrl,
        finalUrl,
        path,
        timestamp: Date.now(),
        totalTime,
        redirectCount,
        isFavorite: false,
      };
      // Add to beginning of array
      history.unshift(entry);
    }
    if (!entry) return null;

    // Limit history size
    const trimmedHistory = history.slice(0, MAX_HISTORY_ENTRIES);

    await chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: trimmedHistory });

    console.log('[RedirectWise] Saved history entry:', entry.id);
    return entry;
  } catch (error) {
    console.error('[RedirectWise] Error saving history:', error);
    return null;
  }
}

// Delete a history entry
export async function deleteHistoryEntry(id: string): Promise<boolean> {
  try {
    const history = await getHistory();
    const filtered = history.filter(entry => entry.id !== id);
    await chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: filtered });
    console.log('[RedirectWise] Deleted history entry:', id);
    return true;
  } catch (error) {
    console.error('[RedirectWise] Error deleting history:', error);
    return false;
  }
}

// Update a history entry (for notes, tags, favorite)
export async function updateHistoryEntry(
  id: string,
  updates: Partial<Pick<HistoryEntry, 'notes' | 'tags' | 'isFavorite'>>
): Promise<boolean> {
  try {
    const history = await getHistory();
    const index = history.findIndex(entry => entry.id === id);

    if (index === -1) return false;

    const current = history[index];
    if (!current) return false;
    history[index] = { ...current, ...updates };
    await chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: history });

    console.log('[RedirectWise] Updated history entry:', id);
    return true;
  } catch (error) {
    console.error('[RedirectWise] Error updating history:', error);
    return false;
  }
}

// Clear all history
export async function clearHistory(): Promise<boolean> {
  try {
    await chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: [] });
    console.log('[RedirectWise] Cleared all history');
    return true;
  } catch (error) {
    console.error('[RedirectWise] Error clearing history:', error);
    return false;
  }
}

// Get settings
export async function getSettings(): Promise<Settings> {
  try {
    const result = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
    return { ...defaultSettings, ...result[SETTINGS_STORAGE_KEY] };
  } catch (error) {
    console.error('[RedirectWise] Error getting settings:', error);
    return defaultSettings;
  }
}

// Save settings
export async function saveSettings(settings: Partial<Settings>): Promise<boolean> {
  try {
    const current = await getSettings();
    const updated = { ...current, ...settings };
    await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: updated });
    console.log('[RedirectWise] Saved settings:', updated);
    return true;
  } catch (error) {
    console.error('[RedirectWise] Error saving settings:', error);
    return false;
  }
}

// Search history
export async function searchHistory(query: string): Promise<HistoryEntry[]> {
  const history = await getHistory();
  const lowerQuery = query.toLowerCase();

  return history.filter(
    entry =>
      entry.originalUrl.toLowerCase().includes(lowerQuery) ||
      entry.finalUrl.toLowerCase().includes(lowerQuery) ||
      entry.notes?.toLowerCase().includes(lowerQuery) ||
      entry.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

// Get history stats - optimized single pass
export async function getHistoryStats() {
  const history = await getHistory();

  let totalRedirects = 0;
  let favorites = 0;

  for (const entry of history) {
    totalRedirects += entry.redirectCount;
    if (entry.isFavorite) favorites++;
  }

  return {
    totalEntries: history.length,
    totalRedirects,
    favorites,
  };
}
