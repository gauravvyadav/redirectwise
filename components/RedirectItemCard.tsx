import clsx from 'clsx';
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Shield,
  Zap,
} from 'lucide-react';
import { RedirectItem } from '../types/redirect';
import HeadersList from './HeadersList';

// Static badge config - defined outside component to avoid recreation
const REDIRECT_BADGES: Record<string, { label: string; color: string; darkColor: string }> = {
  permanent: {
    label: '301',
    color: 'bg-blue-100 text-blue-700',
    darkColor: 'bg-blue-900/50 text-blue-300',
  },
  temporary: {
    label: '302',
    color: 'bg-amber-100 text-amber-700',
    darkColor: 'bg-amber-900/50 text-amber-300',
  },
  hsts: {
    label: 'HSTS',
    color: 'bg-purple-100 text-purple-700',
    darkColor: 'bg-purple-900/50 text-purple-300',
  },
  meta: {
    label: 'META',
    color: 'bg-pink-100 text-pink-700',
    darkColor: 'bg-pink-900/50 text-pink-300',
  },
  javascript: {
    label: 'JS',
    color: 'bg-yellow-100 text-yellow-700',
    darkColor: 'bg-yellow-900/50 text-yellow-300',
  },
};

interface RedirectItemCardProps {
  item: RedirectItem;
  index: number;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  darkMode?: boolean;
}

