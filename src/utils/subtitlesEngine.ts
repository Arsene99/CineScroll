import {
  AspectRatio,
  BackgroundConfig,
  GradientConfig,
  SubtitleBoxStyle,
  SubtitleCueEvent,
  SubtitlePosition,
} from '../types';
import {
  createCanvasLinearGradient,
  getCanvasFont,
  getCanvasDimensions,
} from './creditsEngine';

export const DEFAULT_SUBTITLES_SCRIPT = `Bienvenue dans CineScroll
Écrivez ou collez tout votre texte ici
Chaque ligne devient un sous-titre
Lancez la lecture vidéo ou audio
Cliquez sur « Ligne suivante » au bon rythme
Utilisez « Retirer » pendant les silences
« Annuler » corrige et recule d'un instant
« Reculer » réécoute sans rien effacer`;

/**
 * Splits a full lyric/subtitle script into clean non-empty lines (1 line = 1 cue).
 */
export function parseSubtitleScript(rawText: string): string[] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Returns cue events sorted chronologically by timestamp.
 */
export function sortCueEvents(cues: SubtitleCueEvent[]): SubtitleCueEvent[] {
  return [...cues].sort((a, b) => a.time - b.time);
}

function roundTime(sec: number): number {
  return Math.max(0, Math.round(sec * 100) / 100);
}

