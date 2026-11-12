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
 * Measures total vertical height occupied by the parsed credits text.
 */
export function measureCreditsContentHeight(
  parsedLines: ParsedCreditLine[],
  baseFontSize: number,
  lineSpacing: number
): number {
  let totalHeight = 0;
  for (const line of parsedLines) {
    if (line.type === 'blank') {
      totalHeight += baseFontSize * 1.0;
    } else if (line.type === 'title') {
      totalHeight += baseFontSize * 1.8 * lineSpacing + baseFontSize * 0.5;
    } else {
      totalHeight += baseFontSize * lineSpacing;
    }
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

/**
 * Calculates standard video pixel dimensions and bitrates for export.
 * Guarantees even dimensions required by video encoders (H.264 / VP9).
 */
export function getResolutionDimensions(
  aspectRatio: '9:16' | '16:9' | '1:1',
  resolution: ExportResolution
): { width: number; height: number; bitrate: number; label: string } {
  switch (resolution) {
    case '720p':
      if (aspectRatio === '9:16') {
        return { width: 720, height: 1280, bitrate: 2_500_000, label: '720×1280 (HD)' };
      }
      if (aspectRatio === '16:9') {
        return { width: 1280, height: 720, bitrate: 2_500_000, label: '1280×720 (HD)' };
      }
      return { width: 720, height: 720, bitrate: 2_000_000, label: '720×720 (HD Carré)' };

    case '4k':
      if (aspectRatio === '9:16') {
        return { width: 2160, height: 3840, bitrate: 12_000_000, label: '2160×3840 (4K UHD)' };
      }
      if (aspectRatio === '16:9') {
        return { width: 3840, height: 2160, bitrate: 12_000_000, label: '3840×2160 (4K UHD)' };
      }
      return { width: 2160, height: 2160, bitrate: 10_000_000, label: '2160×2160 (4K Carré)' };

    case '1080p':
    default:
      if (aspectRatio === '9:16') {
        return { width: 1080, height: 1920, bitrate: 5_000_000, label: '1080×1920 (Full HD)' };
      }
      if (aspectRatio === '16:9') {
        return { width: 1920, height: 1080, bitrate: 5_000_000, label: '1920×1080 (Full HD)' };
      }
      return { width: 1080, height: 1080, bitrate: 4_000_000, label: '1080×1080 (Full HD Carré)' };
  }
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

/**
 * Renders one frame of credits onto a 2D canvas context.
 */
export function renderCreditsFrame(
  ctx: CanvasRenderingContext2D,
  config: CreditsConfig,
  currentTime: number,
  parsedLines: ParsedCreditLine[],
  bgMedia: HTMLImageElement | HTMLVideoElement | null
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

  // 1. Clear frame
  ctx.clearRect(0, 0, width, height);

  // 2. Draw Background
  if (config.background.source === 'color') {
    ctx.fillStyle = config.background.value || '#050505';
    ctx.fillRect(0, 0, width, height);
  } else if (bgMedia) {
    try {
      // Cover fit image / video
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
    // Default cinematic dark gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#0c0d14');
    grad.addColorStop(0.5, '#050507');
    grad.addColorStop(1, '#020203');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // 3. Overlay darkness / vignette
  if (config.background.overlayOpacity > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${config.background.overlayOpacity})`;
    ctx.fillRect(0, 0, width, height);
  }

  // 4. Calculate Scroll Y
  const currentY = calculateScrollPosition(progress, height, totalContentHeight, config.direction);

  // 5. Draw text
  ctx.save();

  // Handle star crawl perspective if selected
  if (config.direction === 'star-crawl') {
    // Pseudo 3D perspective via transforms and clipping
    ctx.setTransform(1, 0, 0, 0.45, 0, height * 0.25);
  }

  let yCursor = currentY;
  const paddingX = width * 0.08;
  const contentWidth = width - paddingX * 2;

  // Text shadow setup
  if (config.textShadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = Math.round(8 * scale);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.round(2 * scale);
  } else {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  for (const line of parsedLines) {
    if (line.type === 'blank') {
      yCursor += baseFontSize * 1.0;
      continue;
    }

    if (line.type === 'title') {
      const titleSize = Math.round(baseFontSize * 1.4);
      ctx.font = `700 ${titleSize}px "${config.fontFamily}", sans-serif`;
      ctx.fillStyle = config.color;
      ctx.textAlign = 'center';

      // Draw title line
      ctx.fillText(line.title || '', width / 2, yCursor);
      yCursor += titleSize * config.lineSpacing + baseFontSize * 0.5;
      continue;
    }

    if (line.type === 'role-pair' && config.roleSeparation) {
      // Two-column layout: ROLE on left aligned right, NAME on right aligned left
      const roleSize = Math.round(baseFontSize * 0.95);
      const nameSize = Math.round(baseFontSize * 1.05);

      const colGap = width * 0.05;
      const leftColX = width / 2 - colGap / 2;
      const rightColX = width / 2 + colGap / 2;

      // Role
      ctx.font = `500 ${roleSize}px "${config.fontFamily}", sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.textAlign = 'right';
      ctx.fillText(line.role || '', leftColX, yCursor);

      // Name
      ctx.font = `700 ${nameSize}px "${config.fontFamily}", sans-serif`;
      ctx.fillStyle = config.color;
      ctx.textAlign = 'left';
      ctx.fillText(line.name || '', rightColX, yCursor);

      yCursor += baseFontSize * config.lineSpacing;
      continue;
    }

    // Regular line or unseparated role pair
    const textToDraw = line.type === 'role-pair' ? `${line.role} : ${line.name}` : (line.text || '');
    ctx.font = `600 ${baseFontSize}px "${config.fontFamily}", sans-serif`;
    ctx.fillStyle = config.color;

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

    ctx.fillText(textToDraw, textX, yCursor);
    yCursor += baseFontSize * config.lineSpacing;
  }

  ctx.restore();
}
