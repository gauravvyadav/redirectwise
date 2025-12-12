// PDF Export utility using pdf-lib (Pure TypeScript, no external deps)
import { format } from 'date-fns';
import { Color, PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib';
import { ChainScore, HistoryEntry, RedirectItem } from '../types/redirect';

interface PDFExportOptions {
  title?: string;
  includeHeaders?: boolean;
  includeScore?: boolean;
  includeRecommendations?: boolean;
}

const COLORS = {
  primary: rgb(59 / 255, 130 / 255, 246 / 255), // #3B82F6
  success: rgb(34 / 255, 197 / 255, 94 / 255), // #22C55E
  warning: rgb(245 / 255, 158 / 255, 11 / 255), // #F59E0B
  error: rgb(239 / 255, 68 / 255, 68 / 255), // #EF4444
  dark: rgb(30 / 255, 41 / 255, 59 / 255), // #1E293B
  light: rgb(241 / 255, 245 / 255, 249 / 255), // #F1F5F9
  white: rgb(1, 1, 1),
  textSecondary: rgb(100 / 255, 116 / 255, 139 / 255), // #64748B
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

async function loadLogo(): Promise<ArrayBuffer | null> {
  try {
    const logoUrl = chrome.runtime.getURL('icons/icon-128.png');
    const response = await fetch(logoUrl);
    return await response.arrayBuffer();
  } catch {
    return null;
  }
}

function getGradeColor(grade: ChainScore['grade']): Color {
  switch (grade) {
    case 'A':
      return COLORS.success;
    case 'B':
      return rgb(132 / 255, 204 / 255, 22 / 255); // Lime
    case 'C':
      return COLORS.warning;
    case 'D':
      return rgb(249 / 255, 115 / 255, 22 / 255); // Orange
    case 'F':
      return COLORS.error;
    default:
      return COLORS.dark;
  }
}

function getStatusColor(statusCode: number): Color {
  if (statusCode >= 200 && statusCode < 300) return COLORS.success;
  if (statusCode >= 300 && statusCode < 400) return COLORS.warning;
  if (statusCode >= 400) return COLORS.error;
  return COLORS.dark;
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

// Helper to wrap text (handling both spaces and long strings like URLs/IPs)
function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph === '') {
      lines.push('');
      continue;
    }

    const words = paragraph.split(' ');
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      const wordWidth = font.widthOfTextAtSize(word, fontSize);

      if (wordWidth > maxWidth) {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = '';
        }

        let remaining = word;
        while (remaining.length > 0) {
          let fitIndex = 0;
          let w = '';
          for (let k = 0; k < remaining.length; k++) {
            const char = remaining[k];
            const newW = w + char;
            if (font.widthOfTextAtSize(newW, fontSize) > maxWidth) {
              break;
            }
            w = newW;
            fitIndex = k + 1;
          }

          if (fitIndex === 0) fitIndex = 1;

          lines.push(remaining.substring(0, fitIndex));
          remaining = remaining.substring(fitIndex);
        }
      } else {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);

        if (testWidth <= maxWidth) {
          currentLine = testLine;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }
  return lines.length > 0 ? lines : [text];
}

