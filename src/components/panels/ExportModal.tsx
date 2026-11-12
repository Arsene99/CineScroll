import React, { useState, useEffect, useRef } from 'react';
import { Download, Share2, Film, CheckCircle2, X, RotateCcw, Check, Zap, ChevronDown } from 'lucide-react';
import confetti from 'canvas-confetti';
import { CreditsConfig } from '../../types';
import {
  parseCreditsText,
  renderCreditsFrame,
  createStaticBackgroundCache,
  getResolutionDimensions,
  estimateExportSizeMB,
  formatFileSize,
  ExportResolution,
  ExportFormat,
  ExportQuality,
  ExportFps,
} from '../../utils/creditsEngine';
import { globalAudioEngine } from '../../utils/audioSynth';
import { exportVideo } from '../../utils/videoExporter';

interface ExportModalProps {
  config: CreditsConfig;
  isOpen: boolean;
  onClose: () => void;
  videoElement: HTMLVideoElement | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  config,
  isOpen,
  onClose,
  videoElement,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('mp4');
  const [selectedResolution, setSelectedResolution] = useState<ExportResolution>('720p');
  const [selectedQuality, setSelectedQuality] = useState<ExportQuality>('balanced');
  const [selectedFps, setSelectedFps] = useState<ExportFps>(24);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [statusLabel, setStatusLabel] = useState('Initialisation...');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [actualFormat, setActualFormat] = useState<string>('mp4');
  const [actualSizeBytes, setActualSizeBytes] = useState<number>(0);
  const [renderTimeMs, setRenderTimeMs] = useState<number>(0);
  const [exportError, setExportError] = useState<string | null>(null);