function defaultIdFactory(): string {
  return `cue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Returns the active cue event at or before timeSec (with a tiny 10ms tolerance for exact cue taps).
 */
export function getActiveCueAtTime(
  cues: SubtitleCueEvent[],
  timeSec: number
): SubtitleCueEvent | null {
  const sorted = sortCueEvents(cues);
  let active: SubtitleCueEvent | null = null;
  for (const cue of sorted) {
    if (cue.time <= timeSec + 0.018) {
      active = cue;
    } else {
      break;
    }
  }
  return active;
}

/**
 * Returns the currently visible subtitle text & lineIndex at timeSec, or null if blank/cleared.
 */
export function getActiveSubtitleText(
  cues: SubtitleCueEvent[],
  lines: string[],
  timeSec: number
): { text: string; lineIndex: number; cueId: string } | null {
  const cue = getActiveCueAtTime(cues, timeSec);
  if (!cue || cue.lineIndex === null) {
    return null;
  }
  const text = lines[cue.lineIndex];
  if (!text) {
    return null;
  }
  return { text, lineIndex: cue.lineIndex, cueId: cue.id };
}

/**
 * Computes the next line index to trigger at timeSec based on stamped text cues at or before timeSec.
 */
export function getNextLineIndexAtTime(
  cues: SubtitleCueEvent[],
  timeSec: number,
  totalLines: number
): number {
  if (totalLines <= 0) return 0;
  const sorted = sortCueEvents(cues);
  let lastLineIdx = -1;
  for (const cue of sorted) {
    if (cue.time <= timeSec + 0.01) {
      if (cue.lineIndex !== null) {
        lastLineIdx = Math.max(lastLineIdx, cue.lineIndex);
      }
    } else {
      break;
    }
  }
  return Math.min(totalLines, lastLineIdx + 1);
}

/**
 * Stamps the next line from the full script at timeSec ("Ligne suivante").
 */
export function stampNextLineCue(
  cues: SubtitleCueEvent[],
  timeSec: number,
  totalLines: number,
  idFactory: () => string = defaultIdFactory
): {
  cues: SubtitleCueEvent[];
  stampedLineIndex: number | null;
  nextLineIndex: number;
} {
  const nextIdx = getNextLineIndexAtTime(cues, timeSec, totalLines);
  if (totalLines <= 0 || nextIdx >= totalLines) {
    return { cues: sortCueEvents(cues), stampedLineIndex: null, nextLineIndex: totalLines };
  }

  const cleanTime = roundTime(timeSec);
  const filtered = sortCueEvents(cues).filter(
    (c) => Math.abs(c.time - cleanTime) >= 0.08
  );

  const newCue: SubtitleCueEvent = {
    id: idFactory(),
    time: cleanTime,
    lineIndex: nextIdx,
  };

  // Insert and deduplicate if a future cue immediately holds the exact same lineIndex
  const merged = sortCueEvents([...filtered, newCue]);
  const deduped: SubtitleCueEvent[] = [];
  for (const cue of merged) {
    const prev = deduped[deduped.length - 1];
    if (
      prev &&
      cue.id !== newCue.id &&
      cue.lineIndex !== null &&
      prev.lineIndex === cue.lineIndex
    ) {
      continue;
    }
    deduped.push(cue);
  }

  return {
    cues: deduped,
    stampedLineIndex: nextIdx,
    nextLineIndex: Math.min(totalLines, nextIdx + 1),
  };
}

/**
 * Inserts a clear-screen cue at timeSec ("Retirer le texte") without advancing lineIndex.
 */
export function stampClearCue(
  cues: SubtitleCueEvent[],
  timeSec: number,
  idFactory: () => string = defaultIdFactory
): SubtitleCueEvent[] {
  const cleanTime = roundTime(timeSec);
  const sorted = sortCueEvents(cues).filter(
    (c) => Math.abs(c.time - cleanTime) >= 0.08
  );

  // If the cue right before cleanTime is already cleared (null), no duplicate clear needed
  const prev = getActiveCueAtTime(sorted, cleanTime);
  if (!prev || prev.lineIndex === null) {
    return sorted;
  }

  return sortCueEvents([
    ...sorted,
    {
      id: idFactory(),
      time: cleanTime,
      lineIndex: null,
    },
  ]);
}

/**
 * Cancels the last stamped cue (at or before currentTime, or last overall) and rewinds
 * slightly before it so the user can immediately re-tap in sync ("Annuler & reculer").
 */
export function undoLastCueAndRewind(
  cues: SubtitleCueEvent[],
  currentTime: number,
  leadInSec = 1.5
): {
  cues: SubtitleCueEvent[];
  rewindTime: number;
  removedCue: SubtitleCueEvent | null;
} {
  const sorted = sortCueEvents(cues);
  if (sorted.length === 0) {
    return { cues: [], rewindTime: Math.max(0, roundTime(currentTime)), removedCue: null };
  }

  let targetIdx = -1;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].time <= currentTime + 0.08) {
      targetIdx = i;
      break;
    }
  }
  if (targetIdx === -1) {
    targetIdx = sorted.length - 1;
  }

  const removedCue = sorted[targetIdx];
  const nextCues = sorted.filter((_, idx) => idx !== targetIdx);
  const rewindTime = Math.max(0, roundTime(removedCue.time - leadInSec));

  return {
    cues: nextCues,
    rewindTime,
    removedCue,
  };
}

/**
 * Rewinds currentTime by stepSec without modifying any cues ("Reculer sans annuler").
 */
export function rewindTimeWithoutUndo(currentTime: number, stepSec = 3): number {
  return Math.max(0, roundTime(currentTime - stepSec));
}

/**
 * Word-wraps a subtitle string cleanly into multiple lines that fit within maxWidth.
 */
export function wrapSubtitleLines(
  measureWidth: (text: string) => number,
  text: string,
  maxWidth: number
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (!currentLine || measureWidth(candidate) <= maxWidth) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

export interface RenderSubtitlesFrameOptions {
  aspectRatio: AspectRatio;
  background: BackgroundConfig;
  fontFamily: string;
  fontSize: number;
  color: string;
  textGradient?: GradientConfig;
  position: SubtitlePosition;
  boxStyle: SubtitleBoxStyle;
  cues: SubtitleCueEvent[];
  lines: string[];
  cachedBackground?: HTMLCanvasElement | null;
  fastShadow?: boolean;
}

/**
 * Renders one subtitle video frame onto Canvas 2D (shared by live preview and 720p/1080p/4K export).
 */
export function renderSubtitlesFrame(
  ctx: CanvasRenderingContext2D,
  timeSec: number,
  bgMedia: HTMLImageElement | HTMLVideoElement | null,
  options: RenderSubtitlesFrameOptions
) {
  const { width, height } = ctx.canvas;

  // 1. Background (fast cached blit or dynamic render for video / animated gradient)
  if (options.cachedBackground) {
    ctx.drawImage(options.cachedBackground, 0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height);

    if (options.background.source === 'color') {
      ctx.fillStyle = options.background.value || '#050508';
      ctx.fillRect(0, 0, width, height);
    } else if (options.background.source === 'gradient' && options.background.gradient) {
      ctx.fillStyle = createCanvasLinearGradient(
        ctx,
        width,
        height,
        options.background.gradient,
        timeSec
      );
      ctx.fillRect(0, 0, width, height);
    } else if (bgMedia) {
      try {
        const mediaW =
          (bgMedia as HTMLVideoElement).videoWidth ||
          (bgMedia as HTMLImageElement).naturalWidth ||
          width;
        const mediaH =
          (bgMedia as HTMLVideoElement).videoHeight ||
          (bgMedia as HTMLImageElement).naturalHeight ||
          height;
        const ratio = Math.max(width / mediaW, height / mediaH);
        const shiftX = (width - mediaW * ratio) / 2;
        const shiftY = (height - mediaH * ratio) / 2;
        ctx.drawImage(
          bgMedia,
          0,
          0,
          mediaW,
          mediaH,
          shiftX,
          shiftY,
          mediaW * ratio,
          mediaH * ratio
        );
      } catch {
        ctx.fillStyle = '#08090d';
        ctx.fillRect(0, 0, width, height);
      }
    } else {
      ctx.fillStyle = '#08090d';
      ctx.fillRect(0, 0, width, height);
    }

    if (options.background.overlayOpacity > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${options.background.overlayOpacity})`;
      ctx.fillRect(0, 0, width, height);
    }
  }

  // 2. Active Subtitle at timeSec
  const activeSub = getActiveSubtitleText(options.cues, options.lines, timeSec);
  if (!activeSub) return;

  ctx.save();
  const refWidth = getCanvasDimensions(options.aspectRatio, 1080).width;
  const scale = width / refWidth;
  const scaledSize = Math.max(14, Math.round(options.fontSize * 1.45 * scale));
  ctx.font = getCanvasFont(700, scaledSize, options.fontFamily);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const maxTextWidth = width * 0.82;
  const wrappedLines = wrapSubtitleLines(
    (t) => ctx.measureText(t).width,
    activeSub.text,
    maxTextWidth
  );
  if (wrappedLines.length === 0) {
    ctx.restore();
    return;
  }

  const lineHeight = Math.round(scaledSize * 1.28);
  const blockHeight = wrappedLines.length * lineHeight;
  const maxLineWidth = Math.max(
    ...wrappedLines.map((l) => ctx.measureText(l).width)
  );

  // Anchor center Y based on chosen subtitle position
  let centerY = height * 0.80;
  if (options.position === 'center') {
    centerY = height * 0.5;
  } else if (options.position === 'top') {
    centerY = height * 0.16;
  }

  // Clamp vertically so wrapped multi-line blocks never clip top or bottom edges
  const marginY = Math.round(32 * scale);
  centerY = Math.max(
    marginY + blockHeight / 2,
    Math.min(height - marginY - blockHeight / 2, centerY)
  );

  const firstLineY = centerY - ((wrappedLines.length - 1) * lineHeight) / 2;

  if (options.boxStyle === 'pill-dark') {
    const padX = Math.round(24 * scale);
    const padY = Math.round(14 * scale);
    const boxW = Math.min(width * 0.92, maxLineWidth + padX * 2);
    const boxH = blockHeight + padY * 1.4;
    const boxX = (width - boxW) / 2;
    const boxY = centerY - boxH / 2;

    ctx.fillStyle = 'rgba(8, 10, 14, 0.78)';
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, Math.round(14 * scale));
    ctx.fill();
  }

  const textFill: string | CanvasGradient = options.textGradient
    ? createCanvasLinearGradient(ctx, width, height, options.textGradient, timeSec)
    : options.color;

  if (options.boxStyle === 'outline') {
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.92)';
    ctx.lineWidth = Math.max(2, Math.round(5 * scale));
  } else if (options.boxStyle === 'shadow') {
    if (!options.fastShadow) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = Math.round(12 * scale);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = Math.round(3 * scale);
    }
  }

  const shadowOffset = Math.max(1, Math.round(2.5 * scale));

  wrappedLines.forEach((lineText, idx) => {
    const y = firstLineY + idx * lineHeight;
    if (options.boxStyle === 'outline') {
      ctx.strokeText(lineText, width / 2, y);
    } else if (options.boxStyle === 'shadow' && options.fastShadow) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillText(lineText, width / 2, y + shadowOffset);
    }
    ctx.fillStyle = textFill;
    ctx.fillText(lineText, width / 2, y);
  });

  ctx.restore();
}
