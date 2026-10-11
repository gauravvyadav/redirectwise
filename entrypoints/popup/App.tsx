import { AlertTriangle, Info, PanelRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import CopyButtons from '../../components/CopyButtons';
import EmptyState from '../../components/EmptyState';
import Header from '../../components/Header';
import RedirectPath from '../../components/RedirectPath';
import type { RedirectItem } from '../../types/redirect';
import { calculateTotalDuration, generateId } from '../../types/redirect';
import { exportToImage } from '../../utils/image-export';
import { exportToPDF } from '../../utils/pdf-export';
import type { Settings } from '../../utils/storage';
import { getSettings, saveSettings } from '../../utils/storage';
import { t, useI18n } from '../../utils/i18n';

// Popup shows the current tab only: drop inherited opener hops and strip the
// opener marker so no cross-tab trace (or divider) renders here. The full
// journey stays visible in the sidepanel and dashboard.
function forPopupDisplay(items: RedirectItem[]): RedirectItem[] {
  return items
    .filter(item => !item.inherited)
    .map(item => (item.openedFrom ? { ...item, openedFrom: undefined } : item));
}

function forPopupItem(item: RedirectItem): RedirectItem | null {
  if (item.inherited) return null;
  return item.openedFrom ? { ...item, openedFrom: undefined } : item;
}

export default function App() {
  useI18n();
  const [redirectPath, setRedirectPath] = useState<RedirectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [, setSettings] = useState<Settings | null>(null);
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
        const incoming = forPopupItem(message.item);
        if (!incoming) return;
        setRedirectPath(prev => {
          const idx = prev.findIndex(x => x.id === incoming.id);
          if (idx >= 0) {
            // Background may re-broadcast a known hop with updated metadata
            // (e.g. re-chained as client_redirect after a merge) — refresh it.
            const next = [...prev];
            next[idx] = incoming;
            return next;
          }
          return [...prev, incoming];
        });
      }

      if (
        message.name === 'navigationComplete' &&
        message.tabId === currentTabId.current &&
        message.path
      ) {
        setNavigationError(null);
        setRedirectPath(forPopupDisplay(message.path));
        setLoading(false);
      }

      if (message.name === 'navigationError' && message.tabId === currentTabId.current) {
        if (message.path) {
          setRedirectPath(forPopupDisplay(message.path));
        }
        setNavigationError(message.error || 'Navigation failed');
        setLoading(false);
      }

      if (message.name === 'navigationStart' && message.tabId === currentTabId.current) {
        setNavigationError(null);
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
          includeInherited: false,
        });

        const path = response.path || [];
        setNavigationError(null);
        setRedirectPath(forPopupDisplay(path));

        if (path.length === 0 && tab.status === 'loading') {
          setTimeout(async () => {
            const retryResponse = await chrome.runtime.sendMessage({
              name: 'getTabPath',
              tabId: tab.id,
              includeInherited: false,
            });
            if (retryResponse.path && retryResponse.path.length > 0) {
              setRedirectPath(forPopupDisplay(retryResponse.path));
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
    if (redirectPath.length === 0) return;

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
      totalTime,
      redirectCount,
    };

    await exportToPDF(entry);
  }, [redirectPath]);

  const handleExportImage = useCallback(async () => {
    if (redirectPath.length === 0) return;

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
      totalTime,
      redirectCount,
    };

    await exportToImage(entry);
  }, [redirectPath]);

  return (
    <div className="flex flex-col w-full h-150 transition-colors bg-paper text-ink">
      {/* Fixed architectural header */}
      <div className="shrink-0">
        <Header
          onRefresh={handleRefresh}
          onToggleDarkMode={handleToggleDarkMode}
          onOpenDashboard={handleOpenDashboard}
          onOpenSidepanel={handleOpenSidepanel}
          darkMode={darkMode}
        />

        {redirectPath.length > 0 && (
          <CopyButtons
            redirectPath={redirectPath}
            darkMode={darkMode}
            onExportPDF={handleExportPDF}
            onExportImage={handleExportImage}
            onClear={handleClear}
          />
        )}
      </div>

      {/* Content area */}
      <main className="flex-1 overflow-y-auto p-3.5 min-h-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent animate-spin" />
            <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-muted">
              {t('inspectingRedirects')}
            </span>
          </div>
        ) : navigationError && redirectPath.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4">
            <AlertTriangle className="w-8 h-8 text-err mb-2" />
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-err mb-1">
              {t('navigationError')}
            </span>
            <code className="font-mono text-[11px] px-2.5 py-1.5 border border-err-border bg-err-bg text-err break-all">
              {navigationError}
            </code>
          </div>
        ) : redirectPath.length > 0 ? (
          <div className="space-y-3">
            {navigationError && (
              <div className="border border-err-border bg-err-bg text-err px-3 py-2 flex items-center gap-2 font-mono text-[10.5px]">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <code className="break-all">{navigationError}</code>
              </div>
            )}
            <RedirectPath items={redirectPath} darkMode={darkMode} />
          </div>
        ) : (
          <EmptyState currentUrl={currentUrl} darkMode={darkMode} />
        )}
      </main>

      {/* Footer hint: new-tab ad chains (Google / Meta ads) are tracked live
          in the sidepanel — the popup stays a single-tab view by design. */}
      <footer className="shrink-0 border-t border-line bg-paper-card px-3 py-2 flex items-center gap-1.5">
        <Info className="w-3.5 h-3.5 text-brand shrink-0" />
        <span className="flex-1 min-w-0 font-mono text-[9px] font-bold uppercase tracking-[0.02em] text-muted leading-relaxed whitespace-nowrap truncate">
          {t('newTabAdNotice')}
        </span>
        <button
          onClick={handleOpenSidepanel}
          className="shrink-0 h-6 px-2 inline-flex items-center gap-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.12em] border border-line bg-paper-subtle text-ink hover:border-ink transition-colors cursor-pointer"
          title={t('openSidepanel')}
        >
          <PanelRight className="w-3 h-3" />
          {t('openLabel')}
        </button>
      </footer>
    </div>
  );
}
