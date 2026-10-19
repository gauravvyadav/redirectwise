import { format } from 'date-fns';
import type { RedirectItem } from '../types/redirect';
import { calculateGapDuration, formatDuration } from '../types/redirect';
import { t } from './i18n';

// Swiss Modernist Design System Palette (matches assets/tailwind.css single source of truth)
const SWISS = {
  paper: '#FAFAFA', // Neutral canvas background
  card: '#FFFFFF', // Clean card surface
  subtle: '#F4F4F5', // Subtle surface for badges / headers
  line: '#E4E4E7', // Crisp neutral divider / border
  ink: '#09090B', // Primary text
  stone: '#52525B', // Secondary text
  muted: '#71717A', // Tertiary / muted text
  brand: '#2563EB', // RedirectWise brand blue
  brandDark: '#1D4ED8', // Darker brand accent
  white: '#FFFFFF',

  // Functional Status Colors
  ok: '#16A34A',
  okBg: '#F0FDF4',
  okBorder: '#BBF7D0',

  warn: '#D97706',
  warnBg: '#FFFBEB',
  warnBorder: '#FDE68A',

  err: '#DC2626',
  errBg: '#FEF2F2',
  errBorder: '#FECACA',
};

const FONT_MONO = 'ui-monospace, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", monospace';
const FONT_SANS =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

// 2x Retina supersampling scale factor for crystal-clear vector text rasterization
const RETINA_SCALE = 2;

interface CardLayout {
  item: RedirectItem;
  index: number;
  topY: number;
  height: number;
  urlLines: string[];
  ipLine?: string;
  delayMs: number | null;
  openedFromDomain?: string;
}

function getStatusBadge(item: RedirectItem) {
  if (item.statusObject.isSuccess) {
    return {
      hopBg: SWISS.ok,
      badgeBg: SWISS.okBg,
      badgeBorder: SWISS.okBorder,
      text: SWISS.ok,
    };
  }
  if (item.statusObject.isRedirect) {
    return {
      hopBg: SWISS.warn,
      badgeBg: SWISS.warnBg,
      badgeBorder: SWISS.warnBorder,
      text: SWISS.warn,
    };
  }
  if (item.statusObject.isClientError || item.statusObject.isServerError) {
    return {
      hopBg: SWISS.err,
      badgeBg: SWISS.errBg,
      badgeBorder: SWISS.errBorder,
      text: SWISS.err,
    };
  }
  return {
    hopBg: SWISS.muted,
    badgeBg: SWISS.subtle,
    badgeBorder: SWISS.line,
    text: SWISS.stone,
  };
}

function getRedirectTypeLabel(item: RedirectItem): string | null {
  const getMsg = (key: string, fallback: string) => {
    try {
      return t(key) || fallback;
    } catch {
      return fallback;
    }
  };

  if (item.type === 'server_redirect') {
    if (item.redirect_type === 'permanent') {
      return getMsg('permanentRedirect', 'Permanent (301/308)');
    }
    if (item.redirect_type === 'hsts') {
      return getMsg('hstsRedirect', 'HSTS Redirect');
    }
    return getMsg('temporaryRedirect', 'Temporary (302/307)');
  }
  if (item.type === 'client_redirect') {
    return `Client (${item.redirect_type?.toUpperCase() || 'JS'})`;
  }
  return null;
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const words = text.split(' ');
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i] ?? '';
    const wordWidth = ctx.measureText(word).width;

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
          if (ctx.measureText(newW).width > maxWidth) {
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
      const testWidth = ctx.measureText(testLine).width;

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

  return lines.length > 0 ? lines : [text];
}

/**
 * Pixel-snapped rectangle drawing to prevent anti-aliased fuzzy borders.
 */
function drawRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fillColor?: string,
  strokeColor?: string,
  strokeWidth = 1
) {
  const rx = Math.round(x);
  const ry = Math.round(y);
  const rw = Math.round(w);
  const rh = Math.round(h);

  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fillRect(rx, ry, rw, rh);
  }
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    // Offset stroke by 0.5px to align with device pixel grid for razor-sharp borders
    ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
  }
}

