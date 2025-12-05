import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import ChainScoreCard from '../../components/ChainScoreCard';
import CopyButtons from '../../components/CopyButtons';
import EmptyState from '../../components/EmptyState';
import Header from '../../components/Header';
import RedirectPath from '../../components/RedirectPath';
import { ChainScore, RedirectItem, calculateChainScore, generateId } from '../../types/redirect';
import { exportToPDF } from '../../utils/pdf-export';
import { getSettings, saveSettings } from '../../utils/storage';

export default function App() {
  const [redirectPath, setRedirectPath] = useState<RedirectItem[]>([]);
  const [chainScore, setChainScore] = useState<ChainScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUrl, setCurrentUrl] = useState('');
  const [darkMode, setDarkMode] = useState(false);
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
        setRedirectPath(message.path);
        setLoading(false);
      }

      if (message.name === 'navigationStart' && message.tabId === currentTabId.current) {
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
    const settings = await getSettings();
    setDarkMode(settings.darkMode);
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

    const totalTime = redirectPath.reduce((acc, item) => acc + (item.timing?.duration || 0), 0);
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
        'flex flex-col min-h-[200px] max-h-[600px] transition-colors',
        darkMode ? 'bg-slate-900' : 'bg-slate-50'
      )}
    >
      <Header
        onRefresh={handleRefresh}
        onClear={handleClear}
        onToggleDarkMode={handleToggleDarkMode}
        onOpenDashboard={handleOpenDashboard}
        onOpenSidepanel={handleOpenSidepanel}
        hasPath={redirectPath.length > 0}
        darkMode={darkMode}
      />

      {chainScore && <ChainScoreCard score={chainScore} darkMode={darkMode} />}

      {redirectPath.length > 0 && (
        <CopyButtons
          redirectPath={redirectPath}
          darkMode={darkMode}
          onExportPDF={handleExportPDF}
        />
      )}

      <main className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : redirectPath.length > 0 ? (
          <RedirectPath items={redirectPath} darkMode={darkMode} />
        ) : (
          <EmptyState currentUrl={currentUrl} darkMode={darkMode} />
        )}
      </main>
    </div>
  );
}
