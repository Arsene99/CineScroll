import React, { useState, useEffect, useRef } from 'react';
import { Download, Share2, Film, CheckCircle2, X, RotateCcw, Check, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { CreditsConfig } from '../../types';
import {
  parseCreditsText,
  renderCreditsFrame,
  getResolutionDimensions,
  ExportResolution,
  ExportFormat,
} from '../../utils/creditsEngine';
import { globalAudioEngine } from '../../utils/audioSynth';

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
  const [selectedResolution, setSelectedResolution] = useState<ExportResolution>('1080p');
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [actualFormat, setActualFormat] = useState<string>('mp4');

  const isCancelledRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);

  // Clean up object URL when component unmounts or before a new one is set
  useEffect(() => {
    return () => {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  const handleClose = () => {
    isCancelledRef.current = true;
    if (isExporting) {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try { recorderRef.current.stop(); } catch {}
      }
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

  const currentDims = getResolutionDimensions(config.aspectRatio, selectedResolution);

  const startExport = async () => {
    setIsExporting(true);
    setProgress(0);
    setElapsedSeconds(0);
    setDownloadUrl(null);
    isCancelledRef.current = false;

    // Create offscreen rendering canvas at requested resolution with guaranteed even pixel dimensions
    const exportCanvas = document.createElement('canvas');
    const { width, height, bitrate } = getResolutionDimensions(config.aspectRatio, selectedResolution);
    exportCanvas.width = width;
    exportCanvas.height = height;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) {
      setIsExporting(false);
      return;
    }

    const parsedLines = parseCreditsText(config.text);

    // Capture video stream from canvas
    const canvasStream = exportCanvas.captureStream ? exportCanvas.captureStream(30) : (exportCanvas as any).mozCaptureStream(30);
    const videoTrack = canvasStream.getVideoTracks()[0];

    // Add audio track if audio is active
    const audioDestination = globalAudioEngine.getAudioStreamDestination();
    if (audioDestination && !config.audio.muted && config.audio.presetId !== 'none') {
      const audioTracks = audioDestination.stream.getAudioTracks();
      if (audioTracks.length > 0) {
        canvasStream.addTrack(audioTracks[0]);
      }
    }

    // Negotiate supported mime type based on user format choice
    let chosenMime = '';
    let ext = 'mp4';

    if (selectedFormat === 'mp4') {
      const mp4Candidates = [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=avc1',
        'video/mp4',
      ];
      for (const cand of mp4Candidates) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(cand)) {
          chosenMime = cand;
          ext = 'mp4';
          break;
        }
      }
      // If browser doesn't support mp4 encoding natively, fall back to webm
      if (!chosenMime) {
        chosenMime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm';
        ext = 'webm';
      }
    } else {
      const webmCandidates = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp9',
        'video/webm',
      ];
      for (const cand of webmCandidates) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(cand)) {
          chosenMime = cand;
          ext = 'webm';
          break;
        }
      }
      if (!chosenMime) {
        chosenMime = 'video/mp4';
        ext = 'mp4';
      }
    }

    setActualFormat(ext);

    const recordedChunks: Blob[] = [];
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(canvasStream, {
        mimeType: chosenMime || undefined,
        videoBitsPerSecond: bitrate,
      });
    } catch {
      recorder = new MediaRecorder(canvasStream, {
        videoBitsPerSecond: bitrate,
      });
    }
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: recorder.mimeType || (ext === 'mp4' ? 'video/mp4' : 'video/webm') });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setIsExporting(false);
      setProgress(100);
      setElapsedSeconds(config.speedDuration);

      // Trigger celebration
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    };

    // Load background image if used
    let bgImage: HTMLImageElement | null = null;
    if (config.background.source === 'image' && config.background.value) {
      bgImage = new Image();
      bgImage.crossOrigin = 'anonymous';
      bgImage.src = config.background.value;
      await new Promise((res) => {
        bgImage!.onload = res;
        bgImage!.onerror = res;
      });
    }

    // Start recorder with clean 1-second segment intervals (avoiding corrupt microscopic fragments)
    recorder.start(1000);

    // Start audio during rendering if enabled
    if (!config.audio.muted && config.audio.presetId !== 'none') {
      globalAudioEngine.play(0);
    }

    // Render frame sequence deterministically at exactly 30 frames per second
    const duration = config.speedDuration;
    const fps = 30;
    const frameIntervalMs = 1000 / fps; // 33.33ms per frame
    const totalFrames = Math.max(1, Math.round(duration * fps));
    const loopStartTime = performance.now();

    let frameIdx = 0;

    while (frameIdx <= totalFrames && !isCancelledRef.current) {
      const frameTime = Math.min(duration, frameIdx / fps);
      renderCreditsFrame(ctx, config, frameTime, parsedLines, bgImage || videoElement);

      if (videoTrack && typeof (videoTrack as any).requestFrame === 'function') {
        try {
          (videoTrack as any).requestFrame();
        } catch {}
      }

      const pct = Math.min(99, Math.round((frameIdx / totalFrames) * 100));
      setProgress(pct);
      setElapsedSeconds(Math.floor(frameTime));
      frameIdx++;

      // Real-time synchronization pacing to match MediaRecorder capture rate
      const nextTargetTime = loopStartTime + frameIdx * frameIntervalMs;
      const waitMs = Math.max(0, nextTargetTime - performance.now());
      if (waitMs > 0) {
        await new Promise((r) => setTimeout(r, waitMs));
      } else {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    if (isCancelledRef.current) return;

    // Draw exact final frame and request final track frame
    renderCreditsFrame(ctx, config, duration, parsedLines, bgImage || videoElement);
    if (videoTrack && typeof (videoTrack as any).requestFrame === 'function') {
      try { (videoTrack as any).requestFrame(); } catch {}
    }
    setProgress(100);
    setElapsedSeconds(Math.round(duration));

    // Allow recorder to consume remaining frames before closing
    await new Promise((r) => setTimeout(r, 200));

    if (recorder.state !== 'inactive') {
      try { recorder.stop(); } catch {}
    }
    globalAudioEngine.stop();
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
                {config.aspectRatio} • {config.speedDuration}s • {currentDims.label}
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

        {/* Center state or options */}
        {!isExporting && !downloadUrl ? (
          <div className="space-y-4 pt-1">
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
                  const dims = getResolutionDimensions(config.aspectRatio, res);
                  const isSelected = selectedResolution === res;
                  const label = res === '720p' ? '720p HD' : res === '1080p' ? '1080p Full HD' : '4K Ultra HD';
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
                {elapsedSeconds}s / {config.speedDuration}s
              </span>
              <span className="text-[11px] text-neutral-400 font-medium">
                Rendu {selectedResolution.toUpperCase()} en {selectedFormat.toUpperCase()} ({currentDims.width}×{currentDims.height})
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
              {currentDims.width}×{currentDims.height} • {actualFormat.toUpperCase()} • 30 FPS
            </span>
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
              <span>{isExporting ? 'Encodage en cours...' : `Démarrer le rendu (${selectedResolution.toUpperCase()} • ${selectedFormat.toUpperCase()})`}</span>
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
