import { LayoutDashboard, Moon, PanelRight, RefreshCw, Sun, Trash2 } from 'lucide-react';
import Logo from './Logo';

interface HeaderProps {
  onRefresh: () => void;
  onClear: () => void;
  onToggleDarkMode: () => void;
  onOpenDashboard: () => void;
  onOpenSidepanel?: () => void;
  hasPath: boolean;
  darkMode: boolean;
}

export default function Header({
  onRefresh,
  onClear,
  onToggleDarkMode,
  onOpenDashboard,
  onOpenSidepanel,
  hasPath,
  darkMode,
}: HeaderProps) {
  return (
    <header className="bg-linear-to-r from-blue-600 to-blue-700 text-white px-4 py-3 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-2">
        <Logo size={32} />
        <div>
          <h1 className="text-lg font-semibold leading-tight">{chrome.i18n.getMessage('extensionName').split(':')[0]}</h1>
          <p className="text-xs text-blue-200">{chrome.i18n.getMessage('headerSubtitle')}</p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onToggleDarkMode}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          title={chrome.i18n.getMessage(darkMode ? 'headerLightMode' : 'headerDarkMode')}
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {onOpenSidepanel && (
          <button
            onClick={onOpenSidepanel}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title={chrome.i18n.getMessage('headerOpenRealtimeMonitor')}
          >
            <PanelRight className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={onOpenDashboard}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          title={chrome.i18n.getMessage('headerOpenDashboard')}
        >
          <LayoutDashboard className="w-4 h-4" />
        </button>

        <button
          onClick={onRefresh}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          title={chrome.i18n.getMessage('headerRefresh')}
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {hasPath && (
          <button
            onClick={onClear}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title={chrome.i18n.getMessage('headerClearPath')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
}
