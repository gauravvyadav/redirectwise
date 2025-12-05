import clsx from 'clsx';
import { format, formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  ExternalLink,
  Globe,
  Info,
  Menu,
  Moon,
  RefreshCw,
  Search,
  Star,
  StarOff,
  Sun,
  Trash2,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import HeadersList from '../../components/HeadersList';
import Logo from '../../components/Logo';
import { ChainScore, HistoryEntry } from '../../types/redirect';
import { exportHistoryToPDF, exportToPDF } from '../../utils/pdf-export';
import {
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
  avgScore: number;
  gradeDistribution: Record<string, number>;
  favorites: number;
}

export default function Dashboard() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [filter, setFilter] = useState<'all' | 'favorites' | ChainScore['grade']>('all');
  const [sortBy, setSortBy] = useState<'date' | 'score' | 'redirects'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const detailPanelRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    setLoading(true);
    const [historyData, statsData] = await Promise.all([getHistory(), getHistoryStats()]);
    setHistory(historyData);
    setStats(statsData);
    setLoading(false);
  };

  const loadSettings = async () => {
    const settings = await getSettings();
    setDarkMode(settings.darkMode);
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

    // Grade/favorites filter
    if (filter === 'favorites') {
      filtered = filtered.filter(entry => entry.isFavorite);
    } else if (['A', 'B', 'C', 'D', 'F'].includes(filter)) {
      filtered = filtered.filter(entry => entry.chainScore.grade === filter);
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = a.timestamp - b.timestamp;
          break;
        case 'score':
          comparison = a.chainScore.score - b.chainScore.score;
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
    async (id: string) => {
      if (confirm('Are you sure you want to delete this entry?')) {
        await deleteHistoryEntry(id);
        if (selectedEntry?.id === id) {
          setSelectedEntry(null);
        }
        await loadData();
      }
    },
    [selectedEntry]
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

  const handleClearAll = useCallback(async () => {
    if (confirm('Are you sure you want to clear all history? This cannot be undone.')) {
      await clearHistory();
      setSelectedEntry(null);
      await loadData();
    }
  }, []);

  const handleExportPDF = async (entry: HistoryEntry) => {
    await exportToPDF(entry);
  };

  const handleExportAllPDF = async () => {
    await exportHistoryToPDF(filteredHistory);
  };

  const handleToggleDarkMode = async () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    await saveSettings({ darkMode: newMode });
  };

  const getGradeColor = (grade: ChainScore['grade']) => {
    switch (grade) {
      case 'A':
        return 'text-green-500 bg-green-100 dark:bg-green-900/30';
      case 'B':
        return 'text-lime-500 bg-lime-100 dark:bg-lime-900/30';
      case 'C':
        return 'text-amber-500 bg-amber-100 dark:bg-amber-900/30';
      case 'D':
        return 'text-orange-500 bg-orange-100 dark:bg-orange-900/30';
      case 'F':
        return 'text-red-500 bg-red-100 dark:bg-red-900/30';
    }
  };

  const getGradeBgColor = (grade: ChainScore['grade']) => {
    switch (grade) {
      case 'A':
        return 'bg-green-500';
      case 'B':
        return 'bg-lime-500';
      case 'C':
        return 'bg-amber-500';
      case 'D':
        return 'bg-orange-500';
      case 'F':
        return 'bg-red-500';
    }
  };

  return (
    <div
      className={clsx(
        'h-screen flex flex-col transition-colors',
        darkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-100 text-slate-900'
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
            <Logo size={32} />
            <div>
              <h1 className="text-lg font-bold leading-tight">RedirectWise</h1>
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
                  <strong>{stats.totalEntries}</strong> entries
                </span>
                <span>
                  <strong>{stats.avgScore}</strong> avg score
                </span>
              </div>
            )}
            <button
              onClick={handleToggleDarkMode}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'
              )}
              title={darkMode ? 'Light mode' : 'Dark mode'}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={loadData}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'
              )}
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - Sidebar + Panel */}
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
                placeholder="Search URLs..."
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
                All
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
                <Star className="w-3 h-3" /> Fav
              </button>
              {(['A', 'B', 'C', 'D', 'F'] as const).map(grade => (
                <button
                  key={grade}
                  onClick={() => setFilter(filter === grade ? 'all' : grade)}
                  className={clsx(
                    'w-8 py-1.5 rounded-md text-xs font-bold transition-colors',
                    filter === grade
                      ? getGradeBgColor(grade) + ' text-white'
                      : darkMode
                      ? 'bg-slate-700 hover:bg-slate-600'
                      : 'bg-slate-100 hover:bg-slate-200'
                  )}
                >
                  {grade}
                </button>
              ))}
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
                <option value="date">Sort by Date</option>
                <option value="score">Sort by Score</option>
                <option value="redirects">Sort by Redirects</option>
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
                  title="Export All to PDF"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
              {history.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="p-1.5 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors"
                  title="Clear All History"
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
            {filteredHistory.length} {filteredHistory.length === 1 ? 'entry' : 'entries'}
            {searchQuery && ` matching "${searchQuery}"`}
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
                  {searchQuery || filter !== 'all' ? 'No matches' : 'No history yet'}
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
        <main
          className={clsx('flex-1 overflow-hidden', darkMode ? 'bg-slate-900' : 'bg-slate-100')}
        >
          {selectedEntry ? (
            <div ref={detailPanelRef} className="h-full">
              <DetailPanel
                entry={selectedEntry}
                darkMode={darkMode}
                onExportPDF={() => handleExportPDF(selectedEntry)}
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
              <h3 className="text-lg font-medium mb-1">Select an Entry</h3>
              <p className={clsx('text-sm', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                Choose a redirect from the list to view details
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// History List Item Component
function HistoryListItem({
  entry,
  isSelected,
  darkMode,
  onClick,
  onToggleFavorite,
  onDelete,
}: {
  entry: HistoryEntry;
  isSelected: boolean;
  darkMode: boolean;
  onClick: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}) {
  const getGradeBgColor = (grade: ChainScore['grade']) => {
    switch (grade) {
      case 'A':
        return 'bg-green-500';
      case 'B':
        return 'bg-lime-500';
      case 'C':
        return 'bg-amber-500';
      case 'D':
        return 'bg-orange-500';
      case 'F':
        return 'bg-red-500';
    }
  };

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
        {/* Grade Badge */}
        <div
          className={clsx(
            'w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0',
            getGradeBgColor(entry.chainScore.grade)
          )}
        >
          {entry.chainScore.grade}
        </div>

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
              {entry.redirectCount} hop{entry.redirectCount !== 1 ? 's' : ''}
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
  onExportPDF,
  onToggleFavorite,
  onDelete,
  onBack,
}: {
  entry: HistoryEntry;
  darkMode: boolean;
  onExportPDF: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
  onBack: () => void;
}) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

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

  const getGradeBgColor = (grade: ChainScore['grade']) => {
    switch (grade) {
      case 'A':
        return 'bg-green-500';
      case 'B':
        return 'bg-lime-500';
      case 'C':
        return 'bg-amber-500';
      case 'D':
        return 'bg-orange-500';
      case 'F':
        return 'bg-red-500';
    }
  };

  const getStatusColor = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) return 'bg-green-500';
    if (statusCode >= 300 && statusCode < 400) return 'bg-amber-500';
    if (statusCode >= 400 && statusCode < 500) return 'bg-red-500';
    if (statusCode >= 500) return 'bg-red-600';
    return 'bg-slate-500';
  };

  const getIssueIcon = (type: 'error' | 'warning' | 'info') => {
    switch (type) {
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'info':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
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

          {/* Score Circle */}
          <div
            className={clsx(
              'w-14 h-14 rounded-xl flex flex-col items-center justify-center text-white shrink-0',
              getGradeBgColor(entry.chainScore.grade)
            )}
          >
            <span className="text-2xl font-bold leading-none">{entry.chainScore.grade}</span>
            <span className="text-xs opacity-80">{entry.chainScore.score}</span>
          </div>

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
                {entry.redirectCount} redirect{entry.redirectCount !== 1 ? 's' : ''}
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
                  {entry.totalTime}ms total
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onToggleFavorite}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                entry.isFavorite
                  ? 'text-amber-500'
                  : darkMode
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-400 hover:text-slate-600'
              )}
              title={entry.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              {entry.isFavorite ? (
                <Star className="w-5 h-5 fill-current" />
              ) : (
                <StarOff className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={onExportPDF}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                darkMode
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-400 hover:text-slate-600'
              )}
              title="Export to PDF"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 rounded-lg text-red-400 hover:text-red-500 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Panel Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Issues Section */}
        {entry.chainScore.issues.length > 0 && (
          <section
            className={clsx('rounded-xl p-4', darkMode ? 'bg-slate-800' : 'bg-white shadow-sm')}
          >
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Issues Found ({entry.chainScore.issues.length})
            </h3>
            <div className="space-y-2">
              {entry.chainScore.issues.map((issue, idx) => (
                <div
                  key={idx}
                  className={clsx(
                    'flex items-start gap-3 p-3 rounded-lg',
                    issue.type === 'error' && (darkMode ? 'bg-red-900/20' : 'bg-red-50'),
                    issue.type === 'warning' && (darkMode ? 'bg-amber-900/20' : 'bg-amber-50'),
                    issue.type === 'info' && (darkMode ? 'bg-green-900/20' : 'bg-green-50')
                  )}
                >
                  {getIssueIcon(issue.type)}
                  <div className="flex-1">
                    <p
                      className={clsx(
                        'text-sm',
                        issue.type === 'error' && (darkMode ? 'text-red-400' : 'text-red-700'),
                        issue.type === 'warning' &&
                          (darkMode ? 'text-amber-400' : 'text-amber-700'),
                        issue.type === 'info' && (darkMode ? 'text-green-400' : 'text-green-700')
                      )}
                    >
                      {issue.message}
                    </p>
                    <span
                      className={clsx('text-xs', darkMode ? 'text-slate-500' : 'text-slate-400')}
                    >
                      Impact: {issue.impact}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recommendations Section */}
        {entry.chainScore.recommendations.length > 0 && (
          <section
            className={clsx('rounded-xl p-4', darkMode ? 'bg-slate-800' : 'bg-white shadow-sm')}
          >
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-500" />
              Recommendations
            </h3>
            <ul className="space-y-2">
              {entry.chainScore.recommendations.map((rec, idx) => (
                <li
                  key={idx}
                  className={clsx(
                    'flex items-start gap-2 text-sm',
                    darkMode ? 'text-slate-300' : 'text-slate-600'
                  )}
                >
                  <span className="text-blue-500 mt-0.5">→</span>
                  {rec}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Redirect Chain Section */}
        <section
          className={clsx('rounded-xl p-4', darkMode ? 'bg-slate-800' : 'bg-white shadow-sm')}
        >
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <ArrowRight className="w-4 h-4" />
            Redirect Chain ({entry.path.length} steps)
          </h3>
          <div className="space-y-0">
            {entry.path.map((item, idx) => (
              <div key={item.id} className="relative flex">
                {/* Timeline column */}
                <div className="flex flex-col items-center mr-3">
                  {/* Step Number Circle */}
                  <div
                    className={clsx(
                      'w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0 z-10',
                      getStatusColor(item.status_code)
                    )}
                  >
                    {idx + 1}
                  </div>
                  {/* Connector Line */}
                  {idx < entry.path.length - 1 && (
                    <div
                      className={clsx(
                        'w-0.5 grow min-h-5',
                        darkMode ? 'bg-slate-600' : 'bg-slate-300'
                      )}
                    />
                  )}
                </div>

                {/* Content */}
                <div
                  className={clsx('flex-1 min-w-0', idx < entry.path.length - 1 ? 'pb-4' : 'pb-0')}
                >
                  {/* Clickable header */}
                  <button onClick={() => toggleExpanded(item.id)} className="w-full text-left">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span
                            className={clsx(
                              'px-2 py-0.5 rounded text-xs font-medium',
                              item.statusObject?.isSuccess &&
                                'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                              item.statusObject?.isRedirect &&
                                'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                              (item.statusObject?.isClientError ||
                                item.statusObject?.isServerError) &&
                                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            )}
                          >
                            {item.status_code} {item.status_line}
                          </span>
                          {item.type === 'server_redirect' && item.redirect_type && (
                            <span
                              className={clsx(
                                'px-2 py-0.5 rounded text-xs',
                                darkMode ? 'bg-slate-700' : 'bg-slate-200'
                              )}
                            >
                              {item.redirect_type}
                            </span>
                          )}
                          {item.timing?.duration && (
                            <span
                              className={clsx(
                                'text-xs flex items-center gap-1',
                                darkMode ? 'text-slate-500' : 'text-slate-400'
                              )}
                            >
                              <Zap className="w-3 h-3" />
                              {item.timing.duration}ms
                            </span>
                          )}
                          {/* Expand indicator */}
                          {expandedItems.has(item.id) ? (
                            <ChevronUp className="w-4 h-4 text-slate-400 ml-auto" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400 ml-auto" />
                          )}
                        </div>
                        <p
                          className={clsx(
                            'text-sm break-all',
                            darkMode ? 'text-slate-300' : 'text-slate-700'
                          )}
                        >
                          {item.url}
                        </p>
                      </div>

                      {/* External Link */}
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className={clsx(
                          'p-1 rounded transition-colors shrink-0',
                          darkMode
                            ? 'text-slate-500 hover:text-slate-300'
                            : 'text-slate-400 hover:text-slate-600'
                        )}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {expandedItems.has(item.id) && (
                    <div
                      className={clsx(
                        'mt-3 p-3 rounded-lg border',
                        darkMode
                          ? 'bg-slate-700/50 border-slate-600'
                          : 'bg-slate-50 border-slate-200'
                      )}
                    >
                      <HeadersList headers={item.headers} ip={item.ip} darkMode={darkMode} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Timestamp Footer */}
        <div
          className={clsx(
            'text-xs text-center py-2',
            darkMode ? 'text-slate-500' : 'text-slate-400'
          )}
        >
          Captured: {format(entry.timestamp, "MMMM d, yyyy 'at' h:mm:ss a")} • ID:{' '}
          {entry.id.substring(0, 8)}
        </div>
      </div>
    </div>
  );
}
