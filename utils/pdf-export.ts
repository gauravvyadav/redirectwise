// PDF Export utility using pdf-lib (Pure TypeScript, no external deps)
import { format } from 'date-fns';
import type { Color } from 'pdf-lib';
import { PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib';
import type { HistoryEntry, RedirectItem } from '../types/redirect';
import { calculateGapDuration, formatDuration } from '../types/redirect';

interface PDFExportOptions {
  title?: string;
  includeHeaders?: boolean;
}

// Swiss Modernist Design System Palette (matches assets/tailwind.css single source of truth)
const COLORS = {
  brand: rgb(37 / 255, 99 / 255, 235 / 255), // #2563EB
  ink: rgb(9 / 255, 9 / 255, 11 / 255), // #09090B
  stone: rgb(82 / 255, 82 / 255, 91 / 255), // #52525B
  muted: rgb(113 / 255, 113 / 255, 122 / 255), // #71717A
  line: rgb(228 / 255, 228 / 255, 231 / 255), // #E4E4E7
  subtle: rgb(244 / 255, 244 / 255, 245 / 255), // #F4F4F5
  paper: rgb(250 / 255, 250 / 255, 250 / 255), // #FAFAFA
  white: rgb(1, 1, 1),

  // Functional Status Colors
  ok: rgb(22 / 255, 163 / 255, 74 / 255), // #16A34A
  okBg: rgb(240 / 255, 253 / 255, 244 / 255), // #F0FDF4
  okBorder: rgb(187 / 255, 247 / 255, 208 / 255), // #BBF7D0

  warn: rgb(217 / 255, 119 / 255, 6 / 255), // #D97706
  warnBg: rgb(255 / 255, 251 / 255, 235 / 255), // #FFFBEB
  warnBorder: rgb(253 / 255, 230 / 255, 138 / 255), // #FDE68A

  err: rgb(220 / 255, 38 / 255, 38 / 255), // #DC2626
  errBg: rgb(254 / 255, 242 / 255, 242 / 255), // #FEF2F2
  errBorder: rgb(254 / 255, 202 / 255, 202 / 255), // #FECACA
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 30;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 535.28

/**
 * Standard PDF fonts (Helvetica, Courier, Times) in pdf-lib only support
 * characters within the WinAnsi / Latin-1 encoding set (0x20 - 0xFF).
 * Any character outside this range (such as emojis ⚡, ⏱, bullets •, smart quotes,
 * em-dashes, or arbitrary Unicode in URLs) causes pdf-lib to throw an unhandled
 * "WinAnsi cannot encode" error and abort export.
 *
 * This function converts known Unicode symbols to safe ASCII equivalents and
 * replaces any remaining out-of-range characters with safe ASCII characters.
 */
function cleanPdfText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/[⚡⏱🚀✓✔]/g, '')
    .replace(/[•·]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    // Replace any remaining non-WinAnsi / non-ASCII character with ASCII equivalent or '?'
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?')
    .trim();
}

async function loadLogo(): Promise<ArrayBuffer | null> {
  try {
    const logoUrl = chrome.runtime.getURL('icons/icon-128.png');
    const response = await fetch(logoUrl);
    return await response.arrayBuffer();
  } catch {
    return null;
  }
}

function getStatusColor(statusCode: number): Color {
  if (statusCode >= 200 && statusCode < 300) return COLORS.ok;
  if (statusCode >= 300 && statusCode < 400) return COLORS.warn;
  if (statusCode >= 400) return COLORS.err;
  return COLORS.stone;
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
  if (item.statusObject?.isSuccess) return 'Final (Success)';
  if (item.statusObject?.isClientError) return 'Client Error';
  if (item.statusObject?.isServerError) return 'Server Error';
  return 'Navigation';
}

// Helper to wrap text (handling both spaces and long strings like URLs/IPs)
function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
  const safeText = cleanPdfText(text);
  const paragraphs = safeText.split(/\r?\n/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph === '') {
      lines.push('');
      continue;
    }

    const words = paragraph.split(' ');
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i] ?? '';
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
  return lines.length > 0 ? lines : [safeText];
}

