import React, { useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { CreditsConfig } from '../types';
import {
  formatTime,
  getCanvasDimensions,
  parseCreditsText,
  renderCreditsFrame,
} from '../utils/creditsEngine';

interface PreviewCanvasProps {
  config: CreditsConfig;
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentTime: number;
  onSeek: (time: number) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  videoElementRef?: React.RefObject<HTMLVideoElement | null>;
}

export const PreviewCanvas: React.FC<PreviewCanvasProps> = ({
  config,
  isPlaying,
  onTogglePlay,
  currentTime,
  onSeek,
  onCanvasReady,
  videoElementRef,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);

  // Load background image if source is image or preset
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

  // Sync background video if present
  useEffect(() => {
    const video = videoElementRef?.current;
    if (video && config.background.source === 'video') {
      if (isPlaying) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
  }, [isPlaying, config.background.source, videoElementRef]);

  // Draw frame on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (onCanvasReady) {
      onCanvasReady(canvas);
    }

    const { width, height } = getCanvasDimensions(config.aspectRatio, 1080);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const parsedLines = parseCreditsText(config.text);
    const bgMedia =
      config.background.source === 'video'
        ? videoElementRef?.current || null
        : bgImageRef.current;

    renderCreditsFrame(ctx, config, currentTime, parsedLines, bgMedia);
  }, [config, currentTime, videoElementRef, onCanvasReady]);

  // Handle scrubber change
  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    onSeek(newTime);
  };

  const handleRestart = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSeek(0);
    if (!isPlaying) onTogglePlay();
  };

  // Aspect ratio styling for maximized preview container on mobile
  const getAspectRatioClass = () => {
    switch (config.aspectRatio) {
      case '9:16':
        return 'aspect-[9/16] h-[72vh] max-h-[74vh] max-w-full';
      case '16:9':
        return 'aspect-[16/9] w-full max-h-[46vh]';
      case '1:1':
      default:
        return 'aspect-square h-[62vh] max-h-[64vh] max-w-full';
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-center w-full h-full px-2 sm:px-4 py-1"
    >
      {/* Video element for custom background video */}
      <video
        ref={videoElementRef}
        src={config.background.source === 'video' ? config.background.value : undefined}
        loop
        muted
        playsInline
        className="hidden"
      />

      {/* Frame wrapper - Maximized display */}
      <div
        className={`relative flex items-center justify-center rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800 shadow-2xl shadow-black ${getAspectRatioClass()}`}
        onClick={onTogglePlay}
        role="button"
        tabIndex={0}
        aria-label={isPlaying ? 'Mettre en pause' : 'Lire le générique'}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            onTogglePlay();
          }
        }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain pointer-events-none"
        />

        {/* Aspect ratio badge */}
        <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono text-neutral-300 pointer-events-none z-10">
          {config.aspectRatio}
        </div>

        {/* Controls Bar DIRECTLY INTEGRATED INSIDE video preview player - Seamless gradient, NO box */}
        <div
          className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2.5 px-3.5 pt-7 pb-2.5 bg-gradient-to-t from-black/90 via-black/45 to-transparent pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Play/Pause button */}
          <button
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause' : 'Lecture'}
            className="w-7 h-7 rounded-full bg-amber-500 hover:bg-amber-400 text-neutral-950 flex items-center justify-center transition-all flex-shrink-0 active:scale-95 shadow-md shadow-black/50"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />}
          </button>

          {/* Restart button */}
          <button
            onClick={handleRestart}
            aria-label="Recommencer"
            className="w-6 h-6 rounded-full text-neutral-300 hover:text-white flex items-center justify-center transition-colors flex-shrink-0 active:scale-95 drop-shadow"
          >
            <RotateCcw className="w-3 h-3" />
          </button>

          {/* Scrubber slider */}
          <div className="flex-1 flex items-center">
            <input
              type="range"
              min={0}
              max={config.speedDuration}
              step={0.1}
              value={currentTime}
              onChange={handleScrub}
              aria-label="Curseur temporel"
              className="w-full h-1.5 bg-white/20 hover:bg-white/30 rounded-lg appearance-none cursor-pointer accent-amber-400 shadow-inner"
            />
          </div>

          {/* Time code */}
          <div className="text-[10px] font-mono font-medium text-white/90 drop-shadow min-w-[58px] text-right">
            {formatTime(currentTime)} / {formatTime(config.speedDuration)}
          </div>
        </div>
      </div>
    </div>
  );
};
