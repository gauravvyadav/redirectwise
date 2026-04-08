import clsx from 'clsx';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronRight, XCircle } from 'lucide-react';
import { useState } from 'react';
import { ChainScore } from '../types/redirect';

interface ChainScoreCardProps {
  score: ChainScore;
  darkMode?: boolean;
}

export default function ChainScoreCard({ score, darkMode = false }: ChainScoreCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getGradeColor = () => {
    switch (score.grade) {
      case 'A':
        return 'text-green-500';
      case 'B':
        return 'text-lime-500';
      case 'C':
        return 'text-amber-500';
      case 'D':
        return 'text-orange-500';
      case 'F':
        return 'text-red-500';
    }
  };

  const getIssueIcon = (type: 'error' | 'warning' | 'info') => {
    switch (type) {
      case 'error':
        return <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
      case 'info':
        return <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />;
    }
  };

  const getGradeDescription = () => {
    switch (score.grade) {
      case 'A':
        return chrome.i18n.getMessage('scoreGradeA');
      case 'B':
        return chrome.i18n.getMessage('scoreGradeB');
      case 'C':
        return chrome.i18n.getMessage('scoreGradeC');
      case 'D':
        return chrome.i18n.getMessage('scoreGradeD');
      case 'F':
        return chrome.i18n.getMessage('scoreGradeF');
    }
  };

  // Filter issues (exclude info for count display)
  const filteredIssues = score.issues.filter(issue => issue.type !== 'info');
  const hasIssues = filteredIssues.length > 0;

  return (
    <div
      className={clsx(
        'mx-3 mt-3 rounded-lg overflow-hidden',
        darkMode ? 'bg-slate-800/50' : 'bg-slate-100'
      )}
    >
      {/* Compact One-liner Header */}
      <button
        onClick={() => hasIssues && setIsExpanded(!isExpanded)}
        className={clsx(
          'w-full flex items-center gap-2 px-3 py-2',
          hasIssues && 'cursor-pointer hover:opacity-80 transition-opacity'
        )}
        disabled={!hasIssues}
      >
        {/* Grade Letter */}
        <span className={clsx('text-lg font-bold', getGradeColor())}>{score.grade}</span>

        <span className={clsx('text-xs', darkMode ? 'text-slate-600' : 'text-slate-400')}>-</span>

        {/* Score */}
        <span
          className={clsx('text-sm font-medium', darkMode ? 'text-slate-300' : 'text-slate-700')}
        >
          {score.score}
        </span>

        <span className={clsx('text-xs', darkMode ? 'text-slate-600' : 'text-slate-400')}>-</span>

        {/* Description (truncated) */}
        <span
          className={clsx(
            'text-xs flex-1 text-left truncate',
            darkMode ? 'text-slate-400' : 'text-slate-600'
          )}
        >
          {getGradeDescription()}
        </span>

        {/* Issue count tag + chevron */}
        {hasIssues && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={clsx(
                'text-xs px-2 py-0.5 rounded-full font-medium',
                darkMode
                  ? 'bg-slate-700/50 text-slate-300 border border-slate-600/50'
                  : 'bg-slate-200/70 text-slate-600 border border-slate-300/50'
              )}
              title={filteredIssues.map(issue => `• ${issue.message}`).join('\n')}
            >
              {filteredIssues.length} {filteredIssues.length === 1 ? chrome.i18n.getMessage('scoreIssueSingle') : chrome.i18n.getMessage('scoreIssuePlural')}
            </span>
            {isExpanded ? (
              <ChevronDown
                className={clsx('w-4 h-4', darkMode ? 'text-slate-500' : 'text-slate-400')}
              />
            ) : (
              <ChevronRight
                className={clsx('w-4 h-4', darkMode ? 'text-slate-500' : 'text-slate-400')}
              />
            )}
          </div>
        )}
      </button>

      {/* Expandable Issues Section */}
      {isExpanded && hasIssues && (
        <div
          className={clsx(
            'border-t px-3 py-2',
            darkMode ? 'border-slate-700/50' : 'border-slate-200'
          )}
        >
          <div className="space-y-1.5">
            {filteredIssues.map((issue, idx) => (
              <div key={idx} className="flex items-start gap-2">
                {getIssueIcon(issue.type)}
                <span className={clsx('text-xs', darkMode ? 'text-slate-300' : 'text-slate-700')}>
                  {issue.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
