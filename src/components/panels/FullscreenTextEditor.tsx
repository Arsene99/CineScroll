import React from 'react';
import { X, Check } from 'lucide-react';
import { CreditsConfig } from '../../types';

interface FullscreenTextEditorProps {
  config: CreditsConfig;
  onChange: (updated: Partial<CreditsConfig>) => void;
  onClose: () => void;
}

export const FullscreenTextEditor: React.FC<FullscreenTextEditorProps> = ({
  config,
  onChange,
  onClose,
}) => {
  const linesCount = config.text.split('\n').filter((l) => l.trim().length > 0).length;

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950 flex flex-col text-white animate-in fade-in duration-200">
      {/* Permanent Fixed Top Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-neutral-950 border-b border-neutral-800/90 z-20">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onClose}
            aria-label="Fermer l'éditeur de texte"
            className="w-9 h-9 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white flex items-center justify-center active:scale-95 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-neutral-200">
              Édition du Texte
            </div>
            <div className="text-[10px] font-mono text-neutral-400">
              {linesCount} lignes
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          aria-label="Valider le texte et fermer"
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs active:scale-95 transition-all shadow-md shadow-amber-500/20"
        >
          <Check className="w-3.5 h-3.5 stroke-[3]" />
          <span>Terminer</span>
        </button>
      </header>

      {/* Pure Fullscreen Text Area - Occupies the entire space with zero clutter */}
      <main className="flex-1 relative flex flex-col overflow-hidden bg-neutral-950">
        <textarea
          value={config.text}
          onChange={(e) => onChange({ text: e.target.value })}
          aria-label="Contenu complet du générique"
          placeholder="Écrivez directement votre texte ici...
Exemple:
# TITRE DU FILM
UN FILM DE
Jean-Luc Vasseur

RÉALISATION : Alexandre Dumas
IMAGE : Marie Curie

FIN"
          className="w-full h-full bg-transparent border-0 outline-none focus:outline-none focus:ring-0 p-4 sm:p-6 text-sm sm:text-base font-mono leading-relaxed text-neutral-100 placeholder:text-neutral-600 resize-none overflow-y-auto selection:bg-amber-500/30"
          style={{ fontFamily: 'monospace' }}
          autoFocus
        />
      </main>
    </div>
  );
};
