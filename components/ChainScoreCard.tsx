import clsx from 'clsx';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { ChainScore } from '../types/redirect';

interface ChainScoreCardProps {
  score: ChainScore;
  darkMode?: boolean;
}

export default function ChainScoreCard({ score, darkMode = false }: ChainScoreCardProps) {
  const getGradeColor = () => {
    switch (score.grade) {
      case 'A':
        return 'from-green-500 to-green-600';
      case 'B':
        return 'from-lime-500 to-lime-600';
      case 'C':
        return 'from-amber-500 to-amber-600';
      case 'D':
        return 'from-orange-500 to-orange-600';
      case 'F':
        return 'from-red-500 to-red-600';
    }
  };

  const getGradeBgColor = () => {
    switch (score.grade) {
      case 'A':
        return darkMode ? 'bg-green-900/30' : 'bg-green-50';
      case 'B':
        return darkMode ? 'bg-lime-900/30' : 'bg-lime-50';
      case 'C':
        return darkMode ? 'bg-amber-900/30' : 'bg-amber-50';
      case 'D':
        return darkMode ? 'bg-orange-900/30' : 'bg-orange-50';
      case 'F':
        return darkMode ? 'bg-red-900/30' : 'bg-red-50';
    }
  };

  const getIssueIcon = (type: 'error' | 'warning' | 'info') => {
    switch (type) {
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
      case 'info':
        return <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />;
    }
  };

  return (
    <div className={clsx('mx-3 mt-3 rounded-lg overflow-hidden', getGradeBgColor())}>
      {/* Score Header */}
      <div className="flex items-center gap-3 p-3">
        <div
          className={clsx(
            'w-14 h-14 rounded-xl bg-linear-to-br flex items-center justify-center text-white shadow-lg',
            getGradeColor()
          )}
        >
          <div className="text-center">
            <div className="text-2xl font-bold leading-none">{score.grade}</div>
            <div className="text-xs opacity-80">{score.score}</div>
          </div>
        </div>

        <div className="flex-1">
          <h3 className={clsx('font-semibold', darkMode ? 'text-slate-200' : 'text-slate-800')}>
            Chain Health Score
          </h3>
          <p className={clsx('text-sm', darkMode ? 'text-slate-400' : 'text-slate-600')}>
            {score.grade === 'A' && 'Excellent! Optimal redirect chain.'}
            {score.grade === 'B' && 'Good. Minor improvements possible.'}
            {score.grade === 'C' && 'Fair. Some issues to address.'}
            {score.grade === 'D' && 'Poor. Significant issues found.'}
            {score.grade === 'F' && 'Critical. Major problems detected.'}
          </p>
        </div>
      </div>

      {/* Issues - only show warnings and errors, not info messages */}
      {score.issues.filter(issue => issue.type !== 'info').length > 0 && (
        <div
          className={clsx(
            'border-t px-3 py-2',
            darkMode ? 'border-slate-700/50' : 'border-slate-200/50'
          )}
        >
          <div className="space-y-1.5">
            {score.issues
              .filter(issue => issue.type !== 'info')
              .slice(0, 3)
              .map((issue, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  {getIssueIcon(issue.type)}
                  <span className={clsx('text-xs', darkMode ? 'text-slate-300' : 'text-slate-700')}>
                    {issue.message}
                  </span>
                </div>
              ))}
            {score.issues.filter(issue => issue.type !== 'info').length > 3 && (
              <p className={clsx('text-xs', darkMode ? 'text-slate-500' : 'text-slate-400')}>
                +{score.issues.filter(issue => issue.type !== 'info').length - 3} more issues
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