function drawLogoIcon(page: any, x: number, y: number, size = 28) {
  // Flat brand blue square
  page.drawRectangle({
    x,
    y,
    width: size,
    height: size,
    color: COLORS.brand,
  });

  // White redirect arrow
  const s = size / 32;
  page.drawLine({
    start: { x: x + 10 * s, y: y + 10 * s },
    end: { x: x + 22 * s, y: y + 22 * s },
    thickness: 2 * s,
    color: COLORS.white,
  });
  page.drawLine({
    start: { x: x + 14 * s, y: y + 22 * s },
    end: { x: x + 22 * s, y: y + 22 * s },
    thickness: 2 * s,
    color: COLORS.white,
  });
  page.drawLine({
    start: { x: x + 22 * s, y: y + 14 * s },
    end: { x: x + 22 * s, y: y + 22 * s },
    thickness: 2 * s,
    color: COLORS.white,
  });
}

export async function exportToPDF(
  entry: HistoryEntry,
  options: PDFExportOptions = {}
): Promise<void> {
  const { title = 'Redirect Chain Analysis' } = options;

  const pdfDoc = await PDFDocument.create();
  // Helvetica & HelveticaBold render crisp vector curves in all PDF engines (zero fuzziness)
  const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let yPos = PAGE_HEIGHT - MARGIN;

  const drawPageAccent = (p: any) => {
    p.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 3,
      width: PAGE_WIDTH,
      height: 3,
      color: COLORS.brand,
    });
  };

  const checkPageBreak = (neededHeight: number) => {
    if (yPos - neededHeight < MARGIN + 30) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawPageAccent(page);
      yPos = PAGE_HEIGHT - MARGIN - 20;
    }
  };

  // Draw top brand accent on first page
  drawPageAccent(page);

  // ========== HEADER (Swiss Modernist Clean Surface) ==========
  const logoBuffer = await loadLogo();
  const logoSize = 30;
  const logoX = MARGIN;
  const logoY = PAGE_HEIGHT - MARGIN - logoSize - 2;

  if (logoBuffer) {
    try {
      const logoImage = await pdfDoc.embedPng(logoBuffer);
      page.drawImage(logoImage, {
        x: logoX,
        y: logoY,
        width: logoSize,
        height: logoSize,
      });
    } catch {
      drawLogoIcon(page, logoX, logoY, logoSize);
    }
  } else {
    drawLogoIcon(page, logoX, logoY, logoSize);
  }

  // Wordmark: "REDIRECT" (ink) + "WISE" (brand)
  const titleX = logoX + logoSize + 12;
  page.drawText('REDIRECT', {
    x: titleX,
    y: PAGE_HEIGHT - MARGIN - 14,
    size: 15,
    font: fontBold,
    color: COLORS.ink,
  });
  const rWidth = fontBold.widthOfTextAtSize('REDIRECT', 15);
  page.drawText('WISE', {
    x: titleX + rWidth,
    y: PAGE_HEIGHT - MARGIN - 14,
    size: 15,
    font: fontBold,
    color: COLORS.brand,
  });

  // Header Subtitle
  page.drawText('URL REDIRECT CHECKER // ANALYSIS REPORT', {
    x: titleX,
    y: PAGE_HEIGHT - MARGIN - 26,
    size: 7.5,
    font: fontBold,
    color: COLORS.muted,
  });

  // Right-aligned Date & Report ID in crisp Helvetica
  const dateText = cleanPdfText(format(entry.timestamp || Date.now(), "MMM d, yyyy 'at' h:mm a"));
  const dateWidth = fontNormal.widthOfTextAtSize(dateText, 8);
  page.drawText(dateText, {
    x: PAGE_WIDTH - MARGIN - dateWidth,
    y: PAGE_HEIGHT - MARGIN - 14,
    size: 8,
    font: fontNormal,
    color: COLORS.stone,
  });

  const reportId = (entry.id || 'REPORT').substring(0, 8).toUpperCase();
  const idText = `REPORT ID: ${reportId}`;
  const idWidth = fontBold.widthOfTextAtSize(idText, 7.5);
  page.drawText(idText, {
    x: PAGE_WIDTH - MARGIN - idWidth,
    y: PAGE_HEIGHT - MARGIN - 26,
    size: 7.5,
    font: fontBold,
    color: COLORS.muted,
  });

  // Header Bottom Divider Line
  yPos = PAGE_HEIGHT - MARGIN - logoSize - 12;
  page.drawLine({
    start: { x: MARGIN, y: yPos },
    end: { x: PAGE_WIDTH - MARGIN, y: yPos },
    thickness: 1,
    color: COLORS.line,
  });

  yPos -= 14;

  // ========== SUMMARY METRICS BOX ==========
  const summaryBoxHeight = 58;
  page.drawRectangle({
    x: MARGIN,
    y: yPos - summaryBoxHeight,
    width: CONTENT_WIDTH,
    height: summaryBoxHeight,
    color: COLORS.subtle,
    borderWidth: 1,
    borderColor: COLORS.line,
  });

  // URL summaries (Left Column)
  const statsX = MARGIN + 12;
  const maxUrlWidth = CONTENT_WIDTH - 200;

  page.drawText('ORIGINAL URL', {
    x: statsX,
    y: yPos - 14,
    size: 7,
    font: fontBold,
    color: COLORS.muted,
  });

  let origUrl = cleanPdfText(entry.originalUrl || entry.path?.[0]?.url || '');
  while (fontBold.widthOfTextAtSize(origUrl, 7.5) > maxUrlWidth && origUrl.length > 10) {
    origUrl = origUrl.substring(0, origUrl.length - 4) + '...';
  }
  page.drawText(origUrl, {
    x: statsX,
    y: yPos - 25,
    size: 7.5,
    font: fontBold,
    color: COLORS.ink,
  });

  page.drawText('FINAL URL', {
    x: statsX,
    y: yPos - 38,
    size: 7,
    font: fontBold,
    color: COLORS.muted,
  });

  let finalUrl = cleanPdfText(
    entry.finalUrl || entry.path?.[entry.path.length - 1]?.url || origUrl
  );
  while (fontBold.widthOfTextAtSize(finalUrl, 7.5) > maxUrlWidth && finalUrl.length > 10) {
    finalUrl = finalUrl.substring(0, finalUrl.length - 4) + '...';
  }
  page.drawText(finalUrl, {
    x: statsX,
    y: yPos - 49,
    size: 7.5,
    font: fontBold,
    color: COLORS.ink,
  });

  // Right Summary Statistics
  const actualRedirectCount =
    entry.path?.filter(
      p =>
        p.type === 'server_redirect' ||
        p.type === 'client_redirect' ||
        (p.status_code >= 300 && p.status_code < 400)
    ).length ?? (entry.redirectCount || 0);

  const totalHops = Math.max(1, entry.path?.length || 1);

  if (actualRedirectCount > 0) {
    const statBox1X = PAGE_WIDTH - MARGIN - 145;
    const statBox2X = PAGE_WIDTH - MARGIN - 75;

    // 1. Hops Metric (Left)
    page.drawText(totalHops.toString(), {
      x: statBox1X,
      y: yPos - 26,
      size: 16,
      font: fontBold,
      color: COLORS.ink,
    });
    page.drawText(totalHops === 1 ? 'TOTAL HOP' : 'TOTAL HOPS', {
      x: statBox1X,
      y: yPos - 38,
      size: 7,
      font: fontBold,
      color: COLORS.muted,
    });

    // 2. Redirects Metric (Right)
    page.drawText(actualRedirectCount.toString(), {
      x: statBox2X,
      y: yPos - 26,
      size: 16,
      font: fontBold,
      color: COLORS.ink,
    });
    page.drawText(actualRedirectCount === 1 ? 'REDIRECT' : 'REDIRECTS', {
      x: statBox2X,
      y: yPos - 38,
      size: 7,
      font: fontBold,
      color: COLORS.muted,
    });

    // Total Duration if available
    if (entry.totalTime && entry.totalTime > 0) {
      const durText = cleanPdfText(`${formatDuration(entry.totalTime).toUpperCase()} TOTAL`);
      page.drawText(durText, {
        x: statBox1X,
        y: yPos - 50,
        size: 7.5,
        font: fontBold,
        color: COLORS.brand,
      });
    }
  } else {
    // Direct visit (0 redirects): show clean Hops metric, omit redundant 0 redirects stat
    const statBoxX = PAGE_WIDTH - MARGIN - 80;

    page.drawText(totalHops.toString(), {
      x: statBoxX,
      y: yPos - 26,
      size: 16,
      font: fontBold,
      color: COLORS.ink,
    });
    page.drawText(totalHops === 1 ? 'TOTAL HOP' : 'TOTAL HOPS', {
      x: statBoxX,
      y: yPos - 38,
      size: 7,
      font: fontBold,
      color: COLORS.muted,
    });

    if (entry.totalTime && entry.totalTime > 0) {
      const durText = cleanPdfText(`${formatDuration(entry.totalTime).toUpperCase()} TOTAL`);
      page.drawText(durText, {
        x: statBoxX,
        y: yPos - 50,
        size: 7.5,
        font: fontBold,
        color: COLORS.brand,
      });
    }
  }

  yPos -= summaryBoxHeight + 20;

  // ========== REDIRECT CHAIN DETAILS (Timeline Cards) ==========
  page.drawText('REDIRECT CHAIN DETAILS', {
    x: MARGIN,
    y: yPos,
    size: 10,
    font: fontBold,
    color: COLORS.ink,
  });
  yPos -= 16;

  const path = entry.path || [];
  const timelineX = MARGIN + 10; // Center x for timeline vertical line & hop badges
  const cardX = MARGIN + 26;
  const cardWidth = CONTENT_WIDTH - 26;
  const innerCardPadding = 10;
  const textMaxWidth = cardWidth - innerCardPadding * 2;

  // Pre-calculate card heights & text wrapping
  interface CardData {
    item: RedirectItem;
    index: number;
    urlLines: string[];
    ipLine?: string;
    delayMs: number | null;
    openedFromDomain?: string;
    cardHeight: number;
    statusBg: { fill: Color; border: Color; text: Color; hopBg: Color };
    redirectLabel: string | null;
    timingText?: string;
    insecureText?: string;
    compressionText?: string;
    timeStr: string;
  }

  const cards: CardData[] = [];

  for (let i = 0; i < path.length; i++) {
    const item = path[i];
    if (!item) continue;

    const delayMs = i > 0 ? calculateGapDuration(path[i - 1], item) : null;

    let openedFromDomain: string | undefined;
    if (item.openedFrom) {
      try {
        openedFromDomain = cleanPdfText(new URL(item.openedFrom).hostname);
      } catch {
        openedFromDomain = cleanPdfText(item.openedFrom);
      }
    }

    // Wrap URL to available card content width (480+ pt)
    let rawUrlLines = wrapText(item.url || '', textMaxWidth, fontNormal, 7.5);
    // Cap excessive tracking URLs (2,000+ chars) to max 4 lines so they don't break the page
    if (rawUrlLines.length > 4) {
      const lastLine = rawUrlLines[3] ?? '';
      rawUrlLines = rawUrlLines.slice(0, 4);
      rawUrlLines[3] = (lastLine.length > 3 ? lastLine.slice(0, -3) : lastLine) + '...';
    }

    let ipLine: string | undefined;
    if (item.ip && item.ip !== 'Unknown' && item.ip !== '-') {
      ipLine = cleanPdfText(`IP: ${item.ip}`);
    }

    // Status styling
    let statusBg = {
      fill: COLORS.subtle,
      border: COLORS.line,
      text: COLORS.stone,
      hopBg: COLORS.stone,
    };
    if (item.status_code >= 200 && item.status_code < 300) {
      statusBg = { fill: COLORS.okBg, border: COLORS.okBorder, text: COLORS.ok, hopBg: COLORS.ok };
    } else if (item.status_code >= 300 && item.status_code < 400) {
      statusBg = { fill: COLORS.warnBg, border: COLORS.warnBorder, text: COLORS.warn, hopBg: COLORS.warn };
    } else if (item.status_code >= 400) {
      statusBg = { fill: COLORS.errBg, border: COLORS.errBorder, text: COLORS.err, hopBg: COLORS.err };
    }

    // Redirect type label (Permanent, Temporary, HSTS, Client)
    let redirectLabel: string | null = null;
    if (item.type === 'server_redirect') {
      if (item.redirect_type === 'permanent') redirectLabel = 'PERMANENT (301/308)';
      else if (item.redirect_type === 'hsts') redirectLabel = 'HSTS REDIRECT';
      else redirectLabel = 'TEMPORARY (302/307)';
    } else if (item.type === 'client_redirect') {
      redirectLabel = `CLIENT (${item.redirect_type?.toUpperCase() || 'JS'})`;
    }

    // Timing
    const timingText = item.timing ? cleanPdfText(formatDuration(item.timing.duration)) : undefined;

    // Insecure HTTP
    const insecureText = item.url?.startsWith('http://') ? 'HTTP INSECURE' : undefined;

    // Compression
    let compressionText: string | undefined;
    const encoding = item.headers?.find(h => h.name.toLowerCase() === 'content-encoding')?.value;
    if (encoding) {
      compressionText = encoding === 'br' ? 'BROTLI' : encoding === 'gzip' ? 'GZIP' : encoding.toUpperCase();
    }

    // Timestamp
    let timeStr = '';
    try {
      timeStr = item.timestamp ? format(item.timestamp, 'HH:mm:ss.SSS') : '';
    } catch {}

    // Height calculation:
    // Top Row: 22 pt
    // Divider: 1 pt
    // URL content: 8 pt top + lines * 11 pt + (ipLine ? 14 pt : 0) + 8 pt bottom
    const contentH = 8 + rawUrlLines.length * 11 + (ipLine ? 14 : 0) + 8;
    const cardHeight = Math.max(54, 22 + 1 + contentH);

    cards.push({
      item,
      index: i,
      urlLines: rawUrlLines,
      ipLine,
      delayMs,
      openedFromDomain,
      cardHeight,
      statusBg,
      redirectLabel,
      timingText,
      insecureText,
      compressionText,
      timeStr,
    });
  }

  // Draw timeline cards
  for (let idx = 0; idx < cards.length; idx++) {
    const card = cards[idx];
    if (!card) continue;

    // Calculate required space for any banners / gaps before the card
    let extraTopSpace = 0;
    if (card.openedFromDomain) extraTopSpace += 22;
    if (card.index > 0 && card.delayMs !== null) extraTopSpace += 22;

    checkPageBreak(card.cardHeight + extraTopSpace + 14);

    // 1. Opened From Banner
    if (card.openedFromDomain) {
      const bannerText = cleanPdfText(`NEW TAB FROM ${card.openedFromDomain}`);
      const bTextW = fontBold.widthOfTextAtSize(bannerText, 7);
      const bWidth = bTextW + 16;
      const bHeight = 15;
      const bY = yPos - bHeight;

      page.drawRectangle({
        x: cardX + 10,
        y: bY,
        width: bWidth,
        height: bHeight,
        color: COLORS.brand,
      });

      page.drawText(bannerText, {
        x: cardX + 18,
        y: bY + 4,
        size: 7,
        font: fontBold,
        color: COLORS.white,
      });

      yPos -= bHeight + 7;
    }

    // 2. Gap Marker
    if (card.index > 0 && card.delayMs !== null) {
      const gapText = cleanPdfText(`${formatDuration(card.delayMs).toUpperCase()} GAP`);
      const gTextW = fontBold.widthOfTextAtSize(gapText, 7);
      const gWidth = gTextW + 16;
      const gHeight = 15;
      const gY = yPos - gHeight;

      page.drawRectangle({
        x: cardX + 10,
        y: gY,
        width: gWidth,
        height: gHeight,
        color: COLORS.subtle,
        borderWidth: 1,
        borderColor: COLORS.line,
      });

      page.drawText(gapText, {
        x: cardX + 18,
        y: gY + 4,
        size: 7,
        font: fontBold,
        color: COLORS.stone,
      });

      yPos -= gHeight + 7;
    }

    const cardTopY = yPos;
    const cardBottomY = cardTopY - card.cardHeight;

    // 3. Vertical Timeline Connector Line
    if (idx < cards.length - 1) {
      // Connect to next card
      page.drawLine({
        start: { x: timelineX, y: cardTopY - 10 },
        end: { x: timelineX, y: cardBottomY - 14 },
        thickness: 1.5,
        color: COLORS.line,
      });
    }

    // 4. Hop Square Badge on Timeline
    const hopSize = 18;
    const hopX = timelineX - hopSize / 2;
    const hopY = cardTopY - hopSize - 3;

    page.drawRectangle({
      x: hopX,
      y: hopY,
      width: hopSize,
      height: hopSize,
      color: card.statusBg.hopBg,
    });

    const hopIndexStr = (card.index + 1).toString();
    const hopTextW = fontBold.widthOfTextAtSize(hopIndexStr, 8);
    page.drawText(hopIndexStr, {
      x: hopX + (hopSize - hopTextW) / 2,
      y: hopY + 5,
      size: 8,
      font: fontBold,
      color: COLORS.white,
    });

    // 5. Main Card Container Surface
    page.drawRectangle({
      x: cardX,
      y: cardBottomY,
      width: cardWidth,
      height: card.cardHeight,
      color: COLORS.white,
      borderWidth: 1,
      borderColor: COLORS.line,
    });

    // 6. Card Top Row (Badges cluster)
    let badgeX = cardX + innerCardPadding;
    const pillH = 15;
    const pillY = cardTopY - 19;

    // Status Code Pill (e.g. 200, 301, 404)
    const codeStr = card.item.status_code.toString();
    const codeW = fontBold.widthOfTextAtSize(codeStr, 7.5) + 12;

    page.drawRectangle({
      x: badgeX,
      y: pillY,
      width: codeW,
      height: pillH,
      color: card.statusBg.fill,
      borderWidth: 1,
      borderColor: card.statusBg.border,
    });
    page.drawText(codeStr, {
      x: badgeX + 6,
      y: pillY + 4,
      size: 7.5,
      font: fontBold,
      color: card.statusBg.text,
    });
    badgeX += codeW + 6;

    // Redirect Type Pill (Permanent, Temporary, etc.)
    if (card.redirectLabel) {
      const rLabelW = fontBold.widthOfTextAtSize(card.redirectLabel, 7) + 12;
      page.drawRectangle({
        x: badgeX,
        y: pillY,
        width: rLabelW,
        height: pillH,
        color: COLORS.warnBg,
        borderWidth: 1,
        borderColor: COLORS.warnBorder,
      });
      page.drawText(card.redirectLabel, {
        x: badgeX + 6,
        y: pillY + 4,
        size: 7,
        font: fontBold,
        color: COLORS.warn,
      });
      badgeX += rLabelW + 6;
    }

    // Timing Pill
    if (card.timingText) {
      const timingW = fontNormal.widthOfTextAtSize(card.timingText, 7) + 12;
      page.drawRectangle({
        x: badgeX,
        y: pillY,
        width: timingW,
        height: pillH,
        color: COLORS.subtle,
        borderWidth: 1,
        borderColor: COLORS.line,
      });
      page.drawText(card.timingText, {
        x: badgeX + 6,
        y: pillY + 4,
        size: 7,
        font: fontNormal,
        color: COLORS.stone,
      });
      badgeX += timingW + 6;
    }

    // Insecure HTTP Pill
    if (card.insecureText) {
      const insecW = fontBold.widthOfTextAtSize(card.insecureText, 7) + 12;
      page.drawRectangle({
        x: badgeX,
        y: pillY,
        width: insecW,
        height: pillH,
        color: COLORS.errBg,
        borderWidth: 1,
        borderColor: COLORS.errBorder,
      });
      page.drawText(card.insecureText, {
        x: badgeX + 6,
        y: pillY + 4,
        size: 7,
        font: fontBold,
        color: COLORS.err,
      });
      badgeX += insecW + 6;
    }

    // Compression Pill
    if (card.compressionText) {
      const compW = fontBold.widthOfTextAtSize(card.compressionText, 7) + 12;
      page.drawRectangle({
        x: badgeX,
        y: pillY,
        width: compW,
        height: pillH,
        color: COLORS.subtle,
        borderWidth: 1,
        borderColor: COLORS.line,
      });
      page.drawText(card.compressionText, {
        x: badgeX + 6,
        y: pillY + 4,
        size: 7,
        font: fontBold,
        color: COLORS.brand,
      });
      badgeX += compW + 6;
    }

    // Right-aligned Timestamp in Card Top Row
    if (card.timeStr) {
      const timeW = fontNormal.widthOfTextAtSize(card.timeStr, 7.5);
      page.drawText(card.timeStr, {
        x: cardX + cardWidth - innerCardPadding - timeW,
        y: pillY + 4,
        size: 7.5,
        font: fontNormal,
        color: COLORS.muted,
      });
    }

    // 7. Divider between card top row & URL row
    const dividerY = cardTopY - 23;
    page.drawLine({
      start: { x: cardX, y: dividerY },
      end: { x: cardX + cardWidth, y: dividerY },
      thickness: 0.5,
      color: COLORS.line,
    });

    // 8. URL text lines (in crisp, clear Helvetica)
    let lineY = dividerY - 14;
    for (const urlLine of card.urlLines) {
      page.drawText(urlLine, {
        x: cardX + innerCardPadding,
        y: lineY,
        size: 7.5,
        font: fontNormal,
        color: COLORS.ink,
      });
      lineY -= 11;
    }

    // 9. IP line below URL
    if (card.ipLine) {
      page.drawText(card.ipLine, {
        x: cardX + innerCardPadding,
        y: lineY - 2,
        size: 7,
        font: fontNormal,
        color: COLORS.muted,
      });
    }

    yPos = cardBottomY - 12; // Gap between cards
  }

  // ========== FOOTER ON ALL PAGES ==========
  const pageCount = pdfDoc.getPageCount();
  const pages = pdfDoc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({
      start: { x: MARGIN, y: 24 },
      end: { x: PAGE_WIDTH - MARGIN, y: 24 },
      thickness: 1,
      color: COLORS.line,
    });

    p.drawText('RedirectWise // by GauravLabs', {
      x: MARGIN,
      y: 12,
      size: 7.5,
      font: fontNormal,
      color: COLORS.muted,
    });

    const pageStr = `Page ${i + 1} of ${pageCount}`;
    const pageStrWidth = fontNormal.widthOfTextAtSize(pageStr, 7.5);
    p.drawText(pageStr, {
      x: PAGE_WIDTH - MARGIN - pageStrWidth,
      y: 12,
      size: 7.5,
      font: fontNormal,
      color: COLORS.muted,
    });
  });

  const pdfBytes = await pdfDoc.save();
  const downloadId = cleanPdfText(entry.id || 'export').substring(0, 8);
  downloadPDF(
    pdfBytes,
    `redirectwise-${downloadId}-${format(entry.timestamp || Date.now(), 'yyyy-MM-dd')}.pdf`
  );
}

