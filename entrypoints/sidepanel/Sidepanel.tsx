import clsx from 'clsx';
import { format } from 'date-fns';
import { Activity, Clock, Moon, RefreshCw, Sun, Trash2 } from 'lucide-react';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import RedirectItemCard from '../../components/RedirectItemCard';
import { RedirectItem, calculateGapDuration, formatDuration } from '../../types/redirect';
import { Settings, getSettings, saveSettings } from '../../utils/storage';

interface LiveRedirect extends RedirectItem {
  isNew?: boolean;
}

interface TabSession {
  tabId: number;
  url: string;
  title: string;
  path: LiveRedirect[];
  startTime: number;
  isActive: boolean;
}

const STATUS_COLORS = {
  success: 'bg-green-500',
  redirect: 'bg-amber-500',
  clientError: 'bg-red-500',
  serverError: 'bg-red-600',
} as const;

function getStatusColor(statusCode: number): string {
  if (statusCode >= 200 && statusCode < 300) return STATUS_COLORS.success;
  if (statusCode >= 300 && statusCode < 400) return STATUS_COLORS.redirect;
  if (statusCode >= 400 && statusCode < 500) return STATUS_COLORS.clientError;
  return STATUS_COLORS.serverError;
}

export default function Sidepanel() {
  const [sessions, setSessions] = useState<Map<number, TabSession>>(new Map());
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [activeTabUrl, setActiveTabUrl] = useState<string>('');
  const [darkMode, setDarkMode] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeTabIdRef = useRef<number | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  // Load settings
  useEffect(() => {
    loadSettings();
    initializeActiveTab();
  }, []);

  // Apply dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Listen for tab activation changes
  useEffect(() => {
    const handleTabActivated = async (activeInfo: chrome.tabs.TabActiveInfo) => {
      const tabId = activeInfo.tabId;
      setActiveTabId(tabId);

      // Fetch current redirect path for the newly active tab
      try {
        const tab = await chrome.tabs.get(tabId);
        setActiveTabUrl(tab.url || '');

        const response = await chrome.runtime.sendMessage({
          name: 'getTabPath',
          tabId: tabId,
        });

        // Clear all sessions and only show new active tab's data
        setSessions(() => {
          const newSessions = new Map<number, TabSession>();
          newSessions.set(tabId, {
            tabId,
            url: tab.url || '',
            title: tab.title || 'Unknown',
            path: response?.path || [],
            startTime: Date.now(),
            isActive: true,
          });
          return newSessions;
        });
      } catch (error) {
        console.error('[RedirectWise Sidepanel] Error fetching tab path:', error);
      }
    };

    // Also listen for URL changes in the current tab
    const handleTabUpdated = async (
      tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab
    ) => {
      if (tabId === activeTabId && changeInfo.url) {
        setActiveTabUrl(changeInfo.url);
      }
    };

    chrome.tabs.onActivated.addListener(handleTabActivated);
    chrome.tabs.onUpdated.addListener(handleTabUpdated);

    return () => {
      chrome.tabs.onActivated.removeListener(handleTabActivated);
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
    };
  }, [activeTabId]);

  // Auto scroll to bottom
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

        // Request current state from background
        const response = await chrome.runtime.sendMessage({
          name: 'getTabPath',
          tabId: tab.id,
        });

        // Clear all sessions and only show current tab's data
        setSessions(() => {
          const newSessions = new Map<number, TabSession>();
          if (response?.path?.length > 0) {
            newSessions.set(tab.id!, {
              tabId: tab.id!,
              url: tab.url || '',
              title: tab.title || 'Unknown',
              path: response.path,
              startTime: Date.now(),
              isActive: true,
            });
          }
          return newSessions;
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

      if (existing) {
        // Just update URL and title of existing session to preserve the continuous path
        existing.url = url;
        existing.title = title || url;
        existing.isActive = true;
        newSessions.set(tabId, existing);
      } else {
        // Start new session if none exists
        newSessions.set(tabId, {
          tabId,
          url,
          title: title || url,
          path: [],
          startTime: Date.now(),
          isActive: true,
        });
      }
      return newSessions;
    });
  }, []);

  const handleNewRedirect = useCallback(
    (tabId: number, item: RedirectItem, url?: string, title?: string) => {
      setSessions(prev => {
        const newSessions = new Map(prev);
        const session = newSessions.get(tabId) || {
          tabId,
          url: url || item.url,
          title: title || 'Unknown',
          path: [],
          startTime: Date.now(),
          isActive: true,
        };

        // Prevent duplicate items
        if (session.path.some(x => x.id === item.id)) {
          return prev;
        }

        // Add new item to path with isNew flag for CSS animation
        const newItem: LiveRedirect = { ...item, isNew: true };
        session.path = [...session.path, newItem];
        session.isActive = true;
        newSessions.set(tabId, session);

        return newSessions;
      });
    },
    []
  );

  // Set up message listener for realtime updates
  useEffect(() => {
    const handleMessage = (
      message: { name: string; tabId?: number; item?: RedirectItem; url?: string; title?: string },
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void
    ) => {
      if (!isMonitoring) return;

      const currentActiveTabId = activeTabIdRef.current;

      // Only process updates for the active tab
      if (message.name === 'redirectUpdate' && message.tabId && message.item) {
        if (message.tabId === currentActiveTabId) {
          handleNewRedirect(message.tabId, message.item, message.url, message.title);
        }
        sendResponse({ received: true });
      }

      if (message.name === 'navigationStart' && message.tabId) {
        if (message.tabId === currentActiveTabId) {
          handleNavigationStart(message.tabId, message.url || '', message.title || '');
          setActiveTabUrl(message.url || '');
        }
        sendResponse({ received: true });
      }

      return true;
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [isMonitoring, handleNewRedirect, handleNavigationStart]);

  const toggleDarkMode = async () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    await saveSettings({ darkMode: newMode });
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

  const formatTime = (timestamp: number) => {
    return format(timestamp, 'HH:mm:ss.SSS');
  };

  const truncateUrl = (url: string, maxLength = 40) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
  };

  return (
    <div
      className={clsx(
        'h-screen flex flex-col overflow-hidden',
        darkMode ? 'bg-slate-900 text-white' : 'bg-white text-gray-900'
      )}
    >
      {/* Header - Compact Functional Style */}
      <header className="bg-linear-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wide text-white">
              {chrome.i18n.getMessage('realtimeMonitor')}
            </span>
            <span
              className={clsx(
                'text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 font-medium border',
                isMonitoring
                  ? 'bg-green-500/20 text-green-200 border-green-300/30'
                  : 'bg-white/10 text-blue-100 border-white/20'
              )}
            >
              <span
                className={clsx(
                  'w-1 h-1 rounded-full',
                  isMonitoring ? 'bg-green-400 animate-pulse-live' : 'bg-blue-200'
                )}
              />
              {isMonitoring ? chrome.i18n.getMessage('live') : chrome.i18n.getMessage('paused')}
            </span>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setIsMonitoring(!isMonitoring)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              title={
                isMonitoring
                  ? chrome.i18n.getMessage('pauseMonitoring')
                  : chrome.i18n.getMessage('resumeMonitoring')
              }
            >
              {isMonitoring ? (
                <Activity className="w-4 h-4 text-green-300" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={clearSessions}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              title={chrome.i18n.getMessage('clearSessions')}
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              title={chrome.i18n.getMessage('toggleDarkMode')}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Active Tab Info - Show current tab URL */}
        {(activeSession?.url || activeTabUrl) && (
          <div className="mt-1.5 text-xs truncate px-2 py-1 rounded bg-white/10 text-blue-100 border border-white/10">
            <span className="text-blue-200">{chrome.i18n.getMessage('monitoringLabel')} </span>
            <span className="font-medium text-white">
              {truncateUrl(activeSession?.url || activeTabUrl, 50)}
            </span>
          </div>
        )}
      </header>

      {/* Redirect Stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-1 py-3 flex flex-col gap-2 pb-6">
        {!activeSession || activeSession.path.length === 0 ? (
          <div
            className={clsx(
              'flex flex-col items-center justify-center h-full text-center p-6 rounded-xl border',
              darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
            )}
          >
            <div
              className={clsx(
                'w-16 h-16 rounded-2xl flex items-center justify-center mb-4',
                darkMode ? 'bg-slate-700' : 'bg-gray-100'
              )}
            >
              <Activity
                className={clsx('w-8 h-8', darkMode ? 'text-slate-500' : 'text-gray-400')}
              />
            </div>
            <p
              className={clsx('text-sm font-medium', darkMode ? 'text-slate-300' : 'text-gray-600')}
            >
              {isMonitoring
                ? chrome.i18n.getMessage('waitingForRedirects')
                : chrome.i18n.getMessage('monitoringPaused')}
            </p>
            <p className={clsx('text-xs mt-1', darkMode ? 'text-slate-500' : 'text-gray-400')}>
              {chrome.i18n.getMessage('navigateRealtimeMessage')}
            </p>
          </div>
        ) : (
          <div className="relative">
            {activeSession.path.length > 1 && (
              <div
                className={clsx(
                  'absolute left-7 top-6 bottom-6 w-0.5 z-0',
                  darkMode ? 'bg-slate-800' : 'bg-slate-200'
                )}
              />
            )}
            <div className="flex flex-col gap-2 relative z-10">
              {activeSession.path.map((item, index) => {
                const delayMs =
                  index > 0 ? calculateGapDuration(activeSession.path[index - 1], item) : null;

                return (
                  <Fragment key={item.id}>
                    {index > 0 && delayMs != null && (
                      <div className="flex pl-16 py-1 relative z-20">
                        <span
                          className={clsx(
                            'text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 border',
                            darkMode
                              ? 'bg-slate-800 text-slate-400 border-slate-700'
                              : 'bg-white text-slate-500 border-slate-200'
                          )}
                          title={`Time passed between previous request finishing and this request starting`}
                        >
                          <Clock className="w-3 h-3" />
                          {formatDuration(delayMs)} gap
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
      <footer
        className={clsx(
          'px-4 py-2 border-t text-xs flex items-center justify-between shrink-0 z-30',
          darkMode
            ? 'bg-slate-800 border-slate-700 text-slate-400'
            : 'bg-white border-gray-200 text-gray-500'
        )}
      >
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={e => setAutoScroll(e.target.checked)}
            className="w-3.5 h-3.5 rounded accent-blue-500"
          />
          <span>{chrome.i18n.getMessage('autoScroll')}</span>
        </label>
        <span
          className={clsx('px-2 py-0.5 rounded-full', darkMode ? 'bg-slate-700' : 'bg-gray-100')}
        >
          {sessions.size}{' '}
          {sessions.size !== 1
            ? chrome.i18n.getMessage('sessionsPlural')
            : chrome.i18n.getMessage('sessionSingle')}
        </span>
      </footer>
    </div>
  );
}
