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

// Calculate chain score based on redirect path
export function calculateChainScore(path: RedirectItem[]): ChainScore {
  const issues: ChainIssue[] = [];
  const recommendations: string[] = [];
  let score = 100;

  const redirectCount = path.filter(
    p => p.type === 'server_redirect' || p.type === 'client_redirect'
  ).length;

  // Deduct points for each redirect (SEO impact ~15% per hop)
  if (redirectCount > 0) {
    score -= redirectCount * 10;
  }

  // Check for too many redirects
  if (redirectCount > 3) {
    issues.push({
      type: 'error',
      message: `Too many redirects (${redirectCount}). Each redirect loses ~15% link equity.`,
      impact: 'high',
    });
    recommendations.push('Reduce redirect chain to maximum 2 hops');
    score -= 15;
  } else if (redirectCount > 1) {
    issues.push({
      type: 'warning',
      message: `${redirectCount} redirects in chain. Consider reducing.`,
      impact: 'medium',
    });
  }

  // Check for 302 (temporary) redirects that should be 301
  const tempRedirects = path.filter(p => p.status_code === 302 || p.status_code === 307);
  if (tempRedirects.length > 0) {
    issues.push({
      type: 'warning',
      message: `${tempRedirects.length} temporary redirect(s) found. Consider using 301 for permanent moves.`,
      impact: 'medium',
    });
    recommendations.push('Change 302 redirects to 301 if the move is permanent');
    score -= tempRedirects.length * 5;
  }

  // Check for client-side redirects
  const clientRedirects = path.filter(p => p.type === 'client_redirect');
  if (clientRedirects.length > 0) {
    issues.push({
      type: 'error',
      message: `${clientRedirects.length} client-side redirect(s) detected. These are bad for SEO.`,
      impact: 'high',
    });
    recommendations.push('Replace JavaScript/meta redirects with server-side 301 redirects');
    score -= clientRedirects.length * 15;
  }

  // Check for 4xx or 5xx errors
  const errors = path.filter(p => p.status_code >= 400);
  if (errors.length > 0) {
    issues.push({
      type: 'error',
      message: `${errors.length} error response(s) in chain.`,
      impact: 'high',
    });
    score -= errors.length * 20;
  }

  // Check for HTTPS
  const hasHttp = path.some(p => p.url.startsWith('http://'));
  if (hasHttp) {
    issues.push({
      type: 'warning',
      message: 'Non-HTTPS URL detected in chain.',
      impact: 'medium',
    });
    recommendations.push('Ensure all URLs use HTTPS');
    score -= 10;
  }

  // Perfect chain bonus
  if (redirectCount === 0 && issues.length === 0) {
    issues.push({
      type: 'info',
      message: 'Perfect! Direct access with no redirects.',
      impact: 'low',
    });
  } else if (redirectCount === 1) {
    const redirectItem = path.find(
      p => p.type === 'server_redirect' || p.type === 'client_redirect'
    );
    if (redirectItem?.status_code === 301 || redirectItem?.status_code === 308) {
      issues.push({
        type: 'info',
        message: 'Good! Single permanent redirect.',
        impact: 'low',
      });
    }
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Determine grade
  let grade: ChainScore['grade'];
  if (score >= 90) grade = 'A';
  else if (score >= 75) grade = 'B';
  else if (score >= 60) grade = 'C';
  else if (score >= 40) grade = 'D';
  else grade = 'F';

  return { score, grade, issues, recommendations };
}
