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
import { useCallback, useEffect, useRef, useState } from 'react';
import Logo from '../../components/Logo';
import { ChainScore, RedirectItem, calculateChainScore } from '../../types/redirect';
import { getSettings, saveSettings } from '../../utils/storage';

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
  redirect: 'bg-blue-500',
  clientError: 'bg-yellow-500',
  serverError: 'bg-red-500',
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
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
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
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sessions, autoScroll]);

  const loadSettings = async () => {
    const settings = await getSettings();
    setDarkMode(settings.darkMode);
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
      // Mark previous session for this tab as inactive
      const existing = newSessions.get(tabId);
      if (existing) {
        existing.isActive = false;
      }
      // Start new session
      newSessions.set(tabId, {
        tabId,
        url,
        title: title || url,
        path: [],
        startTime: Date.now(),
        isActive: true,
      });
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

        // Add new item with animation flag
        const newItem: LiveRedirect = { ...item, isNew: true };
        session.path = [...session.path, newItem];
        session.isActive = true;
        newSessions.set(tabId, session);

        // Remove 'isNew' flag after animation
        setTimeout(() => {
          setSessions(current => {
            const updated = new Map(current);
            const s = updated.get(tabId);
            if (s) {
              s.path = s.path.map(p => (p.id === item.id ? { ...p, isNew: false } : p));
              updated.set(tabId, s);
            }
            return updated;
          });
        }, 1000);

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
        'min-h-screen flex flex-col',
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
      </header>

      {/* Chain Score Summary - Popup Style */}
      {chainScore && (
        <div
          className={clsx(
            'mx-3 mt-3 p-3 rounded-xl border shadow-sm',
            darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={clsx(
                  'w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl text-white shadow-lg',
                  chainScore.grade === 'A' && 'bg-linear-to-br from-green-400 to-green-600',
                  chainScore.grade === 'B' && 'bg-linear-to-br from-lime-400 to-lime-600',
                  chainScore.grade === 'C' && 'bg-linear-to-br from-yellow-400 to-yellow-600',
                  chainScore.grade === 'D' && 'bg-linear-to-br from-orange-400 to-orange-600',
                  chainScore.grade === 'F' && 'bg-linear-to-br from-red-400 to-red-600'
                )}
              >
                {chainScore.grade}
              </div>
              <div>
                <div className="text-base font-semibold">SEO Score: {chainScore.score}/100</div>
                <div className={clsx('text-xs', darkMode ? 'text-slate-400' : 'text-gray-500')}>
                  {activeSession?.path.length || 0} hop
                  {(activeSession?.path.length || 0) !== 1 ? 's' : ''} detected
                </div>
              </div>
            </div>
            {chainScore.issues.length > 0 && (
              <div
                className={clsx(
                  'flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg',
                  darkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-50 text-yellow-700'
                )}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {chainScore.issues.length} issue{chainScore.issues.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Redirect Stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
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
          activeSession.path.map((item, index) => (
            <div
              key={item.id}
              className={clsx(
                'rounded-xl border shadow-sm transition-all duration-300',
                item.isNew && 'ring-2 ring-blue-500 ring-opacity-50',
                darkMode
                  ? 'bg-slate-800 border-slate-700 hover:border-slate-600'
                  : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
              )}
            >
              {/* Compact View */}
              <button
                onClick={() => toggleExpanded(item.id)}
                className="w-full px-3 py-2 flex items-center gap-2 text-left"
              >
                {/* Status Indicator */}
                <div
                  className={clsx(
                    'w-2.5 h-2.5 rounded-full shrink-0',
                    getStatusColor(item.status_code)
                  )}
                />

                {/* Index */}
                <span
                  className={clsx(
                    'text-xs font-mono w-5 h-5 rounded-full flex items-center justify-center',
                    darkMode ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'
                  )}
                >
                  {index + 1}
                </span>

                {/* Status Code */}
                <span
                  className={clsx(
                    'text-xs font-mono font-bold px-1.5 py-0.5 rounded',
                    item.status_code >= 200 &&
                      item.status_code < 300 &&
                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                    item.status_code >= 300 &&
                      item.status_code < 400 &&
                      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                    item.status_code >= 400 &&
                      item.status_code < 500 &&
                      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                    item.status_code >= 500 &&
                      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  )}
                >
                  {item.status_code}
                </span>

                {/* URL */}
                <span className="flex-1 text-xs truncate font-mono">
                  {truncateUrl(item.url, 35)}
                </span>

                {/* Timestamp */}
                <span
                  className={clsx(
                    'text-[10px] shrink-0 px-1.5 py-0.5 rounded',
                    darkMode ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'
                  )}
                >
                  {formatTime(item.timestamp)}
                </span>

                {/* Expand Icon */}
                {expandedItems.has(item.id) ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {/* Expanded Details */}
              {expandedItems.has(item.id) && (
                <div
                  className={clsx(
                    'px-3 pb-3 pt-2 text-xs space-y-2 border-t',
                    darkMode ? 'border-slate-700 bg-slate-800/50' : 'border-gray-100 bg-gray-50/50'
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
                        <ArrowRight className="w-3 h-3 text-blue-500" />
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
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <footer
        className={clsx(
          'sticky bottom-0 px-4 py-2 border-t text-xs flex items-center justify-between',
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
