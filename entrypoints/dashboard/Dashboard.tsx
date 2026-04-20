import clsx from 'clsx';
import { format, formatDistanceToNow } from 'date-fns';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileImage,
  FileSpreadsheet,
  Globe,
  Menu,
  Moon,
  RefreshCw,
  Search,
  Settings,
  Star,
  StarOff,
  Sun,
  Trash2,
  Zap,
} from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Logo from '../../components/Logo';
import RedirectItemCard from '../../components/RedirectItemCard';
import { HistoryEntry, RedirectItem, calculateGapDuration, formatDuration } from '../../types/redirect';
import { exportHistoryToPDF, exportToPDF } from '../../utils/pdf-export';
import { exportToImage } from '../../utils/image-export';
import {
  Settings as AppSettings,
  clearHistory,
  deleteHistoryEntry,
  getHistory,
  getHistoryStats,
  getSettings,
  saveSettings,
  updateHistoryEntry,
} from '../../utils/storage';

interface Stats {
  totalEntries: number;
  totalRedirects: number;
  favorites: number;
}

export default function Dashboard() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [currentView, setCurrentView] = useState<'history' | 'settings'>('history');
  const [settingsActiveTab, setSettingsActiveTab] = useState<'general'>('general');
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'redirects'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const detailPanelRef = useRef<HTMLDivElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<'single' | 'all' | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [historyData, statsData] = await Promise.all([getHistory(), getHistoryStats()]);
    setHistory(historyData);
    setStats(statsData);
    setLoading(false);
  };

  const loadSettings = async () => {
    const s = await getSettings();
    setSettings(s);
    setDarkMode(s.darkMode);
  };

  const filteredHistory = useMemo(() => {
    let filtered = [...history];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        entry =>
          entry.originalUrl.toLowerCase().includes(query) ||
          entry.finalUrl.toLowerCase().includes(query) ||
          entry.notes?.toLowerCase().includes(query)
      );
    }

    // Favorites filter
    if (filter === 'favorites') {
      filtered = filtered.filter(entry => entry.isFavorite);
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = a.timestamp - b.timestamp;
          break;
        case 'redirects':
          comparison = a.redirectCount - b.redirectCount;
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [history, searchQuery, filter, sortBy, sortOrder]);

  useEffect(() => {
    loadData();
    loadSettings();
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Auto-select first entry when filtered history changes
  useEffect(() => {
    if (filteredHistory.length > 0 && !selectedEntry) {
      setSelectedEntry(filteredHistory[0]);
    } else if (filteredHistory.length === 0) {
      setSelectedEntry(null);
    }
  }, [filteredHistory, selectedEntry]);

  const handleDelete = useCallback(
    (id: string) => {
      setEntryToDelete(id);
      setDeleteTarget('single');
    },
    []
  );

  const handleToggleFavorite = useCallback(
    async (entry: HistoryEntry) => {
      await updateHistoryEntry(entry.id, { isFavorite: !entry.isFavorite });
      // Update selected entry if it's the one we modified
      if (selectedEntry?.id === entry.id) {
        setSelectedEntry({ ...selectedEntry, isFavorite: !entry.isFavorite });
      }
      await loadData();
    },
    [selectedEntry]
  );

  const handleClearAll = useCallback(() => {
    setDeleteTarget('all');
  }, []);

  const confirmDelete = async () => {
    if (deleteTarget === 'single' && entryToDelete) {
      await deleteHistoryEntry(entryToDelete);
      if (selectedEntry?.id === entryToDelete) {
        setSelectedEntry(null);
      }
      await loadData();
    } else if (deleteTarget === 'all') {
      await clearHistory();
      setSelectedEntry(null);
      await loadData();
    }
    closeDeleteModal();
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setEntryToDelete(null);
  };

  const handleExportPDF = async (entry: HistoryEntry) => {
    await exportToPDF(entry);
  };

  const handleExportImage = async (entry: HistoryEntry) => {
    await exportToImage(entry);
  };

  const handleExportAllPDF = async () => {
    await exportHistoryToPDF(filteredHistory);
  };

  const handleToggleDarkMode = async () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    await saveSettings({ darkMode: newMode });
  };

  const handleToggleSetting = async (key: keyof AppSettings) => {
    if (!settings) return;
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings as AppSettings);
    await saveSettings({ [key]: newSettings[key] });
  };

  return (
    <div
      className={clsx(
        'h-screen flex flex-col transition-colors',
        darkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'
      )}
    >
      {/* Top Header */}
      <header
        className={clsx(
          'shrink-0 border-b h-14',
          darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
        )}
      >
        <div className="h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={clsx(
                'p-2 rounded-lg transition-colors lg:hidden',
                darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'
              )}
            >
              <Menu className="w-5 h-5" />
            </button>

            <div
              className="flex items-center gap-2 cursor-pointer group"
              onClick={() => window.location.reload()}
              title={chrome.i18n.getMessage('headerRefresh')}
            >
              <Logo size={32} />
              <h1 className="text-lg font-bold leading-tight group-hover:text-blue-500 transition-colors">
                {chrome.i18n.getMessage('extensionName').split(':')[0]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {stats && (
              <div
                className={clsx(
                  'hidden md:flex items-center gap-4 mr-4 px-4 py-1.5 rounded-lg text-sm',
                  darkMode ? 'bg-slate-700/50' : 'bg-slate-100'
                )}
              >
                <span>
                  <strong>{stats.totalEntries}</strong> {chrome.i18n.getMessage('entriesLabel')}
                </span>
              </div>
            )}
            <button
              onClick={() => setCurrentView(currentView === 'history' ? 'settings' : 'history')}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                currentView === 'settings' &&
                  (darkMode ? 'bg-slate-700 text-blue-400' : 'bg-slate-200 text-blue-600'),
                darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'
              )}
              title={
                currentView === 'history'
                  ? chrome.i18n.getMessage('settingsTitle')
                  : chrome.i18n.getMessage('backToHistory')
              }
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={handleToggleDarkMode}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'
              )}
              title={chrome.i18n.getMessage(darkMode ? 'headerLightMode' : 'headerDarkMode')}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={loadData}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'
              )}
              title={chrome.i18n.getMessage('headerRefresh')}
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Areas */}
      {currentView === 'history' && (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - History List */}
          <aside
            className={clsx(
              'shrink-0 flex flex-col border-r overflow-hidden transition-all',
              sidebarCollapsed ? 'w-0 lg:w-80' : 'w-full lg:w-80',
              darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
            )}
          >
            {/* Filters & Search */}
            <div
              className={clsx(
                'shrink-0 p-3 border-b space-y-3',
                darkMode ? 'border-slate-700' : 'border-slate-200'
              )}
            >
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={chrome.i18n.getMessage('searchUrls')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className={clsx(
                    'w-full pl-9 pr-3 py-2 rounded-lg border text-sm transition-colors',
                    darkMode
                      ? 'bg-slate-700 border-slate-600 focus:border-blue-500'
                      : 'bg-slate-50 border-slate-200 focus:border-blue-500'
                  )}
                />
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-1">
                <button
                  onClick={() => setFilter('all')}
                  className={clsx(
                    'flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors',
                    filter === 'all'
                      ? 'bg-blue-500 text-white'
                      : darkMode
                        ? 'bg-slate-700 hover:bg-slate-600'
                        : 'bg-slate-100 hover:bg-slate-200'
                  )}
                >
                  {chrome.i18n.getMessage('filterAll')}
                </button>
                <button
                  onClick={() => setFilter('favorites')}
                  className={clsx(
                    'flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1',
                    filter === 'favorites'
                      ? 'bg-amber-500 text-white'
                      : darkMode
                        ? 'bg-slate-700 hover:bg-slate-600'
                        : 'bg-slate-100 hover:bg-slate-200'
                  )}
                >
                  <Star className="w-3 h-3" /> {chrome.i18n.getMessage('filterFav')}
                </button>
              </div>

              {/* Sort & Actions */}
              <div className="flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as typeof sortBy)}
                  className={clsx(
                    'flex-1 px-2 py-1.5 rounded-md border text-xs',
                    darkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'
                  )}
                >
                  <option value="date">{chrome.i18n.getMessage('sortByDate')}</option>
                  <option value="redirects">{chrome.i18n.getMessage('sortByRedirects')}</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className={clsx(
                    'p-1.5 rounded-md transition-colors',
                    darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'
                  )}
                >
                  {sortOrder === 'desc' ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronUp className="w-4 h-4" />
                  )}
                </button>
                {filteredHistory.length > 0 && (
                  <button
                    onClick={handleExportAllPDF}
                    className="p-1.5 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                    title={chrome.i18n.getMessage('exportAllToPdf')}
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
                {history.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="p-1.5 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors"
                    title={chrome.i18n.getMessage('clearAllHistory')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Entry Count */}
            <div
              className={clsx(
                'shrink-0 px-3 py-2 text-xs border-b',
                darkMode
                  ? 'text-slate-400 border-slate-700 bg-slate-800/50'
                  : 'text-slate-500 border-slate-200 bg-slate-50'
              )}
            >
              {filteredHistory.length}{' '}
              {filteredHistory.length === 1
                ? chrome.i18n.getMessage('entrySingle')
                : chrome.i18n.getMessage('entriesLabel')}
              {searchQuery && ` ${chrome.i18n.getMessage('matchingLabel')} "${searchQuery}"`}
            </div>

            {/* History List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-center p-4">
                  <Clock className="w-10 h-10 mb-2 text-slate-300" />
                  <p className={clsx('text-sm', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                    {searchQuery || filter !== 'all'
                      ? chrome.i18n.getMessage('noMatches')
                      : chrome.i18n.getMessage('noHistoryYet')}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredHistory.map(entry => (
                    <HistoryListItem
                      key={entry.id}
                      entry={entry}
                      isSelected={selectedEntry?.id === entry.id}
                      darkMode={darkMode}
                      settings={settings}
                      onClick={() => {
                        setSelectedEntry(entry);
                        if (window.innerWidth < 1024) {
                          setSidebarCollapsed(true);
                        }
                      }}
                      onToggleFavorite={() => handleToggleFavorite(entry)}
                      onDelete={() => handleDelete(entry.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </aside>

          {/* Right Panel - Details */}
          <main className={clsx('flex-1 overflow-hidden', darkMode ? 'bg-slate-900' : 'bg-white')}>
            {selectedEntry ? (
              <div ref={detailPanelRef} className="h-full">
                <DetailPanel
                  entry={selectedEntry}
                  darkMode={darkMode}
                  settings={settings}
                  onExportPDF={() => handleExportPDF(selectedEntry)}
                  onExportImage={() => handleExportImage(selectedEntry)}
                  onToggleFavorite={() => handleToggleFavorite(selectedEntry)}
                  onDelete={() => handleDelete(selectedEntry.id)}
                  onBack={() => setSidebarCollapsed(false)}
                />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div
                  className={clsx(
                    'w-20 h-20 rounded-2xl flex items-center justify-center mb-4',
                    darkMode ? 'bg-slate-800' : 'bg-white'
                  )}
                >
                  <Globe className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-lg font-medium mb-1">
                  {chrome.i18n.getMessage('selectAnEntry')}
                </h3>
                <p className={clsx('text-sm', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                  {chrome.i18n.getMessage('chooseRedirectToView')}
                </p>
              </div>
            )}
          </main>
        </div>
      )}

      {currentView === 'settings' && settings && (
        <SettingsViewUI
          settings={settings}
          darkMode={darkMode}
          activeTab={settingsActiveTab}
          setActiveTab={setSettingsActiveTab}
          onToggleSetting={handleToggleSetting}
        />
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={closeDeleteModal}
          />
          <div
            className={clsx(
              'relative max-w-sm w-full rounded-xl border p-6 shadow-2xl transition-all transform scale-100 z-10',
              darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            )}
          >
            <h3 className="text-base font-semibold mb-2">
              {deleteTarget === 'all'
                ? chrome.i18n.getMessage('clearAllHistory') || 'Clear All History'
                : chrome.i18n.getMessage('deleteEntry') || 'Delete Entry'}
            </h3>
            
            <p className={clsx('text-sm mb-6', darkMode ? 'text-slate-400' : 'text-slate-500')}>
              {deleteTarget === 'all'
                ? chrome.i18n.getMessage('confirmClearAll')
                : chrome.i18n.getMessage('confirmDeleteEntry')}
            </p>
            
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={closeDeleteModal}
                className={clsx(
                  'px-4 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer',
                  darkMode
                    ? 'border-slate-700 hover:bg-slate-700 text-slate-300'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                )}
              >
                {chrome.i18n.getMessage('cancelLabel') || 'Cancel'}
              </button>
              
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors cursor-pointer"
              >
                {deleteTarget === 'all'
                  ? chrome.i18n.getMessage('clearAllHistory').split(' ')[0] || 'Clear'
                  : chrome.i18n.getMessage('deleteEntry') || 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsViewUI({ settings, darkMode, activeTab, setActiveTab, onToggleSetting }: any) {
  return (
    <div className="flex-1 flex overflow-hidden">
      <aside
        className={clsx(
          'shrink-0 flex flex-col w-64 border-r overflow-hidden',
          darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
        )}
      >
        <div
          className={clsx(
            'p-4 border-b font-medium',
            darkMode ? 'border-slate-700' : 'border-slate-200'
          )}
        >
          {chrome.i18n.getMessage('settingsTitle')}
        </div>
        <div className="flex-1 p-2 space-y-1">
          <button
            onClick={() => setActiveTab('general')}
            className={clsx(
              'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'general'
                ? darkMode
                  ? 'bg-blue-900/30 text-blue-400'
                  : 'bg-blue-50 text-blue-600'
                : darkMode
                  ? 'hover:bg-slate-700 text-slate-300'
                  : 'hover:bg-slate-100 text-slate-600'
            )}
          >
            {chrome.i18n.getMessage('generalSettings')}
          </button>
        </div>
      </aside>
      <main
        className={clsx(
          'flex-1 overflow-y-auto p-6 md:p-10',
          darkMode ? 'bg-slate-900' : 'bg-white'
        )}
      >
        {activeTab === 'general' && (
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold mb-6">
              {chrome.i18n.getMessage('generalSettings')}
            </h2>
            <div
              className={clsx(
                'rounded-xl border p-6 flex items-center justify-between',
                darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'
              )}
            >
              <div>
                <h3 className="font-medium">{chrome.i18n.getMessage('darkModeAppearance')}</h3>
                <p className={clsx('text-sm mt-1', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                  {chrome.i18n.getMessage('darkModeDesc')}
                </p>
              </div>
              <span
                className={clsx(
                  'px-3 py-1 rounded-full text-xs font-medium',
                  darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'
                )}
              >
                {chrome.i18n.getMessage('useHeaderButton')}
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  darkMode,
}: {
  checked: boolean;
  onChange: () => void;
  darkMode: boolean;
}) {
  return (
    <label className="flex items-center cursor-pointer shrink-0 ml-4">
      <div
        className={clsx(
          'w-12 h-7 rounded-full transition-colors relative',
          checked ? 'bg-blue-500' : darkMode ? 'bg-slate-700' : 'bg-slate-200'
        )}
      >
        <div
          className={clsx(
            'absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-sm',
            checked ? 'left-6' : 'left-1'
          )}
        />
      </div>
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
    </label>
  );
}

// History List Item Component
function HistoryListItem({
  entry,
  isSelected,
  darkMode,
  settings,
  onClick,
  onToggleFavorite,
  onDelete,
}: {
  entry: HistoryEntry;
  isSelected: boolean;
  darkMode: boolean;
  settings: AppSettings | null;
  onClick: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}) {
  const getHostname = (url: string) => {
    if (!url) return 'Unknown';
    try {
      return new URL(url).hostname;
    } catch {
      return url.length > 30 ? url.substring(0, 30) + '...' : url;
    }
  };

  return (
    <div
      onClick={onClick}
      className={clsx(
        'p-3 cursor-pointer transition-colors group',
        isSelected
          ? darkMode
            ? 'bg-blue-900/30 border-l-2 border-blue-500'
            : 'bg-blue-50 border-l-2 border-blue-500'
          : darkMode
            ? 'hover:bg-slate-700/50'
            : 'hover:bg-slate-50'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className={clsx(
                'text-xs font-medium',
                darkMode ? 'text-slate-300' : 'text-slate-700'
              )}
            >
              {getHostname(entry.originalUrl)}
            </span>
            {entry.isFavorite && <Star className="w-3 h-3 text-amber-500 fill-current" />}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span
              className={clsx('px-1.5 py-0.5 rounded', darkMode ? 'bg-slate-700' : 'bg-slate-200')}
            >
              {entry.redirectCount}{' '}
              {entry.redirectCount !== 1
                ? chrome.i18n.getMessage('hopsPlural')
                : chrome.i18n.getMessage('hopSingle')}
            </span>
            <span className={darkMode ? 'text-slate-500' : 'text-slate-400'}>
              {formatDistanceToNow(entry.timestamp, { addSuffix: true })}
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className={clsx(
              'p-1 rounded transition-colors',
              entry.isFavorite
                ? 'text-amber-500'
                : darkMode
                  ? 'text-slate-500 hover:text-slate-300'
                  : 'text-slate-400 hover:text-slate-600'
            )}
          >
            {entry.isFavorite ? (
              <Star className="w-4 h-4 fill-current" />
            ) : (
              <StarOff className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={e => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 rounded text-red-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Detail Panel Component
function DetailPanel({
  entry,
  darkMode,
  settings,
  onExportPDF,
  onExportImage,
  onToggleFavorite,
  onDelete,
  onBack,
}: {
  entry: HistoryEntry;
  darkMode: boolean;
  settings: AppSettings | null;
  onExportPDF: () => void;
  onExportImage: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
  onBack: () => void;
}) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [copiedText, setCopiedText] = useState(false);
  const [copiedCsv, setCopiedCsv] = useState(false);

  const generateTextOutput = (path: RedirectItem[]): string => {
    return path
      .map((item, idx) => {
        let statusString = `${item.status_code}: ${item.status_line}`;

        if (item.type === 'server_redirect') {
          const redirectType =
            item.redirect_type === 'permanent'
              ? 'Permanent'
              : item.redirect_type === 'hsts'
                ? 'HSTS'
                : 'Temporary';
          statusString = `${item.status_code}: ${redirectType} redirect to ${item.redirect_url}`;
        }

        return `${idx + 1}. ${item.url} - ${statusString}`;
      })
      .join('\n');
  };

  const generateCsvOutput = (path: RedirectItem[]): string => {
    const headers = 'Status Code\tURL\tIP\tPage Type\tRedirect Type\tRedirect URL';

    const rows = path.map(item => {
      let redirectType = item.redirect_type || '';
      if (item.status_code === 301 || item.status_code === 308) {
        redirectType = 'permanent';
      } else if (item.status_code > 301 && item.status_code < 400) {
        redirectType = 'temporary';
      }

      const redirectUrl = item.redirect_url || 'none';

      return [
        item.status_code,
        item.url,
        item.ip || 'Unknown',
        item.type,
        redirectType,
        redirectUrl,
      ].join('\t');
    });

    return [headers, ...rows].join('\n');
  };

  const handleCopyText = async () => {
    try {
      const content = generateTextOutput(entry.path);
      await navigator.clipboard.writeText(content);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleCopyCsv = async () => {
    try {
      const content = generateCsvOutput(entry.path);
      await navigator.clipboard.writeText(content);
      setCopiedCsv(true);
      setTimeout(() => setCopiedCsv(false), 2000);
    } catch (err) {
      console.error('Failed to copy CSV:', err);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getStatusColor = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) return 'bg-green-500';
    if (statusCode >= 300 && statusCode < 400) return 'bg-amber-500';
    if (statusCode >= 400 && statusCode < 500) return 'bg-red-500';
    if (statusCode >= 500) return 'bg-red-600';
    return 'bg-slate-500';
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Panel Header */}
      <div
        className={clsx(
          'shrink-0 p-4 border-b',
          darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
        )}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className={clsx(
              'p-2 rounded-lg transition-colors lg:hidden',
              darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'
            )}
          >
            <ArrowRight className="w-5 h-5 rotate-180" />
          </button>

          {/* URL Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-semibold truncate">{entry.originalUrl}</h2>
              <a
                href={entry.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600 shrink-0"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            {entry.originalUrl !== entry.finalUrl && (
              <div className="flex items-center gap-1 text-sm">
                <ArrowRight className="w-3 h-3 text-slate-400" />
                <span className={clsx('truncate', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                  {entry.finalUrl}
                </span>
              </div>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs">
              <span
                className={clsx(
                  'px-2 py-0.5 rounded-full',
                  darkMode ? 'bg-slate-700' : 'bg-slate-200'
                )}
              >
                {entry.redirectCount}{' '}
                {entry.redirectCount !== 1
                  ? chrome.i18n.getMessage('redirectsPlural')
                  : chrome.i18n.getMessage('redirectSingle')}
              </span>
              <span className={darkMode ? 'text-slate-500' : 'text-slate-400'}>
                {format(entry.timestamp, "MMM d, yyyy 'at' h:mm a")}
              </span>
              {entry.totalTime > 0 && (
                <span
                  className={clsx(
                    'flex items-center gap-1',
                    darkMode ? 'text-slate-500' : 'text-slate-400'
                  )}
                >
                  <Zap className="w-3 h-3" />
                  {formatDuration(entry.totalTime)} {chrome.i18n.getMessage('totalLabel')}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onToggleFavorite}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                entry.isFavorite
                  ? 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300'
                  : darkMode
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800'
              )}
            >
              {entry.isFavorite ? (
                <Star className="w-3.5 h-3.5 fill-current text-amber-500" />
              ) : (
                <StarOff className="w-3.5 h-3.5" />
              )}
              <span>
                {entry.isFavorite
                  ? chrome.i18n.getMessage('favoritedLabel')
                  : chrome.i18n.getMessage('favoriteLabel')}
              </span>
            </button>
            {/* Copy Text */}
            <button
              onClick={handleCopyText}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                copiedText
                  ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300'
                  : darkMode
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800'
              )}
            >
              {copiedText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedText ? chrome.i18n.getMessage('copied') : chrome.i18n.getMessage('textFormat')}</span>
            </button>

            {/* Copy CSV */}
            <button
              onClick={handleCopyCsv}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                copiedCsv
                  ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300'
                  : darkMode
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800'
              )}
            >
              {copiedCsv ? <Check className="w-3.5 h-3.5" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
              <span>{copiedCsv ? chrome.i18n.getMessage('copied') : chrome.i18n.getMessage('csvFormat')}</span>
            </button>

            {/* Export PDF */}
            <button
              onClick={onExportPDF}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                darkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800'
              )}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{chrome.i18n.getMessage('pdfFormat')}</span>
            </button>

            {/* Export Image */}
            <button
              onClick={onExportImage}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                darkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800'
              )}
            >
              <FileImage className="w-3.5 h-3.5" />
              <span>{chrome.i18n.getMessage('imageFormat')}</span>
            </button>

            <div className={clsx('w-px h-5 mx-1', darkMode ? 'bg-slate-700' : 'bg-slate-200')} />

            <button
              onClick={onDelete}
              className="p-2 rounded-lg text-red-400 hover:text-red-500 transition-colors"
              title={chrome.i18n.getMessage('deleteEntry')}
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Panel Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Redirect Chain Section */}
        <section
          className={clsx(
            'rounded-xl p-4 border',
            darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
          )}
        >
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <ArrowRight className="w-4 h-4" />
            {chrome.i18n.getMessage('redirectChain')} ({entry.path.length}{' '}
            {chrome.i18n.getMessage('stepsLabel')})
          </h3>
          <div className="relative">
            {entry.path.length > 1 && (
              <div
                className={clsx(
                  'absolute left-7 top-6 bottom-6 w-0.5 z-0',
                  darkMode ? 'bg-slate-700' : 'bg-slate-200'
                )}
              />
            )}
            <div className="flex flex-col gap-2 relative z-10">
              {entry.path.map((item, idx) => {
                const delayMs = idx > 0 ? calculateGapDuration(entry.path[idx - 1], item) : null;

                return (
                  <Fragment key={item.id}>
                    {idx > 0 && delayMs != null && (
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
                      index={idx}
                      isLast={idx === entry.path.length - 1}
                      isExpanded={expandedItems.has(item.id)}
                      onToggle={() => toggleExpanded(item.id)}
                      darkMode={darkMode}
                    />
                  </Fragment>
                );
              })}
            </div>
          </div>
        </section>

        {/* Timestamp Footer */}
        <div
          className={clsx(
            'text-xs text-center py-2',
            darkMode ? 'text-slate-500' : 'text-slate-400'
          )}
        >
          {chrome.i18n.getMessage('capturedLabel')}:{' '}
          {format(entry.timestamp, "MMMM d, yyyy 'at' h:mm:ss a")} • ID: {entry.id.substring(0, 8)}
        </div>
      </div>
    </div>
  );
}
