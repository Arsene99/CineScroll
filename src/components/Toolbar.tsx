import React from 'react';
import { Type, Image as ImageIcon, Music, Crop as RatioIcon, Download } from 'lucide-react';

export type ActiveTab = 'text' | 'background' | 'audio' | 'ratio' | 'export' | null;

interface ToolbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ activeTab, onSelectTab }) => {
  const tabs = [
    { id: 'text' as ActiveTab, icon: Type, label: 'Texte' },
    { id: 'background' as ActiveTab, icon: ImageIcon, label: 'Fond' },
    { id: 'audio' as ActiveTab, icon: Music, label: 'Audio' },
    { id: 'ratio' as ActiveTab, icon: RatioIcon, label: 'Format' },
    { id: 'export' as ActiveTab, icon: Download, label: 'Exporter' },
  ];

  return (
    <nav
      aria-label="Barre d'outils d'édition"
      className="fixed bottom-0 left-0 right-0 z-40 bg-neutral-950/95 backdrop-blur-xl border-t border-neutral-800/80 px-4 py-2 pb-safe"
    >
      <div className="max-w-md mx-auto flex items-center justify-between">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isExport = tab.id === 'export';

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(isActive ? null : tab.id)}
              aria-label={tab.label}
              aria-pressed={isActive}
              className={`relative flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all duration-200 active:scale-95 ${
                isExport
                  ? 'bg-amber-500/15 border border-amber-500/40 text-amber-400 hover:bg-amber-500/25'
                  : isActive
                  ? 'bg-neutral-800 text-amber-400'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60'
              }`}
            >
              <Icon className="w-5 h-5 stroke-[2.2]" />
              <span className="text-[10px] font-medium tracking-tight mt-0.5">
                {tab.label}
              </span>

              {/* Active dot indicator */}
              {isActive && (
                <span className="absolute -top-1 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
