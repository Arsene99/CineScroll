import React from 'react';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowUp,
  ArrowDown,
  Eye,
  Compass,
  Columns2,
  Minus,
  Plus,
  Sparkles,
} from 'lucide-react';
import { CreditsConfig, ScrollDirection, TextAlignment } from '../../types';
import { FONT_OPTIONS, CREDIT_TEMPLATES } from '../../utils/presets';

interface TextPanelProps {
  config: CreditsConfig;
  onChange: (updated: Partial<CreditsConfig>) => void;
  onClose: () => void;
}

export const TextPanel: React.FC<TextPanelProps> = ({ config, onChange }) => {
  const directions: { id: ScrollDirection; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
    { id: 'bottom-to-top', icon: ArrowUp, label: 'Haut' },
    { id: 'top-to-bottom', icon: ArrowDown, label: 'Bas' },
    { id: 'fade-in', icon: Eye, label: 'Fixe' },
    { id: 'star-crawl', icon: Compass, label: 'Crawl' },
  ];

  const alignments: { id: TextAlignment; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
    { id: 'left', icon: AlignLeft, label: 'Gauche' },
    { id: 'center', icon: AlignCenter, label: 'Centre' },
    { id: 'right', icon: AlignRight, label: 'Droite' },
  ];

  const textColors = [
    { name: 'Blanc', value: '#ffffff' },
    { name: 'Doré', value: '#fbbf24' },
    { name: 'Argent', value: '#e2e8f0' },
    { name: 'Cyan', value: '#38bdf8' },
    { name: 'Crème', value: '#fef3c7' },
  ];

  return (
    <div className="space-y-4 text-white">
      {/* Quick templates bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <div className="flex items-center gap-1 text-[11px] font-medium text-neutral-400 pl-1 pr-2 flex-shrink-0">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>Modèles :</span>
        </div>
        {CREDIT_TEMPLATES.map((tmpl) => (
          <button
            key={tmpl.id}
            onClick={() => onChange({ text: tmpl.text })}
            className="px-2.5 py-1 rounded-full bg-neutral-800 hover:bg-neutral-700 text-[11px] font-medium text-neutral-300 hover:text-white transition-colors flex-shrink-0 active:scale-95"
          >
            {tmpl.name}
          </button>
        ))}
      </div>

      {/* Textarea for inputting/editing credits */}
      <div className="relative">
        <textarea
          value={config.text}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={5}
          aria-label="Texte du générique"
          placeholder="Entrez vos crédits ou utilisez 'ROLE : NOM'..."
          className="w-full p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-sm font-mono text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-amber-500/80 resize-none transition-colors"
        />
      </div>

      {/* Row: Alignment & Direction Controls */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Alignment */}
        <div className="p-2 rounded-xl bg-neutral-900/80 border border-neutral-800/80">
          <div className="flex items-center justify-between">
            {alignments.map((align) => {
              const Icon = align.icon;
              const isSelected = config.alignment === align.id;
              return (
                <button
                  key={align.id}
                  onClick={() => onChange({ alignment: align.id })}
                  aria-label={align.label}
                  aria-pressed={isSelected}
                  className={`w-9 h-8 rounded-lg flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-amber-500 text-neutral-950 font-bold'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Direction */}
        <div className="p-2 rounded-xl bg-neutral-900/80 border border-neutral-800/80">
          <div className="flex items-center justify-between">
            {directions.map((dir) => {
              const Icon = dir.icon;
              const isSelected = config.direction === dir.id;
              return (
                <button
                  key={dir.id}
                  onClick={() => onChange({ direction: dir.id })}
                  aria-label={dir.label}
                  aria-pressed={isSelected}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-amber-500 text-neutral-950 font-bold'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fonts horizontal scroll */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {FONT_OPTIONS.map((font) => {
            const cleanCurrent = (config.fontFamily || '').toLowerCase().trim();
            const cleanFont = font.family.toLowerCase().trim();
            const isSelected =
              cleanCurrent === cleanFont ||
              cleanCurrent.startsWith(cleanFont) ||
              cleanCurrent === font.name.toLowerCase() ||
              cleanCurrent === font.id;
            return (
              <button
                key={font.id}
                onClick={() => onChange({ fontFamily: font.family })}
                className={`px-3 py-1.5 rounded-xl border text-xs whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-neutral-800 border-amber-500 text-amber-400 font-bold shadow-sm'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
                style={{ fontFamily: `"${font.family}", sans-serif` }}
              >
                {font.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Row: Font Size & Speed Duration Slider */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Font size control */}
        <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
          <button
            onClick={() => onChange({ fontSize: Math.max(16, config.fontSize - 2) })}
            aria-label="Diminuer la taille"
            className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-300"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-mono text-neutral-200">
            {config.fontSize}px
          </span>
          <button
            onClick={() => onChange({ fontSize: Math.min(64, config.fontSize + 2) })}
            aria-label="Augmenter la taille"
            className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-300"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Speed / Duration control */}
        <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
          <button
            onClick={() => onChange({ speedDuration: Math.max(5, config.speedDuration - 5) })}
            aria-label="Accélérer le défilement"
            className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-300"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-mono text-neutral-200">
            {config.speedDuration}s
          </span>
          <button
            onClick={() => onChange({ speedDuration: Math.min(120, config.speedDuration + 5) })}
            aria-label="Ralentir le défilement"
            className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-300"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Row: Text color swatches & 2-column role toggle */}
      <div className="flex items-center justify-between gap-3 pt-0.5">
        <div className="flex items-center gap-2">
          {textColors.map((c) => (
            <button
              key={c.value}
              onClick={() => onChange({ color: c.value })}
              aria-label={c.name}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${
                config.color === c.value
                  ? 'border-amber-500 scale-110 shadow-md'
                  : 'border-transparent hover:scale-105'
              }`}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>

        <button
          onClick={() => onChange({ roleSeparation: !config.roleSeparation })}
          aria-pressed={config.roleSeparation}
          aria-label="Disposition 2 colonnes rôle et nom"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
            config.roleSeparation
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
              : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
          }`}
        >
          <Columns2 className="w-3.5 h-3.5" />
          <span>2 Colonnes</span>
        </button>
      </div>
    </div>
  );
};
