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
          <h1 className="text-lg font-semibold leading-tight">RedirectWise</h1>
          <p className="text-xs text-blue-200">Redirect Path Analyzer</p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onToggleDarkMode}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          title={darkMode ? 'Light mode' : 'Dark mode'}
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {onOpenSidepanel && (
          <button
            onClick={onOpenSidepanel}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Open Realtime Monitor"
          >
            <PanelRight className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={onOpenDashboard}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          title="Open Dashboard"
        >
          <LayoutDashboard className="w-4 h-4" />
        </button>

        <button
          onClick={onRefresh}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {hasPath && (
          <button
            onClick={onClear}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Clear path"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
}
