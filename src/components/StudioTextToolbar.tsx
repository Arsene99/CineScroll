import React from 'react';
import {
  Clock,
  ArrowUp,
  ArrowDown,
  Eye,
  Compass,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Columns2,
  Palette,
  Minus,
  Plus,
} from 'lucide-react';
import { CreditsConfig, ScrollDirection, TextAlignment } from '../types';
import { FONT_OPTIONS } from '../utils/presets';

export type TextToolId =
  | 'speed'
  | 'direction'
  | 'font'
  | 'size'
  | 'align'
  | 'columns'
  | 'color'
  | null;

interface StudioTextToolbarProps {
  config: CreditsConfig;
  onChange: (updated: Partial<CreditsConfig>) => void;
  activeTool: TextToolId;
  onSelectTool: (tool: TextToolId) => void;
}

export const StudioTextToolbar: React.FC<StudioTextToolbarProps> = ({
  config,
  onChange,
  activeTool,
  onSelectTool,
}) => {
  const textColors = [
    { name: 'Blanc', value: '#ffffff' },
    { name: 'Doré', value: '#fbbf24' },
    { name: 'Argent', value: '#e2e8f0' },
    { name: 'Cyan', value: '#38bdf8' },
    { name: 'Crème', value: '#fef3c7' },
  ];

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

  const handleToolClick = (tool: TextToolId) => {
    if (tool === 'columns') {
      onChange({ roleSeparation: !config.roleSeparation });
    } else {
      onSelectTool(activeTool === tool ? null : tool);
    }
  };

  return (
    <div className="relative w-full z-30">
      {/* Horizontal Strip placed directly under the top header */}
      <div
        aria-label="Barre d'outils d'édition de texte"
        className="w-full flex items-center justify-around px-3 py-1.5 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800/80"
      >
        {/* 1. Vitesse / Durée */}
        <button
          onClick={() => handleToolClick('speed')}
          aria-label="Vitesse et durée"
          aria-pressed={activeTool === 'speed'}
          className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
            activeTool === 'speed'
              ? 'bg-amber-500 text-neutral-950 shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-850'
          }`}
          title="Vitesse"
        >
          <Clock className="w-4 h-4" />
        </button>

        {/* 2. Sens de défilement */}
        <button
          onClick={() => handleToolClick('direction')}
          aria-label="Sens de défilement"
          aria-pressed={activeTool === 'direction'}
          className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
            activeTool === 'direction'
              ? 'bg-amber-500 text-neutral-950 shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-850'
          }`}
          title="Sens de défilement"
        >
          {config.direction === 'bottom-to-top' && <ArrowUp className="w-4 h-4" />}
          {config.direction === 'top-to-bottom' && <ArrowDown className="w-4 h-4" />}
          {config.direction === 'fade-in' && <Eye className="w-4 h-4" />}
          {config.direction === 'star-crawl' && <Compass className="w-4 h-4" />}
        </button>

        {/* 3. Police */}
        <button
          onClick={() => handleToolClick('font')}
          aria-label="Police de caractères"
          aria-pressed={activeTool === 'font'}
          className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
            activeTool === 'font'
              ? 'bg-amber-500 text-neutral-950 shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-850'
          }`}
          title="Police"
        >
          <Type className="w-4 h-4" />
        </button>

        {/* 4. Taille de police */}
        <button
          onClick={() => handleToolClick('size')}
          aria-label="Taille de police"
          aria-pressed={activeTool === 'size'}
          className={`flex items-center justify-center w-8 h-8 rounded-lg font-mono text-xs font-bold transition-all ${
            activeTool === 'size'
              ? 'bg-amber-500 text-neutral-950 shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-850'
          }`}
          title="Taille"
        >
          <span>A</span>
        </button>

        {/* 5. Alignement */}
        <button
          onClick={() => handleToolClick('align')}
          aria-label="Alignement du texte"
          aria-pressed={activeTool === 'align'}
          className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
            activeTool === 'align'
              ? 'bg-amber-500 text-neutral-950 shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-850'
          }`}
          title="Alignement"
        >
          {config.alignment === 'left' && <AlignLeft className="w-4 h-4" />}
          {config.alignment === 'center' && <AlignCenter className="w-4 h-4" />}
          {config.alignment === 'right' && <AlignRight className="w-4 h-4" />}
        </button>

        {/* 6. Mode 2 colonnes */}
        <button
          onClick={() => handleToolClick('columns')}
          aria-label="Mode 2 colonnes rôle et nom"
          aria-pressed={config.roleSeparation}
          className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
            config.roleSeparation
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-850'
          }`}
          title="2 Colonnes"
        >
          <Columns2 className="w-4 h-4" />
        </button>

        {/* 7. Couleur du texte */}
        <button
          onClick={() => handleToolClick('color')}
          aria-label="Couleur du texte"
          aria-pressed={activeTool === 'color'}
          className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
            activeTool === 'color'
              ? 'bg-amber-500 text-neutral-950 shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-850'
          }`}
          title="Couleur"
        >
          <Palette className="w-4 h-4" />
        </button>
      </div>

      {/* Floating Dropdown / Popover right beneath the horizontal toolbar */}
      {activeTool && (
        <div
          role="region"
          aria-label="Réglage en direct"
          className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-40 bg-neutral-950/95 backdrop-blur-2xl border border-neutral-800 rounded-2xl p-2.5 shadow-2xl shadow-black max-w-[92vw] w-auto animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Tool: Speed & Duration */}
          {activeTool === 'speed' && (
            <div className="flex flex-col gap-2 min-w-[240px] px-1 py-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold text-amber-400 min-w-[50px]">
                  {config.speedDuration >= 60
                    ? `${Math.floor(config.speedDuration / 60)}m${config.speedDuration % 60 ? (config.speedDuration % 60).toString().padStart(2, '0') : ''}`
                    : `${config.speedDuration}s`}
                </span>
                <button
                  onClick={() => onChange({ speedDuration: Math.max(5, config.speedDuration - 5) })}
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
                  value={config.speedDuration}
                  onChange={(e) => onChange({ speedDuration: parseInt(e.target.value) })}
                  aria-label="Curseur durée"
                  className="flex-1 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <button
                  onClick={() => onChange({ speedDuration: Math.min(600, config.speedDuration + 5) })}
                  className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-300"
                  aria-label="Augmenter la durée"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick duration presets for songs and videos */}
              <div className="flex items-center justify-between gap-1 pt-1 border-t border-neutral-850">
                {[
                  { label: '30s', val: 30 },
                  { label: '1m', val: 60 },
                  { label: '2m', val: 120 },
                  { label: '3m', val: 180 },
                  { label: '4m', val: 240 },
                ].map((item) => (
                  <button
                    key={item.val}
                    onClick={() => onChange({ speedDuration: item.val })}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                      config.speedDuration === item.val
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

          {/* Tool: Direction */}
          {activeTool === 'direction' && (
            <div className="flex items-center gap-1.5">
              {directions.map((dir) => {
                const Icon = dir.icon;
                const isSelected = config.direction === dir.id;
                return (
                  <button
                    key={dir.id}
                    onClick={() => {
                      onChange({ direction: dir.id });
                      onSelectTool(null);
                    }}
                    className={`flex items-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-amber-500 text-neutral-950 font-bold'
                        : 'bg-neutral-900 hover:bg-neutral-850 text-neutral-300'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{dir.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Tool: Font */}
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
                    className={`px-2.5 py-1 rounded-xl text-xs whitespace-nowrap transition-all ${
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

          {/* Tool: Font Size */}
          {activeTool === 'size' && (
            <div className="flex items-center gap-2.5 min-w-[210px] px-1">
              <span className="text-[11px] font-mono font-bold text-amber-400 min-w-[36px]">
                {config.fontSize}px
              </span>
              <button
                onClick={() => onChange({ fontSize: Math.max(16, config.fontSize - 2) })}
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
                aria-label="Curseur taille"
                className="flex-1 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <button
                onClick={() => onChange({ fontSize: Math.min(64, config.fontSize + 2) })}
                className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-300"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Tool: Alignment */}
          {activeTool === 'align' && (
            <div className="flex items-center gap-2">
              {alignments.map((align) => {
                const Icon = align.icon;
                const isSelected = config.alignment === align.id;
                return (
                  <button
                    key={align.id}
                    onClick={() => {
                      onChange({ alignment: align.id });
                      onSelectTool(null);
                    }}
                    aria-label={align.label}
                    className={`w-9 h-8 rounded-xl flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-amber-500 text-neutral-950 font-bold'
                        : 'bg-neutral-900 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Tool: Color */}
          {activeTool === 'color' && (
            <div className="flex items-center gap-2">
              {textColors.map((c) => (
                <button
                  key={c.value}
                  onClick={() => {
                    onChange({ color: c.value });
                    onSelectTool(null);
                  }}
                  aria-label={c.name}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${
                    config.color === c.value
                      ? 'border-amber-500 scale-110 shadow-md'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