export async function exportToPDF(
  entry: HistoryEntry,
  options: PDFExportOptions = {}
): Promise<void> {
  const {
    title = 'Redirect Chain Analysis',
    includeScore = true,
    includeRecommendations = true,
  } = options;

  const pdfDoc = await PDFDocument.create();
  const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let yPos = PAGE_HEIGHT - 20;

  const checkPageBreak = (neededHeight: number) => {
    if (yPos - neededHeight < MARGIN) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      yPos = PAGE_HEIGHT - MARGIN;
    }
  };

  // ========== HEADER ==========
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 55,
    width: PAGE_WIDTH,
    height: 55,
    color: COLORS.primary,
  });

  // Logo
  const logoBuffer = await loadLogo();
  if (logoBuffer) {
    const logoImage = await pdfDoc.embedPng(logoBuffer);
    page.drawImage(logoImage, {
      x: 15,
      y: PAGE_HEIGHT - 45,
      width: 35,
      height: 35,
    });
  }

  page.drawText('RedirectWise', {
    x: 60,
    y: PAGE_HEIGHT - 32,
    size: 24,
    font: fontBold,
    color: COLORS.white,
  });

  page.drawText(title, {
    x: 60,
    y: PAGE_HEIGHT - 48,
    size: 12,
    font: fontNormal,
    color: COLORS.white,
  });

  // Date
  const dateText = format(entry.timestamp, "MMMM d, yyyy 'at' h:mm a");
  const dateWidth = fontNormal.widthOfTextAtSize(dateText, 10);
  page.drawText(dateText, {
    x: PAGE_WIDTH - dateWidth - 15,
    y: PAGE_HEIGHT - 30,
    size: 10,
    font: fontNormal,
    color: COLORS.white,
  });

  const idText = `Report ID: ${entry.id.substring(0, 8)}`;
  const idWidth = fontNormal.widthOfTextAtSize(idText, 10);
  page.drawText(idText, {
    x: PAGE_WIDTH - idWidth - 15,
    y: PAGE_HEIGHT - 45,
    size: 10,
    font: fontNormal,
    color: COLORS.white,
  });

  yPos = PAGE_HEIGHT - 80;

  // ========== SUMMARY BOX ==========
  const summaryBoxHeight = 60;

  page.drawRectangle({
    x: 15,
    y: yPos - summaryBoxHeight,
    width: PAGE_WIDTH - 30,
    height: summaryBoxHeight,
    color: COLORS.light,
  });

  // Grade Circle
  const scoreX = 50;
  const scoreY = yPos - summaryBoxHeight / 2 + 5;
  const gradeColor = getGradeColor(entry.chainScore.grade);

  page.drawCircle({
    x: scoreX,
    y: scoreY - 2,
    size: 20,
    color: gradeColor,
  });

  const gradeWidth = fontBold.widthOfTextAtSize(entry.chainScore.grade, 24);
  page.drawText(entry.chainScore.grade, {
    x: scoreX - gradeWidth / 2,
    y: scoreY - 10,
    size: 24,
    font: fontBold,
    color: COLORS.white,
  });

  const scoreText = `Score: ${entry.chainScore.score}/100`;
  const scoreWidth = fontBold.widthOfTextAtSize(scoreText, 10);
  page.drawText(scoreText, {
    x: scoreX - scoreWidth / 2,
    y: scoreY - 35,
    size: 10,
    font: fontBold,
    color: COLORS.dark,
  });

  // Summary URL Stats
  const statsX = 100;
  const maxUrlWidth = PAGE_WIDTH - 250;

  page.drawText('ORIGINAL URL', {
    x: statsX,
    y: yPos - 15,
    size: 9,
    font: fontNormal,
    color: COLORS.textSecondary,
  });
  let origUrl = entry.originalUrl;
  if (fontBold.widthOfTextAtSize(origUrl, 9) > maxUrlWidth) {
    origUrl = origUrl.substring(0, 50) + '...';
  }
  page.drawText(origUrl, { x: statsX, y: yPos - 27, size: 9, font: fontBold, color: COLORS.dark });

  page.drawText('FINAL URL', {
    x: statsX,
    y: yPos - 42,
    size: 9,
    font: fontNormal,
    color: COLORS.textSecondary,
  });
  let finalUrl = entry.finalUrl;
  if (fontBold.widthOfTextAtSize(finalUrl, 9) > maxUrlWidth) {
    finalUrl = finalUrl.substring(0, 50) + '...';
  }
  page.drawText(finalUrl, { x: statsX, y: yPos - 54, size: 9, font: fontBold, color: COLORS.dark });

  // Right Stats
  const rightX = PAGE_WIDTH - 60;

  const redirectCountText = entry.redirectCount.toString();
  const rcWidth = fontBold.widthOfTextAtSize(redirectCountText, 18);
  page.drawText(redirectCountText, {
    x: rightX - rcWidth / 2,
    y: yPos - 20,
    size: 18,
    font: fontBold,
    color: COLORS.dark,
  });

  const rLabel = 'Redirects';
  const rlWidth = fontNormal.widthOfTextAtSize(rLabel, 9);
  page.drawText(rLabel, {
    x: rightX - rlWidth / 2,
    y: yPos - 30,
    size: 9,
    font: fontNormal,
    color: COLORS.textSecondary,
  });

  const hopsText = entry.path.length.toString();
  const hWidth = fontBold.widthOfTextAtSize(hopsText, 18);
  page.drawText(hopsText, {
    x: rightX - hWidth / 2,
    y: yPos - 45,
    size: 18,
    font: fontBold,
    color: COLORS.dark,
  });

  const hLabel = 'Total Hops';
  const hlWidth = fontNormal.widthOfTextAtSize(hLabel, 9);
  page.drawText(hLabel, {
    x: rightX - hlWidth / 2,
    y: yPos - 55,
    size: 9,
    font: fontNormal,
    color: COLORS.textSecondary,
  });

  yPos -= summaryBoxHeight + 30;

  // ========== TABLE ==========
  page.drawText('Redirect Chain Details', {
    x: 15,
    y: yPos,
    size: 16,
    font: fontBold,
    color: COLORS.dark,
  });
  yPos -= 20;

  // Table Headers
  const colWidths = [30, 40, 90, 210, 140, 40];
  const cols = ['#', 'Status', 'Type', 'URL', 'IP', 'Time'];
  let currentX = 15;

  // Header Row Background
  page.drawRectangle({
    x: 15,
    y: yPos - 5,
    width: PAGE_WIDTH - 30,
    height: 20,
    color: COLORS.primary,
  });

  cols.forEach((col, i) => {
    const xPos = i === cols.length - 1 ? currentX + 5 + colWidths[i] / 2 - 10 : currentX + 5;
    page.drawText(col, { x: xPos, y: yPos, size: 10, font: fontBold, color: COLORS.white });
    currentX += colWidths[i];
  });

  yPos -= 25;

  // Table Body
  for (let i = 0; i < entry.path.length; i++) {
    const item = entry.path[i];
    const statusLabel = getStatusLabel(item);
    const timing = item.timing?.duration ? `${item.timing.duration}ms` : '-';
    const statusColor = item.status_code ? getStatusColor(item.status_code) : COLORS.dark;

    const urlLines = wrapText(item.url, colWidths[3] - 10, fontNormal, 9);
    const ipLines = wrapText(item.ip || '-', colWidths[4] - 10, fontNormal, 9);

    const maxLines = Math.max(urlLines.length, ipLines.length);
    const rowHeight = Math.max(24, maxLines * 12 + 12);

    checkPageBreak(rowHeight);

    if (i % 2 === 0) {
      page.drawRectangle({
        x: 15,
        y: yPos - rowHeight + 14,
        width: PAGE_WIDTH - 30,
        height: rowHeight,
        color: COLORS.light,
      });
    }

    const textY = yPos - 2;

    page.drawText((i + 1).toString(), {
      x: 15 + 5,
      y: textY,
      size: 9,
      font: fontNormal,
      color: COLORS.dark,
    });

    page.drawText(item.status_code.toString(), {
      x: 15 + colWidths[0] + 5,
      y: textY,
      size: 9,
      font: fontBold,
      color: statusColor,
    });

    page.drawText(statusLabel, {
      x: 15 + colWidths[0] + colWidths[1] + 5,
      y: textY,
      size: 9,
      font: fontNormal,
      color: COLORS.dark,
    });

    urlLines.forEach((line, lineIdx) => {
      page.drawText(line, {
        x: 15 + colWidths[0] + colWidths[1] + colWidths[2] + 5,
        y: textY - lineIdx * 12,
        size: 9,
        font: fontNormal,
        color: COLORS.dark,
      });
    });

    ipLines.forEach((line, lineIdx) => {
      page.drawText(line, {
        x: 15 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 5,
        y: textY - lineIdx * 12,
        size: 9,
        font: fontNormal,
        color: COLORS.dark,
      });
    });

    const timeWidth = fontNormal.widthOfTextAtSize(timing, 9);
    const timeX =
      15 +
      colWidths[0] +
      colWidths[1] +
      colWidths[2] +
      colWidths[3] +
      colWidths[4] +
      5 +
      colWidths[5] / 2 -
      timeWidth / 2;
    page.drawText(timing, { x: timeX, y: textY, size: 9, font: fontNormal, color: COLORS.dark });

    yPos -= rowHeight;
  }

  yPos -= 30;

  // ========== ANALYTICS & RECOMMENDATIONS ==========
  if (includeScore && entry.chainScore.issues.length > 0) {
    checkPageBreak(50);
    page.drawText('Analysis & Issues', {
      x: 15,
      y: yPos,
      size: 16,
      font: fontBold,
      color: COLORS.dark,
    });
    yPos -= 20;

    entry.chainScore.issues.forEach(issue => {
      checkPageBreak(30);
      const iconColor =
        issue.type === 'error'
          ? COLORS.error
          : issue.type === 'warning'
          ? COLORS.warning
          : COLORS.success;

      page.drawCircle({ x: 20, y: yPos + 3, size: 4, color: iconColor });
      page.drawText(issue.message, {
        x: 30,
        y: yPos,
        size: 11,
        font: fontNormal,
        color: COLORS.dark,
      });
      page.drawText(`Impact: ${issue.impact.toUpperCase()}`, {
        x: 30,
        y: yPos - 12,
        size: 9,
        font: fontNormal,
        color: COLORS.textSecondary,
      });

      yPos -= 30;
    });
    yPos -= 10;
  }

  if (includeRecommendations && entry.chainScore.recommendations.length > 0) {
    checkPageBreak(50);
    page.drawText('Recommendations', {
      x: 15,
      y: yPos,
      size: 16,
      font: fontBold,
      color: COLORS.dark,
    });
    yPos -= 20;

    entry.chainScore.recommendations.forEach((rec, idx) => {
      const recLines = wrapText(rec, PAGE_WIDTH - 60, fontNormal, 11);
      const height = recLines.length * 14 + 10;
      checkPageBreak(height);

      page.drawCircle({ x: 20, y: yPos + 4, size: 8, color: COLORS.primary });
      page.drawText((idx + 1).toString(), {
        x: 17.5,
        y: yPos + 1,
        size: 9,
        font: fontBold,
        color: COLORS.white,
      });

      recLines.forEach((line, lIdx) => {
        page.drawText(line, {
          x: 35,
          y: yPos - lIdx * 14,
          size: 11,
          font: fontNormal,
          color: COLORS.dark,
        });
      });

      yPos -= height;
    });
  }

  // Add Page Numbers
  const pageCount = pdfDoc.getPageCount();
  const pages = pdfDoc.getPages();
  pages.forEach((p, i) => {
    p.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: 20, color: COLORS.light });
    p.drawText('Generated by RedirectWise', {
      x: 15,
      y: 7,
      size: 8,
      font: fontNormal,
      color: COLORS.textSecondary,
    });
    p.drawText(`Page ${i + 1} of ${pageCount}`, {
      x: PAGE_WIDTH - 80,
      y: 7,
      size: 8,
      font: fontNormal,
      color: COLORS.textSecondary,
    });
  });

  const pdfBytes = await pdfDoc.save();
  downloadPDF(
    pdfBytes,
    `redirectwise-${entry.id.substring(0, 8)}-${format(entry.timestamp, 'yyyy-MM-dd')}.pdf`
  );
}

