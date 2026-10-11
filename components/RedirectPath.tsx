import { Clock } from 'lucide-react';
import { Fragment, useState } from 'react';
import type { RedirectItem } from '../types/redirect';
import { calculateGapDuration, calculateTotalDuration, formatDuration } from '../types/redirect';
import { t } from '../utils/i18n';
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

  const totalTime = calculateTotalDuration(items);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between pb-1">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
          {t('redirectChain')} // {items.length} {items.length === 1 ? t('stepSingle') : t('stepsLabel')}
        </span>
        {totalTime > 0 && (
          <span className="h-6 inline-flex items-center font-mono text-[10px] font-bold tracking-[0.12em] text-ink px-2 border border-line bg-paper-card">
            {t('timeLabel')}: {formatDuration(totalTime)}
          </span>
        )}
      </div>

      <div className="relative">
        {/* Hairline 1px connecting rule */}
        {items.length > 1 && (
          <div className="absolute left-1/2 -translate-x-1/2 top-6 bottom-6 w-px z-0 bg-line" />
        )}

        <div className="flex flex-col gap-2 relative z-10">
          {items.map((item, index) => {
            const delayMs = index > 0 ? calculateGapDuration(items[index - 1], item) : null;

            return (
              <Fragment key={item.id}>
                {index > 0 && delayMs != null && (
                  <div className="flex justify-center py-0.5 relative z-20">
                    <span
                      className="h-6 inline-flex items-center font-mono text-[10px] font-bold uppercase tracking-[0.14em] px-2 border border-line bg-paper-subtle text-stone gap-1.5"
                      title={t('gapDurationDesc')}
                    >
                      <Clock className="w-3 h-3 text-stone" />+{formatDuration(delayMs)} {t('gapLabel')}
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
