import { useState, useEffect, useCallback } from 'react';
import { SavedProject, StudioMode } from './types';
import { ModeSelector } from './components/ModeSelector';
import { CreditsStudio } from './components/CreditsStudio';
import { SubtitlesStudio } from './components/SubtitlesStudio';
import { OfflineIndicator } from './components/OfflineIndicator';
import { globalAudioEngine, syncAudioEngineWithConfig } from './utils/audioSynth';

export default function App() {
  const [mode, setMode] = useState<StudioMode>('selection');
  const [activeProject, setActiveProject] = useState<SavedProject | null>(null);
  const [sessionKey, setSessionKey] = useState(0);

  // Support ?autostart=1 or ?mode=credits for testing / direct load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' || params.get('mode') === 'credits') {
      setMode('credits');
    } else if (params.get('mode') === 'subtitles') {
      setMode('subtitles');
    }

    // Force eager preloading of all font families so the PWA service worker caches all .woff2 files for offline use
    if ('fonts' in document) {
      const fontsToPreload = [
        '600 24px "Cinzel"',
        '800 24px "Cinzel"',
        '500 24px "Montserrat"',
        '700 24px "Montserrat"',
        '900 24px "Montserrat"',
        '400 24px "Bebas Neue"',
        '600 24px "Playfair Display"',
        '400 24px "Courier Prime"',
        '700 24px "Courier Prime"',
        '500 24px "Space Grotesk"',
        '700 24px "Space Grotesk"',
        '400 24px "Inter"',
        '600 24px "Inter"',
      ];
      fontsToPreload.forEach((f) => {
        try {
          document.fonts.load(f).catch(() => {});
        } catch {}
      });
    }
  }, []);

  const handleSelectMode = useCallback((selected: StudioMode) => {
    globalAudioEngine.stop();
    setActiveProject(null);
    setSessionKey((k) => k + 1);
    setMode(selected);
  }, []);

  const handleOpenSavedProject = useCallback((project: SavedProject) => {
    const audioCfg =
      project.kind === 'credits'
        ? project.creditsConfig?.audio
        : project.subtitlesConfig?.audio;
    if (audioCfg) {
      syncAudioEngineWithConfig(audioCfg);
    } else {
      globalAudioEngine.stop();
    }
    setActiveProject(project);
    setSessionKey((k) => k + 1);
    setMode(project.kind);
  }, []);

  const handleBackToHome = useCallback(() => {
    globalAudioEngine.stop();
    setActiveProject(null);
    setMode('selection');
  }, []);

  return (
    <div className="w-full min-h-screen bg-black text-white selection:bg-amber-500/30 selection:text-amber-200">
      {mode === 'selection' && (
        <ModeSelector
          onSelectMode={handleSelectMode}
          onOpenSavedProject={handleOpenSavedProject}
        />
      )}

      {mode === 'credits' && (
        <CreditsStudio
          key={`credits-${sessionKey}`}
          initialProject={activeProject?.kind === 'credits' ? activeProject : null}
          onOpenSavedProject={handleOpenSavedProject}
          onBack={handleBackToHome}
        />
      )}

      {mode === 'subtitles' && (
        <SubtitlesStudio
          key={`subtitles-${sessionKey}`}
          initialProject={activeProject?.kind === 'subtitles' ? activeProject : null}
          onOpenSavedProject={handleOpenSavedProject}
          onBack={handleBackToHome}
        />
      )}

      {/* Global PWA Offline indicator */}
      <OfflineIndicator />

      {/* Hidden eager font DOM preloader: forces browser to fetch all woff2 files into service worker cache */}
      <div
        className="fixed -top-96 -left-96 opacity-0 pointer-events-none select-none text-[1px] -z-50"
        aria-hidden="true"
      >
        <span style={{ fontFamily: 'Cinzel', fontWeight: 600 }}>C</span>
        <span style={{ fontFamily: 'Cinzel', fontWeight: 800 }}>C</span>
        <span style={{ fontFamily: 'Montserrat', fontWeight: 500 }}>M</span>
        <span style={{ fontFamily: 'Montserrat', fontWeight: 700 }}>M</span>
        <span style={{ fontFamily: 'Bebas Neue', fontWeight: 400 }}>B</span>
        <span style={{ fontFamily: 'Playfair Display', fontWeight: 600 }}>P</span>
        <span style={{ fontFamily: 'Courier Prime', fontWeight: 400 }}>C</span>
        <span style={{ fontFamily: 'Courier Prime', fontWeight: 700 }}>C</span>
        <span style={{ fontFamily: 'Space Grotesk', fontWeight: 500 }}>S</span>
        <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700 }}>S</span>
        <span style={{ fontFamily: 'Inter', fontWeight: 400 }}>I</span>
        <span style={{ fontFamily: 'Inter', fontWeight: 600 }}>I</span>
      </div>
    </div>
  );
}
