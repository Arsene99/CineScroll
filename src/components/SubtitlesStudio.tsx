import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Plus, Trash2, Play, Pause, Download, Upload, Sparkles, X } from 'lucide-react';
import { SubtitleItem, AspectRatio, BackgroundConfig } from '../types';
import { formatTime, getCanvasDimensions } from '../utils/creditsEngine';
import { globalAudioEngine } from '../utils/audioSynth';
import confetti from 'canvas-confetti';

interface SubtitlesStudioProps {
  onBack: () => void;
}

export const SubtitlesStudio: React.FC<SubtitlesStudioProps> = ({ onBack }) => {
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([
    { id: '1', startTime: 0, endTime: 3.5, text: 'Bienvenue dans CineScroll.' },
    { id: '2', startTime: 4.0, endTime: 7.5, text: 'Ajoutez facilement vos sous-titres et légendes.' },
    { id: '3', startTime: 8.0, endTime: 12.0, text: 'Idéal pour vos Reels, TikTok et Courts-métrages.' },
  ]);

  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [background, setBackground] = useState<BackgroundConfig>({
    source: 'color',
    value: '#08090d',
    overlayOpacity: 0.2,
    blur: 0,
  });
  const [fontSize, setFontSize] = useState(24);
  const [color, setColor] = useState('#ffffff');
  const [bgColor, setBgColor] = useState('rgba(0,0,0,0.75)');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(14);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Load image if changed
  useEffect(() => {
    if (background.source === 'image' && background.value) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = background.value;
      img.onload = () => {
        bgImageRef.current = img;
      };
    } else {
      bgImageRef.current = null;
    }
  }, [background.source, background.value]);

  // Video playback
  useEffect(() => {
    const video = videoElementRef.current;
    if (video && background.source === 'video') {
      if (isPlaying) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
  }, [isPlaying, background.source]);

  // Playback loop
  const step = useCallback(
    (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      setCurrentTime((prev) => {
        const next = prev + delta;
        if (next >= totalDuration) {
          setIsPlaying(false);
          globalAudioEngine.pause();
          return totalDuration;
        }
        return next;
      });

      if (isPlaying) {
        animationFrameIdRef.current = requestAnimationFrame(step);
      }
    },
    [isPlaying, totalDuration]
  );

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = null;
      animationFrameIdRef.current = requestAnimationFrame(step);
    } else {
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
    }
    return () => {
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
    };
  }, [isPlaying, step]);

  // Find active subtitle
  const activeSubtitle = subtitles.find(
    (s) => currentTime >= s.startTime && currentTime <= s.endTime
  );

  // Render subtitle frame onto canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = getCanvasDimensions(aspectRatio, 1080);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Background
    if (background.source === 'color') {
      ctx.fillStyle = background.value;
      ctx.fillRect(0, 0, width, height);
    } else if (bgImageRef.current) {
      const img = bgImageRef.current;
      const hRatio = width / img.naturalWidth;
      const vRatio = height / img.naturalHeight;
      const ratio = Math.max(hRatio, vRatio);
      const shiftX = (width - img.naturalWidth * ratio) / 2;
      const shiftY = (height - img.naturalHeight * ratio) / 2;
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, shiftX, shiftY, img.naturalWidth * ratio, img.naturalHeight * ratio);
    } else if (videoElementRef.current && background.source === 'video') {
      const vid = videoElementRef.current;
      const hRatio = width / (vid.videoWidth || width);
      const vRatio = height / (vid.videoHeight || height);
      const ratio = Math.max(hRatio, vRatio);
      const shiftX = (width - (vid.videoWidth || width) * ratio) / 2;
      const shiftY = (height - (vid.videoHeight || height) * ratio) / 2;
      ctx.drawImage(vid, 0, 0, vid.videoWidth || width, vid.videoHeight || height, shiftX, shiftY, (vid.videoWidth || width) * ratio, (vid.videoHeight || height) * ratio);
    } else {
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, width, height);
    }

    // Dark overlay
    if (background.overlayOpacity > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${background.overlayOpacity})`;
      ctx.fillRect(0, 0, width, height);
    }

    // Draw active subtitle
    if (activeSubtitle && activeSubtitle.text.trim()) {
      ctx.save();
      ctx.font = `600 ${fontSize * 1.5}px "Inter", sans-serif`;
      ctx.textAlign = 'center';

      const padding = 16;
      const textMetrics = ctx.measureText(activeSubtitle.text);
      const textWidth = textMetrics.width;
      const textHeight = fontSize * 1.5;

      const subY = height * 0.82;
      const boxX = (width - textWidth) / 2 - padding;
      const boxY = subY - textHeight + 4;
      const boxWidth = textWidth + padding * 2;
      const boxHeight = textHeight + padding;

      // Subtitle background pill / box
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 10);
      ctx.fill();

      // Subtitle text
      ctx.fillStyle = color;
      ctx.fillText(activeSubtitle.text, width / 2, subY);
      ctx.restore();
    }
  }, [aspectRatio, background, activeSubtitle, fontSize, color, bgColor]);

  const handleAddSubtitle = () => {
    const lastSub = subtitles[subtitles.length - 1];
    const newStart = lastSub ? lastSub.endTime + 0.5 : 0;
    const newEnd = newStart + 3;
    const newSub: SubtitleItem = {
      id: Date.now().toString(),
      startTime: newStart,
      endTime: newEnd,
      text: 'Nouveau sous-titre...',
    };
    setSubtitles([...subtitles, newSub]);
    if (newEnd > totalDuration) {
      setTotalDuration(Math.ceil(newEnd + 2));
    }
  };

  const handleUpdateSubtitle = (id: string, updated: Partial<SubtitleItem>) => {
    setSubtitles((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updated } : s))
    );
  };

  const handleDeleteSubtitle = (id: string) => {
    setSubtitles((prev) => prev.filter((s) => s.id !== id));
  };

  const [exportExt, setExportExt] = useState('mp4');

  const handleExportSubtitlesVideo = async () => {
    setIsExporting(true);
    setExportProgress(0);
    setDownloadUrl(null);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const stream = canvas.captureStream(30);
    const recordedChunks: Blob[] = [];

    let chosenMime = '';
    let ext = 'mp4';
    const mp4Candidates = ['video/mp4;codecs=avc1', 'video/mp4'];
    for (const cand of mp4Candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(cand)) {
        chosenMime = cand;
        ext = 'mp4';
        break;
      }
    }
    if (!chosenMime) {
      chosenMime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      ext = 'webm';
    }
    setExportExt(ext);

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: chosenMime || undefined, videoBitsPerSecond: 4_000_000 });
    } catch {
      recorder = new MediaRecorder(stream);
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: recorder.mimeType || (ext === 'mp4' ? 'video/mp4' : 'video/webm') });
      setDownloadUrl(URL.createObjectURL(blob));
      setIsExporting(false);
      setExportProgress(100);
      confetti({ particleCount: 70, spread: 60 });
    };

    recorder.start(1000);

    const fps = 30;
    const frameIntervalMs = 1000 / fps;
    const duration = totalDuration;
    const totalFrames = Math.max(1, Math.round(duration * fps));
    const loopStartTime = performance.now();

    for (let frameIdx = 0; frameIdx <= totalFrames; frameIdx++) {
      const frameTime = Math.min(duration, frameIdx / fps);
      setCurrentTime(frameTime);
      setExportProgress(Math.min(99, Math.round((frameIdx / totalFrames) * 100)));

      const nextTarget = loopStartTime + frameIdx * frameIntervalMs;
      const waitMs = Math.max(0, nextTarget - performance.now());
      if (waitMs > 0) {
        await new Promise((r) => setTimeout(r, waitMs));
      } else {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    setCurrentTime(duration);
    setExportProgress(100);
    await new Promise((r) => setTimeout(r, 200));
    if (recorder.state !== 'inactive') {
      try { recorder.stop(); } catch {}
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white select-none overflow-hidden">
      {/* Hidden media elements */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setBackground({ ...background, source: 'image', value: URL.createObjectURL(file) });
        }}
        className="hidden"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setBackground({ ...background, source: 'video', value: URL.createObjectURL(file) });
        }}
        className="hidden"
      />
      <video
        ref={videoElementRef}
        src={background.source === 'video' ? background.value : undefined}
        loop
        muted
        playsInline
        className="hidden"
      />

      {/* Top clean header */}
      <header className="flex items-center justify-between px-4 py-3 bg-neutral-950/80 border-b border-neutral-900 z-30">
        <button
          onClick={onBack}
          aria-label="Retour à l'accueil"
          className="flex items-center gap-1.5 p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white active:scale-95 transition-all text-xs"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-200">
            Sous-titres
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
          <span className="text-[10px] font-mono text-neutral-400">
            {aspectRatio}
          </span>
        </div>

        <button
          onClick={handleExportSubtitlesVideo}
          disabled={isExporting}
          aria-label="Exporter la vidéo sous-titrée"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-neutral-950 font-bold text-xs active:scale-95 transition-all shadow-md shadow-sky-500/20"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isExporting ? `${exportProgress}%` : 'Exporter'}</span>
        </button>
      </header>

      {/* Main viewport */}
      <main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden px-4 py-2">
        {/* Canvas preview */}
        <div
          className={`relative flex items-center justify-center rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800 shadow-2xl ${
            aspectRatio === '9:16'
              ? 'aspect-[9/16] max-h-[46vh]'
              : aspectRatio === '16:9'
              ? 'aspect-[16/9] w-full max-h-[36vh]'
              : 'aspect-square max-h-[40vh]'
          }`}
          onClick={() => setIsPlaying(!isPlaying)}
        >
          <canvas ref={canvasRef} className="w-full h-full object-contain pointer-events-none" />


        </div>

        {/* Minimal Timeline */}
        <div className="w-full max-w-sm mt-2 flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            aria-label={isPlaying ? 'Pause' : 'Lecture'}
            className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center"
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.2" />}
          </button>
          <input
            type="range"
            min={0}
            max={totalDuration}
            step={0.1}
            value={currentTime}
            onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
            aria-label="Curseur temporel"
            className="flex-1 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
          <span className="text-[10px] font-mono text-neutral-400">
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </span>
        </div>
      </main>

      {/* Subtitles Items List & Tools Drawer */}
      <div className="h-64 bg-neutral-950/95 border-t border-neutral-800 p-3 flex flex-col justify-between">
        {/* Quick action bar */}
        <div className="flex items-center justify-between pb-2 border-b border-neutral-900">
          <div className="flex items-center gap-2">
            <button
              onClick={() => imageInputRef.current?.click()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-300 hover:text-white active:scale-95"
            >
              <Upload className="w-3 h-3 text-sky-400" />
              <span>Image</span>
            </button>
            <button
              onClick={() => videoInputRef.current?.click()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-300 hover:text-white active:scale-95"
            >
              <Upload className="w-3 h-3 text-sky-400" />
              <span>Vidéo</span>
            </button>
            <button
              onClick={() =>
                setAspectRatio(aspectRatio === '9:16' ? '16:9' : aspectRatio === '16:9' ? '1:1' : '9:16')
              }
              className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] font-mono text-neutral-300 hover:text-white"
            >
              {aspectRatio}
            </button>
          </div>

          <button
            onClick={handleAddSubtitle}
            aria-label="Ajouter un sous-titre"
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-neutral-950 font-bold text-xs active:scale-95 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter</span>
          </button>
        </div>

        {/* Subtitles list */}
        <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1 no-scrollbar">
          {subtitles.map((sub, idx) => {
            const isActive = currentTime >= sub.startTime && currentTime <= sub.endTime;
            return (
              <div
                key={sub.id}
                onClick={() => setCurrentTime(sub.startTime)}
                className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                  isActive
                    ? 'bg-neutral-800/90 border-sky-500/80 shadow-md'
                    : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700'
                }`}
              >
                <span className="text-[10px] font-mono text-neutral-500 w-4 text-center">
                  {idx + 1}
                </span>

                <input
                  type="text"
                  value={sub.text}
                  onChange={(e) => handleUpdateSubtitle(sub.id, { text: e.target.value })}
                  aria-label={`Sous-titre ${idx + 1}`}
                  className="flex-1 bg-transparent text-xs text-neutral-200 focus:outline-none focus:text-white"
                />

                <div className="flex items-center gap-1 text-[10px] font-mono text-neutral-400">
                  <span>{formatTime(sub.startTime)}</span>
                  <span>-</span>
                  <span>{formatTime(sub.endTime)}</span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSubtitle(sub.id);
                  }}
                  aria-label="Supprimer ce sous-titre"
                  className="p-1 rounded text-neutral-500 hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Export ready banner if url exists */}
      {downloadUrl && (
        <div className="fixed inset-x-4 bottom-4 z-50 p-3 bg-neutral-900 border border-sky-500/80 rounded-2xl flex items-center justify-between shadow-2xl">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-semibold text-neutral-100">Vidéo sous-titrée prête</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={downloadUrl}
              download={`sous-titres-cinescroll.${exportExt}`}
              className="px-3 py-1.5 rounded-xl bg-sky-500 text-neutral-950 font-bold text-xs"
            >
              Télécharger ({exportExt.toUpperCase()})
            </a>
            <button
              onClick={() => setDownloadUrl(null)}
              className="p-1 text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