// Export History
export async function exportHistoryToPDF(entries: HistoryEntry[]): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let yPos = PAGE_HEIGHT - MARGIN;

  // Header
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 50,
    width: PAGE_WIDTH,
    height: 50,
    color: COLORS.primary,
  });
  page.drawText('RedirectWise History Report', {
    x: 15,
    y: PAGE_HEIGHT - 30,
    size: 22,
    font: fontBold,
    color: COLORS.white,
  });
  page.drawText(`${entries.length} entries • Generated ${format(new Date(), 'MMMM d, yyyy')}`, {
    x: 15,
    y: PAGE_HEIGHT - 42,
    size: 10,
    font: fontNormal,
    color: COLORS.white,
  });

  yPos = PAGE_HEIGHT - 70;

  // Summary
  const avgScore = entries.reduce((acc, e) => acc + e.chainScore.score, 0) / entries.length;
  const totalRedirects = entries.reduce((acc, e) => acc + e.redirectCount, 0);

  page.drawRectangle({
    x: 15,
    y: yPos - 30,
    width: PAGE_WIDTH - 30,
    height: 30,
    color: COLORS.light,
  });
  page.drawText(`Average Score: ${Math.round(avgScore)}`, {
    x: 25,
    y: yPos - 20,
    size: 12,
    font: fontBold,
    color: COLORS.dark,
  });
  page.drawText(`Total Redirects: ${totalRedirects}`, {
    x: 200,
    y: yPos - 20,
    size: 12,
    font: fontBold,
    color: COLORS.dark,
  });
  page.drawText(`Entries: ${entries.length}`, {
    x: 400,
    y: yPos - 20,
    size: 12,
    font: fontBold,
    color: COLORS.dark,
  });

  yPos -= 50;

  // Table Headers
  const colWidths = [100, 50, 50, 150, 150];
  const cols = ['Date', 'Grade', 'Redir', 'Original URL', 'Final URL'];
  let currentX = 15;

  page.drawRectangle({
    x: 15,
    y: yPos - 5,
    width: PAGE_WIDTH - 30,
    height: 20,
    color: COLORS.primary,
  });
  cols.forEach((col, i) => {
    page.drawText(col, { x: currentX + 5, y: yPos, size: 10, font: fontBold, color: COLORS.white });
    currentX += colWidths[i];
  });

  yPos -= 25;

  // Table Body
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    if (yPos < MARGIN + 20) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      yPos = PAGE_HEIGHT - MARGIN;
    }

    if (i % 2 === 0) {
      page.drawRectangle({
        x: 15,
        y: yPos - 12 + 2,
        width: PAGE_WIDTH - 30,
        height: 16,
        color: COLORS.light,
      });
    }

    const dateStr = format(entry.timestamp, 'MM/dd/yy HH:mm');
    const gradeColor = getGradeColor(entry.chainScore.grade);

    let cx = 15;
    page.drawText(dateStr, { x: cx + 2, y: yPos, size: 9, font: fontNormal, color: COLORS.dark });
    cx += colWidths[0];

    page.drawText(entry.chainScore.grade, {
      x: cx + 15,
      y: yPos,
      size: 9,
      font: fontBold,
      color: gradeColor,
    });
    cx += colWidths[1];

    page.drawText(entry.redirectCount.toString(), {
      x: cx + 15,
      y: yPos,
      size: 9,
      font: fontNormal,
      color: COLORS.dark,
    });
    cx += colWidths[2];

    // Truncate URLs
    let orig =
      entry.originalUrl.length > 30
        ? entry.originalUrl.substring(0, 30) + '...'
        : entry.originalUrl;
    page.drawText(orig, { x: cx + 2, y: yPos, size: 9, font: fontNormal, color: COLORS.dark });
    cx += colWidths[3];

    let final =
      entry.finalUrl.length > 30 ? entry.finalUrl.substring(0, 30) + '...' : entry.finalUrl;
    page.drawText(final, { x: cx + 2, y: yPos, size: 9, font: fontNormal, color: COLORS.dark });

    yPos -= 16;
  }

  const pdfBytes = await pdfDoc.save();
  downloadPDF(pdfBytes, `redirectwise-history-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

function downloadPDF(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as any], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
