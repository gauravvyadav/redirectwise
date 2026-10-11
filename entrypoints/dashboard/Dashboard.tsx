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
import type { HistoryEntry, RedirectItem } from '../../types/redirect';
import { calculateGapDuration, formatDuration } from '../../types/redirect';
import { exportToImage } from '../../utils/image-export';
import { exportHistoryToPDF, exportToPDF } from '../../utils/pdf-export';
import type { Settings as AppSettings } from '../../utils/storage';
import {
  clearHistory,
  deleteHistoryEntry,
  getHistory,
  getHistoryStats,
  getSettings,
  saveSettings,
  updateHistoryEntry,
} from '../../utils/storage';
import { SUPPORTED_LANGUAGES, setI18nLanguage, t, useI18n } from '../../utils/i18n';

interface Stats {
  totalEntries: number;
  totalRedirects: number;
  favorites: number;
}

export default function Dashboard() {
  useI18n();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [currentView, setCurrentView] = useState<'history' | 'settings'>('history');
  const [settingsActiveTab, setSettingsActiveTab] = useState<'general' | 'language'>('general');
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

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        entry =>
          entry.originalUrl.toLowerCase().includes(query) ||
          entry.finalUrl.toLowerCase().includes(query) ||
          entry.notes?.toLowerCase().includes(query)
      );
    }

    if (filter === 'favorites') {
      filtered = filtered.filter(entry => entry.isFavorite);
    }

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

  useEffect(() => {
    if (filteredHistory.length > 0 && !selectedEntry) {
      const first = filteredHistory[0];
      if (first) setSelectedEntry(first);
    } else if (filteredHistory.length === 0) {
      setSelectedEntry(null);
    }
  }, [filteredHistory, selectedEntry]);

  const handleDelete = useCallback((id: string) => {
    setEntryToDelete(id);
    setDeleteTarget('single');
  }, []);

  const handleToggleFavorite = useCallback(
    async (entry: HistoryEntry) => {
      await updateHistoryEntry(entry.id, { isFavorite: !entry.isFavorite });
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

  const handleLanguageChange = async (lang: string) => {
    if (!settings) return;
    const newSettings = { ...settings, language: lang };
    setSettings(newSettings as AppSettings);
    await saveSettings({ language: lang });
    await setI18nLanguage(lang);
  };

  return (
    <div className="h-screen flex flex-col transition-colors bg-paper text-ink">
      {/* Top Header */}
      <header className="shrink-0 border-b border-line bg-paper-card h-14">
        <div className="h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-8 h-8 flex items-center justify-center border border-line bg-paper-card hover:border-ink transition-colors lg:hidden"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div
              className="flex items-center gap-2.5 cursor-pointer group"
              onClick={() => window.location.reload()}
              title={t('headerRefresh')}
            >
              <Logo size={28} />
              <div>
                <h1 className="text-xs font-black uppercase tracking-widest leading-tight text-ink">
                  {t('extensionName').split(':')[0]}
                </h1>
                <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-muted">
                  DASHBOARD // PERSISTENT
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {stats && (
              <div className="hidden md:flex items-center gap-3 h-8 px-3 border border-line bg-paper-card font-mono text-[10px] uppercase tracking-[0.14em] text-text-secondary">
                <span>
                  <strong className="text-ink">{stats.totalEntries}</strong>{' '}
                  {t('entriesLabel')}
                </span>
                <span className="text-muted">/</span>
                <span>
                  <strong className="text-ink">{stats.totalRedirects}</strong>{' '}
                  {t('redirectsPlural')}
                </span>
              </div>
            )}

            <button
              onClick={loadData}
              className="w-8 h-8 flex items-center justify-center border border-line bg-paper-card text-ink hover:border-ink hover:bg-paper-subtle transition-colors"
              title={t('headerRefresh')}
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setCurrentView(currentView === 'history' ? 'settings' : 'history')}
              className={clsx(
                'w-8 h-8 flex items-center justify-center border transition-colors',
                currentView === 'settings'
                  ? 'bg-ink text-paper border-ink'
                  : 'border-line bg-paper-card text-ink hover:border-ink hover:bg-paper-subtle'
              )}
              title={
                currentView === 'history'
                  ? t('settingsTitle')
                  : t('backToHistory')
              }
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={handleToggleDarkMode}
              className="w-8 h-8 flex items-center justify-center border border-line bg-paper-card text-ink hover:border-ink hover:bg-paper-subtle transition-colors"
              title={t(darkMode ? 'headerLightMode' : 'headerDarkMode')}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
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
              'shrink-0 flex flex-col border-r border-line bg-paper overflow-hidden transition-all',
              sidebarCollapsed ? 'w-0 lg:w-84' : 'w-full lg:w-84'
            )}
          >
            {/* Filters & Search */}
            <div className="shrink-0 p-3 border-b border-line space-y-2.5">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                <input
                  type="text"
                  placeholder={t('searchUrls')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 border border-line bg-paper-card text-ink focus:border-ink font-mono text-[11px] outline-none transition-colors"
                />
              </div>

              {/* Filter Tabs Grid */}
              <div className="border border-line bg-line gap-px grid grid-cols-2">
                <button
                  onClick={() => setFilter('all')}
                  className={clsx(
                    'h-8 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors',
                    filter === 'all'
                      ? 'bg-ink text-paper'
                      : 'bg-paper-card text-muted hover:bg-paper-subtle'
                  )}
                >
                  {t('filterAll')}
                </button>
                <button
                  onClick={() => setFilter('favorites')}
                  className={clsx(
                    'h-8 font-mono text-[10px] font-bold uppercase tracking-[0.14em] flex items-center justify-center gap-1 transition-colors',
                    filter === 'favorites'
                      ? 'bg-warn text-white'
                      : 'bg-paper-card text-muted hover:bg-paper-subtle'
                  )}
                >
                  <Star className="w-3 h-3" /> {t('filterFav')}
                </button>
              </div>

              {/* Sort & Actions */}
              <div className="flex items-center gap-1.5">
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as typeof sortBy)}
                  className="flex-1 h-8 px-2.5 border border-line bg-paper-card text-ink font-mono text-[10px] uppercase font-bold outline-none"
                >
                  <option value="date">{t('sortByDate')}</option>
                  <option value="redirects">{t('sortByRedirects')}</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="w-8 h-8 flex items-center justify-center border border-line bg-paper-card hover:border-ink text-ink transition-colors"
                >
                  {sortOrder === 'desc' ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronUp className="w-3.5 h-3.5" />
                  )}
                </button>
                {filteredHistory.length > 0 && (
                  <button
                    onClick={handleExportAllPDF}
                    className="w-8 h-8 flex items-center justify-center border border-accent bg-accent text-white hover:bg-accent-hover transition-colors"
                    title={t('exportAllToPdf')}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                )}
                {history.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="w-8 h-8 flex items-center justify-center border border-err bg-err text-white hover:opacity-90 transition-colors"
                    title={t('clearAllHistory')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Entry Count */}
            <div className="shrink-0 px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] border-b border-line bg-paper-subtle text-muted">
              {filteredHistory.length}{' '}
              {filteredHistory.length === 1
                ? t('entrySingle')
                : t('entriesLabel')}
              {searchQuery && ` // MATCHING "${searchQuery}"`}
            </div>

            {/* History List */}
            <div className="flex-1 overflow-y-auto divide-y divide-line">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2">
                  <div className="w-5 h-5 border-2 border-accent border-t-transparent animate-spin" />
                  <span className="font-mono text-[9px] uppercase tracking-wider text-muted">
                    LOADING SESSIONS...
                  </span>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-center p-4">
                  <Clock className="w-6 h-6 mb-2 text-muted" />
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                    {searchQuery || filter !== 'all'
                      ? t('noMatches')
                      : t('noHistoryYet')}
                  </p>
                </div>
              ) : (
                filteredHistory.map(entry => (
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
                ))
              )}
            </div>
          </aside>

          {/* Right Panel - Details */}
          <main className="flex-1 overflow-hidden bg-paper">
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
                <div className="w-14 h-14 border border-line bg-paper-card flex items-center justify-center mb-3">
                  <Globe className="w-7 h-7 text-accent" />
                </div>
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">
                  NO SELECTION
                </span>
                <h3 className="text-sm font-black uppercase tracking-tight mb-1 text-ink">
                  {t('selectAnEntry')}
                </h3>
                <p className="text-xs max-w-xs text-text-secondary">
                  {t('chooseRedirectToView')}
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
          onLanguageChange={handleLanguageChange}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            onClick={closeDeleteModal}
          />
          <div className="relative max-w-sm w-full border border-ink bg-paper-card text-ink p-6 z-10 transition-all">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-err mb-1 block">
              WARNING // DESTRUCTIVE ACTION
            </span>
            <h3 className="text-sm font-black uppercase tracking-tight mb-2">
              {deleteTarget === 'all'
                ? t('clearAllHistory') || 'Clear All History'
                : t('deleteEntry') || 'Delete Entry'}
            </h3>

            <p className="text-xs mb-6 leading-relaxed text-text-secondary">
              {deleteTarget === 'all'
                ? t('confirmClearAll')
                : t('confirmDeleteEntry')}
            </p>

            <div className="flex items-center justify-end gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em]">
              <button
                onClick={closeDeleteModal}
                className="h-8 px-4 border border-line hover:border-ink text-ink transition-colors inline-flex items-center justify-center"
              >
                {t('cancelLabel') || 'Cancel'}
              </button>

              <button
                onClick={confirmDelete}
                className="h-8 px-4 border border-err bg-err hover:opacity-90 text-white transition-colors inline-flex items-center justify-center"
              >
                {deleteTarget === 'all'
                  ? t('clearAllHistory').split(' ')[0] || 'Clear'
                  : t('deleteEntry') || 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsViewUI({
  settings,
  activeTab,
  setActiveTab,
  onLanguageChange,
}: any) {
  const selectedLang = settings?.language || 'system';

  return (
    <div className="flex-1 flex overflow-hidden">
      <aside className="shrink-0 flex flex-col w-64 border-r border-line bg-paper overflow-hidden">
        <div className="p-4 border-b border-line font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink">
          {t('settingsTitle')}
        </div>
        <div className="flex-1 p-2 space-y-1">
          <button
            onClick={() => setActiveTab('general')}
            className={clsx(
              'w-full text-left px-3 py-2 border font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] transition-colors',
              activeTab === 'general'
                ? 'bg-ink text-paper border-ink'
                : 'border-transparent hover:border-line text-text-secondary'
            )}
          >
            {t('generalSettings')}
          </button>
          <button
            onClick={() => setActiveTab('language')}
            className={clsx(
              'w-full text-left px-3 py-2 border font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] transition-colors',
              activeTab === 'language'
                ? 'bg-ink text-paper border-ink'
                : 'border-transparent hover:border-line text-text-secondary'
            )}
          >
            {t('languageSettings')}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6 md:p-10 bg-paper">
        {activeTab === 'general' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-muted block mb-1">
                {t('configurationPreferences')}
              </span>
              <h2 className="text-xl font-black uppercase tracking-tight mb-6 text-ink">
                {t('generalSettings')}
              </h2>
            </div>
            <div className="border border-line bg-paper-card p-5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-xs uppercase tracking-tight text-ink">
                  {t('darkModeAppearance')}
                </h3>
                <p className="text-[11px] mt-1 text-text-secondary">
                  {t('darkModeDesc')}
                </p>
              </div>
              <span className="px-2.5 py-1 border border-line bg-paper-subtle font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-ink">
                {t('useHeaderButton')}
              </span>
            </div>

            <div className="border border-line bg-paper-card p-5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-xs uppercase tracking-tight text-ink">
                  {t('languageLabel')}
                </h3>
                <p className="text-[11px] mt-1 text-text-secondary">
                  {t('languageDesc')}
                </p>
              </div>
              <select
                value={selectedLang}
                onChange={e => onLanguageChange(e.target.value)}
                className="px-2.5 py-1.5 border border-line bg-paper font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink focus:outline-none focus:border-ink cursor-pointer"
              >
                <option value="system">{t('systemDefault')}</option>
                {SUPPORTED_LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>
                    {lang.nativeName} ({lang.name})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {activeTab === 'language' && (
          <div className="max-w-3xl">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-muted block mb-1">
              {t('configurationPreferences')}
            </span>
            <h2 className="text-xl font-black uppercase tracking-tight mb-2 text-ink">
              {t('languageSettings')}
            </h2>
            <p className="text-xs text-text-secondary mb-6 font-mono">
              {t('languageDesc')}
            </p>

            <div className="space-y-3">
              <button
                onClick={() => onLanguageChange('system')}
                className={clsx(
                  'w-full p-3.5 border text-left font-mono text-xs transition-colors flex items-center justify-between cursor-pointer',
                  selectedLang === 'system'
                    ? 'border-ink bg-ink text-paper font-bold'
                    : 'border-line bg-paper-card hover:border-ink text-ink'
                )}
              >
                <div className="flex flex-col">
                  <span className="font-bold uppercase tracking-wider">{t('systemDefault')}</span>
                  <span
                    className={clsx(
                      'text-[10px] mt-0.5',
                      selectedLang === 'system' ? 'text-paper/70' : 'text-muted'
                    )}
                  >
                    {t('languageDesc')}
                  </span>
                </div>
                {selectedLang === 'system' && <span className="font-bold text-sm">✓</span>}
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-2">
                {SUPPORTED_LANGUAGES.map(lang => {
                  const isSelected = selectedLang === lang.code;
                  return (
                    <button
                      key={lang.code}
                      onClick={() => onLanguageChange(lang.code)}
                      className={clsx(
                        'p-3 border text-left font-mono transition-colors flex items-center justify-between cursor-pointer',
                        isSelected
                          ? 'border-ink bg-ink text-paper font-bold'
                          : 'border-line bg-paper-card hover:border-ink text-ink'
                      )}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-bold truncate">{lang.nativeName}</div>
                        <div
                          className={clsx(
                            'text-[10px] truncate uppercase tracking-wider mt-0.5',
                            isSelected ? 'text-paper/70' : 'text-muted'
                          )}
                        >
                          {lang.name} [{lang.code}]
                        </div>
                      </div>
                      {isSelected && <span className="font-bold text-sm shrink-0">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// History List Item Component
function HistoryListItem({
  entry,
  isSelected,
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
      return url.length > 25 ? url.substring(0, 25) + '...' : url;
    }
  };

  return (
    <div
      onClick={onClick}
      className={clsx(
        'p-3 cursor-pointer transition-colors group border-l-2',
        isSelected ? 'bg-paper-card border-l-accent' : 'border-l-transparent hover:bg-paper-subtle'
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="font-mono text-xs font-bold truncate text-ink">
              {getHostname(entry.originalUrl)}
            </span>
            {entry.isFavorite && <Star className="w-3 h-3 text-warn fill-current" />}
          </div>
          <div className="flex items-center gap-2 font-mono text-[9.5px]">
            <span className="px-1.5 py-0.2 border border-line bg-paper-subtle text-text-secondary font-bold uppercase tracking-wider">
              {entry.redirectCount}{' '}
              {entry.redirectCount !== 1
                ? t('hopsPlural')
                : t('hopSingle')}
            </span>
            <span className="text-muted">
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
              'p-1 border transition-colors',
              entry.isFavorite ? 'border-warn text-warn' : 'border-line hover:border-ink text-muted'
            )}
          >
            {entry.isFavorite ? (
              <Star className="w-3 h-3 fill-current" />
            ) : (
              <StarOff className="w-3 h-3" />
            )}
          </button>
          <button
            onClick={e => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 border border-err-border text-err hover:bg-err-bg transition-colors"
          >
            <Trash2 className="w-3 h-3" />
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

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Panel Header */}
      <div className="shrink-0 p-4 border-b border-line bg-paper-card">
        <div className="flex items-start gap-4">
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center border border-line bg-paper-card hover:border-ink transition-colors lg:hidden shrink-0"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
          </button>

          {/* URL Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 max-w-[40vw] min-w-0">
              <h2
                className="font-mono text-sm font-bold truncate text-ink min-w-0"
                title={entry.originalUrl}
              >
                {entry.originalUrl}
              </h2>
              <a
                href={entry.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:text-accent-hover shrink-0"
                title={t('openUrl') || 'Open URL'}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            {entry.originalUrl !== entry.finalUrl && (
              <div className="flex items-center gap-1.5 font-mono text-xs text-text-secondary mb-2 max-w-[40vw] min-w-0">
                <ArrowRight className="w-3 h-3 text-accent shrink-0" />
                <span className="truncate min-w-0" title={entry.finalUrl}>
                  {entry.finalUrl}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2.5 font-mono text-[10px] flex-wrap">
              <span className="h-6 flex items-center px-2 border border-line bg-paper text-ink font-bold uppercase tracking-wider">
                {entry.redirectCount}{' '}
                {entry.redirectCount !== 1
                  ? t('redirectsPlural')
                  : t('redirectSingle')}
              </span>
              <span className="text-muted">
                {format(entry.timestamp, "MMM d, yyyy 'at' h:mm a")}
              </span>
              {entry.totalTime > 0 && (
                <span className="flex items-center gap-1 font-bold text-accent">
                  <Zap className="w-3 h-3" />
                  {formatDuration(entry.totalTime)} {t('totalLabel').toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {/* Actions Bar */}
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            <button
              onClick={onToggleFavorite}
              className={clsx(
                'h-8 flex items-center gap-1.5 px-3 border font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-colors',
                entry.isFavorite
                  ? 'bg-warn-bg border-warn-border text-warn'
                  : 'bg-paper-card border-line text-text-secondary hover:border-ink hover:text-ink'
              )}
            >
              {entry.isFavorite ? (
                <Star className="w-3.5 h-3.5 fill-current text-warn" />
              ) : (
                <StarOff className="w-3.5 h-3.5" />
              )}
              <span>
                {entry.isFavorite
                  ? t('favoritedLabel')
                  : t('favoriteLabel')}
              </span>
            </button>

            {/* Copy Text */}
            <button
              onClick={handleCopyText}
              className={clsx(
                'h-8 flex items-center gap-1.5 px-3 border font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-colors',
                copiedText
                  ? 'bg-ok-bg border-ok-border text-ok'
                  : 'bg-paper-card border-line text-text-secondary hover:border-ink hover:text-ink'
              )}
            >
              {copiedText ? <Check className="w-3.5 h-3.5 text-ok" /> : <Copy className="w-3.5 h-3.5" />}
              <span>
                {copiedText
                  ? t('copied')
                  : t('textFormat')}
              </span>
            </button>

            {/* Copy CSV */}
            <button
              onClick={handleCopyCsv}
              className={clsx(
                'h-8 flex items-center gap-1.5 px-3 border font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-colors',
                copiedCsv
                  ? 'bg-ok-bg border-ok-border text-ok'
                  : 'bg-paper-card border-line text-text-secondary hover:border-ink hover:text-ink'
              )}
            >
              {copiedCsv ? <Check className="w-3.5 h-3.5 text-ok" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
              <span>
                {copiedCsv ? t('copied') : t('csvFormat')}
              </span>
            </button>

            {/* Export PDF */}
            <button
              onClick={onExportPDF}
              className="h-8 flex items-center gap-1.5 px-3 border border-line bg-paper-card text-text-secondary hover:border-ink hover:text-ink font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-accent" />
              <span>{t('pdfFormat')}</span>
            </button>

            {/* Export Image */}
            <button
              onClick={onExportImage}
              className="h-8 flex items-center gap-1.5 px-3 border border-line bg-paper-card text-text-secondary hover:border-ink hover:text-ink font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-colors"
            >
              <FileImage className="w-3.5 h-3.5 text-accent" />
              <span>{t('imageFormat')}</span>
            </button>

            <button
              onClick={onDelete}
              className="w-8 h-8 flex items-center justify-center border border-err-border text-err hover:bg-err-bg transition-colors shrink-0"
              title={t('deleteEntry')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Panel Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Redirect Chain Section */}
        <section className="border border-line bg-paper-card p-4">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-line">
            <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] flex items-center gap-2 text-ink">
              <ArrowRight className="w-3.5 h-3.5 text-accent" />
              {t('redirectChain')} // {entry.path.length}{' '}
              {t('stepsLabel')}
            </h3>
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted">
              SESSION // {entry.id.substring(0, 8)}
            </span>
          </div>

          <div className="relative">
            {entry.path.length > 1 && (
              <div className="absolute left-1/2 -translate-x-1/2 top-6 bottom-6 w-px z-0 bg-line" />
            )}
            <div className="flex flex-col gap-2 relative z-10">
              {entry.path.map((item, idx) => {
                const delayMs = idx > 0 ? calculateGapDuration(entry.path[idx - 1], item) : null;

                return (
                  <Fragment key={item.id}>
                    {idx > 0 && delayMs != null && (
                      <div className="flex justify-center py-0.5 relative z-20">
                        <span
                          className="font-mono text-[8.5px] font-bold uppercase tracking-[0.14em] px-2 py-0.5 border border-line bg-paper-subtle text-stone flex items-center gap-1"
                          title={t('gapDurationDesc')}
                        >
                          <Clock className="w-2.5 h-2.5 text-stone" />+{formatDuration(delayMs)}{' '}
                          {t('gapLabel')}
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
        <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-center py-2 text-muted">
          {t('capturedLabel')}:{' '}
          {format(entry.timestamp, "MMMM d, yyyy 'at' h:mm:ss a")} // ID: {entry.id.substring(0, 8)}
        </div>
      </div>
    </div>
  );
}
