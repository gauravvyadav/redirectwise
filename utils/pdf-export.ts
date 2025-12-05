// PDF Export utility with beautiful design

import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ChainScore, HistoryEntry, RedirectItem } from '../types/redirect';

interface PDFExportOptions {
  title?: string;
  includeHeaders?: boolean;
  includeScore?: boolean;
  includeRecommendations?: boolean;
}

const COLORS = {
  primary: [59, 130, 246] as [number, number, number], // Blue
  success: [34, 197, 94] as [number, number, number], // Green
  warning: [245, 158, 11] as [number, number, number], // Amber
  error: [239, 68, 68] as [number, number, number], // Red
  dark: [30, 41, 59] as [number, number, number], // Slate-800
  light: [241, 245, 249] as [number, number, number], // Slate-100
  white: [255, 255, 255] as [number, number, number],
};

// Load logo as base64 for PDF embedding
async function loadLogoAsBase64(): Promise<string | null> {
  try {
    const logoUrl = chrome.runtime.getURL('icons/icon-128.png');
    const response = await fetch(logoUrl);
    const blob = await response.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Draw a simple logo as fallback when PNG fails to load
function drawFallbackLogo(doc: jsPDF): void {
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(15, 10, 25, 25, 3, 3, 'F');
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(1.5);
  doc.line(21, 29, 33, 17); // Diagonal line
  doc.line(33, 17, 25, 17); // Top horizontal
  doc.line(33, 17, 33, 25); // Right vertical
}

function getGradeColor(grade: ChainScore['grade']): [number, number, number] {
  switch (grade) {
    case 'A':
      return COLORS.success;
    case 'B':
      return [132, 204, 22]; // Lime
    case 'C':
      return COLORS.warning;
    case 'D':
      return [249, 115, 22]; // Orange
    case 'F':
      return COLORS.error;
  }
}

function getStatusColor(statusCode: number): [number, number, number] {
  if (statusCode >= 200 && statusCode < 300) return COLORS.success;
  if (statusCode >= 300 && statusCode < 400) return COLORS.warning;
  if (statusCode >= 400) return COLORS.error;
  return COLORS.dark;
}

export async function exportToPDF(
  entry: HistoryEntry,
  options: PDFExportOptions = {}
): Promise<void> {
  const {
    title = 'Redirect Chain Analysis',
    includeHeaders = true,
    includeScore = true,
    includeRecommendations = true,
  } = options;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Load logo
  const logoBase64 = await loadLogoAsBase64();

  // Helper to add new page if needed
  const checkNewPage = (requiredSpace: number) => {
    if (yPos + requiredSpace > 270) {
      doc.addPage();
      yPos = 20;
    }
  };

  // ========== HEADER ==========
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 45, 'F');

  // Logo - use PNG logo from extension
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 15, 10, 25, 25);
    } catch {
      // Fallback to drawn logo
      drawFallbackLogo(doc);
    }
  } else {
    drawFallbackLogo(doc);
  }

  // Title
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('RedirectWise', 48, 22);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 48, 32);

  // Date
  doc.setFontSize(10);
  doc.text(format(entry.timestamp, "MMMM d, yyyy 'at' h:mm a"), pageWidth - 15, 22, {
    align: 'right',
  });
  doc.text(`Report ID: ${entry.id.substring(0, 8)}`, pageWidth - 15, 32, { align: 'right' });

  yPos = 55;

  // ========== SUMMARY BOX ==========
  doc.setFillColor(...COLORS.light);
  doc.roundedRect(15, yPos, pageWidth - 30, 50, 3, 3, 'F');

  // Chain Score Circle
  const scoreX = 45;
  const scoreY = yPos + 25;
  const gradeColor = getGradeColor(entry.chainScore.grade);

  doc.setFillColor(...gradeColor);
  doc.circle(scoreX, scoreY, 18, 'F');

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(entry.chainScore.grade, scoreX, scoreY + 2, { align: 'center' });

  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(11);
  doc.text(`Score: ${entry.chainScore.score}/100`, scoreX, scoreY + 28, { align: 'center' });

  // Summary stats
  const statsX = 85;
  const maxTextWidth = pageWidth - statsX - 55; // Leave room for right side stats

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('ORIGINAL URL', statsX, yPos + 12);
  doc.setTextColor(...COLORS.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const originalLines = doc.splitTextToSize(entry.originalUrl, maxTextWidth);
  doc.text(originalLines.slice(0, 2).join('\n'), statsX, yPos + 19);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('FINAL URL', statsX, yPos + 32);
  doc.setTextColor(...COLORS.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const finalLines = doc.splitTextToSize(entry.finalUrl, maxTextWidth);
  doc.text(finalLines.slice(0, 2).join('\n'), statsX, yPos + 39);

  // Right side stats
  const rightX = pageWidth - 45;
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.dark);
  doc.text(`${entry.redirectCount}`, rightX, yPos + 20, { align: 'center' });
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('Redirects', rightX, yPos + 28, { align: 'center' });

  doc.setFontSize(18);
  doc.setTextColor(...COLORS.dark);
  doc.text(`${entry.path.length}`, rightX, yPos + 42, { align: 'center' });
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('Total Hops', rightX, yPos + 50, { align: 'center' });

  yPos += 60;

  // ========== REDIRECT PATH TABLE ==========
  checkNewPage(60);
  yPos += 10;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text('Redirect Chain Details', 15, yPos);
  yPos += 10;

  const tableData = entry.path.map((item, idx) => {
    const statusLabel = getStatusLabel(item);
    const timing = item.timing?.duration ? `${item.timing.duration}ms` : '-';
    return [
      (idx + 1).toString(),
      item.status_code.toString(),
      statusLabel,
      item.url, // Full URL - autoTable will handle wrapping
      item.ip || '-',
      timing,
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'Status', 'Type', 'URL', 'IP', 'Time']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 11,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: COLORS.dark,
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 14, halign: 'center' },
      2: { cellWidth: 22 },
      3: {
        cellWidth: 'auto',
        overflow: 'linebreak',
        cellPadding: { top: 3, right: 2, bottom: 3, left: 2 },
      }, // Full URL with word wrap
      4: { cellWidth: 25 },
      5: { cellWidth: 16, halign: 'right' },
    },
    styles: {
      overflow: 'linebreak',
      cellWidth: 'wrap',
    },
    didParseCell: data => {
      // Color status codes
      if (data.section === 'body' && data.column.index === 1) {
        const statusCode = parseInt(data.cell.raw as string);
        data.cell.styles.textColor = getStatusColor(statusCode);
        data.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: 15, right: 15 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // ========== ISSUES & RECOMMENDATIONS ==========
  if (includeScore && entry.chainScore.issues.length > 0) {
    checkNewPage(50);

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('Analysis & Issues', 15, yPos);
    yPos += 12;

    entry.chainScore.issues.forEach(issue => {
      checkNewPage(18);

      const iconColor =
        issue.type === 'error'
          ? COLORS.error
          : issue.type === 'warning'
          ? COLORS.warning
          : COLORS.success;

      doc.setFillColor(...iconColor);
      doc.circle(20, yPos - 2, 4, 'F');

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.dark);
      doc.text(issue.message, 30, yPos);

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Impact: ${issue.impact.toUpperCase()}`, 30, yPos + 6);

      yPos += 16;
    });
  }

  if (includeRecommendations && entry.chainScore.recommendations.length > 0) {
    checkNewPage(50);
    yPos += 5;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('Recommendations', 15, yPos);
    yPos += 12;

    entry.chainScore.recommendations.forEach((rec, idx) => {
      checkNewPage(14);

      doc.setFillColor(...COLORS.primary);
      doc.circle(20, yPos - 2, 4, 'F');
      doc.setTextColor(...COLORS.white);
      doc.setFontSize(9);
      doc.text((idx + 1).toString(), 20, yPos - 0.5, { align: 'center' });

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.dark);
      doc.text(rec, 30, yPos);

      yPos += 12;
    });
  }

  // ========== FOOTER ==========
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...COLORS.light);
    doc.rect(0, 282, pageWidth, 15, 'F');

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Generated by RedirectWise - Redirect Path Analyzer', 15, 290);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 15, 290, { align: 'right' });
  }

  // Save the PDF
  const filename = `redirectwise-${entry.id.substring(0, 8)}-${format(
    entry.timestamp,
    'yyyy-MM-dd'
  )}.pdf`;
  doc.save(filename);
}

function getStatusLabel(item: RedirectItem): string {
  if (item.type === 'server_redirect') {
    if (item.redirect_type === 'permanent') return 'Permanent (301/308)';
    if (item.redirect_type === 'hsts') return 'HSTS Redirect';
    return 'Temporary (302/307)';
  }
  if (item.type === 'client_redirect') {
    return `Client (${item.redirect_type?.toUpperCase() || 'JS'})`;
  }
  if (item.statusObject.isSuccess) return 'Final (Success)';
  if (item.statusObject.isClientError) return 'Client Error';
  if (item.statusObject.isServerError) return 'Server Error';
  return 'Navigation';
}

// Export multiple entries to PDF
export async function exportHistoryToPDF(entries: HistoryEntry[]): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('RedirectWise History Report', 15, 22);

  doc.setFontSize(12);
  doc.text(`${entries.length} entries • Generated ${format(new Date(), 'MMMM d, yyyy')}`, 15, 30);

  // Stats summary
  const avgScore = entries.reduce((acc, e) => acc + e.chainScore.score, 0) / entries.length;
  const totalRedirects = entries.reduce((acc, e) => acc + e.redirectCount, 0);

  doc.setFillColor(...COLORS.light);
  doc.roundedRect(15, 45, pageWidth - 30, 25, 3, 3, 'F');

  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(13);
  doc.text(`Average Score: ${Math.round(avgScore)}`, 25, 60);
  doc.text(`Total Redirects: ${totalRedirects}`, 100, 60);
  doc.text(`Entries: ${entries.length}`, pageWidth - 50, 60);

  // Table
  const tableData = entries.map(entry => [
    format(entry.timestamp, 'MM/dd/yy HH:mm'),
    entry.chainScore.grade,
    entry.redirectCount.toString(),
    entry.originalUrl, // Full URL
    entry.finalUrl, // Full URL
  ]);

  autoTable(doc, {
    startY: 80,
    head: [['Date', 'Grade', 'Redirects', 'Original URL', 'Final URL']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 11,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: COLORS.dark,
      cellPadding: 3,
    },
    styles: {
      overflow: 'linebreak',
      cellWidth: 'wrap',
    },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 12, halign: 'center' },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 'auto', overflow: 'linebreak' }, // Full URL with wrap
      4: { cellWidth: 'auto', overflow: 'linebreak' }, // Full URL with wrap
    },
    didParseCell: data => {
      if (data.section === 'body' && data.column.index === 1) {
        const grade = data.cell.raw as string;
        data.cell.styles.textColor = getGradeColor(grade as ChainScore['grade']);
        data.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: 15, right: 15 },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Generated by RedirectWise', 15, 290);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 15, 290, { align: 'right' });
  }

  doc.save(`redirectwise-history-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
