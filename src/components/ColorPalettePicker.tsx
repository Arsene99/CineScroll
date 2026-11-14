import React, { useState, useEffect } from 'react';
import { Sparkles, Plus, X, Pipette } from 'lucide-react';
import { GradientConfig } from '../types';
import { GRADIENT_PRESETS, QUICK_COLOR_SWATCHES } from '../utils/presets';
import {
  gradientToCss,
  hexToHsl,
  hslToHex,
  normalizeHexColor,
} from '../utils/creditsEngine';

interface ColorPalettePickerProps {
  mode: 'solid' | 'gradient';
  color: string;
  gradient?: GradientConfig;
  onChangeSolid: (hex: string) => void;
  onChangeGradient: (grad: GradientConfig) => void;
  compact?: boolean;
  label?: string;
}

const DEFAULT_GRADIENT: GradientConfig = {
  colors: ['#8b5cf6', '#ec4899'],
  angle: 135,
  animated: true,
  animationSpeed: 1,
};

export const ColorPalettePicker: React.FC<ColorPalettePickerProps> = ({
  mode,
  color,
  gradient,
  onChangeSolid,
  onChangeGradient,
  compact = false,
  label,
}) => {
  const [activeStopIndex, setActiveStopIndex] = useState(0);
  const currentGradient = gradient && gradient.colors.length >= 2 ? gradient : DEFAULT_GRADIENT;
  const safeStopIndex = Math.min(activeStopIndex, currentGradient.colors.length - 1);

  const editedHex =
    mode === 'solid'
      ? normalizeHexColor(color, '#ffffff')
      : normalizeHexColor(currentGradient.colors[safeStopIndex] || '#8b5cf6', '#8b5cf6');

  const [hexDraft, setHexDraft] = useState(editedHex);

  useEffect(() => {
    setHexDraft(editedHex);
  }, [editedHex]);

  const hsl = hexToHsl(editedHex);

  const commitColor = (nextHex: string) => {
    const clean = normalizeHexColor(nextHex, editedHex);
    if (mode === 'solid') {
      onChangeSolid(clean);
    } else {
      const nextColors = [...currentGradient.colors];
      nextColors[safeStopIndex] = clean;
      onChangeGradient({ ...currentGradient, colors: nextColors });
    }
  };

  const handleHslChange = (nextH: number, nextS: number, nextL: number) => {
    const nextHex = hslToHex(nextH, nextS, nextL);
    setHexDraft(nextHex);
    commitColor(nextHex);
  };

  const handleHexInput = (val: string) => {
    setHexDraft(val);
    const cleaned = val.trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{6}$/.test(cleaned) || /^[0-9a-fA-F]{3}$/.test(cleaned)) {
      commitColor(`#${cleaned}`);
    }
  };

  const handleToggleMode = (nextMode: 'solid' | 'gradient') => {
    if (nextMode === 'solid') {
      onChangeSolid(editedHex);
    } else {
      const nextGrad = gradient && gradient.colors.length >= 2
        ? gradient
        : {
            ...DEFAULT_GRADIENT,
            colors: [normalizeHexColor(color, '#8b5cf6'), '#ec4899'],
          };
      onChangeGradient(nextGrad);
    }
  };

  const handleAddThirdStop = () => {
    if (currentGradient.colors.length >= 3) return;
    const nextColors = [...currentGradient.colors, '#38bdf8'];
    onChangeGradient({ ...currentGradient, colors: nextColors });
    setActiveStopIndex(2);
  };

  const handleRemoveThirdStop = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    if (currentGradient.colors.length <= 2) return;
    const nextColors = currentGradient.colors.filter((_, i) => i !== idx);
    onChangeGradient({ ...currentGradient, colors: nextColors });
    setActiveStopIndex(0);
  };

  const hueColor = hslToHex(hsl.h, 100, 50);

  return (
    <div className={`space-y-2.5 text-white ${compact ? 'w-full' : ''}`}>
      {/* Header + Uni / Dégradé Switch */}
      <div className="flex items-center justify-between gap-2">
        {label ? (
          <span className="text-[11px] font-semibold text-neutral-300">{label}</span>
        ) : (
          <span className="text-[11px] font-semibold text-neutral-400">Palette libre</span>
        )}

        <div
          role="tablist"
          aria-label="Type de couleur"
          className="flex items-center p-0.5 rounded-lg bg-neutral-900 border border-neutral-800"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'solid'}
            onClick={() => handleToggleMode('solid')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
              mode === 'solid'
                ? 'bg-amber-500 text-neutral-950 shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Uni
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'gradient'}
            onClick={() => handleToggleMode('gradient')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1 ${
              mode === 'gradient'
                ? 'bg-amber-500 text-neutral-950 shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>Dégradé</span>
          </button>
        </div>
      </div>

      {/* Gradient stops + preview + angle + animation controls */}
      {mode === 'gradient' && (
        <div className="space-y-2.5 p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800">
          {/* Live gradient bar + stop pills */}
          <div
            className="h-8 w-full rounded-lg border border-white/15 shadow-inner flex items-center justify-end px-2"
            style={{ background: gradientToCss(currentGradient) }}
          >
            {currentGradient.animated && (
              <span className="px-1.5 py-0.5 rounded bg-black/55 backdrop-blur-sm text-[9px] font-semibold text-amber-300 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                <span>Animé</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {currentGradient.colors.map((stopColor, idx) => {
              const isStopActive = idx === safeStopIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveStopIndex(idx)}
                  aria-label={`Couleur ${idx + 1} du dégradé`}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-mono transition-all ${
                    isStopActive
                      ? 'bg-neutral-800 border-amber-500 text-white shadow-sm'
                      : 'bg-neutral-950/70 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-white/25"
                    style={{ backgroundColor: stopColor }}
                  />
                  <span>#{idx + 1}</span>
                  {currentGradient.colors.length > 2 && idx === currentGradient.colors.length - 1 && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Retirer la couleur ${idx + 1}`}
                      onClick={(e) => handleRemoveThirdStop(e, idx)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          handleRemoveThirdStop(e as unknown as React.MouseEvent, idx);
                        }
                      }}
                      className="ml-0.5 text-neutral-400 hover:text-red-400"
                    >
                      <X className="w-3 h-3" />
                    </span>
                  )}
                </button>
              );
            })}

            {currentGradient.colors.length < 3 && (
              <button
                type="button"
                onClick={handleAddThirdStop}
                aria-label="Ajouter une 3e couleur"
                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-neutral-700 hover:border-amber-500/60 text-[11px] text-neutral-300 hover:text-amber-300 transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>3e</span>
              </button>
            )}
          </div>

          {/* Direction / Angle */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-neutral-400">
              <span>Orientation</span>
              <span className="font-mono text-neutral-300">{Math.round(currentGradient.angle)}°</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={360}
                step={5}
                value={currentGradient.angle}
                onChange={(e) =>
                  onChangeGradient({ ...currentGradient, angle: parseInt(e.target.value, 10) })
                }
                aria-label="Angle du dégradé"
                className="flex-1 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex items-center gap-1">
                {[
                  { label: '↓', deg: 180 },
                  { label: '↘', deg: 135 },
                  { label: '→', deg: 90 },
                  { label: '↗', deg: 45 },
                ].map((dir) => (
                  <button
                    key={dir.deg}
                    type="button"
                    onClick={() => onChangeGradient({ ...currentGradient, angle: dir.deg })}
                    className={`w-6 h-6 rounded text-[11px] font-bold transition-colors ${
                      Math.round(currentGradient.angle) === dir.deg
                        ? 'bg-amber-500 text-neutral-950'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    {dir.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Animated Gradient Toggle & Speed */}
          <div className="flex items-center justify-between pt-1 border-t border-neutral-800/80 gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={currentGradient.animated}
              aria-label="Activer le dégradé animé"
              onClick={() =>
                onChangeGradient({ ...currentGradient, animated: !currentGradient.animated })
              }
              className="flex items-center gap-2 text-xs text-neutral-200"
            >
              <span
                className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center ${
                  currentGradient.animated ? 'bg-amber-500 justify-end' : 'bg-neutral-700 justify-start'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white shadow" />
              </span>
              <span className="text-[11px] font-medium">Dégradé animé</span>
            </button>

            {currentGradient.animated && (
              <div className="flex items-center gap-1">
                {[
                  { label: 'Lent', speed: 0.6 },
                  { label: 'Normal', speed: 1 },
                  { label: 'Rapide', speed: 1.8 },
                ].map((sp) => (
                  <button
                    key={sp.label}
                    type="button"
                    onClick={() =>
                      onChangeGradient({ ...currentGradient, animationSpeed: sp.speed })
                    }
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      (currentGradient.animationSpeed ?? 1) === sp.speed
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                        : 'bg-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {sp.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Gradient Starters */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
            {GRADIENT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  onChangeGradient({ ...preset.gradient });
                  setActiveStopIndex(0);
                }}
                aria-label={`Dégradé ${preset.name}`}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-neutral-950/80 border border-neutral-800 hover:border-amber-500/50 text-[10px] text-neutral-200 whitespace-nowrap flex-shrink-0"
              >
                <span
                  className="w-3 h-3 rounded-full border border-white/20"
                  style={{ background: gradientToCss(preset.gradient) }}
                />
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Custom HSL Color Picker + Native Pipette + Hex Input + Swatches (for active color or active gradient stop) */}
      <div className="space-y-2 p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800">
        {/* Top Row: Live Swatch + Native OS Color Picker + Editable Hex Input */}
        <div className="flex items-center gap-2">
          <label
            className="relative w-9 h-8 rounded-lg border border-white/20 cursor-pointer flex items-center justify-center overflow-hidden shadow-inner flex-shrink-0"
            style={{ backgroundColor: editedHex }}
            title="Sélecteur système libre"
          >
            <input
              type="color"
              value={editedHex}
              onChange={(e) => {
                setHexDraft(e.target.value);
                commitColor(e.target.value);
              }}
              aria-label="Sélecteur de couleur libre"
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
            />
            <Pipette className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] pointer-events-none" />
          </label>

          <input
            type="text"
            value={hexDraft}
            onChange={(e) => handleHexInput(e.target.value)}
            maxLength={7}
            spellCheck={false}
            aria-label="Code couleur hexadécimal"
            placeholder="#EC4899"
            className="flex-1 bg-neutral-950 border border-neutral-800 focus:border-amber-500 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs font-mono text-neutral-100 uppercase"
          />

          <span className="text-[10px] text-neutral-400 font-mono">
            {mode === 'gradient' ? `Stop #${safeStopIndex + 1}` : 'Libre'}
          </span>
        </div>

        {/* Rainbow Hue Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-neutral-400">
            <span>Teinte</span>
            <span className="font-mono">{hsl.h}°</span>
          </div>
          <input
            type="range"
            min={0}
            max={360}
            value={hsl.h}
            onChange={(e) => handleHslChange(parseInt(e.target.value, 10), hsl.s || 80, hsl.l === 0 || hsl.l === 100 ? 55 : hsl.l)}
            aria-label="Teinte de la couleur"
            className="w-full h-2.5 rounded-full appearance-none cursor-pointer border border-white/10"
            style={{
              background:
                'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
            }}
          />
        </div>

        {/* Saturation & Luminosity Sliders */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-neutral-400">
              <span>Saturation</span>
              <span className="font-mono">{hsl.s}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={hsl.s}
              onChange={(e) => handleHslChange(hsl.h, parseInt(e.target.value, 10), hsl.l)}
              aria-label="Saturation de la couleur"
              className="w-full h-2 rounded-full appearance-none cursor-pointer border border-white/10"
              style={{
                background: `linear-gradient(to right, #808080, ${hueColor})`,
              }}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-neutral-400">
              <span>Luminosité</span>
              <span className="font-mono">{hsl.l}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={hsl.l}
              onChange={(e) => handleHslChange(hsl.h, hsl.s, parseInt(e.target.value, 10))}
              aria-label="Luminosité de la couleur"
              className="w-full h-2 rounded-full appearance-none cursor-pointer border border-white/10"
              style={{
                background: `linear-gradient(to right, #000000 0%, ${hueColor} 50%, #ffffff 100%)`,
              }}
            />
          </div>
        </div>

        {/* Quick Swatches */}
        <div className="grid grid-cols-6 gap-1.5 pt-1">
          {QUICK_COLOR_SWATCHES.map((swatch) => {
            const isSelected = editedHex === swatch.toLowerCase();
            return (
              <button
                key={swatch}
                type="button"
                onClick={() => {
                  setHexDraft(swatch);
                  commitColor(swatch);
                }}
                aria-label={`Nuance ${swatch}`}
                className={`h-6 rounded-md border transition-transform ${
                  isSelected
                    ? 'border-amber-400 scale-105 ring-1 ring-amber-400'
                    : 'border-white/15 hover:scale-105'
                }`}
                style={{ backgroundColor: swatch }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
