import { useState } from 'react';
import { RedirectItem } from '../types/redirect';
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
  const totalTime = items.reduce((acc, item) => acc + (item.timing?.duration || 0), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-medium uppercase tracking-wide ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Redirect Path ({items.length} {items.length === 1 ? 'step' : 'steps'})
        </span>
        {totalTime > 0 && (
          <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Total: {totalTime}ms
          </span>
        )}
      </div>
      
      <div className="relative">
        {/* Vertical line connecting items */}
        {items.length > 1 && (
          <div className={`absolute left-4 top-6 bottom-6 w-0.5 z-0 ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
        )}
        
        <div className="space-y-2 relative z-10">
          {items.map((item, index) => (
            <RedirectItemCard
              key={item.id}
              item={item}
              index={index}
              isLast={index === items.length - 1}
              isExpanded={expandedId === item.id}
              onToggle={() => handleToggle(item.id)}
              darkMode={darkMode}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
