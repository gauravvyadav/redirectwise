// Storage utilities for persistent history

import { v4 as uuidv4 } from 'uuid';
import { HistoryEntry, RedirectItem, calculateChainScore } from '../types/redirect';

const HISTORY_STORAGE_KEY = 'redirectwise_history';
const SETTINGS_STORAGE_KEY = 'redirectwise_settings';
const MAX_HISTORY_ENTRIES = 500;

export interface Settings {
  darkMode: boolean;
  autoSaveHistory: boolean;
  maxHistoryEntries: number;
}

const defaultSettings: Settings = {
  darkMode: false,
  autoSaveHistory: true,
  maxHistoryEntries: MAX_HISTORY_ENTRIES,
};

// Get all history entries
export async function getHistory(): Promise<HistoryEntry[]> {
  try {
    const result = await chrome.storage.local.get(HISTORY_STORAGE_KEY);
    return result[HISTORY_STORAGE_KEY] || [];
  } catch (error) {
    console.error('[RedirectWise] Error getting history:', error);
    return [];
  }
}

// Save a new history entry
export async function saveHistoryEntry(path: RedirectItem[]): Promise<HistoryEntry | null> {
  if (!path || path.length === 0) return null;

  try {
    const history = await getHistory();

    const originalUrl = path[0]?.url || '';
    const finalUrl = path[path.length - 1]?.url || originalUrl;
    const chainScore = calculateChainScore(path);

    // Calculate total time
    const totalTime = path.reduce((acc, item) => {
      return acc + (item.timing?.duration || 0);
    }, 0);

    const redirectCount = path.filter(
      p => p.type === 'server_redirect' || p.type === 'client_redirect'
    ).length;

    const entry: HistoryEntry = {
      id: uuidv4(),
      originalUrl,
      finalUrl,
      path,
      timestamp: Date.now(),
      chainScore,
      totalTime,
      redirectCount,
      isFavorite: false,
    };

    // Add to beginning of array
    history.unshift(entry);

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

    history[index] = { ...history[index], ...updates };
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

  const gradeDistribution: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  let totalRedirects = 0;
  let totalScore = 0;
  let favorites = 0;

  for (const entry of history) {
    totalRedirects += entry.redirectCount;
    totalScore += entry.chainScore.score;
    gradeDistribution[entry.chainScore.grade]++;
    if (entry.isFavorite) favorites++;
  }

  return {
    totalEntries: history.length,
    totalRedirects,
    avgScore: history.length > 0 ? Math.round(totalScore / history.length) : 0,
    gradeDistribution,
    favorites,
  };
}
