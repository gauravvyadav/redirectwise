import { useState } from 'react';
import { Copy, FileSpreadsheet, Check, FileDown } from 'lucide-react';
import { RedirectItem } from '../types/redirect';
import clsx from 'clsx';

interface CopyButtonsProps {
  redirectPath: RedirectItem[];
  darkMode?: boolean;
  onExportPDF?: () => Promise<void>;
}

type CopyFormat = 'text' | 'csv';

export default function CopyButtons({ redirectPath, darkMode = false, onExportPDF }: CopyButtonsProps) {
  const [copiedFormat, setCopiedFormat] = useState<CopyFormat | null>(null);
  const [exporting, setExporting] = useState(false);

  const generateTextOutput = (): string => {
    return redirectPath.map((item, idx) => {
      let statusString = `${item.status_code}: ${item.status_line}`;
      
      if (item.type === 'server_redirect') {
        const redirectType = item.redirect_type === 'permanent' 
          ? 'Permanent' 
          : item.redirect_type === 'hsts' 
            ? 'HSTS' 
            : 'Temporary';
        statusString = `${item.status_code}: ${redirectType} redirect to ${item.redirect_url}`;
      }
      
      return `${idx + 1}. ${item.url} - ${statusString}`;
    }).join('\n');
  };

  const generateCsvOutput = (): string => {
    const headers = 'Status Code\tURL\tIP\tPage Type\tRedirect Type\tRedirect URL';
    
    const rows = redirectPath.map(item => {
      let redirectType = item.redirect_type || '';
      if (item.status_code === 301 || item.status_code === 308) {
        redirectType = 'permanent';
      } else if (item.status_code > 301 && item.status_code < 400) {
        redirectType = 'temporary';
      }
      
      const redirectUrl = item.redirect_url || 'none';
      
      return [
        item.status_code,
        item.url,
        item.ip || 'Unknown',
        item.type,
        redirectType,
        redirectUrl
      ].join('\t');
    });
    
    return [headers, ...rows].join('\n');
  };

  const handleCopy = async (format: CopyFormat) => {
    try {
      const content = format === 'text' 
        ? generateTextOutput() 
        : generateCsvOutput();
      
      await navigator.clipboard.writeText(content);
      setCopiedFormat(format);
      
      // Reset after 2 seconds
      setTimeout(() => {
        setCopiedFormat(null);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleExportPDF = async () => {
    if (exporting || !onExportPDF) return;
    
    setExporting(true);
    try {
      await onExportPDF();
    } catch (error) {
      console.error('Failed to export PDF:', error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={clsx(
      "flex items-center gap-2 px-4 py-2 border-b",
      darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
    )}>
      <span className={clsx("text-xs mr-auto", darkMode ? "text-slate-400" : "text-slate-500")}>
        Copy path as:
      </span>
      
      <button
        onClick={() => handleCopy('text')}
        className={clsx(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
          copiedFormat === 'text'
            ? 'bg-green-100 text-green-700'
            : darkMode 
              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        )}
      >
        {copiedFormat === 'text' ? (
          <>
            <Check className="w-3.5 h-3.5" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            Text
          </>
        )}
      </button>
      
      <button
        onClick={() => handleCopy('csv')}
        className={clsx(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
          copiedFormat === 'csv'
            ? 'bg-green-100 text-green-700'
            : darkMode 
              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        )}
      >
        {copiedFormat === 'csv' ? (
          <>
            <Check className="w-3.5 h-3.5" />
            Copied!
          </>
        ) : (
          <>
            <FileSpreadsheet className="w-3.5 h-3.5" />
            CSV
          </>
        )}
      </button>

      {onExportPDF && (
        <>
          <div className={clsx("w-px h-5", darkMode ? "bg-slate-600" : "bg-slate-300")} />

          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              exporting
                ? 'bg-blue-100 text-blue-700 cursor-wait'
                : darkMode 
                  ? 'bg-blue-600 text-white hover:bg-blue-500'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
            )}
          >
            <FileDown className={clsx("w-3.5 h-3.5", exporting && "animate-bounce")} />
            {exporting ? 'Exporting...' : 'PDF'}
          </button>
        </>
      )}
    </div>
  );
}
