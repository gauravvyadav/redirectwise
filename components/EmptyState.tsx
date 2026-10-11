import { AlertCircle, Globe } from 'lucide-react';
import { t } from '../utils/i18n';

interface EmptyStateProps {
  currentUrl: string;
  darkMode?: boolean;
}

export default function EmptyState({ currentUrl }: EmptyStateProps) {
  const isSpecialPage =
    !currentUrl ||
    currentUrl.startsWith('chrome://') ||
    currentUrl.startsWith('chrome-extension://') ||
    currentUrl.startsWith('edge://') ||
    currentUrl.startsWith('moz-extension://') ||
    currentUrl.startsWith('about:');

  return (
    <div className="flex flex-col items-center justify-center h-48 text-center px-4">
      {isSpecialPage ? (
        <>
          <div className="w-10 h-10 border border-line bg-paper-card flex items-center justify-center text-accent mb-3">
            <AlertCircle className="w-5 h-5" />
          </div>
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">
            STATUS // RESTRICTED PROTOCOL
          </span>
          <h2 className="text-xs font-black uppercase tracking-tight text-ink">
            {t('emptyStateSpecialPageTitle')}
          </h2>
          <p className="text-[11px] max-w-xs mt-1.5 leading-relaxed text-text-secondary">
            {t('emptyStateSpecialPageDesc')}
          </p>
        </>
      ) : (
        <>
          <div className="w-10 h-10 border border-line bg-paper-card flex items-center justify-center text-accent mb-3">
            <Globe className="w-5 h-5" />
          </div>
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">
            MONITOR // READY
          </span>
          <h2 className="text-xs font-black uppercase tracking-tight text-ink">
            {t('emptyStateDefaultTitle')}
          </h2>
          <p className="text-[11px] max-w-xs mt-1.5 leading-relaxed text-text-secondary">
            {t('emptyStateDefaultDesc')}
          </p>
        </>
      )}
    </div>
  );
}
