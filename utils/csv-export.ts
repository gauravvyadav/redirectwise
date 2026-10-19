import { format } from 'date-fns';
import type { HistoryEntry, RedirectItem } from '../types/redirect';

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCsvContent(path: RedirectItem[]): string {
  const headers = [
    'Hop',
    'Status Code',
    'URL',
    'IP',
    'Type',
    'Redirect Type',
    'Redirect URL',
    'Duration (ms)',
  ];

  const rows = path.map((item, idx) => {
    let redirectType = item.redirect_type || '';
    if (item.status_code === 301 || item.status_code === 308) {
      redirectType = 'permanent';
    } else if (item.status_code > 301 && item.status_code < 400) {
      redirectType = 'temporary';
    }

    const redirectUrl = item.redirect_url || '';
    const duration = item.timing?.duration ? Math.round(item.timing.duration) : '';

    return [
      idx + 1,
      item.status_code,
      item.url,
      item.ip || 'Unknown',
      item.type,
      redirectType,
      redirectUrl,
      duration,
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  // Prepend \uFEFF UTF-8 Byte Order Mark for universal Excel & spreadsheet compatibility
  return '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
}

export function exportToCSV(
  entry: { path: RedirectItem[]; id?: string; timestamp?: number },
  filename?: string
): void {
  try {
    const csvContent = generateCsvContent(entry.path || []);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const idPart = entry.id ? `${entry.id.substring(0, 8)}-` : '';
    const datePart = format(entry.timestamp || Date.now(), 'yyyy-MM-dd-HH-mm');
    link.download = filename || `redirectwise-${idPart}${datePart}.csv`;

    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    }, 1000);
  } catch (err) {
    console.error('[RedirectWise] Failed to download CSV:', err);
  }
}

export function exportHistoryToCSV(entries: HistoryEntry[], filename?: string): void {
  try {
    const headers = [
      'Session ID',
      'Date',
      'Total Hops',
      'Redirects',
      'Original URL',
      'Final URL',
      'Total Time (ms)',
      'Is Favorite',
    ];

    const rows = entries.map(e => {
      const actualRedirects =
        e.path?.filter(
          p =>
            p.type === 'server_redirect' ||
            p.type === 'client_redirect' ||
            (p.status_code >= 300 && p.status_code < 400)
        ).length ?? e.redirectCount;

      return [
        e.id || '',
        format(e.timestamp || Date.now(), 'yyyy-MM-dd HH:mm:ss'),
        Math.max(1, e.path?.length || 1),
        actualRedirects,
        e.originalUrl || e.path?.[0]?.url || '',
        e.finalUrl || e.path?.[e.path.length - 1]?.url || '',
        e.totalTime ? Math.round(e.totalTime) : 0,
        e.isFavorite ? 'Yes' : 'No',
      ]
        .map(escapeCsvCell)
        .join(',');
    });

    const csvContent = '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `redirectwise-history-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    }, 1000);
  } catch (err) {
    console.error('[RedirectWise] Failed to download history CSV:', err);
  }
}
