import clsx from 'clsx';
import { AlertCircle, Globe } from 'lucide-react';

interface EmptyStateProps {
  currentUrl: string;
  darkMode?: boolean;
}

export default function EmptyState({ currentUrl, darkMode = false }: EmptyStateProps) {
  const isSpecialPage =
    !currentUrl ||
    currentUrl.startsWith('chrome://') ||
    currentUrl.startsWith('chrome-extension://') ||
    currentUrl.startsWith('edge://') ||
    currentUrl.startsWith('moz-extension://') ||
    currentUrl.startsWith('about:');

  return (
    <div className="flex flex-col items-center justify-center h-40 text-center px-4">
      {isSpecialPage ? (
        <>
          <AlertCircle className="w-12 h-12 text-amber-500 mb-3" />
          <h2
            className={clsx(
              'text-lg font-medium mb-1',
              darkMode ? 'text-slate-200' : 'text-slate-700'
            )}
          >
            Cannot track this page
          </h2>
          <p className={clsx('text-sm', darkMode ? 'text-slate-400' : 'text-slate-500')}>
            Browser internal pages cannot be tracked. Navigate to a website to see its redirect
            path.
          </p>
        </>
      ) : (
        <>
          <Globe
            className={clsx('w-12 h-12 mb-3', darkMode ? 'text-slate-600' : 'text-slate-300')}
          />
          <h2
            className={clsx(
              'text-lg font-medium mb-1',
              darkMode ? 'text-slate-200' : 'text-slate-700'
            )}
          >
            No redirects detected
          </h2>
          <p className={clsx('text-sm', darkMode ? 'text-slate-400' : 'text-slate-500')}>
            Navigate to a URL or refresh the page to capture its redirect path.
          </p>
        </>
      )}
    </div>
  );
}