export default function RedirectItemCard({
  item,
  index,
  isLast,
  isExpanded,
  onToggle,
  darkMode = false,
}: RedirectItemCardProps) {
  const getStatusColor = () => {
    if (item.statusObject.isSuccess) return 'bg-green-500';
    if (item.statusObject.isRedirect) return 'bg-amber-500';
    if (item.statusObject.isClientError) return 'bg-red-500';
    if (item.statusObject.isServerError) return 'bg-red-600';
    return 'bg-slate-400';
  };

  const getStatusBgColor = () => {
    if (darkMode) {
      if (item.statusObject.isSuccess) return 'bg-slate-800 border-green-800';
      if (item.statusObject.isRedirect) return 'bg-slate-800 border-amber-800';
      if (item.statusObject.isClientError) return 'bg-slate-800 border-red-800';
      if (item.statusObject.isServerError) return 'bg-slate-800 border-red-800';
      return 'bg-slate-800 border-slate-700';
    }
    if (item.statusObject.isSuccess) return 'bg-green-50 border-green-200';
    if (item.statusObject.isRedirect) return 'bg-amber-50 border-amber-200';
    if (item.statusObject.isClientError) return 'bg-red-50 border-red-200';
    if (item.statusObject.isServerError) return 'bg-red-50 border-red-200';
    return 'bg-slate-50 border-slate-200';
  };

  const getStatusLabel = () => {
    if (item.type === 'server_redirect') {
      const redirectLabel =
        item.redirect_type === 'permanent'
          ? 'Permanent'
          : item.redirect_type === 'hsts'
          ? 'HSTS'
          : 'Temporary';
      return `${item.status_code} ${redirectLabel} Redirect`;
    }
    return `${item.status_code} ${item.status_line}`;
  };

  const getRedirectBadge = () => {
    if (!item.redirect_type) return null;

    const badge = REDIRECT_BADGES[item.redirect_type];
    if (!badge) return null;

    return (
      <span
        className={clsx(
          'text-xs font-medium px-1.5 py-0.5 rounded',
          darkMode ? badge.darkColor : badge.color
        )}
      >
        {badge.label}
      </span>
    );
  };

  const truncateUrl = (url: string, maxLength = 50) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  };

  // Quick status indicators
  const getQuickIndicators = () => {
    const indicators: { icon: React.ReactNode; label: string; color: string }[] = [];

    // HTTPS indicator
    const isHttps = item.url.startsWith('https://');
    if (isHttps) {
      indicators.push({
        icon: <Shield className="w-3 h-3" />,
        label: 'HTTPS',
        color: darkMode ? 'text-green-400' : 'text-green-600',
      });
    }

    // Compression indicator
    const encoding = item.headers.find(h => h.name.toLowerCase() === 'content-encoding')?.value;
    if (encoding) {
      const label = encoding === 'br' ? 'Brotli' : encoding === 'gzip' ? 'Gzip' : encoding;
      indicators.push({
        icon: <Zap className="w-3 h-3" />,
        label,
        color: darkMode ? 'text-purple-400' : 'text-purple-600',
      });
    }

    return indicators;
  };

  const quickIndicators = getQuickIndicators();

  return (
    <div
      className={clsx(
        'rounded-lg border transition-all duration-200',
        getStatusBgColor(),
        isExpanded ? 'shadow-md' : 'shadow-sm hover:shadow-md'
      )}
    >
      {/* Main clickable area */}
      <button onClick={onToggle} className="w-full text-left p-3 flex items-start gap-3">
        {/* Step number with status indicator */}
        <div className="shrink-0 flex flex-col items-center">
          <div
            className={clsx(
              'w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm',
              getStatusColor()
            )}
          >
            {index + 1}
          </div>
          {!isLast && (
            <ArrowRight
              className={clsx(
                'w-4 h-4 mt-1 rotate-90',
                darkMode ? 'text-slate-600' : 'text-slate-400'
              )}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={clsx(
                'font-medium text-sm',
                darkMode ? 'text-slate-200' : 'text-slate-800'
              )}
            >
              {getStatusLabel()}
            </span>
            {getRedirectBadge()}
            {item.timing?.duration && (
              <span
                className={clsx(
                  'flex items-center gap-0.5 text-xs',
                  darkMode ? 'text-slate-500' : 'text-slate-400'
                )}
              >
                <Clock className="w-3 h-3" />
                {item.timing.duration}ms
              </span>
            )}
            {/* Quick indicators */}
            {quickIndicators.map((indicator, i) => (
              <span
                key={i}
                className={clsx('flex items-center gap-0.5 text-xs', indicator.color)}
                title={indicator.label}
              >
                {indicator.icon}
              </span>
            ))}
          </div>

          <p
            className={clsx('text-xs truncate', darkMode ? 'text-slate-400' : 'text-slate-600')}
            title={item.url}
          >
            {truncateUrl(item.url, 45)}
          </p>

          {item.redirect_url && (
            <div
              className={clsx(
                'flex items-center gap-1 mt-1 text-xs',
                darkMode ? 'text-slate-500' : 'text-slate-500'
              )}
            >
              <ArrowRight className="w-3 h-3" />
              <span className="truncate" title={item.redirect_url}>
                {truncateUrl(item.redirect_url, 40)}
              </span>
            </div>
          )}

          {item.ip && item.ip !== 'Unknown' && (
            <p className={clsx('text-xs mt-1', darkMode ? 'text-slate-600' : 'text-slate-400')}>
              IP: {item.ip}
            </p>
          )}
        </div>

        {/* Expand indicator */}
        <div className={clsx('shrink-0', darkMode ? 'text-slate-500' : 'text-slate-400')}>
          {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </div>
      </button>

      {/* Expanded headers section */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0">
          <div
            className={clsx('border-t pt-3', darkMode ? 'border-slate-700' : 'border-slate-200')}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className={clsx(
                  'text-xs font-medium uppercase',
                  darkMode ? 'text-slate-400' : 'text-slate-500'
                )}
              >
                Response Headers
              </span>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
                onClick={e => {
                  e.stopPropagation();
                  chrome.tabs.create({ url: item.url });
                }}
              >
                Open URL <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <HeadersList headers={item.headers} ip={item.ip} darkMode={darkMode} />
          </div>

          {/* HSTS Note */}
          {item.redirect_type === 'hsts' && (
            <div
              className={clsx(
                'mt-3 p-2 rounded text-xs',
                darkMode
                  ? 'bg-purple-900/30 border border-purple-800 text-purple-300'
                  : 'bg-purple-50 border border-purple-200 text-purple-700'
              )}
            >
              <strong>HSTS Redirect:</strong> This is an internal browser redirect. The server
              previously indicated this domain should always use HTTPS. Chrome cached this and
              redirected without contacting the server.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
