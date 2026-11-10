import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Sparkles, Download, X } from 'lucide-react';
import { CreditsConfig } from '../types';
import { CREDIT_TEMPLATES } from '../utils/presets';
import { PreviewCanvas } from './PreviewCanvas';
import { Toolbar, ActiveTab } from './Toolbar';
import { FullscreenTextEditor } from './panels/FullscreenTextEditor';
import { BackgroundPanel } from './panels/BackgroundPanel';
import { AudioPanel } from './panels/AudioPanel';
import { RatioPanel } from './panels/RatioPanel';
import { ExportModal } from './panels/ExportModal';
import { StudioTextToolbar, TextToolId } from './StudioTextToolbar';
import { globalAudioEngine } from '../utils/audioSynth';
import { PWAInstallButton } from './PWAInstallButton';

interface CreditsStudioProps {
  onBack: () => void;
}

export const CreditsStudio: React.FC<CreditsStudioProps> = ({ onBack }) => {
  // Main credits configuration
  const [config, setConfig] = useState<CreditsConfig>({
    text: CREDIT_TEMPLATES[0].text,
    fontFamily: 'Cinzel',
    fontSize: 24,
    color: '#ffffff',
    alignment: 'center',
    direction: 'bottom-to-top',
    speedDuration: 25,
    lineSpacing: 1.6,
    roleSeparation: true,
    textShadow: true,
    background: {
      source: 'color',
      value: '#050508',
      overlayOpacity: 0, // No artificial dimming by default
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);

  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const currentTimeRef = useRef(0);
  const isPlayingRef = useRef(false);

  currentTimeRef.current = currentTime;
  isPlayingRef.current = isPlaying;

  // Partial config update helper
  const handleConfigChange = (updated: Partial<CreditsConfig>) => {
    setConfig((prev) => ({ ...prev, ...updated }));
  };

  // Playback loop with accurate delta timing
  const step = useCallback(
    (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      const next = currentTimeRef.current + delta;
      if (next >= config.speedDuration) {
        currentTimeRef.current = config.speedDuration;
        setCurrentTime(config.speedDuration);
        setIsPlaying(false);
        globalAudioEngine.stop(); // Stop audio immediately at end of text scroll
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
    [config.speedDuration]
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

  const handleTogglePlay = () => {
    if (currentTimeRef.current >= config.speedDuration) {
      currentTimeRef.current = 0;
      setCurrentTime(0);
      globalAudioEngine.seek(0);
    }
    setIsPlaying((prev) => !prev);
  };

  const [activeTextTool, setActiveTextTool] = useState<TextToolId>(null);

  const handleSeek = (time: number) => {
    currentTimeRef.current = time;
    setCurrentTime(time);
    globalAudioEngine.seek(time);
  };

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTextTool(null);
    if (tab === 'export') {
      setIsPlaying(false);
      setShowExportModal(true);
    } else {
      setActiveTab(tab);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white select-none overflow-hidden relative">
      {/* 1. Top clean header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 bg-neutral-950 border-b border-neutral-900 z-30">
        <button
          onClick={onBack}
          aria-label="Retour à l'accueil"
          className="flex items-center gap-1.5 p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white active:scale-95 transition-all text-xs"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-200">
            Générique
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span className="text-[10px] font-mono text-neutral-400">
            {config.aspectRatio}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <PWAInstallButton variant="compact" />

          <button
            onClick={() => {
              setIsPlaying(false);
              setShowExportModal(true);
            }}
            aria-label="Exporter la vidéo"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs active:scale-95 transition-all shadow-md shadow-amber-500/20"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exporter</span>
          </button>
        </div>
      </header>

      {/* 2. Horizontal Text Editing Toolbar directly below the header */}
      <div className="flex-shrink-0 z-30">
        <StudioTextToolbar
          config={config}
          onChange={handleConfigChange}
          activeTool={activeTextTool}
          onSelectTool={(tool) => {
            setActiveTextTool(tool);
            if (activeTab) setActiveTab(null);
          }}
        />
      </div>

      {/* 3. Maximized Live Video Preview Center Area */}
      <main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden pb-16 pt-0.5">
        <PreviewCanvas
          config={config}
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
          currentTime={currentTime}
          onSeek={handleSeek}
          videoElementRef={videoElementRef}
        />
      </main>

      {/* Fullscreen Text Editor when 'text' is selected */}
      {activeTab === 'text' && (
        <FullscreenTextEditor
          config={config}
          onChange={handleConfigChange}
          onClose={() => setActiveTab(null)}
        />
      )}

      {/* Interactive Bottom Sheet Drawer with Fixed/Sticky Header for Background, Audio, Ratio */}
      {activeTab && activeTab !== 'text' && (
        <>
          {/* Subtle backdrop overlay to close on click outside */}
          <div
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setActiveTab(null)}
          />

          <div className="fixed inset-x-0 bottom-16 z-40 bg-neutral-950/98 backdrop-blur-2xl border-t border-neutral-800 rounded-t-3xl shadow-2xl max-h-[60vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
            {/* 1. Permanent Pinned Header - Never scrolls away! */}
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

            {/* 2. Scrollable Content Area */}
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
                  onSyncDuration={(duration) => handleConfigChange({ speedDuration: duration })}
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

      {/* Floating Bottom Toolbar */}
      <Toolbar activeTab={activeTab} onSelectTab={handleSelectTab} />

      {/* Video Exporter Modal */}
      <ExportModal
        config={config}
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        videoElement={videoElementRef.current}
      />
    </div>
  );
};
