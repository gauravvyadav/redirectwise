import clsx from 'clsx';
import { Activity, Clock, LayoutDashboard, Moon, RefreshCw, Sun, Trash2 } from 'lucide-react';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import RedirectItemCard from '../../components/RedirectItemCard';
import type { RedirectItem } from '../../types/redirect';
import { calculateGapDuration, formatDuration } from '../../types/redirect';
import type { Settings } from '../../utils/storage';
import { getSettings, saveSettings } from '../../utils/storage';
import { t, useI18n } from '../../utils/i18n';

interface LiveRedirect extends RedirectItem {
  isNew?: boolean;
}

interface TabSession {
  tabId: number;
  url: string;
  title: string;
  path: LiveRedirect[];
  startTime: number;
  lastSeen: number;
  isActive: boolean;
}

// Bound in-memory sessions so long browsing doesn't bloat the sidepanel.
const MAX_TRACKED_SESSIONS = 20;

function evictOldSessions(
  sessions: Map<number, TabSession>,
  protectedIds: (number | null)[]
): Map<number, TabSession> {
  if (sessions.size <= MAX_TRACKED_SESSIONS) return sessions;
  const keep = new Set(protectedIds.filter((id): id is number => id !== null));
  const evictable = [...sessions.values()]
    .filter(s => !keep.has(s.tabId))
    .sort((a, b) => a.lastSeen - b.lastSeen);
  const next = new Map(sessions);
  while (next.size > MAX_TRACKED_SESSIONS && evictable.length > 0) {
    next.delete(evictable.shift()!.tabId);
  }
  return next;
}

