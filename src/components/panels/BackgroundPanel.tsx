import React, { useRef } from 'react';
import { Upload, Video, Palette, SunMedium, FileImage, Film, X } from 'lucide-react';
import { BackgroundConfig } from '../../types';
import { BACKGROUND_PRESETS } from '../../utils/presets';

interface BackgroundPanelProps {
  background: BackgroundConfig;
  onChange: (bg: BackgroundConfig) => void;
}

export const BackgroundPanel: React.FC<BackgroundPanelProps> = ({ background, onChange }) => {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onChange({
        ...background,
        source: 'image',
        value: url,
        customFileName: file.name,
      });
    }
  };

  const handleVideoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onChange({
        ...background,
        source: 'video',
        value: url,
        customFileName: file.name,
      });
    }
  };

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({
      ...background,
      source: 'color',
      value: '#050508',
      customFileName: undefined,
    });
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handleRemoveVideo = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({
      ...background,
      source: 'color',
      value: '#050508',
      customFileName: undefined,
    });
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
  };

  const solidColors = ['#050508', '#0b1329', '#09231f', '#240e1b', '#261d0a', '#1b1c20'];

  const isImageActive = background.source === 'image' && !!background.value;
  const isVideoActive = background.source === 'video' && !!background.value;

  return (
    <div className="space-y-4 text-white">
      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageFile}
        className="hidden"
        aria-label="Charger une image"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        onChange={handleVideoFile}
        className="hidden"
        aria-label="Charger une vidéo"
      />

      {/* Upload buttons row: Image or Video, or active file bar with X */}
      <div className="grid grid-cols-2 gap-2.5">
        {isImageActive ? (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-900 border border-amber-500/60 shadow-md">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
                <FileImage className="w-3.5 h-3.5" />
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold text-neutral-100 truncate">
                  {background.customFileName || 'Image importée'}
                </div>
                <div className="text-[10px] text-amber-400 font-medium">Image active</div>
              </div>
            </div>
            <button
              onClick={handleRemoveImage}
              aria-label="Supprimer cette image"
              className="w-6 h-6 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-red-400 flex items-center justify-center transition-colors flex-shrink-0 ml-1.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => imageInputRef.current?.click()}
            aria-label="Importer une image de fond"
            className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 hover:bg-neutral-850 active:scale-95 transition-all text-xs font-medium text-neutral-200"
          >
            <Upload className="w-4 h-4 text-amber-400" />
            <span>Image de fond</span>
          </button>
        )}

        {isVideoActive ? (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-900 border border-amber-500/60 shadow-md">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
                <Film className="w-3.5 h-3.5" />
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold text-neutral-100 truncate">
                  {background.customFileName || 'Vidéo importée'}
                </div>
                <div className="text-[10px] text-amber-400 font-medium">Vidéo active</div>
              </div>
            </div>
            <button
              onClick={handleRemoveVideo}
              aria-label="Supprimer cette vidéo"
              className="w-6 h-6 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-red-400 flex items-center justify-center transition-colors flex-shrink-0 ml-1.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => videoInputRef.current?.click()}
            aria-label="Importer une vidéo de fond"
            className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 hover:bg-neutral-850 active:scale-95 transition-all text-xs font-medium text-neutral-200"
          >
            <Video className="w-4 h-4 text-amber-400" />
            <span>Vidéo de fond</span>
          </button>
        )}
      </div>

      {/* Preset cinematic backgrounds */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-medium text-neutral-400 px-1">
          Fonds Cinématographiques
        </div>
        <div className="grid grid-cols-3 gap-2">
          {BACKGROUND_PRESETS.map((preset) => {
            const isSelected = background.source === 'color' && background.value === preset.previewColor;
            return (
              <button
                key={preset.id}
                onClick={() =>
                  onChange({
                    ...background,
                    source: 'color',
                    value: preset.previewColor,
                    customFileName: undefined,
                  })
                }
                aria-label={preset.name}
                className={`relative h-12 rounded-xl overflow-hidden border-2 transition-all p-1.5 text-left flex flex-col justify-end ${
                  isSelected
                    ? 'border-amber-500 shadow-md scale-[1.02]'
                    : 'border-neutral-800 hover:border-neutral-700'
                }`}
                style={{ background: preset.gradient }}
              >
                <span className="text-[10px] font-medium text-white/90 truncate">
                  {preset.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Solid colors palette */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-medium text-neutral-400 px-1">
          <span className="flex items-center gap-1.5">
            <Palette className="w-3 h-3 text-amber-400" />
            <span>Teintes unies</span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          {solidColors.map((color) => {
            const isSelected = background.source === 'color' && background.value === color;
            return (
              <button
                key={color}
                onClick={() =>
                  onChange({
                    ...background,
                    source: 'color',
                    value: color,
                    customFileName: undefined,
                  })
                }
                aria-label={`Couleur ${color}`}
                className={`flex-1 h-8 rounded-lg border-2 transition-transform ${
                  isSelected ? 'border-amber-400 scale-105' : 'border-neutral-800'
                }`}
                style={{ backgroundColor: color }}
              />
            );
          })}
        </div>
      </div>

      {/* Dark overlay opacity slider for text legibility */}
      <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2">
        <div className="flex items-center justify-between text-xs text-neutral-300">
          <span className="flex items-center gap-1.5">
            <SunMedium className="w-3.5 h-3.5 text-amber-400" />
            <span>Assombrir l'arrière-plan</span>
          </span>
          <span className="font-mono text-neutral-400">
            {Math.round(background.overlayOpacity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={0.9}
          step={0.05}
          value={background.overlayOpacity}
          onChange={(e) =>
            onChange({
              ...background,
              overlayOpacity: parseFloat(e.target.value),
            })
          }
          aria-label="Opacité de l'assombrissement"
          className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
        />
      </div>
    </div>
  );
};
