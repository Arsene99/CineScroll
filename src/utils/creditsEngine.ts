import { CreditsConfig, ScrollDirection, TextAlignment } from '../types';

export interface ParsedCreditLine {
  type: 'title' | 'role-pair' | 'regular' | 'blank';
  title?: string;
  role?: string;
  name?: string;
  text?: string;
  lineIndex: number;
}

/**
 * Parses raw credits text into structured line items.
 * Lines like "DIRECTEUR DE LA PHOTOGRAPHIE : Marie Dupont" become role-pairs.
 * Lines with # or ALL CAPS become title headers.
 */
export function parseCreditsText(rawText: string): ParsedCreditLine[] {
  const lines = rawText.split('\n');
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return { type: 'blank', lineIndex: idx };
    }

    if (trimmed.startsWith('#') || trimmed.startsWith('===') || trimmed.startsWith('---')) {
      const cleanTitle = trimmed.replace(/^[#=\-\s]+/, '').replace(/[#=\-\s]+$/, '');
      return { type: 'title', title: cleanTitle, lineIndex: idx };
    }

    if (trimmed.includes(' : ') || trimmed.includes(' - ')) {
      const sep = trimmed.includes(' : ') ? ' : ' : ' - ';
      const parts = trimmed.split(sep);
      return {
        type: 'role-pair',
        role: parts[0].trim(),
        name: parts.slice(1).join(sep).trim(),
        lineIndex: idx,
      };
    }

    // Check if it's an uppercase header
    if (trimmed.length > 2 && trimmed === trimmed.toUpperCase() && !trimmed.match(/[0-9]/)) {
      return { type: 'title', title: trimmed, lineIndex: idx };
    }

    return { type: 'regular', text: trimmed, lineIndex: idx };
  });
}

/**
 * Calculates current scroll offset in CSS/canvas pixels.
 * progress is normalized between 0.0 and 1.0.
 */
export function calculateScrollPosition(
  progress: number,
  canvasHeight: number,
  totalContentHeight: number,
  direction: ScrollDirection
): number {
  const clampedProgress = Math.max(0, Math.min(1, progress));

  if (direction === 'bottom-to-top') {
    // Starts just below bottom of canvas (+canvasHeight) and moves up until completely off screen (-totalContentHeight)
    const startY = canvasHeight;
    const endY = -totalContentHeight;
    return startY + clampedProgress * (endY - startY);
  }

  if (direction === 'top-to-bottom') {
    // Starts above top of canvas (-totalContentHeight) and moves down until below bottom (+canvasHeight)
    const startY = -totalContentHeight;
    const endY = canvasHeight;
    return startY + clampedProgress * (endY - startY);
  }

  if (direction === 'fade-in') {
    // Centered vertically, stays in place
    return (canvasHeight - totalContentHeight) / 2;
  }

  if (direction === 'star-crawl') {
    // Perspective crawl starting near bottom and receding towards top
    const startY = canvasHeight * 0.9;
    const endY = -totalContentHeight * 1.2;
    return startY + clampedProgress * (endY - startY);
  }

  return 0;
}

/**
 * Generates valid CSS font string with robust fallback typography chains.
 * Always produces valid syntax for Canvas 2D contexts, preventing silent font drop.
 */
