import React from 'react';
import { Smartphone, Monitor, Square, Check } from 'lucide-react';
import { AspectRatio } from '../../types';

interface RatioPanelProps {
  currentRatio: AspectRatio;
  onChange: (ratio: AspectRatio) => void;
}

export const RatioPanel: React.FC<RatioPanelProps> = ({ currentRatio, onChange }) => {
  const ratios: { id: AspectRatio; label: string; sublabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
    {
      id: '9:16',
      label: '9:16 Vertical',
      sublabel: 'Reels, TikTok, Stories',
      icon: Smartphone,
    },
    {
      id: '16:9',
      label: '16:9 Cinéma',
      sublabel: 'YouTube, Téléviseur, Film',
      icon: Monitor,
    },
    {
      id: '1:1',
      label: '1:1 Carré',
      sublabel: 'Publications & Flux',
      icon: Square,
    },
  ];

  return (
    <div className="space-y-3 text-white">
      <div className="text-[11px] font-medium text-neutral-400 px-1">
        Format de cadrage vidéo
      </div>
      <div className="grid grid-cols-1 gap-2">
        {ratios.map((item) => {
          const Icon = item.icon;
          const isSelected = currentRatio === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              aria-label={item.label}
              aria-pressed={isSelected}
              className={`flex items-center justify-between p-3.5 rounded-xl border transition-all text-left ${
                isSelected
                  ? 'bg-neutral-800 border-amber-500/90 text-white shadow-md'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    isSelected
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-neutral-800 text-neutral-500'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-neutral-200">
                    {item.label}
                  </div>
                  <div className="text-[10px] text-neutral-500">
                    {item.sublabel}
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
  );
};
