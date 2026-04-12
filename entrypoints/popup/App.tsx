import clsx from 'clsx';
import { AlertTriangle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import ChainScoreCard from '../../components/ChainScoreCard';
import CopyButtons from '../../components/CopyButtons';
import EmptyState from '../../components/EmptyState';
import Header from '../../components/Header';
import RedirectPath from '../../components/RedirectPath';
import {
  ChainScore,
  RedirectItem,
  calculateChainScore,
  calculateTotalDuration,
  generateId,
} from '../../types/redirect';
import { exportToPDF } from '../../utils/pdf-export';
import { Settings, getSettings, saveSettings } from '../../utils/storage';

export default function App() {
  const [redirectPath, setRedirectPath] = useState<RedirectItem[]>([]);
  const [chainScore, setChainScore] = useState<ChainScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const currentTabId = useRef<number | null>(null);

  useEffect(() => {
    loadSettings();
    loadRedirectPath();

    // Listen for real-time updates from background
    const handleMessage = (message: {
      name: string;
      tabId?: number;
      path?: RedirectItem[];
      item?: RedirectItem;
      error?: string;
    }) => {
      if (!currentTabId.current) return;

      if (
        message.name === 'redirectUpdate' &&
        message.tabId === currentTabId.current &&
        message.item
      ) {
        setRedirectPath(prev => [...prev, message.item!]);
      }

      if (
        message.name === 'navigationComplete' &&
        message.tabId === currentTabId.current &&
        message.path
      ) {
        setNavigationError(null);
        setRedirectPath(message.path);
        setLoading(false);
      }

      if (message.name === 'navigationError' && message.tabId === currentTabId.current) {
        if (message.path) {
          setRedirectPath(message.path);
        }
        setNavigationError(message.error || 'Navigation failed');
        setLoading(false);
      }

      if (message.name === 'navigationStart' && message.tabId === currentTabId.current) {
        setNavigationError(null);
        setRedirectPath([]);
        setLoading(true);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    if (redirectPath.length > 0) {
      setChainScore(calculateChainScore(redirectPath));
    } else {
      setChainScore(null);
    }
  }, [redirectPath]);

  const loadSettings = async () => {
    const s = await getSettings();
    setSettings(s);
    setDarkMode(s.darkMode);
  };

  const loadRedirectPath = async () => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (tab?.id) {
        currentTabId.current = tab.id;
        setCurrentUrl(tab.url || '');

        const response = await chrome.runtime.sendMessage({
          name: 'getTabPath',
          tabId: tab.id,
        });

        console.log('[RedirectWise] Received path:', response);
        const path = response.path || [];
        setNavigationError(null);
        setRedirectPath(path);

        // If no path and page might still be loading, wait a bit and retry
        if (path.length === 0 && tab.status === 'loading') {
          setTimeout(async () => {
            const retryResponse = await chrome.runtime.sendMessage({
              name: 'getTabPath',
              tabId: tab.id,
            });
            if (retryResponse.path && retryResponse.path.length > 0) {
              setRedirectPath(retryResponse.path);
            }
            setLoading(false);
          }, 500);
          return;
        }
      }
    } catch (error) {
      console.error('[RedirectWise] Error loading path:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    loadRedirectPath();
  };

  const handleClear = async () => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (tab?.id) {
        await chrome.runtime.sendMessage({
          name: 'clearTabPath',
          tabId: tab.id,
        });
        setRedirectPath([]);
      }
    } catch (error) {
      console.error('[RedirectWise] Error clearing path:', error);
    }
  };

  const handleToggleDarkMode = async () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    await saveSettings({ darkMode: newMode });
  };

  const handleOpenDashboard = () => {
    chrome.runtime.sendMessage({ name: 'openDashboard' });
  };

  const handleOpenSidepanel = async () => {
    try {
      const window = await chrome.windows.getCurrent();
      await chrome.runtime.sendMessage({
        name: 'openSidepanel',
        windowId: window.id,
      });
    } catch (error) {
      console.error('[RedirectWise] Error opening sidepanel:', error);
    }
  };

  const handleExportPDF = useCallback(async () => {
    if (redirectPath.length === 0 || !chainScore) return;

    const totalTime = calculateTotalDuration(redirectPath);
    const redirectCount = redirectPath.filter(
      p => p.type === 'server_redirect' || p.type === 'client_redirect'
    ).length;

    const entry = {
      id: generateId(),
      originalUrl: redirectPath[0]?.url || '',
      finalUrl: redirectPath[redirectPath.length - 1]?.url || '',
      path: redirectPath,
      timestamp: Date.now(),
      chainScore,
      totalTime,
      redirectCount,
    };

    await exportToPDF(entry);
  }, [redirectPath, chainScore]);

  return (
    <div
      className={clsx(
        'flex flex-col w-full h-[600px] transition-colors',
        darkMode ? 'bg-slate-900' : 'bg-slate-50'
      )}
    >
      {/* Fixed header section */}
      <div className="shrink-0">
        <Header
          onRefresh={handleRefresh}
          onClear={handleClear}
          onToggleDarkMode={handleToggleDarkMode}
          onOpenDashboard={handleOpenDashboard}
          onOpenSidepanel={handleOpenSidepanel}
          hasPath={redirectPath.length > 0}
          darkMode={darkMode}
        />

        {chainScore && settings?.showChainScoreInPopup !== false && (
          <ChainScoreCard score={chainScore} darkMode={darkMode} />
        )}

        {redirectPath.length > 0 && (
          <CopyButtons
            redirectPath={redirectPath}
            darkMode={darkMode}
            onExportPDF={handleExportPDF}
          />
        )}
      </div>

      {/* Scrollable content area */}
      <main className="flex-1 overflow-y-auto p-3 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : navigationError && redirectPath.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <AlertTriangle className="w-10 h-10 text-red-500 mb-3" />
            <code
              className={clsx(
                'text-xs px-2 py-1 rounded break-all',
                darkMode ? 'bg-red-950/40 text-red-300' : 'bg-red-50 text-red-600'
              )}
            >
              {navigationError}
            </code>
          </div>
        ) : redirectPath.length > 0 ? (
          <div className="space-y-3">
            {navigationError && (
              <div
                className={clsx(
                  'rounded-lg border px-3 py-2 flex items-center gap-2',
                  darkMode ? 'bg-red-950/30 border-red-900/60 text-red-300' : 'bg-red-50 border-red-200 text-red-600'
                )}
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <code className="text-[11px] break-all">{navigationError}</code>
              </div>
            )}
            <RedirectPath items={redirectPath} darkMode={darkMode} />
          </div>
        ) : (
          <EmptyState currentUrl={currentUrl} darkMode={darkMode} />
        )}
      </main>
    </div>
  );
}
