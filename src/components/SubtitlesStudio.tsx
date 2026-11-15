import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Download,
  Play,
  Pause,
  RotateCcw,
  StepForward,
  EyeOff,
  Undo2,
  ListOrdered,
  Sparkles,
  Trash2,
  X,
  FileText,
} from 'lucide-react';
import {
  CreditsConfig,
  SubtitlesStudioConfig,
} from '../types';
import {
  formatTime,
  getAnimatedGradientState,
  getCanvasDimensions,
} from '../utils/creditsEngine';
import {
  DEFAULT_SUBTITLES_SCRIPT,
  getActiveSubtitleText,
  getNextLineIndexAtTime,
  parseSubtitleScript,
  renderSubtitlesFrame,
  rewindTimeWithoutUndo,
  stampClearCue,
  stampNextLineCue,
  undoLastCueAndRewind,
} from '../utils/subtitlesEngine';
import { globalAudioEngine } from '../utils/audioSynth';
import { Toolbar, ActiveTab } from './Toolbar';
import { SubtitleStyleToolbar, SubtitleToolId } from './SubtitleStyleToolbar';
import { FullscreenTextEditor } from './panels/FullscreenTextEditor';
import { BackgroundPanel } from './panels/BackgroundPanel';
import { AudioPanel } from './panels/AudioPanel';
import { RatioPanel } from './panels/RatioPanel';
import { ExportModal } from './panels/ExportModal';
import { PWAInstallButton } from './PWAInstallButton';

interface SubtitlesStudioProps {
  onBack: () => void;
}