export default function Sidepanel() {
  useI18n();
  const [sessions, setSessions] = useState<Map<number, TabSession>>(new Map());
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [activeTabUrl, setActiveTabUrl] = useState<string>('');
  const [darkMode, setDarkMode] = useState(false);
  const [, setSettings] = useState<Settings | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeTabIdRef = useRef<number | null>(null);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    loadSettings();
    initializeActiveTab();
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    const handleTabActivated = async (activeInfo: chrome.tabs.TabActiveInfo) => {
      const tabId = activeInfo.tabId;
      setActiveTabId(tabId);

      try {
        const tab = await chrome.tabs.get(tabId);
        setActiveTabUrl(tab.url || '');

        // Full journey including inherited opener hops (popup filters these out).
        const response = await chrome.runtime.sendMessage({
          name: 'getTabPath',
          tabId: tabId,
          includeInherited: true,
        });

        // Upsert without wiping other tabs; sync with background truth.
        setSessions(prev => {
          const next = new Map(prev);
          const existing = next.get(tabId);
          const now = Date.now();
          for (const session of next.values()) {
            session.isActive = session.tabId === tabId;
          }
          next.set(tabId, {
            tabId,
            url: tab.url || existing?.url || '',
            title: tab.title || existing?.title || 'Unknown',
            path: response?.path?.length ? response.path : existing?.path || [],
            startTime: existing?.startTime || now,
            lastSeen: now,
            isActive: true,
          });
          return evictOldSessions(next, [tabId]);
        });
      } catch (error) {
        console.error('[RedirectWise Sidepanel] Error fetching tab path:', error);
      }
    };

    const handleTabUpdated = (
      tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab
    ) => {
      if (tabId === activeTabId && changeInfo.url) {
        setActiveTabUrl(changeInfo.url);
      }
      if (changeInfo.url || changeInfo.title) {
        setSessions(prev => {
          const existing = prev.get(tabId);
          if (!existing) return prev;
          const next = new Map(prev);
          next.set(tabId, {
            ...existing,
            url: changeInfo.url || tab.url || existing.url,
            title: changeInfo.title || tab.title || existing.title,
            lastSeen: Date.now(),
          });
          return next;
        });
      }
    };

    const handleTabRemoved = (tabId: number) => {
      setSessions(prev => {
        if (!prev.has(tabId)) return prev;
        const next = new Map(prev);
        next.delete(tabId);
        return next;
      });
    };

    chrome.tabs.onActivated.addListener(handleTabActivated);
    chrome.tabs.onUpdated.addListener(handleTabUpdated);
    chrome.tabs.onRemoved.addListener(handleTabRemoved);

    return () => {
      chrome.tabs.onActivated.removeListener(handleTabActivated);
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
      chrome.tabs.onRemoved.removeListener(handleTabRemoved);
    };
  }, [activeTabId]);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 50);
    }
  }, [sessions.get(activeTabId || -1)?.path.length, autoScroll, activeTabId]);

  const loadSettings = async () => {
    const s = await getSettings();
    setSettings(s);
    setDarkMode(s.darkMode);
  };

  const initializeActiveTab = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        setActiveTabId(tab.id);
        setActiveTabUrl(tab.url || '');

        // Full journey including inherited opener hops (popup filters these out).
        const response = await chrome.runtime.sendMessage({
          name: 'getTabPath',
          tabId: tab.id,
          includeInherited: true,
        });

        setSessions(prev => {
          const next = new Map(prev);
          if (response?.path?.length > 0) {
            const now = Date.now();
            next.set(tab.id!, {
              tabId: tab.id!,
              url: tab.url || '',
              title: tab.title || 'Unknown',
              path: response.path,
              startTime: now,
              lastSeen: now,
              isActive: true,
            });
            return evictOldSessions(next, [tab.id!]);
          }
          return next;
        });
      }
    } catch (error) {
      console.error('[RedirectWise Sidepanel] Error initializing:', error);
    }
  };

  const handleNavigationStart = useCallback((tabId: number, url: string, title: string) => {
    setSessions(prev => {
      const newSessions = new Map(prev);
      const existing = newSessions.get(tabId);
      const now = Date.now();

      if (existing) {
        existing.url = url;
        existing.title = title || url;
        existing.isActive = true;
        existing.lastSeen = now;
        newSessions.set(tabId, existing);
      } else {
        newSessions.set(tabId, {
          tabId,
          url,
          title: title || url,
          path: [],
          startTime: now,
          lastSeen: now,
          isActive: true,
        });
      }
      return evictOldSessions(newSessions, [tabId]);
    });
  }, []);

  const handleNewRedirect = useCallback(
    (tabId: number, item: RedirectItem, url?: string, title?: string) => {
      setSessions(prev => {
        const newSessions = new Map(prev);
        const now = Date.now();
        const session = newSessions.get(tabId) || {
          tabId,
          url: url || item.url,
          title: title || 'Unknown',
          path: [],
          startTime: now,
          lastSeen: now,
          isActive: true,
        };

        if (session.path.some(x => x.id === item.id)) {
          // Background may re-broadcast a known hop with updated metadata
          // (e.g. re-chained as client_redirect after a merge) — refresh it.
          session.path = session.path.map(x => (x.id === item.id ? { ...item, isNew: x.isNew } : x));
          session.lastSeen = now;
          newSessions.set(tabId, session);
          return newSessions;
        }

        const newItem: LiveRedirect = { ...item, isNew: true };
        session.path = [...session.path, newItem];
        session.isActive = true;
        session.lastSeen = now;
        newSessions.set(tabId, session);

        return evictOldSessions(newSessions, [tabId]);
      });
    },
    []
  );

  // Full-chain sync on navigation finish (merges + inheritance applied).
  const handleNavigationComplete = useCallback((tabId: number, path: RedirectItem[]) => {
    setSessions(prev => {
      const next = new Map(prev);
      const now = Date.now();
      const existing = next.get(tabId);
      next.set(tabId, {
        tabId,
        url: existing?.url || path[path.length - 1]?.url || '',
        title: existing?.title || 'Unknown',
        path: path.map(item => {
          const prevItem = existing?.path.find(x => x.id === item.id);
          return { ...item, isNew: prevItem?.isNew };
        }),
        startTime: existing?.startTime || now,
        lastSeen: now,
        isActive: existing?.isActive ?? true,
      });
      return evictOldSessions(next, [tabId]);
    });
  }, []);

  useEffect(() => {
    const handleMessage = (
      message: {
        name: string;
        tabId?: number;
        item?: RedirectItem;
        path?: RedirectItem[];
        url?: string;
        title?: string;
      },
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void
    ) => {
      if (!isMonitoring) return;

      // Track every tab's trace so cross-tab journeys stay visible.
      if (message.name === 'redirectUpdate' && message.tabId && message.item) {
        handleNewRedirect(message.tabId, message.item, message.url, message.title);
        sendResponse({ received: true });
      }

      if (message.name === 'navigationStart' && message.tabId) {
        handleNavigationStart(message.tabId, message.url || '', message.title || '');
        if (message.tabId === activeTabIdRef.current) {
          setActiveTabUrl(message.url || '');
        }
        sendResponse({ received: true });
      }

      if (message.name === 'navigationComplete' && message.tabId && message.path) {
        handleNavigationComplete(message.tabId, message.path);
        sendResponse({ received: true });
      }

      return true;
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [isMonitoring, handleNewRedirect, handleNavigationStart, handleNavigationComplete]);

  const toggleDarkMode = async () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    await saveSettings({ darkMode: newMode });
  };

  const handleOpenDashboard = () => {
    chrome.runtime.sendMessage({ name: 'openDashboard' });
  };

  const clearSessions = () => {
    setSessions(new Map());
  };

  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const activeSession = activeTabId ? sessions.get(activeTabId) : null;

  const truncateUrl = (url: string, maxLength = 45) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-paper text-ink">
      {/* Header - Swiss Architectural Style with Variable Colors */}
      <header className="bg-paper-card border-b border-line">
        <div className="px-3.5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-black text-xs uppercase tracking-[0.08em] text-ink">
              {t('realtimeMonitor')}
            </span>
            <span
              className={clsx(
                'h-7 font-mono text-[10px] px-2 border flex items-center gap-1.5 shrink-0 font-bold uppercase tracking-[0.14em]',
                isMonitoring
                  ? 'bg-ok-bg text-ok border-ok-border'
                  : 'bg-paper-subtle text-muted border-line'
              )}
            >
              <span
                className={clsx(
                  'w-1.5 h-1.5',
                  isMonitoring ? 'bg-ok animate-pulse-live' : 'bg-muted'
                )}
              />
              {isMonitoring ? t('live') : t('paused')}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMonitoring(!isMonitoring)}
              className="w-7 h-7 flex items-center justify-center border border-line bg-paper-card text-ink hover:border-ink hover:bg-paper-subtle transition-colors"
              title={
                isMonitoring
                  ? t('pauseMonitoring')
                  : t('resumeMonitoring')
              }
            >
              {isMonitoring ? (
                <Activity className="w-3.5 h-3.5 text-ok" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              onClick={clearSessions}
              className="w-7 h-7 flex items-center justify-center border border-line bg-paper-card text-ink hover:border-ink hover:bg-paper-subtle transition-colors"
              title={t('clearSessions')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleOpenDashboard}
              className="w-7 h-7 flex items-center justify-center border border-line bg-paper-card text-ink hover:border-ink hover:bg-paper-subtle transition-colors"
              title={t('headerOpenDashboard')}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={toggleDarkMode}
              className="w-7 h-7 flex items-center justify-center border border-line bg-paper-card text-ink hover:border-ink hover:bg-paper-subtle transition-colors"
              title={t('toggleDarkMode')}
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Active Tab Info */}
        {(activeSession?.url || activeTabUrl) && (
          <div className="border-t border-line bg-paper-card px-3.5 h-7 font-mono text-[10px] flex items-center gap-1.5 truncate">
            <span className="text-muted font-bold uppercase tracking-wider shrink-0">
              {t('targetLabel')} //
            </span>
            <span className="text-ink truncate font-medium">
              {truncateUrl(activeSession?.url || activeTabUrl, 55)}
            </span>
          </div>
        )}
      </header>

      {/* Redirect Stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pt-2 flex flex-col gap-2">
        {!activeSession || activeSession.path.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 border border-line bg-paper-card">
            <div className="w-12 h-12 border border-line bg-paper-subtle flex items-center justify-center mb-3">
              <Activity className="w-6 h-6 text-accent" />
            </div>
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">
              {t('standbyLabel')}
            </span>
            <p className="text-xs font-black uppercase tracking-tight text-ink">
              {isMonitoring
                ? t('waitingForRedirects')
                : t('monitoringPaused')}
            </p>
            <p className="text-[11px] mt-1 max-w-xs leading-relaxed text-text-secondary">
              {t('navigateRealtimeMessage')}
            </p>
          </div>
        ) : (
          <div className="relative">
            {activeSession.path.length > 1 && (
              <div className="absolute left-1/2 -translate-x-1/2 top-6 bottom-6 w-px z-0 bg-line" />
            )}
            <div className="flex flex-col gap-2 relative z-10">
              {activeSession.path.map((item, index) => {
                const delayMs =
                  index > 0 ? calculateGapDuration(activeSession.path[index - 1], item) : null;

                return (
                  <Fragment key={item.id}>
                    {index > 0 && delayMs != null && (
                      <div className="flex justify-center py-0.5 relative z-20">
                        <span
                          className="h-6 inline-flex items-center font-mono text-[10px] font-bold uppercase tracking-[0.14em] px-2 border border-line bg-paper-subtle text-stone gap-1.5"
                          title={t('gapDurationDesc')}
                        >
                          <Clock className="w-3 h-3 text-stone" />+{formatDuration(delayMs)} {t('gapLabel')}
                        </span>
                      </div>
                    )}
                    <RedirectItemCard
                      item={item}
                      index={index}
                      isLast={index === activeSession.path.length - 1}
                      isExpanded={expandedItems.has(item.id)}
                      onToggle={() => toggleExpanded(item.id)}
                      darkMode={darkMode}
                    />
                  </Fragment>
                );
              })}
            </div>
          </div>
        )}
        <div ref={bottomRef} className="h-1 shrink-0" />
      </div>

      {/* Footer */}
      <footer className="px-3.5 py-2 border-t border-line bg-paper-card font-mono text-[10px] flex items-center justify-between shrink-0 z-30 text-text-secondary">
        <label className="flex items-center gap-2 cursor-pointer select-none font-bold uppercase tracking-[0.12em]">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={e => setAutoScroll(e.target.checked)}
            className="w-3.5 h-3.5 accent-accent"
          />
          <span>{t('autoScroll')}</span>
        </label>
        <span className="h-6 inline-flex items-center px-2 border border-line bg-paper text-ink font-bold uppercase tracking-[0.14em]">
          {sessions.size}{' '}
          {sessions.size !== 1
            ? t('sessionsPlural')
            : t('sessionSingle')}
        </span>
      </footer>
    </div>
  );
}
