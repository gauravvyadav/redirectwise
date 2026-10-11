import { LayoutDashboard, Moon, PanelRight, RefreshCw, Sun } from 'lucide-react';
import { t } from '../utils/i18n';
import Logo from './Logo';

interface HeaderProps {
  onRefresh: () => void;
  onToggleDarkMode: () => void;
  onOpenDashboard: () => void;
  onOpenSidepanel?: () => void;
  darkMode: boolean;
}

export default function Header({
  onRefresh,
  onToggleDarkMode,
  onOpenDashboard,
  onOpenSidepanel,
  darkMode,
}: HeaderProps) {
  return (
    <header className="bg-paper-card text-ink px-4 py-3 flex items-center justify-between border-b border-line">
      <div className="flex items-center gap-2.5">
        <Logo size={28} />
        <div>
          <h1 className="text-xs font-black uppercase tracking-[0.08em] text-ink leading-tight">
            {t('extensionName').split(':')[0]}
          </h1>
          <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted mt-0.5">
            {t('headerSubtitle')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={onRefresh}
          className="w-7 h-7 flex items-center justify-center border border-line bg-paper-card text-ink hover:border-ink hover:bg-paper-subtle transition-colors"
          title={t('headerRefresh')}
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        {onOpenSidepanel && (
          <button
            onClick={onOpenSidepanel}
            className="w-7 h-7 flex items-center justify-center border border-line bg-paper-card text-ink hover:border-ink hover:bg-paper-subtle transition-colors"
            title={t('headerOpenRealtimeMonitor')}
          >
            <PanelRight className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={onOpenDashboard}
          className="w-7 h-7 flex items-center justify-center border border-line bg-paper-card text-ink hover:border-ink hover:bg-paper-subtle transition-colors"
          title={t('headerOpenDashboard')}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onToggleDarkMode}
          className="w-7 h-7 flex items-center justify-center border border-line bg-paper-card text-ink hover:border-ink hover:bg-paper-subtle transition-colors"
          title={t(darkMode ? 'headerLightMode' : 'headerDarkMode')}
        >
          {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>
      </div>
    </header>
  );
}