export const SubtitlesStudio: React.FC<SubtitlesStudioProps> = ({ onBack }) => {
  const [config, setConfig] = useState<SubtitlesStudioConfig>({
    rawText: DEFAULT_SUBTITLES_SCRIPT,
    cues: [],
    fontFamily: 'Montserrat',
    fontSize: 24,
    color: '#ffffff',
    position: 'bottom',
    boxStyle: 'pill-dark',
    durationSec: 25,
    background: {
      source: 'color',
      value: '#050508',
      overlayOpacity: 0,
      blur: 0,
    },
    audio: {
      presetId: 'cinema-epic',
      volume: 0.6,
      muted: false,
    },
    aspectRatio: '9:16',
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>(null);
  const [activeStyleTool, setActiveStyleTool] = useState<SubtitleToolId>(null);
  const [showCuesSheet, setShowCuesSheet] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const currentTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const cuesRef = useRef(config.cues);

  currentTimeRef.current = currentTime;
  isPlayingRef.current = isPlaying;
  cuesRef.current = config.cues;

  const lines = useMemo(() => parseSubtitleScript(config.rawText), [config.rawText]);
  const activeSubtitle = useMemo(
    () => getActiveSubtitleText(config.cues, lines, currentTime),
    [config.cues, lines, currentTime]
  );
  const nextLineIndex = useMemo(
    () => getNextLineIndexAtTime(config.cues, currentTime, lines.length),
    [config.cues, currentTime, lines.length]
  );
  const nextLineText = nextLineIndex < lines.length ? lines[nextLineIndex] : null;
  const isAllLinesStamped = lines.length > 0 && nextLineIndex >= lines.length;

  const handleConfigChange = (updated: Partial<SubtitlesStudioConfig>) => {
    setConfig((prev) => ({ ...prev, ...updated }));
  };

  // Load background image when selected
  useEffect(() => {
    if (config.background.source === 'image' && config.background.value) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = config.background.value;
      img.onload = () => {
        bgImageRef.current = img;
      };
    } else {
      bgImageRef.current = null;
    }
  }, [config.background.source, config.background.value]);

  // Sync background video playback
  useEffect(() => {
    const video = videoElementRef.current;
    if (video && config.background.source === 'video') {
      if (isPlaying) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
  }, [isPlaying, config.background.source]);

  // Accurate delta-time playback loop
  const step = useCallback(
    (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      const next = currentTimeRef.current + delta;
      if (next >= config.durationSec) {
        currentTimeRef.current = config.durationSec;
        setCurrentTime(config.durationSec);
        setIsPlaying(false);
        globalAudioEngine.stop();
        if (animationFrameIdRef.current) {
          cancelAnimationFrame(animationFrameIdRef.current);
          animationFrameIdRef.current = null;
        }
        return;
      }

      currentTimeRef.current = next;
      setCurrentTime(next);

      if (isPlayingRef.current) {
        animationFrameIdRef.current = requestAnimationFrame(step);
      }
    },
    [config.durationSec]
  );

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = null;
      animationFrameIdRef.current = requestAnimationFrame(step);
      globalAudioEngine.play(currentTimeRef.current);
    } else {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      globalAudioEngine.pause();
    }
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [isPlaying, step]);

  // Sync background video time when seeking while paused or jumping
  const seekAllMedia = useCallback(
    (targetTime: number) => {
      const clamped = Math.max(0, Math.min(config.durationSec, targetTime));
      currentTimeRef.current = clamped;
      setCurrentTime(clamped);
      globalAudioEngine.seek(clamped);
      const video = videoElementRef.current;
      if (video && config.background.source === 'video' && Number.isFinite(video.duration) && video.duration > 0) {
        try {
          video.currentTime = clamped % video.duration;
        } catch {}
      }
    },
    [config.durationSec, config.background.source]
  );

  const handleTogglePlay = () => {
    if (currentTimeRef.current >= config.durationSec) {
      seekAllMedia(0);
    }
    setIsPlaying((prev) => !prev);
  };

  const handleRestart = (e: React.MouseEvent) => {
    e.stopPropagation();
    seekAllMedia(0);
    if (!isPlaying) setIsPlaying(true);
  };

  // Core Video Lyrics Cueing Actions
  const handleStampNextLine = useCallback(() => {
    setConfig((prev) => {
      const scriptLines = parseSubtitleScript(prev.rawText);
      const res = stampNextLineCue(prev.cues, currentTimeRef.current, scriptLines.length);
      return { ...prev, cues: res.cues };
    });
  }, []);

  const handleClearCurrentText = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      cues: stampClearCue(prev.cues, currentTimeRef.current),
    }));
  }, []);

  const handleUndoAndRewind = useCallback(() => {
    const res = undoLastCueAndRewind(cuesRef.current, currentTimeRef.current, 1.5);
    cuesRef.current = res.cues;
    setConfig((prev) => ({ ...prev, cues: res.cues }));
    if (res.removedCue) {
      seekAllMedia(res.rewindTime);
    }
  }, [seekAllMedia]);

  const handleRewindOnly = useCallback(() => {
    const rewound = rewindTimeWithoutUndo(currentTimeRef.current, 3);
    seekAllMedia(rewound);
  }, [seekAllMedia]);

  // Draw live preview canvas (with idle animated-gradient animation when paused at t=0)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = getCanvasDimensions(config.aspectRatio, 1080);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const bgMedia =
      config.background.source === 'video'
        ? videoElementRef.current || null
        : bgImageRef.current;

    const hasAnimatedGradient =
      (config.background.source === 'gradient' && Boolean(config.background.gradient?.animated)) ||
      Boolean(config.textGradient?.animated);

    if (hasAnimatedGradient && !isPlaying && !showExportModal && currentTime === 0) {
      let rafId = 0;
      const startMs = performance.now();
      let lastDrawMs = -100;

      const tick = (now: number) => {
        if (now - lastDrawMs >= 33) {
          lastDrawMs = now;
          const previewTime = (now - startMs) / 1000;
          const animatedBg =
            config.background.source === 'gradient' && config.background.gradient?.animated
              ? getAnimatedGradientState(config.background.gradient, previewTime)
              : null;
          const animatedText = config.textGradient?.animated
            ? getAnimatedGradientState(config.textGradient, previewTime)
            : null;

          renderSubtitlesFrame(ctx, 0, bgMedia, {
            aspectRatio: config.aspectRatio,
            background:
              animatedBg && config.background.gradient
                ? {
                    ...config.background,
                    gradient: {
                      ...config.background.gradient,
                      angle: animatedBg.angle,
                      colors: animatedBg.colors,
                      animated: false,
                    },
                  }
                : config.background,
            fontFamily: config.fontFamily,
            fontSize: config.fontSize,
            color: config.color,
            textGradient:
              animatedText && config.textGradient
                ? {
                    ...config.textGradient,
                    angle: animatedText.angle,
                    colors: animatedText.colors,
                    animated: false,
                  }
                : config.textGradient,
            position: config.position,
            boxStyle: config.boxStyle,
            cues: config.cues,
            lines,
          });
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafId);
    }

    renderSubtitlesFrame(ctx, currentTime, bgMedia, {
      aspectRatio: config.aspectRatio,
      background: config.background,
      fontFamily: config.fontFamily,
      fontSize: config.fontSize,
      color: config.color,
      textGradient: config.textGradient,
      position: config.position,
      boxStyle: config.boxStyle,
      cues: config.cues,
      lines,
    });
  }, [config, lines, currentTime, isPlaying, showExportModal]);

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveStyleTool(null);
    setShowCuesSheet(false);
    if (tab === 'export') {
      setIsPlaying(false);
      setShowExportModal(true);
    } else {
      setActiveTab(tab);
    }
  };

  // Adapt SubtitlesStudioConfig into CreditsConfig shape for shared ExportModal
  const exportAdapterConfig: CreditsConfig = useMemo(
    () => ({
      text: config.rawText,
      fontFamily: config.fontFamily,
      fontSize: config.fontSize,
      color: config.color,
      textGradient: config.textGradient,
      alignment: 'center',
      direction: 'fade-in',
      speedDuration: config.durationSec,
      lineSpacing: 1.4,
      roleSeparation: false,
      textShadow: true,
      background: config.background,
      audio: config.audio,
      aspectRatio: config.aspectRatio,
    }),
    [config]
  );

  const getAspectRatioClass = () => {
    switch (config.aspectRatio) {
      case '9:16':
        return 'aspect-[9/16] h-full max-h-[50vh] lg:max-h-[68vh] max-w-full';
      case '16:9':
        return 'aspect-[16/9] w-full max-w-xl max-h-[38vh] lg:max-h-[52vh]';
      case '1:1':
      default:
        return 'aspect-square h-full max-h-[44vh] lg:max-h-[60vh] max-w-full';
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white select-none overflow-hidden relative">
      {/* Hidden video element synced with background media */}
      <video
        ref={videoElementRef}
        src={config.background.source === 'video' ? config.background.value : undefined}
        loop
        muted
        playsInline
        onLoadedMetadata={(e) => {
          const vidDur = e.currentTarget.duration;
          if (Number.isFinite(vidDur) && vidDur > 1) {
            const clampedDur = Math.min(600, Math.max(5, Math.round(vidDur)));
            setConfig((prev) => ({ ...prev, durationSec: clampedDur }));
          }
        }}
        className="hidden"
      />

      {/* 1. Compact Header matching CreditsStudio */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 bg-neutral-950 border-b border-neutral-900 z-30">
        <button
          onClick={onBack}
          aria-label="Retour à l'accueil"
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white active:scale-95 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold uppercase tracking-wider text-neutral-100 whitespace-nowrap">
            Sous-titres
          </span>
          <span className="text-neutral-600" aria-hidden="true">
            ·
          </span>
          <span className="font-mono text-amber-400 tabular-nums">{config.aspectRatio}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <PWAInstallButton variant="compact" />
          <button
            onClick={() => {
              setIsPlaying(false);
              setShowExportModal(true);
            }}
            aria-label="Exporter la vidéo sous-titrée"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs active:scale-95 transition-all shadow-md shadow-amber-500/20 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exporter</span>
          </button>
        </div>
      </header>

      {/* 2. Horizontal Style Toolbar directly below header */}
      <div className="flex-shrink-0 z-30">
        <SubtitleStyleToolbar
          config={config}
          onChange={handleConfigChange}
          activeTool={activeStyleTool}
          onSelectTool={(tool) => {
            setActiveStyleTool(tool);
            if (activeTab) setActiveTab(null);
          }}
        />
      </div>

      {/* 3. Main Responsive Workspace (Preview + Video Lyrics Sync Deck) */}
      <main className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 lg:gap-6 lg:max-w-7xl lg:w-full lg:mx-auto px-3 sm:px-5 pt-2 pb-18 overflow-hidden">
        {/* Preview Player Zone */}
        <div className="flex-1 min-h-0 lg:col-span-7 flex flex-col items-center justify-center py-1">
          <div
            className={`relative flex items-center justify-center rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800 shadow-2xl shadow-black ${getAspectRatioClass()}`}
            onClick={handleTogglePlay}
            role="button"
            tabIndex={0}
            aria-label={isPlaying ? 'Mettre en pause' : 'Lire la vidéo'}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                handleTogglePlay();
              }
            }}
          >
            <canvas
              ref={canvasRef}
              className="w-full h-full object-contain pointer-events-none"
            />

            {/* Integrated Video Scrub Bar */}
            <div
              className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2.5 px-3.5 pt-7 pb-2.5 bg-gradient-to-t from-black/90 via-black/45 to-transparent pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={handleTogglePlay}
                aria-label={isPlaying ? 'Pause' : 'Lecture'}
                className="w-8 h-8 rounded-full bg-amber-500 hover:bg-amber-400 text-neutral-950 flex items-center justify-center transition-all flex-shrink-0 active:scale-95 shadow-md shadow-black/50"
              >
                {isPlaying ? (
                  <Pause className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />
                )}
              </button>

              <button
                onClick={handleRestart}
                aria-label="Recommencer"
                className="w-8 h-8 rounded-full text-neutral-300 hover:text-white flex items-center justify-center transition-colors flex-shrink-0 active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <div className="flex-1 flex items-center">
                <input
                  type="range"
                  min={0}
                  max={config.durationSec}
                  step={0.1}
                  value={currentTime}
                  onChange={(e) => seekAllMedia(parseFloat(e.target.value))}
                  aria-label="Curseur temporel"
                  className="w-full h-1.5 bg-white/20 hover:bg-white/30 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>

              <div className="text-[10px] font-mono tabular-nums font-medium text-white/90 min-w-[62px] text-right">
                {formatTime(currentTime)} / {formatTime(config.durationSec)}
              </div>
            </div>
          </div>
        </div>

        {/* Live-Sync Video Lyrics Deck (Thumb Zone on Mobile, Right Column on Desktop) */}
        <section
          aria-label="Commandes de synchronisation des sous-titres"
          className="flex-shrink-0 lg:col-span-5 lg:flex lg:flex-col lg:justify-center lg:py-4 w-full max-w-md mx-auto lg:max-w-none space-y-2 pt-1.5"
        >
          {/* Desktop Full Script Overview (clickable lines, synced highlight) */}
          <div className="hidden lg:flex flex-col flex-1 max-h-[38vh] rounded-2xl bg-neutral-950 border border-neutral-800/90 overflow-hidden mb-1">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-900">
              <span className="text-xs font-semibold text-neutral-200">
                Texte complet · {lines.length} lignes
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('text')}
                className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
              >
                Modifier le texte
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 no-scrollbar">
              {lines.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('text')}
                  className="w-full py-6 text-xs text-neutral-400 hover:text-white text-center"
                >
                  Aucune ligne. Cliquez ici pour coller votre texte.
                </button>
              ) : (
                lines.map((lineText, idx) => {
                  const isOnScreen = activeSubtitle?.lineIndex === idx;
                  const isUpcoming = nextLineIndex === idx;
                  const stampedCue = config.cues.find((c) => c.lineIndex === idx);
                  return (
                    <div
                      key={`${idx}-${lineText.slice(0, 12)}`}
                      onClick={() => {
                        if (stampedCue) seekAllMedia(stampedCue.time);
                      }}
                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs transition-colors ${
                        stampedCue ? 'cursor-pointer' : ''
                      } ${
                        isOnScreen
                          ? 'bg-amber-500/15 border border-amber-500/60 text-white font-semibold'
                          : isUpcoming
                          ? 'bg-neutral-900 border border-neutral-700 text-neutral-100'
                          : 'text-neutral-400 hover:bg-neutral-900/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono tabular-nums text-[10px] text-neutral-500 w-5 shrink-0">
                          {idx + 1}.
                        </span>
                        <span className="truncate">{lineText}</span>
                      </div>
                      {stampedCue && (
                        <span className="font-mono tabular-nums text-[10px] text-amber-400 shrink-0">
                          {formatTime(stampedCue.time, true)}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Unboxed Status / Next Line Info Line + Cues Inspector Trigger */}
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="min-w-0 flex-1 text-xs truncate">
              {lines.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('text')}
                  className="text-amber-400 hover:text-amber-300 font-medium underline underline-offset-2"
                >
                  Ajouter votre texte complet
                </button>
              ) : nextLineText ? (
                <p className="text-neutral-300 truncate">
                  <span className="text-neutral-500 font-mono tabular-nums">
                    Suivante ({nextLineIndex + 1}/{lines.length}) ·{' '}
                  </span>
                  <span className="text-neutral-100 font-medium">{nextLineText}</span>
                </p>
              ) : (
                <p className="text-emerald-400 font-medium truncate">
                  Toutes les {lines.length} lignes ont été synchronisées
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowCuesSheet(true)}
              aria-label={`Voir les repères (${config.cues.length})`}
              className="flex items-center gap-1.5 px-2.5 min-h-[36px] rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[11px] font-mono tabular-nums text-neutral-300 hover:text-white transition-colors shrink-0 whitespace-nowrap"
            >
              <ListOrdered className="w-3.5 h-3.5 text-amber-400" />
              <span>Repères ({config.cues.length})</span>
            </button>
          </div>

          {/* Primary Cue Button: Afficher la ligne suivante */}
          <button
            type="button"
            onClick={lines.length === 0 ? () => setActiveTab('text') : handleStampNextLine}
            disabled={isAllLinesStamped}
            aria-label="Afficher la ligne suivante"
            className="w-full min-h-[48px] px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-900 disabled:border disabled:border-neutral-800 disabled:text-neutral-500 text-neutral-950 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 active:scale-[0.98] whitespace-nowrap"
          >
            {lines.length === 0 ? (
              <>
                <FileText className="w-4 h-4 shrink-0" />
                <span>Écrire le texte complet</span>
              </>
            ) : isAllLinesStamped ? (
              <span>Fin du texte ({lines.length}/{lines.length})</span>
            ) : (
              <>
                <StepForward className="w-4 h-4 shrink-0 stroke-[2.5]" />
                <span>
                  Ligne suivante ({nextLineIndex + 1}/{lines.length})
                </span>
              </>
            )}
          </button>

          {/* 3 Secondary Sync Controls (Thumb-ergonomic >= 44px touch targets) */}
          <div className="grid grid-cols-3 gap-2">
            {/* 1. Retirer le texte actuel sans avancer */}
            <button
              type="button"
              onClick={handleClearCurrentText}
              disabled={!activeSubtitle}
              aria-label="Retirer le texte à l'écran"
              title="Masquer le sous-titre actuel pendant une pause"
              className="min-h-[44px] px-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 border border-neutral-800 text-neutral-200 font-medium text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 whitespace-nowrap"
            >
              <EyeOff className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span>Retirer</span>
            </button>

            {/* 2. Annuler le dernier sous-titre et revenir en arrière */}
            <button
              type="button"
              onClick={handleUndoAndRewind}
              disabled={config.cues.length === 0}
              aria-label="Annuler le dernier sous-titre et revenir en arrière"
              title="Annuler le dernier repère et reculer un peu"
              className="min-h-[44px] px-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 border border-neutral-800 text-neutral-200 font-medium text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 whitespace-nowrap"
            >
              <Undo2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Annuler</span>
            </button>

            {/* 3. Revenir en arrière SANS annuler la dernière action */}
            <button
              type="button"
              onClick={handleRewindOnly}
              disabled={currentTime <= 0}
              aria-label="Reculer de 3 secondes sans annuler"
              title="Revenir en arrière sans rien annuler"
              className="min-h-[44px] px-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 border border-neutral-800 text-neutral-200 font-medium text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span>Reculer -3s</span>
            </button>
          </div>
        </section>
      </main>

      {/* Fullscreen Script Editor when 'Texte' tab is active */}
      {activeTab === 'text' && (
        <FullscreenTextEditor
          text={config.rawText}
          onChangeText={(nextText) => handleConfigChange({ rawText: nextText })}
          title="Texte complet des sous-titres"
          unitLabel="lignes (1 ligne = 1 sous-titre)"
          placeholder={`Collez ou écrivez tout votre texte ici.
Chaque ligne non vide deviendra un sous-titre à déclencher au clic :

Premier couplet de ma vidéo
Deuxième phrase à afficher au bon moment
Troisième phrase...`}
          onClose={() => setActiveTab(null)}
        />
      )}

      {/* Cues Inspector Bottom Sheet (to review/seek/delete individual stamped cues) */}
      {showCuesSheet && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[1px]"
            onClick={() => setShowCuesSheet(false)}
          />
          <div className="fixed inset-x-0 bottom-16 z-40 bg-neutral-950/98 backdrop-blur-2xl border-t border-neutral-800 rounded-t-3xl shadow-2xl max-h-[60vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-neutral-900 bg-neutral-950">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-200">
                <ListOrdered className="w-4 h-4 text-amber-400" />
                <span className="uppercase tracking-wider">
                  Repères synchronisés ({config.cues.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                {config.cues.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      handleConfigChange({ cues: [] });
                      seekAllMedia(0);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[11px] text-red-400 font-medium"
                  >
                    Tout effacer
                  </button>
                )}
                <button
                  onClick={() => setShowCuesSheet(false)}
                  aria-label="Fermer les repères"
                  className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
              {config.cues.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-8">
                  Aucun repère enregistré pour l&apos;instant. Lancez la lecture et appuyez sur « Ligne suivante » au rythme voulu.
                </p>
              ) : (
                config.cues.map((cue) => {
                  const isClear = cue.lineIndex === null;
                  const cueLabel = isClear
                    ? 'Texte retiré (pause)'
                    : lines[cue.lineIndex!] ?? `Ligne ${cue.lineIndex! + 1}`;
                  return (
                    <div
                      key={cue.id}
                      onClick={() => seekAllMedia(cue.time)}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono tabular-nums text-xs font-bold text-amber-400 shrink-0">
                          {formatTime(cue.time, true)}
                        </span>
                        <span
                          className={`text-xs truncate ${
                            isClear ? 'italic text-neutral-400' : 'text-neutral-100'
                          }`}
                        >
                          {cueLabel}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConfigChange({
                            cues: config.cues.filter((c) => c.id !== cue.id),
                          });
                        }}
                        aria-label="Supprimer ce repère"
                        className="w-8 h-8 rounded-lg text-neutral-500 hover:text-red-400 flex items-center justify-center shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* Shared Interactive Bottom Sheet Drawer for Background, Audio, Ratio */}
      {activeTab && activeTab !== 'text' && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setActiveTab(null)}
          />

          <div className="fixed inset-x-0 bottom-16 z-40 bg-neutral-950/98 backdrop-blur-2xl border-t border-neutral-800 rounded-t-3xl shadow-2xl max-h-[60vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-neutral-900 bg-neutral-950">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-200">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="uppercase tracking-wider">
                  {activeTab === 'background' && 'Arrière-plan'}
                  {activeTab === 'audio' && 'Musique & Son'}
                  {activeTab === 'ratio' && 'Format d’écran'}
                </span>
              </div>
              <button
                onClick={() => setActiveTab(null)}
                aria-label="Fermer le panneau"
                className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
              {activeTab === 'background' && (
                <BackgroundPanel
                  background={config.background}
                  onChange={(bg) => handleConfigChange({ background: bg })}
                />
              )}

              {activeTab === 'audio' && (
                <AudioPanel
                  audio={config.audio}
                  onChange={(aud) => handleConfigChange({ audio: aud })}
                  onSyncDuration={(duration) => handleConfigChange({ durationSec: duration })}
                />
              )}

              {activeTab === 'ratio' && (
                <RatioPanel
                  currentRatio={config.aspectRatio}
                  onChange={(ratio) => handleConfigChange({ aspectRatio: ratio })}
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* Shared Bottom Navigation Bar matching CreditsStudio */}
      <Toolbar activeTab={activeTab} onSelectTab={handleSelectTab} />

      {/* Shared High-Res MP4 / WebM Exporter Modal */}
      {showExportModal && (
        <ExportModal
          config={exportAdapterConfig}
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          videoElement={videoElementRef.current}
          filePrefix="cinescroll-soustitres"
          customDrawFrame={(ctx, timeSec, bgMedia, cachedBackground) =>
            renderSubtitlesFrame(ctx, timeSec, bgMedia, {
              aspectRatio: config.aspectRatio,
              background: config.background,
              fontFamily: config.fontFamily,
              fontSize: config.fontSize,
              color: config.color,
              textGradient: config.textGradient,
              position: config.position,
              boxStyle: config.boxStyle,
              cues: config.cues,
              lines,
              cachedBackground,
              fastShadow: true,
            })
          }
        />
      )}
    </div>
  );
};
