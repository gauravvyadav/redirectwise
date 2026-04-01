import clsx from 'clsx';
import { format } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Moon,
  RefreshCw,
  Sun,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import HeadersList from '../../components/HeadersList';
import Logo from '../../components/Logo';
import { ChainScore, RedirectItem, calculateChainScore } from '../../types/redirect';
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
  const chainScore: ChainScore | null = activeSession?.path.length
    ? calculateChainScore(activeSession.path)
    : null;

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
        darkMode ? 'bg-slate-900 text-white' : 'bg-slate-50 text-gray-900'
      )}
    >
      {/* Header - Popup Style */}
      <header className="bg-linear-to-r from-blue-600 to-blue-700 text-white px-4 py-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={32} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold leading-tight">RedirectWise</h1>
                <span
                  className={clsx(
                    'text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1',
                    isMonitoring ? 'bg-green-400/20 text-green-100' : 'bg-white/10 text-white/70'
                  )}
                >
                  <span
                    className={clsx(
                      'w-1.5 h-1.5 rounded-full',
                      isMonitoring ? 'bg-green-400 animate-pulse-live' : 'bg-white/50'
                    )}
                  />
                  {isMonitoring ? 'Live' : 'Paused'}
                </span>
              </div>
              <p className="text-xs text-blue-200">Realtime Monitor</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMonitoring(!isMonitoring)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title={isMonitoring ? 'Pause monitoring' : 'Resume monitoring'}
            >
              {isMonitoring ? (
                <Activity className="w-4 h-4 text-green-300" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={clearSessions}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Clear sessions"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              onClick={toggleDarkMode}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Toggle dark mode"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Active Tab Info - Show current tab URL */}
        {(activeSession?.url || activeTabUrl) && (
          <div className="mt-2 text-xs truncate px-2 py-1.5 rounded bg-white/10">
            <span className="text-blue-200">Monitoring: </span>
            <span className="font-medium">
              {truncateUrl(activeSession?.url || activeTabUrl, 50)}
            </span>
          </div>
        )}

        {/* Chain Score Summary - Slim Header Version */}
        {chainScore && settings?.showChainScoreInSidepanel !== false && (
          <div className="mt-2 flex items-center justify-between text-xs px-2 py-1.5 rounded bg-white/10">
            <div className="flex items-center gap-2">
              <span className="text-blue-200">Score:</span>
              <span
                className={clsx(
                  'font-bold px-1.5 py-0.5 rounded text-[10px]',
                  chainScore.grade === 'A' && 'bg-green-500 text-white',
                  chainScore.grade === 'B' && 'bg-lime-500 text-slate-900',
                  chainScore.grade === 'C' && 'bg-yellow-500 text-slate-900',
                  chainScore.grade === 'D' && 'bg-orange-500 text-white',
                  chainScore.grade === 'F' && 'bg-red-500 text-white'
                )}
              >
                {chainScore.grade}
              </span>
              <span className="font-semibold">{chainScore.score}/100</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-white/80">
                {activeSession?.path.length || 0} hop
                {(activeSession?.path.length || 0) !== 1 ? 's' : ''}
              </span>
              {chainScore.issues.length > 0 && (
                <span className="flex items-center gap-1 text-yellow-300 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {chainScore.issues.length} {chainScore.issues.length === 1 ? 'issue' : 'issues'}
                </span>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Redirect Stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2 pb-6">
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
              {isMonitoring ? 'Waiting for redirects...' : 'Monitoring paused'}
            </p>
            <p className={clsx('text-xs mt-1', darkMode ? 'text-slate-500' : 'text-gray-400')}>
              Navigate to a URL to see redirects in realtime
            </p>
          </div>
        ) : (
          activeSession.path.map((item, index) => {
            let delayMs = 0;
            if (index > 0) {
              const prevItem = activeSession.path[index - 1];
              if (item.timing?.startTime && prevItem.timing?.endTime) {
                delayMs = Math.max(0, item.timing.startTime - prevItem.timing.endTime);
              } else if (item.timestamp && prevItem.timestamp) {
                delayMs = Math.max(0, item.timestamp - prevItem.timestamp);
              }
            }

            return (
              <Fragment key={item.id}>
                {index > 0 && delayMs >= 0 && (
                  <div className="flex justify-center py-1 relative z-20">
                    <span
                      className={clsx(
                        'text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 border shadow-sm',
                        darkMode
                          ? 'bg-slate-800 text-slate-400 border-slate-700'
                          : 'bg-white text-slate-500 border-slate-200'
                      )}
                      title={`Time passed between previous request finishing and this request starting`}
                    >
                      <Clock className="w-3 h-3" />
                      {delayMs}ms gap
                    </span>
                  </div>
                )}
                <div
                  className={clsx(
                    'rounded-xl border transition-colors',
                    item.isNew && 'animate-highlight',
                    darkMode
                      ? 'bg-slate-800 border-slate-700 hover:border-slate-600'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  )}
                >
                  {/* Compact View */}
                  <button
                    onClick={() => toggleExpanded(item.id)}
                    className="w-full px-3 py-2 flex items-center gap-2 text-left"
                  >
                    <div
                      className={clsx(
                        'w-2.5 h-2.5 rounded-full shrink-0',
                        getStatusColor(item.status_code)
                      )}
                    />

                    <span
                      className={clsx(
                        'text-xs font-mono w-5 h-5 rounded-full flex items-center justify-center',
                        darkMode ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      {index + 1}
                    </span>

                    <span className="flex-1" />

                    <span
                      className={clsx(
                        'text-xs font-mono font-bold px-1.5 py-0.5 rounded',
                        item.status_code >= 200 &&
                          item.status_code < 300 &&
                          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                        item.status_code >= 300 &&
                          item.status_code < 400 &&
                          'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                        item.status_code >= 400 &&
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      )}
                    >
                      {item.status_code}
                    </span>

                    {item.timing?.duration && (
                      <span
                        className={clsx(
                          'text-[10px] shrink-0 px-1.5 py-0.5 rounded',
                          darkMode ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'
                        )}
                      >
                        {item.timing.duration}ms
                      </span>
                    )}

                    <span
                      className={clsx(
                        'text-[10px] shrink-0 px-1.5 py-0.5 rounded',
                        darkMode ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      {formatTime(item.timestamp)}
                    </span>

                    {expandedItems.has(item.id) ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </button>

                  <p
                    className={clsx(
                      'px-3 pb-2 text-xs break-all font-mono',
                      darkMode ? 'text-slate-400' : 'text-gray-600'
                    )}
                  >
                    {item.url}
                  </p>

                  {/* Expanded Details */}
                  {expandedItems.has(item.id) && (
                    <div
                      className={clsx(
                        'px-3 pb-3 pt-2 text-xs space-y-2 border-t',
                        darkMode
                          ? 'border-slate-700 bg-slate-800/50'
                          : 'border-gray-100 bg-gray-50/50'
                      )}
                    >
                      {/* Full URL */}
                      <div className="flex items-start gap-2">
                        <span className="text-gray-500 w-14 shrink-0">URL:</span>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline break-all flex items-center gap-1"
                        >
                          {item.url}
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>

                      {/* Status */}
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 w-14">Status:</span>
                        <span className="flex items-center gap-1">
                          {item.status_code >= 200 && item.status_code < 300 && (
                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                          )}
                          {item.status_code >= 300 && item.status_code < 400 && (
                            <ArrowRight className="w-3 h-3 text-amber-500" />
                          )}
                          {item.status_code >= 400 && <XCircle className="w-3 h-3 text-red-500" />}
                          {item.status_line}
                        </span>
                      </div>

                      {/* Redirect Type */}
                      {item.redirect_type && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 w-14">Type:</span>
                          <span
                            className={clsx(
                              'px-1.5 py-0.5 rounded text-[10px] uppercase font-medium',
                              item.redirect_type === 'permanent' &&
                                'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
                              item.redirect_type === 'temporary' &&
                                'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
                              item.redirect_type === 'hsts' &&
                                'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                            )}
                          >
                            {item.redirect_type}
                          </span>
                        </div>
                      )}

                      {/* Timing */}
                      {item.timing && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 w-14">Time:</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-gray-400" />
                            {item.timing.duration}ms
                          </span>
                        </div>
                      )}

                      {/* Redirect URL */}
                      {item.redirect_url && (
                        <div className="flex items-start gap-2">
                          <span className="text-gray-500 w-14 shrink-0">To:</span>
                          <span className="text-blue-500 break-all">{item.redirect_url}</span>
                        </div>
                      )}

                      {/* Enhanced Headers Details */}
                      {item.headers && item.headers.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                          <HeadersList headers={item.headers} ip={item.ip} darkMode={darkMode} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Fragment>
            );
          })
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
          <span>Auto-scroll</span>
        </label>
        <span
          className={clsx('px-2 py-0.5 rounded-full', darkMode ? 'bg-slate-700' : 'bg-gray-100')}
        >
          {sessions.size} session{sessions.size !== 1 ? 's' : ''}
        </span>
      </footer>
    </div>
  );
}
