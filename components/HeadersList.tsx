import clsx from 'clsx';
import { RedirectHeader } from '../types/redirect';

interface HeadersListProps {
  headers: RedirectHeader[];
  ip?: string;
  darkMode?: boolean;
}

export default function HeadersList({ headers, ip, darkMode = false }: HeadersListProps) {
  // Filter out sensitive headers like Set-Cookie
  const filteredHeaders = headers.filter(h => h.name.toLowerCase() !== 'set-cookie');

  const allHeaders = [{ name: 'Server IP Address', value: ip || 'Unknown' }, ...filteredHeaders];

  if (allHeaders.length === 0) {
    return (
      <p className={clsx('text-xs italic', darkMode ? 'text-slate-500' : 'text-slate-400')}>
        No headers available
      </p>
    );
  }

  return (
    <div
      className={clsx(
        'rounded border divide-y max-h-48 overflow-y-auto',
        darkMode
          ? 'bg-slate-800 border-slate-700 divide-slate-700'
          : 'bg-white border-slate-200 divide-slate-100'
      )}
    >
      {allHeaders.map((header, idx) => (
        <div key={idx} className="flex text-xs">
          <span
            className={clsx(
              'shrink-0 w-1/3 p-2 font-medium truncate',
              darkMode ? 'text-slate-400 bg-slate-700/50' : 'text-slate-600 bg-slate-50'
            )}
            title={header.name}
          >
            {header.name}
          </span>
          <span
            className={clsx('flex-1 p-2 break-all', darkMode ? 'text-slate-300' : 'text-slate-700')}
          >
            {header.value || '-'}
          </span>
        </div>
      ))}
    </div>
  );
}
