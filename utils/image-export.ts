import { format } from 'date-fns';
import { RedirectItem, calculateGapDuration, formatDuration } from '../types/redirect';

// Modern Color Palette matching light theme
const COLORS = {
  success: {
    bg: '#F0FDF4', // green 50
    border: '#BBF7D0', // green 200
    circle: '#22C55E', // green 500
    text: '#15803D', // green 700
    badgeBg: '#DCFCE7', // green 100
  },
  redirect: {
    bg: '#FFFBEB', // amber 50
    border: '#FEF3C7', // amber 200
    circle: '#F59E0B', // amber 500
    text: '#B45309', // amber 700
    badgeBg: '#FEF3C7', // amber 100
  },
  clientError: {
    bg: '#FEF2F2', // red 50
    border: '#FECACA', // red 200
    circle: '#EF4444', // red 500
    text: '#B91C1C', // red 700
    badgeBg: '#FEE2E2', // red 100
  },
  serverError: {
    bg: '#FEF2F2', // red 50
    border: '#FECACA', // red 200
    circle: '#DC2626', // red 600
    text: '#B91C1C', // red 700
    badgeBg: '#FEE2E2', // red 100
  },
  default: {
    bg: '#F8FAFC', // slate 50
    border: '#E2E8F0', // slate 200
    circle: '#94A3B8', // slate 400
    text: '#475569', // slate 700
    badgeBg: '#F1F5F9', // slate 100
  },
};

interface CardLayout {
  item: RedirectItem;
  index: number;
  topY: number;
  height: number;
  urlLines: string[];
  ipLine?: string;
  delayMs: number | null;
}

function getColorsForItem(item: RedirectItem) {
  if (item.statusObject.isSuccess) return COLORS.success;
  if (item.statusObject.isRedirect) return COLORS.redirect;
  if (item.statusObject.isClientError) return COLORS.clientError;
  if (item.statusObject.isServerError) return COLORS.serverError;
  return COLORS.default;
}

