import clsx from 'clsx';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Globe,
  Server,
  Shield,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { RedirectHeader } from '../types/redirect';

interface HeadersListProps {
  headers: RedirectHeader[];
  ip?: string;
  darkMode?: boolean;
}

interface HeaderCategory {
  name: string;
  icon: React.ReactNode;
  items: { label: string; value: string }[];
  color: string;
  darkColor: string;
}

export default function HeadersList({ headers, ip, darkMode = false }: HeadersListProps) {
  const [showAllHeaders, setShowAllHeaders] = useState(false);

  // Helper to find header value (case-insensitive)
  const getHeader = (name: string): string | undefined => {
    const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return header?.value;
  };

  // Parse cache-control header
  const parseCacheControl = (value: string | undefined): string => {
    if (!value) return 'Not specified';
    const parts = value.split(',').map(p => p.trim());
    const maxAge = parts.find(p => p.startsWith('max-age='));
    const sMaxAge = parts.find(p => p.startsWith('s-maxage='));
    const isPrivate = parts.includes('private');
    const isPublic = parts.includes('public');
    const noCache = parts.includes('no-cache');
    const noStore = parts.includes('no-store');

    if (noStore) return '🚫 No Store';
    if (noCache) return '⚠️ No Cache';

    let result = isPrivate ? '🔒 Private' : isPublic ? '🌐 Public' : '';
    if (maxAge) {
      const seconds = parseInt(maxAge.split('=')[1]);
      if (seconds === 0) result += ' (0s)';
      else if (seconds < 60) result += ` (${seconds}s)`;
      else if (seconds < 3600) result += ` (${Math.round(seconds / 60)}m)`;
      else if (seconds < 86400) result += ` (${Math.round(seconds / 3600)}h)`;
      else result += ` (${Math.round(seconds / 86400)}d)`;
    }
    return result || value;
  };

  // Build categories
  const categories: HeaderCategory[] = [];

  // Server Info
  const serverItems: { label: string; value: string }[] = [];
  // Always show IP Address
  serverItems.push({ label: 'IP Address', value: ip || 'Not available' });
  const server = getHeader('server');
  if (server) serverItems.push({ label: 'Server', value: server });
  const poweredBy = getHeader('x-powered-by');
  if (poweredBy) serverItems.push({ label: 'Powered By', value: poweredBy });
  const via = getHeader('via');
  if (via) serverItems.push({ label: 'Via', value: via });
  const altSvc = getHeader('alt-svc');
  if (altSvc) {
    const protocols: string[] = [];
    if (altSvc.includes('h3')) protocols.push('HTTP/3');
    if (altSvc.includes('h2')) protocols.push('HTTP/2');
    if (protocols.length > 0)
      serverItems.push({ label: 'Alt Protocols', value: protocols.join(', ') });
  }

  if (serverItems.length > 0) {
    categories.push({
      name: 'Server',
      icon: <Server className="w-3.5 h-3.5" />,
      items: serverItems,
      color: 'bg-blue-100 text-blue-700 border-blue-200',
      darkColor: 'bg-blue-900/30 text-blue-300 border-blue-800',
    });
  }

  // Caching
  const cacheItems: { label: string; value: string }[] = [];
  const cacheControl = getHeader('cache-control');
  if (cacheControl)
    cacheItems.push({ label: 'Cache Control', value: parseCacheControl(cacheControl) });
  const expires = getHeader('expires');
  if (expires)
    cacheItems.push({ label: 'Expires', value: expires === '-1' ? 'Immediately' : expires });
  const age = getHeader('age');
  if (age) cacheItems.push({ label: 'Age', value: `${age}s` });
  const etag = getHeader('etag');
  if (etag)
    cacheItems.push({
      label: 'ETag',
      value: etag.length > 30 ? etag.substring(0, 30) + '...' : etag,
    });
  const lastModified = getHeader('last-modified');
  if (lastModified) cacheItems.push({ label: 'Last Modified', value: lastModified });

  if (cacheItems.length > 0) {
    categories.push({
      name: 'Caching',
      icon: <Clock className="w-3.5 h-3.5" />,
      items: cacheItems,
      color: 'bg-amber-100 text-amber-700 border-amber-200',
      darkColor: 'bg-amber-900/30 text-amber-300 border-amber-800',
    });
  }

  // Security
  const securityItems: { label: string; value: string }[] = [];
  const hsts = getHeader('strict-transport-security');
  if (hsts) {
    const maxAgeMatch = hsts.match(/max-age=(\d+)/);
    const maxAgeDays = maxAgeMatch ? Math.round(parseInt(maxAgeMatch[1]) / 86400) : 0;
    const includesSub = hsts.includes('includeSubDomains');
    securityItems.push({
      label: 'HSTS',
      value: `✅ ${maxAgeDays}d${includesSub ? ' +subdomains' : ''}`,
    });
  }
  const csp =
    getHeader('content-security-policy') || getHeader('content-security-policy-report-only');
  if (csp) securityItems.push({ label: 'CSP', value: '✅ Enabled' });
  const xfo = getHeader('x-frame-options');
  if (xfo) securityItems.push({ label: 'X-Frame-Options', value: xfo });
  const xss = getHeader('x-xss-protection');
  if (xss)
    securityItems.push({
      label: 'XSS Protection',
      value: xss === '0' ? '❌ Disabled' : '✅ Enabled',
    });
  const xcto = getHeader('x-content-type-options');
  if (xcto) securityItems.push({ label: 'Content-Type Options', value: xcto });
  const coop = getHeader('cross-origin-opener-policy');
  if (coop) securityItems.push({ label: 'COOP', value: coop.split(';')[0] });
  const corp = getHeader('cross-origin-resource-policy');
  if (corp) securityItems.push({ label: 'CORP', value: corp });
  const coep = getHeader('cross-origin-embedder-policy');
  if (coep) securityItems.push({ label: 'COEP', value: coep });
  const permissions = getHeader('permissions-policy');
  if (permissions) securityItems.push({ label: 'Permissions', value: '✅ Set' });

  if (securityItems.length > 0) {
    categories.push({
      name: 'Security',
      icon: <Shield className="w-3.5 h-3.5" />,
      items: securityItems,
      color: 'bg-green-100 text-green-700 border-green-200',
      darkColor: 'bg-green-900/30 text-green-300 border-green-800',
    });
  }

  // Content
  const contentItems: { label: string; value: string }[] = [];
  const contentType = getHeader('content-type');
  if (contentType) {
    const parts = contentType.split(';');
    const type = parts[0].trim();
    const charset = parts
      .find(p => p.includes('charset='))
      ?.split('=')[1]
      ?.trim();
    contentItems.push({ label: 'Type', value: type });
    if (charset) contentItems.push({ label: 'Charset', value: charset.toUpperCase() });
  }
  const encoding = getHeader('content-encoding');
  if (encoding) {
    const label = encoding === 'br' ? 'Brotli' : encoding === 'gzip' ? 'Gzip' : encoding;
    contentItems.push({ label: 'Compression', value: `⚡ ${label}` });
  }
  const contentLength = getHeader('content-length');
  if (contentLength) {
    const bytes = parseInt(contentLength);
    const size =
      bytes < 1024
        ? `${bytes}B`
        : bytes < 1048576
        ? `${(bytes / 1024).toFixed(1)}KB`
        : `${(bytes / 1048576).toFixed(1)}MB`;
    contentItems.push({ label: 'Size', value: size });
  }
  const transferEncoding = getHeader('transfer-encoding');
  if (transferEncoding) contentItems.push({ label: 'Transfer', value: transferEncoding });

  if (contentItems.length > 0) {
    categories.push({
      name: 'Content',
      icon: <FileText className="w-3.5 h-3.5" />,
      items: contentItems,
      color: 'bg-purple-100 text-purple-700 border-purple-200',
      darkColor: 'bg-purple-900/30 text-purple-300 border-purple-800',
    });
  }

  // Client Hints
  const acceptCh = headers.filter(h => h.name.toLowerCase() === 'accept-ch');
  if (acceptCh.length > 0) {
    const hints = acceptCh
      .map(h => h.value)
      .join(', ')
      .split(',')
      .map(h => h.trim());
    const uniqueHints = [...new Set(hints)];
    categories.push({
      name: 'Client Hints',
      icon: <Globe className="w-3.5 h-3.5" />,
      items: [{ label: 'Requested', value: `${uniqueHints.length} hints` }],
      color: 'bg-cyan-100 text-cyan-700 border-cyan-200',
      darkColor: 'bg-cyan-900/30 text-cyan-300 border-cyan-800',
    });
  }

  // Filter out sensitive headers
  const filteredHeaders = headers.filter(
    h => !['set-cookie', 'cookie', 'authorization'].includes(h.name.toLowerCase())
  );

  return (
    <div className="space-y-2">
      {/* Category Cards - Single column for better readability */}
      {categories.length > 0 && (
        <div className="space-y-2">
          {categories.map((category, idx) => (
            <div
              key={idx}
              className={clsx(
                'rounded-lg border p-2.5',
                darkMode ? category.darkColor : category.color
              )}
            >
              <div className="flex items-center gap-1.5 mb-2">
                {category.icon}
                <span className="text-xs font-semibold">{category.name}</span>
              </div>
              <div className="space-y-1">
                {category.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="opacity-70 shrink-0 min-w-[70px]">{item.label}:</span>
                    <span className="font-medium break-all">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All Headers Toggle */}
      <button
        onClick={() => setShowAllHeaders(!showAllHeaders)}
        className={clsx(
          'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors',
          darkMode
            ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
        )}
      >
        <span className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5" />
          All Headers ({filteredHeaders.length})
        </span>
        {showAllHeaders ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>

      {/* All Headers List */}
      {showAllHeaders && (
        <div
          className={clsx(
            'rounded border divide-y max-h-48 overflow-y-auto',
            darkMode
              ? 'bg-slate-800 border-slate-700 divide-slate-700'
              : 'bg-white border-slate-200 divide-slate-100'
          )}
        >
          {filteredHeaders.map((header, idx) => (
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
                className={clsx(
                  'flex-1 p-2 break-all',
                  darkMode ? 'text-slate-300' : 'text-slate-700'
                )}
              >
                {header.value || '-'}
              </span>
            </div>
          ))}
        </div>
      )}

      {categories.length === 0 && filteredHeaders.length === 0 && (
        <p className={clsx('text-xs italic', darkMode ? 'text-slate-500' : 'text-slate-400')}>
          No headers available
        </p>
      )}
    </div>
  );
}
