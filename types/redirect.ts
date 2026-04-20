// Types for redirect tracking

export interface RedirectHeader {
  name: string;
  value: string;
}

export interface RedirectItem {
  id: string;
  url: string;
  status_code: number;
  status_line: string;
  ip: string;
  type: 'navigation' | 'server_redirect' | 'client_redirect';
  redirect_type?: 'permanent' | 'temporary' | 'meta' | 'javascript' | 'hsts';
  redirect_url?: string;
  headers: RedirectHeader[];
  timestamp: number;
  timing?: RedirectTiming;
  statusObject: {
    isSuccess: boolean;
    isRedirect: boolean;
    isClientError: boolean;
    isServerError: boolean;
    classes: string[];
  };
}

export interface RedirectTiming {
  startTime: number;
  endTime: number;
  duration: number;
}

export function formatDuration(
  durationMs?: number | null,
  options: { style?: 'compact' | 'long'; fallback?: string } = {}
): string {
  const { style = 'compact', fallback = '-' } = options;

  if (durationMs == null || !Number.isFinite(durationMs)) return fallback;

  const duration = Math.max(0, durationMs);

  if (duration < 1000) {
    const roundedMs = Math.round(duration);
    return style === 'long'
      ? `${roundedMs} ${roundedMs === 1 ? 'millisecond' : 'milliseconds'}`
      : `${roundedMs} ms`;
  }

  if (duration < 60000) {
    const seconds = duration / 1000;
    const roundedSeconds = seconds < 10 ? Math.round(seconds * 10) / 10 : Math.round(seconds);
    const formattedSeconds = Number.isInteger(roundedSeconds)
      ? roundedSeconds.toString()
      : roundedSeconds.toFixed(1);

    return style === 'long'
      ? `${formattedSeconds} ${roundedSeconds === 1 ? 'second' : 'seconds'}`
      : `${formattedSeconds} sec`;
  }

  const minutes = duration / 60000;
  const roundedMinutes = minutes < 10 ? Math.round(minutes * 10) / 10 : Math.round(minutes);
  const formattedMinutes = Number.isInteger(roundedMinutes)
    ? roundedMinutes.toString()
    : roundedMinutes.toFixed(1);

  return style === 'long'
    ? `${formattedMinutes} ${roundedMinutes === 1 ? 'minute' : 'minutes'}`
    : `${formattedMinutes} min`;
}

export function calculateTotalDuration(path: Pick<RedirectItem, 'timing'>[]): number {
  return path.reduce((sum, item) => sum + (item.timing?.duration || 0), 0);
}

export function calculateGapDuration(
  previousItem?: Pick<RedirectItem, 'timing' | 'timestamp'>,
  currentItem?: Pick<RedirectItem, 'timing' | 'timestamp'>
): number | null {
  if (currentItem?.timing && previousItem?.timing) {
    return Math.max(0, currentItem.timing.startTime - previousItem.timing.endTime);
  }

  if (currentItem?.timestamp && previousItem?.timestamp) {
    return Math.max(0, currentItem.timestamp - previousItem.timestamp);
  }

  return null;
}

export interface TabRedirectPath {
  tabId: number;
  path: RedirectItem[];
  startTime: number;
}

export interface RedirectMessage {
  name: string;
  tabId?: number;
  path?: RedirectItem[];
  historyId?: string;
}

export type RedirectType = 'permanent' | 'temporary' | 'meta' | 'javascript' | 'hsts';

// History entry for persistent storage
export interface HistoryEntry {
  id: string;
  originalUrl: string;
  finalUrl: string;
  path: RedirectItem[];
  timestamp: number;
  totalTime: number;
  redirectCount: number;
  tags?: string[];
  notes?: string;
  isFavorite?: boolean;
}

export function getStatusObject(statusCode: number): RedirectItem['statusObject'] {
  const isSuccess = statusCode >= 200 && statusCode < 300;
  const isRedirect = statusCode >= 300 && statusCode < 400;
  const isClientError = statusCode >= 400 && statusCode < 500;
  const isServerError = statusCode >= 500;

  const classes: string[] = [];

  if (isSuccess) classes.push('status-success');
  if (isRedirect) classes.push('status-redirect');
  if (isClientError) classes.push('status-client-error');
  if (isServerError) classes.push('status-server-error');

  return {
    isSuccess,
    isRedirect,
    isClientError,
    isServerError,
    classes,
  };
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}