export function getCanvasFont(
  weight: number | string,
  sizePx: number,
  fontFamily: string
): string {
  const clean = (fontFamily || 'Cinzel')
    .split(',')[0]
    .replace(/['"]/g, '')
    .trim();

  switch (clean.toLowerCase()) {
    case 'cinzel':
      return `${weight} ${sizePx}px "Cinzel", Georgia, "Times New Roman", serif`;
    case 'montserrat':
      return `${weight} ${sizePx}px "Montserrat", "Segoe UI", Roboto, sans-serif`;
    case 'bebas neue':
    case 'bebas':
      return `${weight} ${sizePx}px "Bebas Neue", Impact, "Arial Narrow Bold", sans-serif`;
    case 'playfair display':
    case 'playfair':
      return `${weight} ${sizePx}px "Playfair Display", Didot, Georgia, serif`;
    case 'courier prime':
    case 'courier':
      return `${weight} ${sizePx}px "Courier Prime", "Courier New", monospace`;
    case 'space grotesk':
    case 'space':
      return `${weight} ${sizePx}px "Space Grotesk", "Trebuchet MS", sans-serif`;
    case 'inter':
      return `${weight} ${sizePx}px "Inter", system-ui, -apple-system, sans-serif`;
    default:
      return `${weight} ${sizePx}px "${clean}", sans-serif`;
  }
}

/**
 * Calculates exact line height for a parsed credit item.
 */
export function getLineHeight(
  line: ParsedCreditLine,
  baseFontSize: number,
  lineSpacing: number
): number {
  if (line.type === 'blank') {
    return baseFontSize * 1.0;
  }
  if (line.type === 'title') {
    const titleSize = Math.round(baseFontSize * 1.4);
    return titleSize * lineSpacing + baseFontSize * 0.5;
  }
  return baseFontSize * lineSpacing;
}

/**
 * Measures total vertical height occupied by the parsed credits text.
 */
export function measureCreditsContentHeight(
  parsedLines: ParsedCreditLine[],
  baseFontSize: number,
  lineSpacing: number
): number {
  let totalHeight = 0;
  for (const line of parsedLines) {
    totalHeight += getLineHeight(line, baseFontSize, lineSpacing);
  }
  return Math.max(totalHeight, baseFontSize * 2);
}

/**
 * Format seconds to MM:SS or MM:SS.S
 */
export function formatTime(seconds: number, includeSubseconds = false): string {
  const safeSec = Math.max(0, seconds);
  const mins = Math.floor(safeSec / 60);
  const secs = Math.floor(safeSec % 60);
  const tenths = Math.floor((safeSec % 1) * 10);

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  if (includeSubseconds) {
    return `${pad(mins)}:${pad(secs)}.${tenths}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Calculates canvas pixel dimensions for a given aspect ratio and display container size.
 */
export type ExportResolution = '720p' | '1080p' | '4k';
export type ExportFormat = 'mp4' | 'webm';
export type ExportQuality = 'compact' | 'balanced' | 'high';
export type ExportFps = 15 | 24 | 30 | 60;

/**
 * Calculates standard video pixel dimensions and calibrated bitrates for export.
 * Guarantees even dimensions required by video encoders (H.264 / VP9).
 */
export function getResolutionDimensions(
  aspectRatio: '9:16' | '16:9' | '1:1',
  resolution: ExportResolution,
  quality: ExportQuality = 'balanced',
  hasMotionBackground = false,
  fps: ExportFps = 24
): { width: number; height: number; bitrate: number; audioBitrate: number; label: string } {
  const qualityMultiplier = quality === 'compact' ? 0.58 : quality === 'high' ? 1.85 : 1.0;
  const motionMultiplier = hasMotionBackground ? 1.55 : 1.0;
  const fpsMultiplier =
    fps <= 15 ? 0.72 : fps <= 24 ? 0.9 : fps <= 30 ? 1.0 : 1.45;
  const audioBitrate = quality === 'high' ? 96_000 : 64_000;

  let width = 1080;
  let height = 1920;
  let baseTextBitrate = 720_000;
  let label = '1080×1920 (Full HD)';

  if (resolution === '720p') {
    baseTextBitrate = 380_000;
    if (aspectRatio === '9:16') {
      width = 720; height = 1280; label = '720×1280 (HD)';
    } else if (aspectRatio === '16:9') {
      width = 1280; height = 720; label = '1280×720 (HD)';
    } else {
      width = 720; height = 720; baseTextBitrate = 330_000; label = '720×720 (HD Carré)';
    }
  } else if (resolution === '4k') {
    baseTextBitrate = 2_200_000;
    if (aspectRatio === '9:16') {
      width = 2160; height = 3840; label = '2160×3840 (4K UHD)';
    } else if (aspectRatio === '16:9') {
      width = 3840; height = 2160; label = '3840×2160 (4K UHD)';
    } else {
      width = 2160; height = 2160; baseTextBitrate = 1_850_000; label = '2160×2160 (4K Carré)';
    }
  } else {
    baseTextBitrate = 720_000;
    if (aspectRatio === '9:16') {
      width = 1080; height = 1920; label = '1080×1920 (Full HD)';
    } else if (aspectRatio === '16:9') {
      width = 1920; height = 1080; label = '1920×1080 (Full HD)';
    } else {
      width = 1080; height = 1080; baseTextBitrate = 620_000; label = '1080×1080 (Full HD Carré)';
    }
  }

  const bitrate = Math.round(baseTextBitrate * qualityMultiplier * motionMultiplier * fpsMultiplier);
  return { width, height, bitrate, audioBitrate, label };
}

/**
 * Estimates exported file size in MB based on target video + audio bitrates and MP4/WebM container overhead (~3%).
 * Avoids optimistic under-estimation so final file sizes stay at or below the previewed estimate.
 */
export function estimateExportSizeMB(
  durationSeconds: number,
  videoBitrateBps: number,
  hasAudio: boolean,
  audioBitrateBps = 64_000
): number {
  if (durationSeconds <= 0) return 0;
  const totalBps = videoBitrateBps + (hasAudio ? audioBitrateBps : 0);
  const bytesWithMuxOverhead = ((totalBps * durationSeconds) / 8) * 1.03;
  return Math.max(0.1, Number((bytesWithMuxOverhead / (1024 * 1024)).toFixed(1)));
}

/**
 * Formats byte sizes cleanly in French (Ko / Mo).
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/**
 * Calculates canvas pixel dimensions for a given aspect ratio and display container size.
 */
export function getCanvasDimensions(aspectRatio: '9:16' | '16:9' | '1:1', maxDimension = 1080): {
  width: number;
  height: number;
} {
  switch (aspectRatio) {
    case '9:16': {
      const rawW = Math.round((maxDimension * 9) / 16);
      return { width: rawW % 2 === 0 ? rawW : rawW + 1, height: maxDimension };
    }
    case '16:9': {
      const rawH = Math.round((maxDimension * 9) / 16);
      return { width: maxDimension, height: rawH % 2 === 0 ? rawH : rawH + 1 };
    }
    case '1:1':
    default:
      return { width: maxDimension, height: maxDimension };
  }
}

export interface RenderFrameOptions {
  cachedBackground?: HTMLCanvasElement | null;
  fastShadow?: boolean;
}

/**
 * Pre-renders static color, gradient, or photo background (+ overlay) once before an export
 * so hundreds/thousands of frames avoid re-scaling images or recreating gradients.
 */
export function createStaticBackgroundCache(
  width: number,
  height: number,
  config: CreditsConfig,
  bgImage: HTMLImageElement | null
): HTMLCanvasElement | null {
  if (config.background.source === 'video' || typeof document === 'undefined') {
    return null;
  }

  const cache = document.createElement('canvas');
  cache.width = width;
  cache.height = height;
  const ctx = cache.getContext('2d');
  if (!ctx) return null;

  if (config.background.source === 'color') {
    ctx.fillStyle = config.background.value || '#050505';
    ctx.fillRect(0, 0, width, height);
  } else if (bgImage) {
    try {
      const mediaW = bgImage.naturalWidth || width;
      const mediaH = bgImage.naturalHeight || height;
      const ratio = Math.max(width / mediaW, height / mediaH);
      const centerShiftX = (width - mediaW * ratio) / 2;
      const centerShiftY = (height - mediaH * ratio) / 2;
      ctx.drawImage(bgImage, 0, 0, mediaW, mediaH, centerShiftX, centerShiftY, mediaW * ratio, mediaH * ratio);
    } catch {
      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#0c0d14');
    grad.addColorStop(0.5, '#050507');
    grad.addColorStop(1, '#020203');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  if (config.background.overlayOpacity > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${config.background.overlayOpacity})`;
    ctx.fillRect(0, 0, width, height);
  }

  return cache;
}

/**
 * Renders one frame of credits onto a 2D canvas context.
 */
export function renderCreditsFrame(
  ctx: CanvasRenderingContext2D,
  config: CreditsConfig,
  currentTime: number,
  parsedLines: ParsedCreditLine[],
  bgMedia: HTMLImageElement | HTMLVideoElement | null,
  options?: RenderFrameOptions
) {
  const { width, height } = ctx.canvas;
  const progress = config.speedDuration > 0 ? currentTime / config.speedDuration : 0;

  // Scale typography proportionally to canvas width so layout is identical at any resolution
  const refWidth = getCanvasDimensions(config.aspectRatio, 1080).width;
  const scale = width / refWidth;
  const baseFontSize = Math.max(10, Math.round(config.fontSize * scale));

  const totalContentHeight = measureCreditsContentHeight(
    parsedLines,
    baseFontSize,
    config.lineSpacing
  );

  // 1 & 2 & 3. Background (fast cached blit during export, or live render)
  if (options?.cachedBackground) {
    ctx.drawImage(options.cachedBackground, 0, 0);
  } else {
    ctx.clearRect(0, 0, width, height);

    if (config.background.source === 'color') {
      ctx.fillStyle = config.background.value || '#050505';
      ctx.fillRect(0, 0, width, height);
    } else if (bgMedia) {
      try {
        const mediaW = (bgMedia as HTMLVideoElement).videoWidth || (bgMedia as HTMLImageElement).naturalWidth || width;
        const mediaH = (bgMedia as HTMLVideoElement).videoHeight || (bgMedia as HTMLImageElement).naturalHeight || height;
        const hRatio = width / mediaW;
        const vRatio = height / mediaH;
        const ratio = Math.max(hRatio, vRatio);
        const centerShiftX = (width - mediaW * ratio) / 2;
        const centerShiftY = (height - mediaH * ratio) / 2;

        ctx.drawImage(bgMedia, 0, 0, mediaW, mediaH, centerShiftX, centerShiftY, mediaW * ratio, mediaH * ratio);
      } catch {
        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(0, 0, width, height);
      }
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#0c0d14');
      grad.addColorStop(0.5, '#050507');
      grad.addColorStop(1, '#020203');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    if (config.background.overlayOpacity > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${config.background.overlayOpacity})`;
      ctx.fillRect(0, 0, width, height);
    }
  }

  // 4. Calculate Scroll Y
  const currentY = calculateScrollPosition(progress, height, totalContentHeight, config.direction);

  // 5. Draw text
  ctx.save();

  if (config.direction === 'star-crawl') {
    ctx.setTransform(1, 0, 0, 0.45, 0, height * 0.25);
  }

  let yCursor = currentY;
  const paddingX = width * 0.08;

  const useFastOffsetShadow = Boolean(config.textShadow && options?.fastShadow);
  const shadowOffsetY = Math.max(1, Math.round(2 * scale));

  if (config.textShadow && !useFastOffsetShadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = Math.round(8 * scale);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = shadowOffsetY;
  } else {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  const canCullVertically = config.direction !== 'star-crawl';
  const cullTop = -baseFontSize * 2.5;
  const cullBottom = height + baseFontSize * 2.5;

  const drawTextWithOptionalFastShadow = (text: string, x: number, y: number, fillStyle: string) => {
    if (useFastOffsetShadow) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
      ctx.fillText(text, x, y + shadowOffsetY);
    }
    ctx.fillStyle = fillStyle;
    ctx.fillText(text, x, y);
  };

  for (const line of parsedLines) {
    const lineH = getLineHeight(line, baseFontSize, config.lineSpacing);

    if (line.type === 'blank') {
      yCursor += lineH;
      continue;
    }

    // Skip off-screen text rasterization for fast multi-hundred-line renders
    if (canCullVertically && (yCursor + lineH < cullTop || yCursor - lineH > cullBottom)) {
      yCursor += lineH;
      continue;
    }

    if (line.type === 'title') {
      const titleSize = Math.round(baseFontSize * 1.4);
      ctx.font = getCanvasFont(700, titleSize, config.fontFamily);
      ctx.textAlign = 'center';
      drawTextWithOptionalFastShadow(line.title || '', width / 2, yCursor, config.color);
      yCursor += lineH;
      continue;
    }

    if (line.type === 'role-pair' && config.roleSeparation) {
      const roleSize = Math.round(baseFontSize * 0.95);
      const nameSize = Math.round(baseFontSize * 1.05);

      const colGap = width * 0.05;
      const leftColX = width / 2 - colGap / 2;
      const rightColX = width / 2 + colGap / 2;

      ctx.font = getCanvasFont(500, roleSize, config.fontFamily);
      ctx.textAlign = 'right';
      drawTextWithOptionalFastShadow(line.role || '', leftColX, yCursor, 'rgba(255, 255, 255, 0.7)');

      ctx.font = getCanvasFont(700, nameSize, config.fontFamily);
      ctx.textAlign = 'left';
      drawTextWithOptionalFastShadow(line.name || '', rightColX, yCursor, config.color);

      yCursor += lineH;
      continue;
    }

    const textToDraw = line.type === 'role-pair' ? `${line.role} : ${line.name}` : (line.text || '');
    ctx.font = getCanvasFont(600, baseFontSize, config.fontFamily);

    let textX = width / 2;
    if (config.alignment === 'left') {
      textX = paddingX;
      ctx.textAlign = 'left';
    } else if (config.alignment === 'right') {
      textX = width - paddingX;
      ctx.textAlign = 'right';
    } else {
      ctx.textAlign = 'center';
    }

    drawTextWithOptionalFastShadow(textToDraw, textX, yCursor, config.color);
    yCursor += lineH;
  }

  ctx.restore();
}