function drawLogoMark(ctx: CanvasRenderingContext2D, x: number, y: number, size = 36) {
  const rx = Math.round(x);
  const ry = Math.round(y);

  // Flat brand blue square (Swiss style)
  ctx.fillStyle = SWISS.brand;
  ctx.fillRect(rx, ry, size, size);

  // White redirect arrow matching public/icons/logo.svg
  ctx.save();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = Math.max(2, size * (2.6 / 32));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const s = size / 32;
  ctx.moveTo(rx + 10 * s, ry + 22 * s);
  ctx.lineTo(rx + 22 * s, ry + 10 * s);
  ctx.moveTo(rx + 14 * s, ry + 10 * s);
  ctx.lineTo(rx + 22 * s, ry + 10 * s);
  ctx.lineTo(rx + 22 * s, ry + 18 * s);
  ctx.stroke();
  ctx.restore();
}

async function loadLogoImage(): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    try {
      const logoUrl = chrome.runtime.getURL('icons/icon-128.png');
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = logoUrl;
    } catch {
      resolve(null);
    }
  });
}

function formatTime(timestamp: number): string {
  try {
    return format(timestamp, 'HH:mm:ss.SSS');
  } catch {
    return '';
  }
}

export async function exportToImage(
  entry: {
    path: RedirectItem[];
    originalUrl?: string;
    finalUrl?: string;
    timestamp?: number;
    totalTime?: number;
    redirectCount?: number;
  },
  title = 'Redirect Chain Analysis'
): Promise<void> {
  const path = entry.path;
  if (!path || path.length === 0) return;

  const originalUrl = entry.originalUrl || path[0]?.url || '';
  const finalUrl = entry.finalUrl || path[path.length - 1]?.url || '';
  const timestamp = entry.timestamp || Date.now();
  const totalTime = entry.totalTime || 0;
  // Always compute the real, up-to-date redirect count from the actual chain hops
  const redirectCount = path.filter(
    p =>
      p.type === 'server_redirect' ||
      p.type === 'client_redirect' ||
      (p.status_code >= 300 && p.status_code < 400)
  ).length;

  const canvasWidth = 840;
  const cardX = 84;
  const cardWidth = 724;
  const insideCardPadding = 14;
  const textMaxWidth = cardWidth - insideCardPadding * 2;

  // Pass 1: Measure and compute layouts
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d')!;

  const urlFont = `12px ${FONT_MONO}`;

  let currentY = 126; // Below 110px header + 16px margin
  const layouts: CardLayout[] = [];

  for (let i = 0; i < path.length; i++) {
    const item = path[i];
    if (!item) continue;
    const delayMs = i > 0 ? calculateGapDuration(path[i - 1], item) : null;

    let openedFromDomain: string | undefined;
    if (item.openedFrom) {
      try {
        openedFromDomain = new URL(item.openedFrom).hostname;
      } catch {
        openedFromDomain = item.openedFrom;
      }
    }

    // Gap height
    if (i > 0 && delayMs !== null) {
      currentY += 28;
    }

    // Opened From marker height
    if (openedFromDomain) {
      currentY += 26;
    }

    tempCtx.font = urlFont;
    const urlLines = wrapCanvasText(tempCtx, item.url, textMaxWidth);

    let ipLine: string | undefined;
    if (item.ip && item.ip !== 'Unknown') {
      ipLine = `IP: ${item.ip}`;
    }

    // Swiss Modernist 2-row card:
    // Top row: 34px (badges + timestamp)
    // Divider: 1px
    // URL row: 10px top + urlLines.length * 18px + (ipLine ? 20px : 0) + 10px bottom
    let cardHeight = 34 + 10 + urlLines.length * 18 + (ipLine ? 20 : 0) + 10;
    cardHeight = Math.max(cardHeight, 66);

    layouts.push({
      item,
      index: i,
      topY: currentY,
      height: cardHeight,
      urlLines,
      ipLine,
      delayMs,
      openedFromDomain,
    });

    currentY += cardHeight + 12; // Gap between cards
  }

  const canvasHeight = currentY + 36;

  // Pass 2: Render onto high-DPI supersampled canvas
  const canvas = document.createElement('canvas');
  // Multiply canvas buffer dimensions by RETINA_SCALE for razor-sharp vector font rasterization
  canvas.width = Math.round(canvasWidth * RETINA_SCALE);
  canvas.height = Math.round(canvasHeight * RETINA_SCALE);

  const ctx = canvas.getContext('2d')!;

  // Scale the context so all coordinate math remains intuitive 1x values
  ctx.scale(RETINA_SCALE, RETINA_SCALE);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Canvas background (Swiss neutral paper)
  ctx.fillStyle = SWISS.paper;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Outer border
  drawRect(ctx, 0, 0, canvasWidth, canvasHeight, undefined, SWISS.line, 1);

  // ========== HEADER ==========
  // Top brand accent stripe
  ctx.fillStyle = SWISS.brand;
  ctx.fillRect(0, 0, canvasWidth, 3);

  // Header background
  ctx.fillStyle = SWISS.subtle;
  ctx.fillRect(0, 3, canvasWidth, 107);

  // Header bottom border
  ctx.strokeStyle = SWISS.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 110.5);
  ctx.lineTo(canvasWidth, 110.5);
  ctx.stroke();

  // Draw Logo Mark
  const logoImg = await loadLogoImage();
  const logoX = 24;
  const logoY = 20;
  if (logoImg) {
    ctx.drawImage(logoImg, logoX, logoY, 40, 40);
  } else {
    drawLogoMark(ctx, logoX, logoY, 40);
  }

  const textStartX = logoX + 52;

  // Extension Title: "REDIRECT" (ink) + "WISE" (brand)
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `900 17px ${FONT_SANS}`;
  ctx.fillStyle = SWISS.ink;
  ctx.fillText('REDIRECT', textStartX, 38);
  const redirWidth = ctx.measureText('REDIRECT').width;
  ctx.fillStyle = SWISS.brand;
  ctx.fillText('WISE', textStartX + redirWidth, 38);

  // Tagline
  ctx.fillStyle = SWISS.muted;
  ctx.font = `700 9px ${FONT_MONO}`;
  ctx.fillText('URL REDIRECT CHECKER', textStartX, 51);

  // URLs Sub-info
  ctx.font = `11.5px ${FONT_MONO}`;
  const maxHeaderUrlChars = 62;
  const displaySrc =
    originalUrl.length > maxHeaderUrlChars
      ? originalUrl.substring(0, maxHeaderUrlChars - 3) + '...'
      : originalUrl;
  const displayDest =
    finalUrl.length > maxHeaderUrlChars
      ? finalUrl.substring(0, maxHeaderUrlChars - 3) + '...'
      : finalUrl;

  ctx.fillStyle = SWISS.muted;
  ctx.fillText('SRC:', textStartX, 73);
  ctx.fillStyle = SWISS.stone;
  ctx.fillText(displaySrc, textStartX + 36, 73);

  if (originalUrl !== finalUrl) {
    ctx.fillStyle = SWISS.muted;
    ctx.fillText('DST:', textStartX, 91);
    ctx.fillStyle = SWISS.stone;
    ctx.fillText(displayDest, textStartX + 36, 91);
  }

  // Header Right-Aligned Stats Cluster
  const rightX = canvasWidth - 24;
  ctx.textAlign = 'right';

  // Hops and Redirects Badges
  const hopsCount = path.length;
  const hopsText = `${hopsCount} ${hopsCount === 1 ? 'HOP' : 'HOPS'}`;
  const redirectText = `${redirectCount} ${redirectCount === 1 ? 'REDIRECT' : 'REDIRECTS'}`;

  ctx.font = `bold 10px ${FONT_MONO}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  if (redirectCount > 0) {
    const rTextWidth = ctx.measureText(redirectText).width;
    const rBadgeW = Math.round(rTextWidth + 14);
    const rBadgeH = 22;
    const rBadgeX = rightX - rBadgeW;
    const rBadgeY = 22;

    const hTextWidth = ctx.measureText(hopsText).width;
    const hBadgeW = Math.round(hTextWidth + 14);
    const hBadgeH = 22;
    const hBadgeX = rBadgeX - hBadgeW - 6;

    // 1. Hops Badge
    drawRect(ctx, hBadgeX, rBadgeY, hBadgeW, hBadgeH, SWISS.card, SWISS.line, 1);
    ctx.fillStyle = SWISS.ink;
    ctx.fillText(hopsText, hBadgeX + hBadgeW / 2, rBadgeY + hBadgeH / 2);

    // 2. Redirect Count Badge
    drawRect(ctx, rBadgeX, rBadgeY, rBadgeW, rBadgeH, SWISS.card, SWISS.line, 1);
    ctx.fillStyle = SWISS.ink;
    ctx.fillText(redirectText, rBadgeX + rBadgeW / 2, rBadgeY + rBadgeH / 2);
  } else {
    // Only 1 direct hop (0 redirects): show clean Hops badge, no empty second tag
    const hTextWidth = ctx.measureText(hopsText).width;
    const hBadgeW = Math.round(hTextWidth + 14);
    const hBadgeH = 22;
    const hBadgeX = rightX - hBadgeW;
    const hBadgeY = 22;

    drawRect(ctx, hBadgeX, hBadgeY, hBadgeW, hBadgeH, SWISS.card, SWISS.line, 1);
    ctx.fillStyle = SWISS.ink;
    ctx.fillText(hopsText, hBadgeX + hBadgeW / 2, hBadgeY + hBadgeH / 2);
  }

  // Reset text align for subsequent right-aligned stats (Total Time & Date)
  ctx.textAlign = 'right';

  // Total Duration
  if (totalTime > 0) {
    ctx.fillStyle = SWISS.brand;
    ctx.font = `bold 10.5px ${FONT_MONO}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`⚡ ${formatDuration(totalTime).toUpperCase()} TOTAL`, rightX, 64);
  }

  // Date
  ctx.fillStyle = SWISS.muted;
  ctx.font = `10px ${FONT_MONO}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(format(timestamp, "MMM d, yyyy 'at' h:mm a"), rightX, 84);

  // Reset text alignment for timeline and cards
  ctx.textAlign = 'left';

  // ========== TIMELINE CONNECTOR ==========
  if (layouts.length > 1) {
    const first = layouts[0];
    const last = layouts[layouts.length - 1];
    if (first && last) {
      const firstCenterY = first.topY + 17;
      const lastCenterY = last.topY + 17;

      ctx.beginPath();
      ctx.moveTo(48, firstCenterY);
      ctx.lineTo(48, lastCenterY);
      ctx.strokeStyle = SWISS.line;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // ========== STEP CARDS ==========
  for (const layout of layouts) {
    const { item, index, topY, height, urlLines, ipLine, delayMs, openedFromDomain } = layout;
    const badge = getStatusBadge(item);
    const redirectLabel = getRedirectTypeLabel(item);

    let drawY = topY;

    // Draw Gap Badge
    if (index > 0 && delayMs !== null) {
      const gapY = drawY - 20;
      const gapText = `⏱ ${formatDuration(delayMs).toUpperCase()} GAP`;
      ctx.font = `bold 10px ${FONT_MONO}`;
      const gapTextWidth = ctx.measureText(gapText).width;
      const pillW = Math.round(gapTextWidth + 16);
      const pillH = 18;
      const pillX = cardX + 12;

      drawRect(ctx, pillX, gapY, pillW, pillH, SWISS.subtle, SWISS.line, 1);
      ctx.fillStyle = SWISS.stone;
      ctx.textBaseline = 'middle';
      ctx.fillText(gapText, pillX + 8, gapY + pillH / 2);
    }

    // Draw Opened From Marker if present
    if (openedFromDomain) {
      const markerY = drawY - 20;
      const markerText = `NEW TAB FROM ${openedFromDomain}`;
      ctx.font = `bold 10px ${FONT_MONO}`;
      const markerWidth = ctx.measureText(markerText).width;
      const bannerW = Math.round(markerWidth + 16);
      const bannerH = 18;
      const bannerX = cardX + 12;

      drawRect(ctx, bannerX, markerY, bannerW, bannerH, SWISS.brand, SWISS.brand, 1);
      ctx.fillStyle = SWISS.white;
      ctx.textBaseline = 'middle';
      ctx.fillText(markerText, bannerX + 8, markerY + bannerH / 2);
    }

    // Hop Square Badge on Timeline (x = 36 to 60, center x = 48)
    const hopSize = 24;
    const hopX = 36;
    const hopY = drawY + 5;
    drawRect(ctx, hopX, hopY, hopSize, hopSize, badge.hopBg);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = SWISS.white;
    ctx.font = `bold 11px ${FONT_MONO}`;
    ctx.fillText((index + 1).toString(), hopX + hopSize / 2, hopY + hopSize / 2);
    ctx.textAlign = 'left';

    // Main Card Surface: Crisp Swiss Modernist rectangle
    drawRect(ctx, cardX, drawY, cardWidth, height, SWISS.card, SWISS.line, 1);

    // Card Top Row (Badges + Actions cluster)
    let badgeX = cardX + 10;
    const topRowH = 20;
    const topRowY = drawY + 7;

    // 1. Status Code Badge
    const codeStr = item.status_code.toString();
    ctx.font = `bold 11px ${FONT_MONO}`;
    const codeWidth = ctx.measureText(codeStr).width;
    const codeW = Math.round(codeWidth + 14);

    drawRect(ctx, badgeX, topRowY, codeW, topRowH, badge.badgeBg, badge.badgeBorder, 1);
    ctx.fillStyle = badge.text;
    ctx.textBaseline = 'middle';
    ctx.fillText(codeStr, badgeX + 7, topRowY + topRowH / 2);
    badgeX += codeW + 6;

    // 2. Redirect Type Badge (Permanent, Temporary, HSTS, etc.)
    if (redirectLabel) {
      const labelText = redirectLabel.toUpperCase();
      ctx.font = `bold 10px ${FONT_MONO}`;
      const lblWidth = ctx.measureText(labelText).width;
      const lblW = Math.round(lblWidth + 12);

      drawRect(ctx, badgeX, topRowY, lblW, topRowH, SWISS.warnBg, SWISS.warnBorder, 1);
      ctx.fillStyle = SWISS.warn;
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, badgeX + 6, topRowY + topRowH / 2);
      badgeX += lblW + 6;
    }

    // 3. Timing / Duration Badge
    if (item.timing?.duration !== undefined) {
      const durText = formatDuration(item.timing.duration);
      ctx.font = `500 10.5px ${FONT_MONO}`;
      const durWidth = ctx.measureText(durText).width;
      const durW = Math.round(durWidth + 12);

      drawRect(ctx, badgeX, topRowY, durW, topRowH, SWISS.subtle, SWISS.line, 1);
      ctx.fillStyle = SWISS.stone;
      ctx.textBaseline = 'middle';
      ctx.fillText(durText, badgeX + 6, topRowY + topRowH / 2);
      badgeX += durW + 6;
    }

    // 4. Insecure HTTP Badge
    if (item.url.startsWith('http://')) {
      const httpText = 'HTTP INSECURE';
      ctx.font = `bold 10px ${FONT_MONO}`;
      const httpWidth = ctx.measureText(httpText).width;
      const httpW = Math.round(httpWidth + 12);

      drawRect(ctx, badgeX, topRowY, httpW, topRowH, SWISS.errBg, SWISS.errBorder, 1);
      ctx.fillStyle = SWISS.err;
      ctx.textBaseline = 'middle';
      ctx.fillText(httpText, badgeX + 6, topRowY + topRowH / 2);
      badgeX += httpW + 6;
    }

    // 5. Compression Badge (Brotli / Gzip)
    const encoding = item.headers.find(h => h.name.toLowerCase() === 'content-encoding')?.value;
    if (encoding) {
      const displayEncoding =
        encoding === 'br' ? 'BROTLI' : encoding === 'gzip' ? 'GZIP' : encoding.toUpperCase();
      ctx.font = `bold 10px ${FONT_MONO}`;
      const encWidth = ctx.measureText(displayEncoding).width;
      const encW = Math.round(encWidth + 12);

      drawRect(ctx, badgeX, topRowY, encW, topRowH, SWISS.card, SWISS.line, 1);
      ctx.fillStyle = SWISS.brand;
      ctx.textBaseline = 'middle';
      ctx.fillText(displayEncoding, badgeX + 6, topRowY + topRowH / 2);
      badgeX += encW + 6;
    }

    // Timestamp on right side of card top row
    const timeStr = formatTime(item.timestamp);
    if (timeStr) {
      ctx.textAlign = 'right';
      ctx.fillStyle = SWISS.muted;
      ctx.font = `11px ${FONT_MONO}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(timeStr, cardX + cardWidth - 12, topRowY + topRowH / 2);
      ctx.textAlign = 'left';
    }

    // Divider line between card top row and URL row
    ctx.strokeStyle = SWISS.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX, drawY + 34.5);
    ctx.lineTo(cardX + cardWidth, drawY + 34.5);
    ctx.stroke();

    // URL row: Crisp monospace text
    ctx.fillStyle = SWISS.stone;
    ctx.font = urlFont;
    ctx.textBaseline = 'top';
    let urlY = drawY + 46;
    for (const line of urlLines) {
      ctx.fillText(line, cardX + 12, urlY);
      urlY += 18;
    }

    // IP Line if available
    if (ipLine) {
      ctx.fillStyle = SWISS.muted;
      ctx.font = `10.5px ${FONT_MONO}`;
      ctx.fillText(ipLine, cardX + 12, urlY + 2);
    }
  }

  // ========== FOOTER ==========
  const footerY = canvasHeight - 14;
  ctx.fillStyle = SWISS.muted;
  ctx.font = `9.5px ${FONT_MONO}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('REDIRECTWISE // GAURAVLABS', 24, footerY);

  ctx.textAlign = 'right';
  ctx.fillText('HTTPS://REDIRECTWISE.GAURAVLABS.COM', canvasWidth - 24, footerY);
  ctx.textAlign = 'left';

  // Trigger download at high-DPI resolution
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `redirectwise-chain-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
