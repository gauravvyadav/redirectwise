import clsx from 'clsx';
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Info,
  Shield,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { RedirectItem, formatDuration } from '../types/redirect';
import HeadersList from './HeadersList';

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
  const [copied, setCopied] = useState(false);
  const [showHeaders, setShowHeaders] = useState(false);

  const copyUrl = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(item.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

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
      return item.redirect_type === 'permanent'
        ? chrome.i18n.getMessage('permanentRedirect')
        : item.redirect_type === 'hsts'
        ? chrome.i18n.getMessage('hstsRedirect')
        : chrome.i18n.getMessage('temporaryRedirect');
    }
    return item.status_line;
  };

  const getQuickIndicators = () => {
    const indicators: { icon: React.ReactNode; label: string; color: string }[] = [];
    const isHttps = item.url.startsWith('https://');
    if (isHttps) {
      indicators.push({
        icon: <Shield className="w-3 h-3" />,
        label: 'HTTPS',
        color: darkMode ? 'text-green-400' : 'text-green-600',
      });
    }
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
        'rounded-lg border transition-colors',
        getStatusBgColor(),
        isExpanded && (darkMode ? 'border-slate-600' : 'border-slate-300')
      )}
    >
      <button onClick={onToggle} className="w-full text-left p-3 flex items-start gap-3">
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
            <span className="flex-1" />
            <span
              className={clsx(
                'text-xs font-medium px-1.5 py-0.5 rounded',
                item.statusObject.isSuccess &&
                  (darkMode ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'),
                item.statusObject.isRedirect &&
                  (darkMode ? 'bg-amber-900/50 text-amber-300' : 'bg-amber-100 text-amber-700'),
                item.statusObject.isClientError &&
                  (darkMode ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-700'),
                item.statusObject.isServerError &&
                  (darkMode ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-700')
              )}
            >
              {item.status_code}
            </span>
            {item.timing && (
              <span
                className={clsx(
                  'text-xs px-1.5 py-0.5 rounded',
                  darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'
                )}
              >
                {formatDuration(item.timing.duration)}
              </span>
            )}
            {quickIndicators.map((indicator, i) => (
              <span
                key={i}
                className={clsx('flex items-center gap-0.5 text-xs', indicator.color)}
                title={indicator.label}
              >
                {indicator.icon}
              </span>
            ))}
            <button
              onClick={copyUrl}
              className={clsx(
                'p-1 rounded cursor-pointer hover:bg-slate-200/50 transition-colors relative',
                darkMode ? 'hover:bg-slate-700/50 text-slate-500' : 'text-slate-400',
                copied && 'text-green-500'
              )}
              title={chrome.i18n.getMessage('copyUrl')}
            >
              <Copy className="w-3.5 h-3.5" />
              {copied && (
                <span
                  className={clsx(
                    'absolute -top-6 left-1/2 -translate-x-1/2 text-xs px-2 py-1 rounded whitespace-nowrap',
                    darkMode ? 'bg-slate-700 text-green-400' : 'bg-slate-800 text-green-400'
                  )}
                >
                  {chrome.i18n.getMessage('copied')}
                </span>
              )}
            </button>
          </div>

          <p className={clsx('text-xs break-all', darkMode ? 'text-slate-400' : 'text-slate-600')}>
            {!isExpanded && item.url.length > 100 ? `${item.url.substring(0, 100)}...` : item.url}
          </p>

          {item.ip && item.ip !== 'Unknown' && (
            <p className={clsx('text-xs mt-1', darkMode ? 'text-slate-600' : 'text-slate-400')}>
              IP: {item.ip}
            </p>
          )}
        </div>

        <div className={clsx('shrink-0', darkMode ? 'text-slate-500' : 'text-slate-400')}>
          {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 pt-0">
          <div
            className={clsx('border-t pt-3', darkMode ? 'border-slate-700' : 'border-slate-200')}
          >
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={e => {
                  e.stopPropagation();
                  setShowHeaders(!showHeaders);
                }}
                className={clsx(
                  'text-xs font-medium flex items-center gap-1 px-2 py-1 rounded transition-colors',
                  darkMode
                    ? 'text-slate-400 hover:bg-slate-700/50'
                    : 'text-slate-500 hover:bg-slate-200/50'
                )}
              >
                <Info className="w-3 h-3" />
                {chrome.i18n.getMessage('responseHeaders')}
                {showHeaders ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </button>
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
                {chrome.i18n.getMessage('openUrl')} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            {showHeaders && <HeadersList headers={item.headers} ip={item.ip} darkMode={darkMode} />}
          </div>

          {item.redirect_type === 'hsts' && (
            <div
              className={clsx(
                'mt-3 p-2 rounded text-xs',
                darkMode
                  ? 'bg-purple-900/30 border border-purple-800 text-purple-300'
                  : 'bg-purple-50 border border-purple-200 text-purple-700'
              )}
            >
              <strong>{chrome.i18n.getMessage('hstsRedirect')}:</strong> {chrome.i18n.getMessage('hstsRedirectDesc')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
