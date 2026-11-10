import React, { useRef } from 'react';
import { Volume2, VolumeX, Upload, Music, Check, X, FileAudio, Clock } from 'lucide-react';
import { AudioConfig } from '../../types';
import { AUDIO_PRESETS, globalAudioEngine } from '../../utils/audioSynth';
import { formatTime } from '../../utils/creditsEngine';

interface AudioPanelProps {
  audio: AudioConfig;
  onChange: (audio: AudioConfig) => void;
  onSyncDuration?: (durationSec: number) => void;
}

export const AudioPanel: React.FC<AudioPanelProps> = ({ audio, onChange, onSyncDuration }) => {
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSelectPreset = (presetId: string) => {
    globalAudioEngine.setPreset(presetId);
    onChange({
      ...audio,
      presetId,
    });
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const audioEl = new Audio(url);
      audioEl.addEventListener('loadedmetadata', () => {
        const fileDuration = Math.round(audioEl.duration);
        if (fileDuration && fileDuration > 0) {
          onChange({
            ...audio,
            presetId: 'custom',
            customFileUrl: url,
            customFileName: file.name,
            customFileDuration: fileDuration,
          });
          if (onSyncDuration) {
            onSyncDuration(fileDuration);
          }
        }
      });
      globalAudioEngine.setCustomAudio(url);
      onChange({
        ...audio,
        presetId: 'custom',
        customFileUrl: url,
        customFileName: file.name,
      });
    }
  };

  const handleRemoveCustomAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    globalAudioEngine.setPreset('cinema-epic');
    onChange({
      ...audio,
      presetId: 'cinema-epic',
      customFileUrl: undefined,
      customFileName: undefined,
      customFileDuration: undefined,
    });
    if (audioFileInputRef.current) {
      audioFileInputRef.current.value = '';
    }
  };

  const handleVolumeChange = (newVol: number) => {
    globalAudioEngine.setVolume(newVol);
    onChange({
      ...audio,
      volume: newVol,
      muted: newVol === 0,
    });
  };

  const toggleMute = () => {
    const nextMuted = !audio.muted;
    globalAudioEngine.setVolume(nextMuted ? 0 : audio.volume || 0.7);
    onChange({
      ...audio,
      muted: nextMuted,
    });
  };

  return (
    <div className="space-y-4 text-white">
      {/* Hidden file input */}
      <input
        ref={audioFileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleAudioUpload}
        className="hidden"
        aria-label="Charger un fichier audio"
      />

      {/* Upload button OR Uploaded File Status Bar with X button */}
      {audio.customFileUrl ? (
        <div className="space-y-2">
          <div className="w-full flex items-center justify-between p-3 rounded-xl bg-neutral-900 border border-amber-500/50 shadow-md">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
                <FileAudio className="w-4 h-4" />
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold text-neutral-100 truncate">
                  {audio.customFileName || 'Fichier audio importé'}
                </div>
                <div className="text-[10px] text-amber-400 font-medium flex items-center gap-1.5">
                  <span>Piste audio active</span>
                  {audio.customFileDuration && (
                    <span className="font-mono text-neutral-400">
                      ({formatTime(audio.customFileDuration)})
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleRemoveCustomAudio}
              aria-label="Retirer ce fichier audio"
              className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-red-400 flex items-center justify-center transition-colors flex-shrink-0 ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick sync duration button if duration is detected */}
          {audio.customFileDuration && onSyncDuration && (
            <button
              onClick={() => onSyncDuration(audio.customFileDuration!)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-medium transition-colors"
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Caler la durée du défilement sur le morceau ({formatTime(audio.customFileDuration)})</span>
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={() => audioFileInputRef.current?.click()}
          aria-label="Importer ma propre musique"
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 hover:bg-neutral-850 active:scale-98 transition-all text-xs font-medium text-neutral-200"
        >
          <Upload className="w-4 h-4 text-amber-400" />
          <span>Importer ma propre musique</span>
        </button>
      )}

      {/* Preset tracks list */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-medium text-neutral-400 px-1">
          Musiques d'ambiance intégrées
        </div>
        <div className="space-y-1.5">
          {AUDIO_PRESETS.map((preset) => {
            const isSelected = !audio.customFileUrl && audio.presetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handleSelectPreset(preset.id)}
                aria-label={preset.name}
                aria-pressed={isSelected}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                  isSelected
                    ? 'bg-neutral-800 border-amber-500/80 text-white shadow-sm'
                    : 'bg-neutral-900 border-neutral-800/80 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isSelected
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-neutral-800 text-neutral-500'
                    }`}
                  >
                    <Music className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-200">
                      {preset.name}
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      {preset.description}
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Volume control */}
      <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center gap-3">
        <button
          onClick={toggleMute}
          aria-label={audio.muted ? 'Activer le son' : 'Couper le son'}
          className="text-neutral-400 hover:text-white"
        >
          {audio.muted || audio.volume === 0 ? (
            <VolumeX className="w-4 h-4 text-red-400" />
          ) : (
            <Volume2 className="w-4 h-4 text-amber-400" />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={audio.muted ? 0 : audio.volume}
          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
          aria-label="Volume audio"
          className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
        />
        <span className="text-xs font-mono text-neutral-400 min-w-[32px] text-right">
          {audio.muted ? '0%' : `${Math.round(audio.volume * 100)}%`}
        </span>
      </div>
    </div>
  );
};
