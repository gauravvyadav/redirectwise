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
  chainScore: ChainScore;
  totalTime: number;
  redirectCount: number;
  tags?: string[];
  notes?: string;
  isFavorite?: boolean;
}

// Chain score for SEO analysis
export interface ChainScore {
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: ChainIssue[];
  recommendations: string[];
}

export interface ChainIssue {
  type: 'warning' | 'error' | 'info';
  message: string;
  impact: 'high' | 'medium' | 'low';
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

export function calculateChainScore(path: RedirectItem[]): ChainScore {
  const issues: ChainIssue[] = [];
  const recommendations: string[] = [];
  let score = 100;

  const TRACKING_DOMAINS = [
    'bit.ly',
    't.co',
    'goo.gl',
    'rb.gy',
    'tinyurl.com',
    'ow.ly',
    'buff.ly',
    'is.gd',
    'cutt.ly',
    'shorturl.at',
    'tiny.cc',
    'lnkd.in',
    'fb.me',
    'youtu.be',
    'amzn.to',
    'g.co',
  ];

  const isTrackingDomain = (url: string): boolean => {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return TRACKING_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
    } catch {
      return false;
    }
  };

  const redirects = path.filter(p => p.type === 'server_redirect' || p.type === 'client_redirect');
  const redirectCount = redirects.length;
  const trackingRedirectCount = redirects.filter(r => isTrackingDomain(r.url)).length;
  const regularRedirectCount = redirectCount - trackingRedirectCount;

  const totalTime = calculateTotalDuration(path);
  const slowRedirects = path.filter(p => (p.timing?.duration || 0) > 1000);

  if (regularRedirectCount > 0) {
    score -= regularRedirectCount * 5;
  }
  if (trackingRedirectCount > 0) {
    score -= trackingRedirectCount * 2;
    issues.push({
      type: 'info',
      message: `${trackingRedirectCount} tracking redirect(s) detected (expected for ads/analytics).`,
      impact: 'low',
    });
  }

  if (redirectCount > 3) {
    issues.push({
      type: 'error',
      message: `Long chain: ${redirectCount} redirects. Each hop loses ~5% link equity.`,
      impact: 'high',
    });
    recommendations.push('Reduce redirect chain to 2-3 hops maximum');
    score -= 10;
  } else if (redirectCount > 1) {
    issues.push({
      type: 'warning',
      message: `${redirectCount} redirects in chain.`,
      impact: 'medium',
    });
  }

  const tempRedirects = path.filter(p => p.status_code === 302 || p.status_code === 307);
  if (tempRedirects.length > 0) {
    issues.push({
      type: 'warning',
      message: `${tempRedirects.length} temporary redirect(s). Use 301 for permanent moves.`,
      impact: 'medium',
    });
    recommendations.push('Change 302/307 to 301/308 if the move is permanent');
    score -= tempRedirects.length * 3;
  }

  const clientRedirects = path.filter(p => p.type === 'client_redirect');
  if (clientRedirects.length > 0) {
    issues.push({
      type: 'error',
      message: `${clientRedirects.length} client-side redirect(s). Bad for SEO and slow.`,
      impact: 'high',
    });
    recommendations.push('Replace meta/JavaScript redirects with server-side 301');
    score -= clientRedirects.length * 10;
  }

  const errors = path.filter(p => p.status_code >= 400);
  if (errors.length > 0) {
    issues.push({
      type: 'error',
      message: `${errors.length} error response(s) in chain.`,
      impact: 'high',
    });
    score -= errors.length * 20;
  }

  const hasHttp = path.some(p => p.url.startsWith('http://'));
  if (hasHttp) {
    issues.push({
      type: 'warning',
      message: 'Non-HTTPS URL detected.',
      impact: 'medium',
    });
    recommendations.push('Ensure all URLs use HTTPS');
    score -= 10;
  }

  if (totalTime > 0 && totalTime < 500 && redirectCount > 0) {
    score += 5;
    issues.push({
      type: 'info',
      message: `Fast chain: ${formatDuration(totalTime, { style: 'long' })} total.`,
      impact: 'low',
    });
  }
  if (slowRedirects.length > 0) {
    issues.push({
      type: 'warning',
      message: `${slowRedirects.length} slow redirect(s) (>1 second each).`,
      impact: 'medium',
    });
    score -= slowRedirects.length * 5;
  }

  if (redirectCount === 0 && issues.filter(i => i.type !== 'info').length === 0) {
    issues.push({
      type: 'info',
      message: 'Perfect! Direct access with no redirects.',
      impact: 'low',
    });
  } else if (redirectCount === 1) {
    const redirectItem = redirects[0];
    if (redirectItem?.status_code === 301 || redirectItem?.status_code === 308) {
      issues.push({
        type: 'info',
        message: 'Single permanent redirect (minimal SEO impact).',
        impact: 'low',
      });
    }
  }

  score = Math.max(0, Math.min(100, score));

  let grade: ChainScore['grade'];
  if (score >= 90) grade = 'A';
  else if (score >= 75) grade = 'B';
  else if (score >= 60) grade = 'C';
  else if (score >= 40) grade = 'D';
  else grade = 'F';

  return { score, grade, issues, recommendations };
}
