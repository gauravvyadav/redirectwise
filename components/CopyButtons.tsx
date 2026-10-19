import clsx from 'clsx';
import { Check, Copy, FileDown, FileSpreadsheet, FileImage, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { RedirectItem } from '../types/redirect';
import { exportToCSV } from '../utils/csv-export';
import { t } from '../utils/i18n';

interface CopyButtonsProps {
  redirectPath: RedirectItem[];
  darkMode?: boolean;
  onExportPDF?: () => Promise<void>;
  onExportImage?: () => Promise<void>;
  onClear?: () => void;
}

export default function CopyButtons({
  redirectPath,
  onExportPDF,
  onExportImage,
  onClear,
}: CopyButtonsProps) {
  const [copiedText, setCopiedText] = useState(false);
  const [downloadedCsv, setDownloadedCsv] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingImage, setExportingImage] = useState(false);

  const generateTextOutput = (): string => {
    return redirectPath
      .map((item, idx) => {
        let statusString = `${item.status_code}: ${item.status_line}`;

        if (item.type === 'server_redirect') {
          const redirectType =
            item.redirect_type === 'permanent'
              ? 'Permanent'
              : item.redirect_type === 'hsts'
                ? 'HSTS'
                : 'Temporary';
          statusString = `${item.status_code}: ${redirectType} redirect to ${item.redirect_url}`;
        }

        return `${idx + 1}. ${item.url} - ${statusString}`;
      })
      .join('\n');
  };

  const handleCopyText = async () => {
    try {
      const content = generateTextOutput();
      await navigator.clipboard.writeText(content);
      setCopiedText(true);
      setTimeout(() => {
        setCopiedText(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const handleDownloadCsv = () => {
    try {
      exportToCSV({ path: redirectPath });
      setDownloadedCsv(true);
      setTimeout(() => {
        setDownloadedCsv(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to download CSV:', error);
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

  const handleExportImage = async () => {
    if (exportingImage || !onExportImage) return;

    setExportingImage(true);
    try {
      await onExportImage();
    } catch (error) {
      console.error('Failed to export image:', error);
    } finally {
      setExportingImage(false);
    }
  };

  return (
    <div className="w-full border-b border-line bg-line gap-px grid grid-cols-5">
      <button
        onClick={handleCopyText}
        className={clsx(
          'h-8.5 flex items-center justify-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-colors',
          copiedText
            ? 'bg-ok-bg text-ok'
            : 'bg-paper-card text-ink hover:bg-paper-subtle'
        )}
      >
        {copiedText ? (
          <>
            <Check className="w-3.5 h-3.5 text-ok" />
            {t('copied')}
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5 text-muted" />
            {t('textFormat')}
          </>
        )}
      </button>

      <button
        onClick={handleDownloadCsv}
        className={clsx(
          'h-8.5 flex items-center justify-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-colors',
          downloadedCsv
            ? 'bg-ok-bg text-ok'
            : 'bg-paper-card text-ink hover:bg-paper-subtle'
        )}
      >
        {downloadedCsv ? (
          <>
            <Check className="w-3.5 h-3.5 text-ok" />
            {t('csvFormat')}
          </>
        ) : (
          <>
            <FileSpreadsheet className="w-3.5 h-3.5 text-muted" />
            {t('csvFormat')}
          </>
        )}
      </button>

      {onExportPDF && (
        <button
          onClick={handleExportPDF}
          disabled={exporting}
          className={clsx(
            'h-8.5 flex items-center justify-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-colors',
            exporting
              ? 'bg-accent/15 text-accent cursor-wait'
              : 'bg-paper-card text-ink hover:bg-paper-subtle'
          )}
        >
          <FileDown className={clsx('w-3.5 h-3.5 text-accent', exporting && 'animate-bounce')} />
          {exporting
            ? t('exportingPdf')
            : t('pdfFormat')}
        </button>
      )}

      {onExportImage && (
        <button
          onClick={handleExportImage}
          disabled={exportingImage}
          className={clsx(
            'h-8.5 flex items-center justify-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-colors',
            exportingImage
              ? 'bg-accent/15 text-accent cursor-wait'
              : 'bg-paper-card text-ink hover:bg-paper-subtle'
          )}
        >
          <FileImage className={clsx('w-3.5 h-3.5 text-accent', exportingImage && 'animate-bounce')} />
          {exportingImage
            ? t('exportingImage')
            : t('imageFormat')}
        </button>
      )}

      {onClear && (
        <button
          onClick={onClear}
          className="h-8.5 flex items-center justify-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] bg-paper-card text-err hover:bg-err-bg transition-colors"
          title={t('headerClearPath')}
        >
          <Trash2 className="w-3.5 h-3.5" />
          {t('clearLabel')}
        </button>
      )}
    </div>
  );
}
