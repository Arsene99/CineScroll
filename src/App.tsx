import { useState, useEffect } from 'react';
import { StudioMode } from './types';
import { ModeSelector } from './components/ModeSelector';
import { CreditsStudio } from './components/CreditsStudio';
import { SubtitlesStudio } from './components/SubtitlesStudio';
import { OfflineIndicator } from './components/OfflineIndicator';

export default function App() {
  const [mode, setMode] = useState<StudioMode>('selection');

  // Support ?autostart=1 or ?mode=credits for testing / direct load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' || params.get('mode') === 'credits') {
      setMode('credits');
    } else if (params.get('mode') === 'subtitles') {
      setMode('subtitles');
    }
  }, []);

  return (
    <div className="w-full min-h-screen bg-black text-white selection:bg-amber-500/30 selection:text-amber-200">
      {mode === 'selection' && (
        <ModeSelector onSelectMode={(selected) => setMode(selected)} />
      )}

      {mode === 'credits' && (
        <CreditsStudio onBack={() => setMode('selection')} />
      )}

      {mode === 'subtitles' && (
        <SubtitlesStudio onBack={() => setMode('selection')} />
      )}

      {/* Global PWA Offline indicator */}
      <OfflineIndicator />
    </div>
  );
}