function getStatusLabel(item: RedirectItem): string {
  const getMsg = (key: string, fallback: string) => {
    try {
      return chrome.i18n.getMessage(key) || fallback;
    } catch {
      return fallback;
    }
  };

  if (item.type === 'server_redirect') {
    if (item.redirect_type === 'permanent') return getMsg('permanentRedirect', 'Permanent Redirect (301/308)');
    if (item.redirect_type === 'hsts') return getMsg('hstsRedirect', 'HSTS Redirect');
    return getMsg('temporaryRedirect', 'Temporary Redirect (302/307)');
  }
  if (item.type === 'client_redirect') {
    return `Client Redirect (${item.redirect_type?.toUpperCase() || 'JS'})`;
  }
  return item.status_line || 'Navigation';
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const words = text.split(' ');
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
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

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fillColor: string,
  strokeColor?: string,
  strokeWidth = 1
) {
  ctx.beginPath();
  ctx.fillStyle = fillColor;
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
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
  const redirectCount = entry.redirectCount ?? path.filter(p => p.type !== 'navigation').length;

  const canvasWidth = 800;
  const cardX = 80;
  const cardWidth = 688;
  const insideCardPadding = 16;
  const textMaxWidth = cardWidth - insideCardPadding * 2; // 656px

  // Pass 1: Measure and compute layouts
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d')!;

  const titleFont = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  const urlFont = '13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';

  let currentY = 130; // Header ends around 110-120
  const layouts: CardLayout[] = [];

  for (let i = 0; i < path.length; i++) {
    const item = path[i];
    const delayMs = i > 0 ? calculateGapDuration(path[i - 1], item) : null;

    if (i > 0) {
      currentY += 36; // Gap height
    }

    tempCtx.font = urlFont;
    const urlLines = wrapCanvasText(tempCtx, item.url, textMaxWidth);

    let ipLine: string | undefined;
    if (item.ip && item.ip !== 'Unknown') {
      ipLine = `IP: ${item.ip}`;
    }

    // Padding top/bottom: 12px + 12px = 24px
    // Status header: 20px
    // Spacing: 6px
    // URL lines: urlLines.length * 18px
    let cardHeight = 12 + 20 + 6 + urlLines.length * 18 + 12;
    if (ipLine) {
      cardHeight += 6 + 16; // spacing + ip text height
    }

    cardHeight = Math.max(cardHeight, 64);

    layouts.push({
      item,
      index: i,
      topY: currentY,
      height: cardHeight,
      urlLines,
      ipLine,
      delayMs,
    });

    currentY += cardHeight;
  }

  const canvasHeight = currentY + 32;

  // Pass 2: Create canvas and draw
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d')!;

  // Smooth drawing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Draw border around the entire canvas
  ctx.strokeStyle = '#F1F5F9';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, canvasWidth - 2, canvasHeight - 2);

  // Draw Header box background
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, canvasWidth, 110);
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 110);
  ctx.lineTo(canvasWidth, 110);
  ctx.stroke();

  // Try to load logo and draw it
  const logoImg = await loadLogoImage();
  let titleX = 32;
  if (logoImg) {
    ctx.drawImage(logoImg, 32, 24, 48, 48);
    titleX = 96;
  }

  // Draw Header title
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  ctx.fillText(title, titleX, 42);

  // Draw Header sub-info (URLs)
  ctx.fillStyle = '#475569';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  const truncateLimit = 420;
  tempCtx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const displaySrc = originalUrl.length > 60 ? originalUrl.substring(0, 57) + '...' : originalUrl;
  const displayDest = finalUrl.length > 60 ? finalUrl.substring(0, 57) + '...' : finalUrl;

  ctx.fillText(`Source: ${displaySrc}`, titleX, 64);
  if (originalUrl !== finalUrl) {
    ctx.fillText(`Destination: ${displayDest}`, titleX, 82);
  }

  // Draw Header meta (Right aligned)
  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748B';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  ctx.fillText(`${redirectCount} ${redirectCount === 1 ? 'redirect' : 'redirects'}`, canvasWidth - 32, 40);
  if (totalTime > 0) {
    ctx.fillText(`Total time: ${formatDuration(totalTime)}`, canvasWidth - 32, 60);
  }
  ctx.fillText(format(timestamp, "MMM d, yyyy 'at' h:mm a"), canvasWidth - 32, 80);

  // Reset text alignment for card drawing
  ctx.textAlign = 'left';

  // Draw vertical timeline connector line
  if (layouts.length > 1) {
    const firstCircleY = layouts[0].topY + 28;
    const lastCircleY = layouts[layouts.length - 1].topY + 28;

    ctx.beginPath();
    ctx.moveTo(48, firstCircleY);
    ctx.lineTo(48, lastCircleY);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Draw each step card
  for (const layout of layouts) {
    const { item, index, topY, height, urlLines, ipLine, delayMs } = layout;
    const colors = getColorsForItem(item);

    // Draw Gap Badge if index > 0 and delayMs exists
    if (index > 0 && delayMs !== null) {
      const gapY = topY - 18; // center of gap
      const gapText = `${formatDuration(delayMs)} gap`;

      ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
      const gapTextWidth = ctx.measureText(gapText).width;
      const pillWidth = gapTextWidth + 24;
      const pillHeight = 20;
      const pillX = cardX + 16;
      const pillY = gapY - pillHeight / 2;

      // Draw background pill
      drawRoundRect(ctx, pillX, pillY, pillWidth, pillHeight, 10, '#FFFFFF', '#E2E8F0');

      // Draw Clock Icon (circle clock representation or clock symbol)
      ctx.fillStyle = '#64748B';
      ctx.font = '10px sans-serif';
      ctx.fillText('⏱', pillX + 6, gapY + 4);

      // Draw gap text
      ctx.fillStyle = '#64748B';
      ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
      ctx.fillText(gapText, pillX + 18, gapY + 4);
    }

    // Draw Card Container
    drawRoundRect(ctx, cardX, topY, cardWidth, height, 8, colors.bg, colors.border);

    // Draw Circle Hop Number
    const circleCenterY = topY + 28;
    ctx.beginPath();
    ctx.arc(48, circleCenterY, 16, 0, Math.PI * 2);
    ctx.fillStyle = colors.circle;
    ctx.fill();

    // Hop Number Text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    ctx.fillText((index + 1).toString(), 48, circleCenterY);

    // Reset baselines for card text
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Draw Status Label
    ctx.fillStyle = colors.text;
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    ctx.fillText(getStatusLabel(item), cardX + 16, topY + 26);

    // Right-aligned elements in the card header
    let rightX = cardX + cardWidth - 16;

    // 1. Draw Timestamp (far right)
    const timeStr = formatTime(item.timestamp);
    if (timeStr) {
      ctx.fillStyle = '#94A3B8';
      ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
      const timeWidth = ctx.measureText(timeStr).width;
      ctx.fillText(timeStr, rightX - timeWidth, topY + 25);
      rightX -= timeWidth + 12;
    }

    // 2. Draw Duration Badge
    if (item.timing?.duration !== undefined) {
      const durationStr = formatDuration(item.timing.duration);
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
      const durWidth = ctx.measureText(durationStr).width;
      const badgeW = durWidth + 12;
      const badgeH = 18;
      const badgeX = rightX - badgeW;
      const badgeY = topY + 11;

      drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4, '#F1F5F9', undefined);
      ctx.fillStyle = '#475569';
      ctx.fillText(durationStr, badgeX + 6, topY + 24);
      rightX -= badgeW + 8;
    }

    // 3. Draw Status Code Badge
    const codeStr = item.status_code.toString();
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    const codeWidth = ctx.measureText(codeStr).width;
    const codeBadgeW = codeWidth + 12;
    const codeBadgeH = 18;
    const codeBadgeX = rightX - codeBadgeW;
    const codeBadgeY = topY + 11;

    drawRoundRect(ctx, codeBadgeX, codeBadgeY, codeBadgeW, codeBadgeH, 4, colors.badgeBg, undefined);
    ctx.fillStyle = colors.text;
    ctx.fillText(codeStr, codeBadgeX + 6, topY + 24);
    rightX -= codeBadgeW + 8;

    // 4. Draw HTTPS Badge if applicable
    const isHttps = item.url.startsWith('https://');
    if (isHttps) {
      const httpsStr = 'HTTPS';
      ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
      const httpsWidth = ctx.measureText(httpsStr).width;
      const httpsBadgeW = httpsWidth + 10;
      const httpsBadgeH = 16;
      const httpsBadgeX = rightX - httpsBadgeW;
      const httpsBadgeY = topY + 12;

      drawRoundRect(ctx, httpsBadgeX, httpsBadgeY, httpsBadgeW, httpsBadgeH, 4, '#DCFCE7', '#BBF7D0');
      ctx.fillStyle = '#15803D';
      ctx.fillText(httpsStr, httpsBadgeX + 5, topY + 23);
      rightX -= httpsBadgeW + 6;
    }

    // 5. Draw Compression Badge if content encoding header exists
    const encoding = item.headers.find(h => h.name.toLowerCase() === 'content-encoding')?.value;
    if (encoding) {
      const displayEncoding = encoding === 'br' ? 'Brotli' : encoding === 'gzip' ? 'Gzip' : encoding;
      ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
      const encWidth = ctx.measureText(displayEncoding).width;
      const encBadgeW = encWidth + 10;
      const encBadgeH = 16;
      const encBadgeX = rightX - encBadgeW;
      const encBadgeY = topY + 12;

      drawRoundRect(ctx, encBadgeX, encBadgeY, encBadgeW, encBadgeH, 4, '#F3E8FF', '#E9D5FF');
      ctx.fillStyle = '#7E22CE';
      ctx.fillText(displayEncoding, encBadgeX + 5, topY + 23);
    }

    // Draw URL Lines
    ctx.fillStyle = '#475569';
    ctx.font = '13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
    let urlY = topY + 38;
    for (const line of urlLines) {
      ctx.fillText(line, cardX + 16, urlY + 11);
      urlY += 18;
    }

    // Draw IP Address if available
    if (ipLine) {
      ctx.fillStyle = '#94A3B8';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
      ctx.fillText(ipLine, cardX + 16, urlY + 10);
    }
  }

  // Trigger download
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `redirectwise-chain-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
