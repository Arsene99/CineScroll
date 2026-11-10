import React, { useState } from 'react';
import { Download, Share2, Film, CheckCircle2, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { CreditsConfig } from '../../types';
import {
  getCanvasDimensions,
  parseCreditsText,
  renderCreditsFrame,
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
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  const startExport = async () => {
    setIsExporting(true);
    setProgress(0);
    setDownloadUrl(null);

    // Create offscreen rendering canvas
    const exportCanvas = document.createElement('canvas');
    const { width, height } = getCanvasDimensions(config.aspectRatio, 1080);
    exportCanvas.width = width;
    exportCanvas.height = height;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) {
      setIsExporting(false);
      return;
    }

    const parsedLines = parseCreditsText(config.text);

    // Capture video stream from canvas at 30fps
    const canvasStream = exportCanvas.captureStream(30);

    // Add audio track if audio is active
    const audioDestination = globalAudioEngine.getAudioStreamDestination();
    if (audioDestination && !config.audio.muted && config.audio.presetId !== 'none') {
      const audioTracks = audioDestination.stream.getAudioTracks();
      if (audioTracks.length > 0) {
        canvasStream.addTrack(audioTracks[0]);
      }
    }

    // Determine supported mime type
    let mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/mp4';
      }
    }

    const recordedChunks: Blob[] = [];
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(canvasStream, {
        mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
        videoBitsPerSecond: 3_000_000,
      });
    } catch {
      recorder = new MediaRecorder(canvasStream);
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: recorder.mimeType || 'video/webm' });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setIsExporting(false);
      setProgress(100);

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

    // Start recorder
    recorder.start(100);

    // Start audio during rendering if enabled
    if (!config.audio.muted && config.audio.presetId !== 'none') {
      globalAudioEngine.play(0);
    }

    // Render frame sequence
    const fps = 30;
    const totalFrames = Math.max(30, Math.round(config.speedDuration * fps));
    const dt = config.speedDuration / totalFrames;

    let currentFrame = 0;

    const renderStep = () => {
      if (currentFrame >= totalFrames) {
        recorder.stop();
        globalAudioEngine.stop();
        return;
      }

      const t = currentFrame * dt;
      renderCreditsFrame(ctx, config, t, parsedLines, bgImage || videoElement);

      currentFrame++;
      setProgress(Math.round((currentFrame / totalFrames) * 100));

      // Use requestAnimationFrame for smooth non-blocking export
      requestAnimationFrame(renderStep);
    };

    renderStep();
  };

  const handleShare = async () => {
    if (downloadUrl && navigator.share) {
      try {
        const response = await fetch(downloadUrl);
        const blob = await response.blob();
        const file = new File([blob], 'generique-cinescroll.webm', { type: blob.type });
        await navigator.share({
          files: [file],
          title: 'Mon Générique CineScroll',
        });
      } catch {
        // Fallback or user dismissed
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-t-3xl sm:rounded-2xl p-6 text-white shadow-2xl space-y-5">
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
                {config.aspectRatio} • {config.speedDuration}s • 1080p
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Center state */}
        <div className="flex flex-col items-center justify-center py-4">
          {isExporting ? (
            <div className="flex flex-col items-center space-y-3">
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
              <span className="text-xs text-neutral-400 font-medium animate-pulse">
                Rendu vidéo en cours...
              </span>
            </div>
          ) : downloadUrl ? (
            <div className="flex flex-col items-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <span className="text-sm font-bold text-neutral-100">
                Vidéo prête !
              </span>
              <span className="text-xs text-neutral-400">
                Fichier haute définition avec audio
              </span>
            </div>
          ) : (
            <div className="text-center space-y-1">
              <p className="text-xs text-neutral-300">
                Prêt pour l'encodage direct de votre générique.
              </p>
              <p className="text-[11px] text-neutral-500 font-mono">
                Résolution fluide 30 FPS • Rendu optimisé mobile
              </p>
            </div>
          )}
        </div>

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
              <span>{isExporting ? 'Encodage...' : 'Démarrer le rendu'}</span>
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <a
                href={downloadUrl}
                download={`cinescroll-${Date.now()}.webm`}
                className="py-3 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg active:scale-98"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger</span>
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
                  onClick={onClose}
                  aria-label="Terminer"
                  className="py-3 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-medium text-xs flex items-center justify-center gap-2 transition-all active:scale-98"
                >
                  <span>Fermer</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
