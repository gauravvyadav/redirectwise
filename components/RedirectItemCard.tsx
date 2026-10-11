import clsx from 'clsx';
import { ChevronDown, ChevronRight, Copy, ExternalLink, Info, LockOpen, Zap } from 'lucide-react';
import { useState } from 'react';
import type { RedirectItem } from '../types/redirect';
import { formatDuration } from '../types/redirect';
import { t } from '../utils/i18n';
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
    if (item.statusObject.isSuccess) return 'bg-ok text-white';
    if (item.statusObject.isRedirect) return 'bg-warn text-white';
    if (item.statusObject.isClientError || item.statusObject.isServerError)
      return 'bg-err text-white';
    return 'bg-muted text-white';
  };

  const getRedirectTypeLabel = () => {
    if (item.type === 'server_redirect') {
      return item.redirect_type === 'permanent'
        ? t('permanentRedirect')
        : item.redirect_type === 'hsts'
          ? t('hstsRedirect')
          : t('temporaryRedirect');
    }
    return null;
  };

  const getQuickIndicators = () => {
    const indicators: {
      icon: React.ReactNode;
      label: string;
      color: string;
      iconOnly?: boolean;
    }[] = [];
    // Only flag insecure pages — virtually everything is HTTPS these days,
    // so the lock icon just wastes tag-row space. HTTP gets a warning badge.
    if (item.url.startsWith('http://')) {
      indicators.push({
        icon: <LockOpen className="w-3 h-3" />,
        label: 'HTTP',
        color: 'text-err',
        iconOnly: true,
      });
    }
    const encoding = item.headers.find(h => h.name.toLowerCase() === 'content-encoding')?.value;
    if (encoding) {
      const label = encoding === 'br' ? 'Brotli' : encoding === 'gzip' ? 'Gzip' : encoding;
      indicators.push({
        icon: <Zap className="w-3 h-3" />,
        label,
        color: 'text-brand',
      });
    }
    return indicators;
  };

  const quickIndicators = getQuickIndicators();
  const redirectLabel = getRedirectTypeLabel();
  const openedFromDomain = item.openedFrom
    ? (() => {
        try {
          return new URL(item.openedFrom).hostname;
        } catch {
          return item.openedFrom;
        }
      })()
    : '';

  return (
    <>
      {item.openedFrom && (
        <div className="flex justify-center py-0.5">
          <span
            className="h-6 inline-flex items-center font-mono text-[10px] font-bold uppercase tracking-[0.14em] px-2 border border-brand bg-brand text-white gap-1.5 max-w-full"
            title={`${t('openedFromTitle')} ${item.openedFrom}`}
          >
            <span className="shrink-0">{t('newTabFrom')}</span>
            <span className="truncate font-bold normal-case tracking-normal min-w-0 max-w-45">
              {openedFromDomain}
            </span>
          </span>
        </div>
      )}
      <div
        className={clsx(
          'border bg-paper-card transition-colors',
          isExpanded ? 'border-ink' : 'border-line hover:border-muted'
        )}
      >
        {/* Top Header Row: Badge + Tags + Action Buttons */}
        <button
          onClick={onToggle}
          className="w-full text-left p-2.5 flex items-center gap-2.5 cursor-pointer"
        >
          <div className="shrink-0 flex items-center justify-center">
            <div
              className={clsx(
                'w-6 h-6 flex items-center justify-center font-mono font-bold text-[11px]',
                getStatusColor()
              )}
            >
              {index + 1}
            </div>
          </div>

          <div className="flex-1 min-w-0 flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              {redirectLabel && (
                <span className="h-6 inline-flex items-center font-mono text-[9.5px] font-bold uppercase px-2 border border-warn-border bg-warn-bg text-warn shrink-0">
                  {redirectLabel}
                </span>
              )}

              {item.timing && (
                <span className="h-6 inline-flex items-center font-mono text-[10px] font-medium px-2 border border-line bg-paper-subtle text-text-secondary shrink-0">
                  {formatDuration(item.timing.duration)}
                </span>
              )}

              {quickIndicators.map((indicator, i) => (
                <span
                  key={i}
                  className={clsx(
                    'h-6 inline-flex items-center justify-center border border-line shrink-0',
                    indicator.color,
                    indicator.iconOnly
                      ? 'w-6'
                      : 'gap-1 font-mono text-[9.5px] font-semibold uppercase px-2'
                  )}
                  title={indicator.label}
                >
                  {indicator.icon}
                  {!indicator.iconOnly && indicator.label}
                </span>
              ))}
            </div>

            {/* Pinned Action Cluster: Status Code + Copy URL + Expand Chevron */}
            <div className="flex items-center gap-1 shrink-0">
              <span
                className={clsx(
                  'h-6 inline-flex items-center font-mono text-[10.5px] font-black px-2 border shrink-0',
                  item.statusObject.isSuccess && 'bg-ok-bg border-ok-border text-ok',
                  item.statusObject.isRedirect && 'bg-warn-bg border-warn-border text-warn',
                  (item.statusObject.isClientError || item.statusObject.isServerError) &&
                    'bg-err-bg border-err-border text-err'
                )}
              >
                {item.status_code}
              </span>

              <button
                onClick={copyUrl}
                className={clsx(
                  'w-6 h-6 flex items-center justify-center border border-line bg-paper-card text-muted hover:border-ink hover:text-ink transition-colors relative cursor-pointer shrink-0',
                  copied && 'text-ok border-ok'
                )}
                title={t('copyUrl')}
              >
                <Copy className="w-3 h-3" />
                {copied && (
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 bg-ink text-paper whitespace-nowrap shadow-none z-30">
                    {t('copied')}
                  </span>
                )}
              </button>

              <div className="w-6 h-6 flex items-center justify-center text-muted shrink-0">
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </div>
            </div>
          </div>
        </button>

        {/* URL Row: Divider above is permanent (border-t), divider below (border-b) only when open */}
        <div
          onClick={!isExpanded ? onToggle : undefined}
          className={clsx(
            'border-t border-line px-3 py-2 transition-colors',
            isExpanded ? 'border-b bg-paper-subtle/30' : 'cursor-pointer hover:bg-paper-subtle/40'
          )}
        >
          <p className="font-mono text-[11px] break-all leading-relaxed text-text-secondary select-text">
            {!isExpanded && item.url.length > 95 ? `${item.url.substring(0, 95)}...` : item.url}
          </p>
        </div>

        {/* When Expanded: Controls & Headers */}
        {isExpanded && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={e => {
                  e.stopPropagation();
                  setShowHeaders(!showHeaders);
                }}
                className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] flex items-center gap-1.5 px-2.5 py-1 border border-line bg-paper-subtle text-ink hover:border-ink transition-colors"
              >
                <Info className="w-3 h-3 text-brand" />
                {t('responseHeaders')}
                {showHeaders ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-brand hover:text-brand-hover flex items-center gap-1 border border-transparent hover:border-brand px-2 py-0.5 transition-colors"
                onClick={e => {
                  e.stopPropagation();
                  chrome.tabs.create({ url: item.url });
                }}
              >
                {t('openUrl')} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            {showHeaders && (
              <HeadersList
                headers={item.headers}
                ip={item.ip}
                statusLine={item.status_line}
                darkMode={darkMode}
              />
            )}

            {item.redirect_type === 'hsts' && (
              <div className="mt-2.5 p-2 border border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20 text-purple-900 dark:text-purple-300 font-mono text-[10px] leading-relaxed">
                <strong className="uppercase tracking-widest">{t('hstsRedirect')}:</strong>{' '}
                {t('hstsRedirectDesc')}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