  const exportSignalRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  // Clean up object URL when component unmounts or before a new one is set
  useEffect(() => {
    return () => {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  const handleClose = () => {
    exportSignalRef.current.cancelled = true;
    if (isExporting) {
      globalAudioEngine.stop();
      setIsExporting(false);
    }
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }
    onClose();
  };

  if (!isOpen) return null;

  const hasMotionBackground = config.background.source === 'video';
  const hasActiveAudio = Boolean(
    !config.audio.muted && config.audio.presetId !== 'none' && config.audio.volume > 0
  );
  const currentDims = getResolutionDimensions(
    config.aspectRatio,
    selectedResolution,
    selectedQuality,
    hasMotionBackground,
    selectedFps
  );
  const estimatedSizeMB = estimateExportSizeMB(
    config.speedDuration,
    currentDims.bitrate,
    hasActiveAudio,
    currentDims.audioBitrate
  );

  const startExport = async () => {
    setIsExporting(true);
    setProgress(1);
    setElapsedSeconds(0);
    setStatusLabel('Initialisation...');
    setDownloadUrl(null);
    setExportError(null);
    setActualSizeBytes(0);
    setRenderTimeMs(0);

    const signal = { cancelled: false };
    exportSignalRef.current = signal;

    try {
      const parsedLines = parseCreditsText(config.text);

      // Load background image if used
      let bgImage: HTMLImageElement | null = null;
      if (config.background.source === 'image' && config.background.value) {
        bgImage = new Image();
        bgImage.crossOrigin = 'anonymous';
        bgImage.src = config.background.value;
        if (!bgImage.complete) {
          await new Promise((res) => {
            const timeout = window.setTimeout(res, 4000);
            bgImage!.onload = () => {
              window.clearTimeout(timeout);
              res(null);
            };
            bgImage!.onerror = () => {
              window.clearTimeout(timeout);
              res(null);
            };
          });
        }
      }

      const cachedBackground = createStaticBackgroundCache(
        currentDims.width,
        currentDims.height,
        config,
        bgImage
      );

      const result = await exportVideo({
        width: currentDims.width,
        height: currentDims.height,
        fps: selectedFps,
        durationSec: config.speedDuration,
        bitrate: currentDims.bitrate,
        audioBitrate: currentDims.audioBitrate,
        format: selectedFormat,
        audio: config.audio,
        bgImage,
        bgVideo: config.background.source === 'video' ? videoElement : null,
        signal,
        drawFrame: (ctx, timeSec) => {
          renderCreditsFrame(ctx, config, timeSec, parsedLines, bgImage || videoElement, {
            cachedBackground,
            fastShadow: true,
          });
        },
        onProgress: (pct, renderedSec, statusText) => {
          if (!signal.cancelled) {
            setProgress(pct);
            setElapsedSeconds(renderedSec);
            if (statusText) setStatusLabel(statusText);
          }
        },
      });

      if (signal.cancelled) return;

      const url = URL.createObjectURL(result.blob);
      setActualFormat(result.format);
      setActualSizeBytes(result.blob.size);
      setRenderTimeMs(result.renderDurationMs);
      setDownloadUrl(url);
      setIsExporting(false);
      setProgress(100);
      setElapsedSeconds(config.speedDuration);

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch (err) {
      if ((err as Error)?.name === 'AbortError' || signal.cancelled) {
        return;
      }
      setExportError('Erreur lors de la génération vidéo. Essayez un autre format ou qualité.');
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    if (downloadUrl && navigator.share) {
      try {
        const response = await fetch(downloadUrl);
        const blob = await response.blob();
        const filename = `cinescroll-${selectedResolution}.${actualFormat}`;
        const file = new File([blob], filename, { type: blob.type });
        await navigator.share({
          files: [file],
          title: 'Mon Générique CineScroll',
        });
      } catch {
        // User cancelled or share not allowed
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm max-h-[92vh] overflow-y-auto no-scrollbar bg-neutral-900 border border-neutral-800 rounded-t-3xl sm:rounded-2xl p-5 text-white shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-100">
                Génération de la Vidéo
              </h3>
              <p className="text-[11px] text-neutral-400 font-mono">
                {config.aspectRatio} • {config.speedDuration}s • {selectedFps} i/s • ~{estimatedSizeMB} Mo
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            aria-label="Fermer"
            className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error banner */}
        {exportError && (
          <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs">
            {exportError}
          </div>
        )}

        {/* Center state or options */}
        {!isExporting && !downloadUrl ? (
          <div className="space-y-3.5 pt-1">
            {/* Format Selector */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
                Format de fichier
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedFormat('mp4')}
                  className={`p-2.5 rounded-xl border text-left transition-all relative ${
                    selectedFormat === 'mp4'
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300 shadow-sm'
                      : 'bg-neutral-800/60 border-neutral-700/60 text-neutral-300 hover:bg-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold font-mono">MP4</span>
                    {selectedFormat === 'mp4' && (
                      <span className="w-4 h-4 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-neutral-400 block leading-tight">
                    Galerie mobile & réseaux (Android, iOS)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedFormat('webm')}
                  className={`p-2.5 rounded-xl border text-left transition-all relative ${
                    selectedFormat === 'webm'
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300 shadow-sm'
                      : 'bg-neutral-800/60 border-neutral-700/60 text-neutral-300 hover:bg-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold font-mono">WebM</span>
                    {selectedFormat === 'webm' && (
                      <span className="w-4 h-4 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-neutral-400 block leading-tight">
                    Web & navigateurs PC
                  </span>
                </button>
              </div>
            </div>

            {/* Resolution Selector */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
                Résolution vidéo
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(['720p', '1080p', '4k'] as ExportResolution[]).map((res) => {
                  const dims = getResolutionDimensions(
                    config.aspectRatio,
                    res,
                    selectedQuality,
                    hasMotionBackground,
                    selectedFps
                  );
                  const isSelected = selectedResolution === res;
                  const desc = res === '720p' ? 'Léger' : res === '1080p' ? 'Optimal' : 'Cinéma';

                  return (
                    <button
                      key={res}
                      type="button"
                      onClick={() => setSelectedResolution(res)}
                      className={`p-2 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500 text-amber-300 shadow-sm'
                          : 'bg-neutral-800/60 border-neutral-700/60 text-neutral-300 hover:bg-neutral-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold font-mono">{res.toUpperCase()}</span>
                        {isSelected && (
                          <span className="w-3.5 h-3.5 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center">
                            <Check className="w-2 h-2 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-neutral-400 truncate">
                        {dims.width}×{dims.height}
                      </span>
                      <span className="text-[9px] text-neutral-500 font-medium mt-0.5">
                        {desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quality / File Size Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                  Compression & poids
                </span>
                <span className="text-[10px] font-mono text-amber-400">
                  Estimé : ~{estimatedSizeMB} Mo
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'compact', title: 'Compact', sub: 'Ultra léger' },
                    { id: 'balanced', title: 'Équilibré', sub: 'Net & léger' },
                    { id: 'high', title: 'Haute', sub: 'Max détails' },
                  ] as const
                ).map((q) => {
                  const isSelected = selectedQuality === q.id;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setSelectedQuality(q.id)}
                      className={`p-2 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500 text-amber-300 shadow-sm'
                          : 'bg-neutral-800/60 border-neutral-700/60 text-neutral-300 hover:bg-neutral-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] font-bold">{q.title}</span>
                        {isSelected && (
                          <span className="w-3.5 h-3.5 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center">
                            <Check className="w-2 h-2 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-neutral-500 block leading-tight">
                        {q.sub}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* FPS Selector Dropdown */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="export-fps-select"
                  className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider"
                >
                  Images par seconde (FPS)
                </label>
                <span className="text-[10px] font-mono text-neutral-400">
                  {selectedFps} i/s
                </span>
              </div>
              <div className="relative">
                <select
                  id="export-fps-select"
                  aria-label="Images par seconde (FPS)"
                  value={selectedFps}
                  onChange={(e) => setSelectedFps(Number(e.target.value) as ExportFps)}
                  className="w-full appearance-none rounded-xl bg-neutral-800/80 border border-neutral-700/70 hover:border-neutral-600 focus:border-amber-500 focus:outline-none px-3 py-2.5 pr-9 text-xs font-medium text-neutral-100 cursor-pointer transition-colors"
                >
                  <option value={15}>15 i/s — Ultra léger (défilement lent)</option>
                  <option value={24}>24 i/s — Cinéma (recommandé)</option>
                  <option value={30}>30 i/s — Standard fluide</option>
                  <option value={60}>60 i/s — Très fluide (plus lourd)</option>
                </select>
                <ChevronDown className="w-4 h-4 text-neutral-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>
        ) : null}

        {/* Progress or Completion View */}
        {isExporting ? (
          <div className="flex flex-col items-center justify-center py-5 space-y-3">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-neutral-800"
                  strokeWidth="3"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-amber-500 transition-all duration-150"
                  strokeDasharray={`${progress}, 100`}
                  strokeWidth="3"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute font-mono text-base font-bold text-amber-400">
                {progress}%
              </span>
            </div>
            <div className="flex flex-col items-center text-center">
              <span className="text-xs text-neutral-200 font-mono font-medium">
                {elapsedSeconds}s / {config.speedDuration}s • {statusLabel}
              </span>
              <span className="text-[11px] text-amber-400/90 font-medium flex items-center gap-1 mt-0.5">
                <Zap className="w-3 h-3" />
                <span>Encodage rapide • {selectedResolution.toUpperCase()} {selectedFps} i/s {selectedFormat.toUpperCase()}</span>
              </span>
            </div>
          </div>
        ) : downloadUrl ? (
          <div className="flex flex-col items-center justify-center py-4 space-y-2">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <span className="text-sm font-bold text-neutral-100">
              Vidéo prête !
            </span>
            <span className="text-xs text-neutral-400 text-center font-mono">
              {currentDims.width}×{currentDims.height} • {selectedFps} i/s • {actualFormat.toUpperCase()} • {formatFileSize(actualSizeBytes)}
            </span>
            {renderTimeMs > 0 && (
              <span className="text-[11px] text-emerald-400 font-medium">
                Généré en {(renderTimeMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        ) : null}

        {/* Action buttons */}
        <div className="space-y-2 pt-1">
          {!downloadUrl ? (
            <button
              onClick={startExport}
              disabled={isExporting}
              aria-label="Lancer l'export vidéo"
              className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-800 disabled:text-neutral-500 text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 active:scale-98"
            >
              <Download className="w-4 h-4" />
              <span>
                {isExporting
                  ? 'Encodage rapide...'
                  : `Démarrer le rendu (${selectedResolution.toUpperCase()} • ${selectedFormat.toUpperCase()})`}
              </span>
            </button>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={downloadUrl}
                  download={`cinescroll-${selectedResolution}-${Date.now()}.${actualFormat}`}
                  className="py-3 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg active:scale-98"
                >
                  <Download className="w-4 h-4" />
                  <span>Télécharger ({actualFormat.toUpperCase()})</span>
                </a>

                {typeof navigator !== 'undefined' && 'share' in navigator ? (
                  <button
                    onClick={handleShare}
                    aria-label="Partager la vidéo"
                    className="py-3 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-medium text-xs flex items-center justify-center gap-2 transition-all active:scale-98"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Partager</span>
                  </button>
                ) : (
                  <button
                    onClick={handleClose}
                    aria-label="Terminer"
                    className="py-3 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-medium text-xs flex items-center justify-center gap-2 transition-all active:scale-98"
                  >
                    <span>Fermer</span>
                  </button>
                )}
              </div>

              {/* Regenerate button to easily trigger a new export with the latest modifications */}
              <button
                onClick={() => {
                  setDownloadUrl((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return null;
                  });
                  setProgress(0);
                  setElapsedSeconds(0);
                }}
                aria-label="Refaire un rendu vidéo"
                className="w-full py-2.5 px-3 rounded-xl bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border border-neutral-700/60 active:scale-98"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Nouveau rendu (changer format / appliquer modifs)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
