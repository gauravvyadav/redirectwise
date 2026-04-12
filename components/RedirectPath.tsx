import clsx from 'clsx';
import { Clock } from 'lucide-react';
import { Fragment, useState } from 'react';
import {
  RedirectItem,
  calculateGapDuration,
  calculateTotalDuration,
  formatDuration,
} from '../types/redirect';
import RedirectItemCard from './RedirectItemCard';

interface RedirectPathProps {
  items: RedirectItem[];
  darkMode?: boolean;
}

export default function RedirectPath({ items, darkMode = false }: RedirectPathProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleToggle = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Calculate total time
  const totalTime = calculateTotalDuration(items);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <span
          className={`text-xs font-medium uppercase tracking-wide ${
            darkMode ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          Redirect Path ({items.length} {items.length === 1 ? 'step' : 'steps'})
        </span>
        {totalTime > 0 && (
          <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Total Request Time: {formatDuration(totalTime)}
          </span>
        )}
      </div>

      <div className="relative">
        {/* Vertical line connecting items */}
        {items.length > 1 && (
          <div
            className={`absolute left-[27px] top-6 bottom-6 w-0.5 z-0 ${
              darkMode ? 'bg-slate-700' : 'bg-slate-200'
            }`}
          />
        )}

        <div className="flex flex-col gap-2 relative z-10">
          {items.map((item, index) => {
            const delayMs = index > 0 ? calculateGapDuration(items[index - 1], item) : null;

            return (
              <Fragment key={item.id}>
                {index > 0 && delayMs != null && (
                  <div className="flex pl-16 py-1 relative z-20">
                    <span
                      className={clsx(
                        'text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 border',
                        darkMode
                          ? 'bg-slate-800 text-slate-400 border-slate-700'
                          : 'bg-white text-slate-500 border-slate-200'
                      )}
                      title={`Time passed between previous request finishing and this request starting`}
                    >
                      <Clock className="w-3 h-3" />
                      {formatDuration(delayMs)} gap
                    </span>
                  </div>
                )}
                <RedirectItemCard
                  item={item}
                  index={index}
                  isLast={index === items.length - 1}
                  isExpanded={expandedId === item.id}
                  onToggle={() => handleToggle(item.id)}
                  darkMode={darkMode}
                />
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
