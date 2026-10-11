import { Check, Copy, Zap } from 'lucide-react';
import { useState } from 'react';
import type { RedirectHeader } from '../types/redirect';
import { t } from '../utils/i18n';

interface HeadersListProps {
  headers: RedirectHeader[];
  ip?: string;
  statusLine?: string;
  darkMode?: boolean;
}

export default function HeadersList({ headers, ip, statusLine }: HeadersListProps) {
  const [copied, setCopied] = useState(false);

  const filteredHeaders = (headers || []).filter(
    h => !['set-cookie', 'cookie', 'authorization'].includes(h.name.toLowerCase())
  );

  const hasData = Boolean(statusLine || (ip && ip !== 'Unknown') || filteredHeaders.length > 0);

  if (!hasData) {
    return (
      <div className="mt-2 p-2.5 border border-line bg-paper-card text-center font-mono text-[10px] text-muted uppercase tracking-wider">
        {t('noHeadersAvailable')}
      </div>
    );
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const lines: string[] = [];
    if (statusLine) {
      lines.push(`Status-Line: ${statusLine}`);
    }
    if (ip && ip !== 'Unknown') {
      lines.push(`IP-Address: ${ip}`);
    }
    filteredHeaders.forEach(h => {
      lines.push(`${h.name}: ${h.value}`);
    });
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const totalCount =
    filteredHeaders.length +
    (ip && ip !== 'Unknown' ? 1 : 0) +
    (statusLine ? 1 : 0);

  return (
    <div className="mt-2">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-paper-subtle border border-line font-mono text-[10px]">
        <span className="flex items-center gap-1.5 font-bold uppercase tracking-[0.14em] text-ink">
          <Zap className="w-3 h-3 text-brand" />
          {t('allHeaders')} ({totalCount})
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 font-bold uppercase tracking-[0.14em] text-brand hover:text-brand-hover transition-colors"
          title={t('copyHeadersTitle')}
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-ok" />
              <span className="text-ok">{t('copied')}</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>{t('copyLabel')}</span>
            </>
          )}
        </button>
      </div>

      {/* Structured 2-Column Table */}
      <div className="border-x border-b border-line bg-paper-card divide-y divide-line max-h-60 overflow-y-auto">
        {statusLine && (
          <div className="flex font-mono text-[10.5px] hover:bg-paper-subtle/50 transition-colors">
            <span
              className="shrink-0 w-2/5 p-1.5 font-bold uppercase truncate border-r border-line text-text-secondary bg-paper-subtle"
              title="STATUS LINE"
            >
              STATUS_LINE
            </span>
            <span className="flex-1 p-1.5 break-all text-ink font-mono font-medium">{statusLine}</span>
          </div>
        )}
        {ip && ip !== 'Unknown' && (
          <div className="flex font-mono text-[10.5px] hover:bg-paper-subtle/50 transition-colors">
            <span
              className="shrink-0 w-2/5 p-1.5 font-bold uppercase truncate border-r border-line text-text-secondary bg-paper-subtle"
              title="IP ADDRESS"
            >
              IP_ADDRESS
            </span>
            <span className="flex-1 p-1.5 break-all text-ink font-mono font-medium">{ip}</span>
          </div>
        )}
        {filteredHeaders.map((header, idx) => (
          <div
            key={idx}
            className="flex font-mono text-[10.5px] hover:bg-paper-subtle/50 transition-colors"
          >
            <span
              className="shrink-0 w-2/5 p-1.5 font-bold uppercase truncate border-r border-line text-text-secondary bg-paper-subtle"
              title={header.name}
            >
              {header.name}
            </span>
            <span className="flex-1 p-1.5 break-all text-ink">{header.value || '-'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
