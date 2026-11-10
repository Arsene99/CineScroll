import React from 'react';
import { StudioMode } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface ModeSelectorProps {
  onSelectMode: (mode: StudioMode) => void;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({ onSelectMode }) => {
  return (
    <div className="flex flex-col min-h-screen bg-black text-white select-none px-6 py-10 justify-between">
      {/* 1. Large software title at top: name only, no icons, no badges */}
      <header className="pt-4 text-center">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white font-sans">
          CineScroll
        </h1>
      </header>

      {/* 2. Two simple cards stacked one above the other */}
      <main className="w-full max-w-md mx-auto my-auto flex flex-col gap-4 py-8">
        {/* Card 1: Génériques */}
        <button
          onClick={() => onSelectMode('credits')}
          aria-label="Génériques, Défilement et audio"
          className="w-full py-8 px-6 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/70 text-left transition-all duration-200 active:scale-[0.98] shadow-xl hover:bg-neutral-850"
        >
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-1">
            Génériques
          </h2>
          <p className="text-sm text-neutral-400 font-medium">
            Défilement et audio
          </p>
        </button>

        {/* Card 2: Sous-titres */}
        <button
          onClick={() => onSelectMode('subtitles')}
          aria-label="Sous-titres, Légendes et synchronisation"
          className="w-full py-8 px-6 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-left transition-all duration-200 active:scale-[0.98] shadow-xl hover:bg-neutral-850"
        >
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-1">
            Sous-titres
          </h2>
          <p className="text-sm text-neutral-400 font-medium">
            Légendes et synchronisation
          </p>
        </button>
      </main>

      {/* PWA Install Button area */}
      <footer className="w-full max-w-md mx-auto flex justify-center pb-2">
        <PWAInstallButton variant="full" />
      </footer>
    </div>
  );
};