// Bulk History PDF Export
export async function exportHistoryToPDF(entries: HistoryEntry[]): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let yPos = PAGE_HEIGHT - MARGIN;

  const drawPageAccent = (p: any) => {
    p.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 3,
      width: PAGE_WIDTH,
      height: 3,
      color: COLORS.brand,
    });
  };

  drawPageAccent(page);

  // Header
  const logoBuffer = await loadLogo();
  const logoSize = 28;
  const logoX = MARGIN;
  const logoY = PAGE_HEIGHT - MARGIN - logoSize - 2;

  if (logoBuffer) {
    try {
      const logoImage = await pdfDoc.embedPng(logoBuffer);
      page.drawImage(logoImage, {
        x: logoX,
        y: logoY,
        width: logoSize,
        height: logoSize,
      });
    } catch {
      drawLogoIcon(page, logoX, logoY, logoSize);
    }
  } else {
    drawLogoIcon(page, logoX, logoY, logoSize);
  }

  const titleX = logoX + logoSize + 12;
  page.drawText('REDIRECTWISE HISTORY REPORT', {
    x: titleX,
    y: PAGE_HEIGHT - MARGIN - 14,
    size: 14,
    font: fontBold,
    color: COLORS.ink,
  });

  const historySubtitle = cleanPdfText(
    `${entries.length} SESSIONS - GENERATED ${format(new Date(), 'MMMM d, yyyy')}`.toUpperCase()
  );
  page.drawText(historySubtitle, {
    x: titleX,
    y: PAGE_HEIGHT - MARGIN - 26,
    size: 7.5,
    font: fontBold,
    color: COLORS.muted,
  });

  yPos = PAGE_HEIGHT - MARGIN - logoSize - 12;
  page.drawLine({
    start: { x: MARGIN, y: yPos },
    end: { x: PAGE_WIDTH - MARGIN, y: yPos },
    thickness: 1,
    color: COLORS.line,
  });

  yPos -= 14;

  // Summary Metrics Box
  const totalRedirects = entries.reduce((acc, e) => {
    const freshCount =
      e.path?.filter(
        p =>
          p.type === 'server_redirect' ||
          p.type === 'client_redirect' ||
          (p.status_code >= 300 && p.status_code < 400)
      ).length ?? e.redirectCount;
    return acc + freshCount;
  }, 0);
  const totalHops = entries.reduce((acc, e) => acc + Math.max(1, e.path?.length || 1), 0);
  const favoritesCount = entries.filter(e => e.isFavorite).length;

  const summaryHeight = 36;
  page.drawRectangle({
    x: MARGIN,
    y: yPos - summaryHeight,
    width: CONTENT_WIDTH,
    height: summaryHeight,
    color: COLORS.subtle,
    borderWidth: 1,
    borderColor: COLORS.line,
  });

  const m1X = MARGIN + 14;
  page.drawText(`TOTAL SESSIONS: ${entries.length}`, {
    x: m1X,
    y: yPos - 22,
    size: 8.5,
    font: fontBold,
    color: COLORS.ink,
  });

  const m2X = MARGIN + 145;
  page.drawText(`TOTAL HOPS: ${totalHops}`, {
    x: m2X,
    y: yPos - 22,
    size: 8.5,
    font: fontBold,
    color: COLORS.ink,
  });

  const m3X = MARGIN + 280;
  page.drawText(`TOTAL REDIRECTS: ${totalRedirects}`, {
    x: m3X,
    y: yPos - 22,
    size: 8.5,
    font: fontBold,
    color: COLORS.ink,
  });

  const m4X = MARGIN + 430;
  page.drawText(`FAVORITES: ${favoritesCount}`, {
    x: m4X,
    y: yPos - 22,
    size: 8.5,
    font: fontBold,
    color: COLORS.ink,
  });

  yPos -= summaryHeight + 20;

  // Table Headers
  const colWidths: [number, number, number, number] = [95, 48, 196, 196];
  const cols = ['DATE', 'REDIR', 'ORIGINAL URL', 'FINAL URL'];

  page.drawRectangle({
    x: MARGIN,
    y: yPos - 18,
    width: CONTENT_WIDTH,
    height: 18,
    color: COLORS.ink,
  });

  let currentX = MARGIN;
  cols.forEach((col, i) => {
    const colWidth = colWidths[i] ?? 0;
    page.drawText(col, {
      x: currentX + 6,
      y: yPos - 12.5,
      size: 7.5,
      font: fontBold,
      color: COLORS.white,
    });
    currentX += colWidth;
  });

  yPos -= 22;

  // Table Body
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;

    if (yPos < MARGIN + 30) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawPageAccent(page);
      yPos = PAGE_HEIGHT - MARGIN - 15;
    }

    const rowHeight = 16;
    if (i % 2 === 1) {
      page.drawRectangle({
        x: MARGIN,
        y: yPos - rowHeight + 6,
        width: CONTENT_WIDTH,
        height: rowHeight,
        color: COLORS.subtle,
      });
    }

    page.drawLine({
      start: { x: MARGIN, y: yPos - rowHeight + 6 },
      end: { x: MARGIN + CONTENT_WIDTH, y: yPos - rowHeight + 6 },
      thickness: 0.5,
      color: COLORS.line,
    });

    const dateStr = cleanPdfText(format(entry.timestamp || Date.now(), 'yyyy-MM-dd HH:mm'));
    let cx = MARGIN;

    // Date
    page.drawText(dateStr, {
      x: cx + 6,
      y: yPos - 4,
      size: 7.5,
      font: fontNormal,
      color: COLORS.muted,
    });
    cx += colWidths[0];

    // Redirect Count (Status Colored)
    const freshCount =
      entry.path?.filter(
        p =>
          p.type === 'server_redirect' ||
          p.type === 'client_redirect' ||
          (p.status_code >= 300 && p.status_code < 400)
      ).length ?? (entry.redirectCount || 0);
    const redirColor = freshCount > 0 ? COLORS.warn : COLORS.ok;
    page.drawText(freshCount.toString(), {
      x: cx + 14,
      y: yPos - 4,
      size: 7.5,
      font: fontBold,
      color: redirColor,
    });
    cx += colWidths[1];

    // Truncate URLs for table row
    let orig = cleanPdfText(entry.originalUrl || entry.path?.[0]?.url || '');
    while (fontNormal.widthOfTextAtSize(orig, 7.5) > colWidths[2] - 12 && orig.length > 10) {
      orig = orig.substring(0, orig.length - 4) + '...';
    }
    page.drawText(orig, {
      x: cx + 6,
      y: yPos - 4,
      size: 7.5,
      font: fontNormal,
      color: COLORS.stone,
    });
    cx += colWidths[2];

    let final = cleanPdfText(
      entry.finalUrl || entry.path?.[entry.path.length - 1]?.url || orig
    );
    while (fontNormal.widthOfTextAtSize(final, 7.5) > colWidths[3] - 12 && final.length > 10) {
      final = final.substring(0, final.length - 4) + '...';
    }
    page.drawText(final, {
      x: cx + 6,
      y: yPos - 4,
      size: 7.5,
      font: fontNormal,
      color: COLORS.stone,
    });

    yPos -= rowHeight;
  }

  // Footer on all pages
  const pageCount = pdfDoc.getPageCount();
  const pages = pdfDoc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({
      start: { x: MARGIN, y: 24 },
      end: { x: PAGE_WIDTH - MARGIN, y: 24 },
      thickness: 1,
      color: COLORS.line,
    });

    p.drawText('RedirectWise // by GauravLabs', {
      x: MARGIN,
      y: 12,
      size: 7.5,
      font: fontNormal,
      color: COLORS.muted,
    });

    const pageStr = `Page ${i + 1} of ${pageCount}`;
    const pageStrWidth = fontNormal.widthOfTextAtSize(pageStr, 7.5);
    p.drawText(pageStr, {
      x: PAGE_WIDTH - MARGIN - pageStrWidth,
      y: 12,
      size: 7.5,
      font: fontNormal,
      color: COLORS.muted,
    });
  });

  const pdfBytes = await pdfDoc.save();
  downloadPDF(pdfBytes, `redirectwise-history-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

function downloadPDF(bytes: Uint8Array, filename: string) {
  try {
    const blob = new Blob([bytes as any], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    }, 1000);
  } catch (err) {
    console.error('[RedirectWise] Failed to download PDF blob:', err);
  }
}
