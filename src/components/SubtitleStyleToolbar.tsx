import React from 'react';
import {
  Clock,
  Type,
  Palette,
  Minus,
  Plus,
  Check,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyStart,
  Square,
} from 'lucide-react';
import {
  SubtitleBoxStyle,
  SubtitlePosition,
  SubtitlesStudioConfig,
} from '../types';
import { FONT_OPTIONS } from '../utils/presets';
import { gradientToCss } from '../utils/creditsEngine';
import { ColorPalettePicker } from './ColorPalettePicker';

export type SubtitleToolId =
  | 'duration'
  | 'font'
  | 'size'
  | 'position'
  | 'boxStyle'
  | 'color'
  | null;

interface SubtitleStyleToolbarProps {
  config: SubtitlesStudioConfig;
  onChange: (updated: Partial<SubtitlesStudioConfig>) => void;
  activeTool: SubtitleToolId;
  onSelectTool: (tool: SubtitleToolId) => void;
}

export const SubtitleStyleToolbar: React.FC<SubtitleStyleToolbarProps> = ({
  config,
  onChange,
  activeTool,
  onSelectTool,
}) => {
  const positions: {
    id: SubtitlePosition;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }[] = [
    { id: 'bottom', icon: AlignVerticalJustifyEnd, label: 'Bas' },
    { id: 'center', icon: AlignVerticalJustifyCenter, label: 'Centre' },
    { id: 'top', icon: AlignVerticalJustifyStart, label: 'Haut' },
  ];

  const boxStyles: { id: SubtitleBoxStyle; label: string }[] = [
    { id: 'pill-dark', label: 'Cartouche' },
    { id: 'shadow', label: 'Ombre' },
    { id: 'outline', label: 'Contour' },
  ];

  const handleToolClick = (tool: SubtitleToolId) => {
    onSelectTool(activeTool === tool ? null : tool);
  };

  return (
    <div className="relative w-full z-30">
      <div
        aria-label="Barre d'outils de style des sous-titres"
        className="w-full flex items-center justify-around px-3 py-1.5 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800/80"
      >
        {/* 1. Durée totale */}
        <button
          onClick={() => handleToolClick('duration')}
          aria-label="Durée de la vidéo"
          aria-pressed={activeTool === 'duration'}
          className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
            activeTool === 'duration'
              ? 'bg-amber-500 text-neutral-950 shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-850'
          }`}
          title="Durée"
        >
          <Clock className="w-4 h-4" />
        </button>

        {/* 2. Police */}
        <button
          onClick={() => handleToolClick('font')}
          aria-label="Police de caractères"
          aria-pressed={activeTool === 'font'}
          className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
            activeTool === 'font'
              ? 'bg-amber-500 text-neutral-950 shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-850'
          }`}
          title="Police"
        >
          <Type className="w-4 h-4" />
        </button>

        {/* 3. Taille */}
        <button
          onClick={() => handleToolClick('size')}
          aria-label="Taille du texte"
          aria-pressed={activeTool === 'size'}
          className={`flex items-center justify-center w-9 h-9 rounded-lg font-mono text-xs font-bold transition-all ${
            activeTool === 'size'
              ? 'bg-amber-500 text-neutral-950 shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-850'
          }`}
          title="Taille"
        >
          <span>A</span>
        </button>

        {/* 4. Position verticale */}
        <button
          onClick={() => handleToolClick('position')}
          aria-label="Position des sous-titres"
          aria-pressed={activeTool === 'position'}
          className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
            activeTool === 'position'
              ? 'bg-amber-500 text-neutral-950 shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-850'
          }`}
          title="Position"
        >
          {config.position === 'bottom' && <AlignVerticalJustifyEnd className="w-4 h-4" />}
          {config.position === 'center' && <AlignVerticalJustifyCenter className="w-4 h-4" />}
          {config.position === 'top' && <AlignVerticalJustifyStart className="w-4 h-4" />}
        </button>

        {/* 5. Style d'encadrement */}
        <button
          onClick={() => handleToolClick('boxStyle')}
          aria-label="Style du contour et fond"
          aria-pressed={activeTool === 'boxStyle'}
          className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
            activeTool === 'boxStyle'
              ? 'bg-amber-500 text-neutral-950 shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-850'
          }`}
          title="Style de boîte"
        >
          <Square className="w-4 h-4" />
        </button>

        {/* 6. Couleur & Dégradé libre */}
        <button
          onClick={() => handleToolClick('color')}
          aria-label="Couleur du texte"
          aria-pressed={activeTool === 'color'}
          className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
            activeTool === 'color'
              ? 'bg-amber-500 text-neutral-950 shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-850'
          }`}
          title="Couleur"
        >
          <Palette className="w-4 h-4" />
          <span
            className="w-2.5 h-2.5 rounded-full border border-black/60 absolute bottom-1 right-1 shadow"
            style={{
              background: config.textGradient ? gradientToCss(config.textGradient) : config.color,
            }}
          />
        </button>
      </div>

      {/* Popover right beneath the strip */}
      {activeTool && (
        <div
          role="region"
          aria-label="Réglage de style"
          className={`absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-40 bg-neutral-950/95 backdrop-blur-2xl border border-neutral-800 rounded-2xl p-2.5 shadow-2xl shadow-black animate-in fade-in slide-in-from-top-2 duration-150 ${
            activeTool === 'color'
              ? 'w-[330px] max-w-[94vw] max-h-[65vh] overflow-y-auto no-scrollbar p-3'
              : 'max-w-[92vw] w-auto'
          }`}
        >
          {activeTool === 'duration' && (
            <div className="flex flex-col gap-2 min-w-[240px] px-1 py-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold text-amber-400 min-w-[50px]">
                  {config.durationSec >= 60
                    ? `${Math.floor(config.durationSec / 60)}m${config.durationSec % 60 ? (config.durationSec % 60).toString().padStart(2, '0') : ''}`
                    : `${config.durationSec}s`}
                </span>
                <button
                  onClick={() => onChange({ durationSec: Math.max(5, config.durationSec - 5) })}
                  className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-300"
                  aria-label="Diminuer la durée"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="range"
                  min={5}
                  max={600}
                  step={5}
                  value={config.durationSec}
                  onChange={(e) => onChange({ durationSec: parseInt(e.target.value) })}
                  aria-label="Curseur durée vidéo"
                  className="flex-1 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <button
                  onClick={() => onChange({ durationSec: Math.min(600, config.durationSec + 5) })}
                  className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-300"
                  aria-label="Augmenter la durée"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-1 pt-1 border-t border-neutral-850">
                {[
                  { label: '15s', val: 15 },
                  { label: '30s', val: 30 },
                  { label: '1m', val: 60 },
                  { label: '2m', val: 120 },
                  { label: '3m', val: 180 },
                ].map((item) => (
                  <button
                    key={item.val}
                    onClick={() => onChange({ durationSec: item.val })}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                      config.durationSec === item.val
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-neutral-850 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTool === 'font' && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-[320px] py-0.5">
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
                    onClick={() => {
                      onChange({ fontFamily: font.family });
                      onSelectTool(null);
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-xs whitespace-nowrap transition-all ${
                      isSelected
                        ? 'bg-neutral-800 border border-amber-500 text-amber-400 font-bold shadow-sm'
                        : 'bg-neutral-900 hover:bg-neutral-850 text-neutral-300'
                    }`}
                    style={{ fontFamily: `"${font.family}", sans-serif` }}
                  >
                    {font.name}
                  </button>
                );
              })}
            </div>
          )}

          {activeTool === 'size' && (
            <div className="flex items-center gap-2.5 min-w-[210px] px-1">
              <span className="text-[11px] font-mono font-bold text-amber-400 min-w-[36px]">
                {config.fontSize}px
              </span>
              <button
                onClick={() => onChange({ fontSize: Math.max(16, config.fontSize - 2) })}
                aria-label="Réduire taille"
                className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-300"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="range"
                min={16}
                max={64}
                step={2}
                value={config.fontSize}
                onChange={(e) => onChange({ fontSize: parseInt(e.target.value) })}
                aria-label="Curseur taille des sous-titres"
                className="flex-1 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <button
                onClick={() => onChange({ fontSize: Math.min(64, config.fontSize + 2) })}
                aria-label="Agrandir taille"
                className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-300"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {activeTool === 'position' && (
            <div className="flex items-center gap-1.5">
              {positions.map((pos) => {
                const Icon = pos.icon;
                const isSelected = config.position === pos.id;
                return (
                  <button
                    key={pos.id}
                    onClick={() => {
                      onChange({ position: pos.id });
                      onSelectTool(null);
                    }}
                    className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                      isSelected
                        ? 'bg-amber-500 text-neutral-950 font-bold'
                        : 'bg-neutral-900 hover:bg-neutral-850 text-neutral-300'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{pos.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {activeTool === 'boxStyle' && (
            <div className="flex items-center gap-1.5">
              {boxStyles.map((st) => {
                const isSelected = config.boxStyle === st.id;
                return (
                  <button
                    key={st.id}
                    onClick={() => {
                      onChange({ boxStyle: st.id });
                      onSelectTool(null);
                    }}
                    className={`py-1.5 px-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                      isSelected
                        ? 'bg-amber-500 text-neutral-950 font-bold'
                        : 'bg-neutral-900 hover:bg-neutral-850 text-neutral-300'
                    }`}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>
          )}

          {activeTool === 'color' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800/80">
                <span className="text-xs font-bold text-neutral-100">Couleur des sous-titres</span>
                <button
                  type="button"
                  onClick={() => onSelectTool(null)}
                  aria-label="Valider la couleur des sous-titres"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[11px] transition-colors"
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                  <span>OK</span>
                </button>
              </div>
              <ColorPalettePicker
                mode={config.textGradient ? 'gradient' : 'solid'}
                color={config.color}
                gradient={config.textGradient}
                compact
                onChangeSolid={(hex) => onChange({ color: hex, textGradient: undefined })}
                onChangeGradient={(grad) =>
                  onChange({ textGradient: grad, color: grad.colors[0] || config.color })
                }
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
