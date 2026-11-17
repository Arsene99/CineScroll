import React, { useEffect, useState } from 'react';
import { FolderOpen, RotateCcw, X } from 'lucide-react';
import { ProjectSummary, SavedProject, StudioMode } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { ProjectSaveLoadSheet } from './ProjectSaveLoadSheet';
import { formatProjectDate, projectRepository } from '../utils/projectStorage';

interface ModeSelectorProps {
  onSelectMode: (mode: StudioMode) => void;
  onOpenSavedProject: (project: SavedProject) => void;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  onSelectMode,
  onOpenSavedProject,
}) => {
  const [summaries, setSummaries] = useState<ProjectSummary[]>([]);
  const [latestDraft, setLatestDraft] = useState<SavedProject | null>(null);
  const [showProjectsSheet, setShowProjectsSheet] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, draft] = await Promise.all([
          projectRepository.listSummaries(),
          projectRepository.getLatestDraft(),
        ]);
        if (cancelled) return;
        setSummaries(list);
        setLatestDraft(draft);
      } catch {
        // Ignore storage read errors silently on initial home render
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDismissDraft = async () => {
    if (!latestDraft) return;
    try {
      await projectRepository.clearDraft(latestDraft.kind);
    } catch {}
    setLatestDraft(null);
  };

  return (
    <div className="flex flex-col min-h-screen bg-black text-white select-none px-6 py-10 justify-between">
      {/* 1. Large software title at top: name only, no icons, no badges */}
      <header className="pt-4 text-center">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white font-sans">
          CineScroll
        </h1>
      </header>

      {/* 2. Two primary mode cards stacked cleanly, followed by quiet local projects trigger */}
      <main className="w-full max-w-md mx-auto my-auto flex flex-col gap-3.5 py-6">
        {/* Card 1: Génériques */}
        <button
          type="button"
          onClick={() => onSelectMode('credits')}
          aria-label="Génériques, Défilement et audio"
          className="w-full py-7 px-6 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/70 text-left transition-all duration-200 active:scale-[0.98] shadow-xl hover:bg-neutral-850"
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
          type="button"
          onClick={() => onSelectMode('subtitles')}
          aria-label="Sous-titres, Légendes et synchronisation"
          className="w-full py-7 px-6 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-left transition-all duration-200 active:scale-[0.98] shadow-xl hover:bg-neutral-850"
        >
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-1">
            Sous-titres
          </h2>
          <p className="text-sm text-neutral-400 font-medium">
            Légendes et synchronisation
          </p>
        </button>

        {/* Saved Projects Entry (clean, restrained secondary surface) */}
        <button
          type="button"
          onClick={() => setShowProjectsSheet(true)}
          aria-label={`Mes projets enregistrés (${summaries.length})`}
          className="w-full min-h-[56px] px-5 py-3.5 rounded-2xl bg-neutral-950 border border-neutral-800/90 hover:border-neutral-700 flex items-center justify-between gap-3 text-left transition-colors active:scale-[0.99] mt-1"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-neutral-900 border border-neutral-800 text-amber-400 flex items-center justify-center shrink-0">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-neutral-100">
                Mes projets enregistrés
              </div>
              <p className="text-xs text-neutral-400 truncate tabular-nums">
                {summaries.length === 0
                  ? 'Aucun projet enregistré'
                  : `${summaries.length} projet${summaries.length > 1 ? 's' : ''} · ${summaries[0].name}`}
              </p>
            </div>
          </div>
          <span className="text-xs font-mono tabular-nums text-amber-400 shrink-0">
            {summaries.length > 0 ? summaries.length : ''}
          </span>
        </button>

        {/* Automatic Draft Resume Strip (shown only when an auto-saved draft exists) */}
        {latestDraft && (
          <div className="flex items-center gap-1.5 rounded-2xl bg-neutral-950 border border-neutral-900 px-2 py-1">
            <button
              type="button"
              onClick={() => onOpenSavedProject(latestDraft)}
              aria-label="Reprendre le dernier brouillon"
              className="flex-1 min-w-0 min-h-[44px] px-3 flex items-center gap-2.5 text-left rounded-xl hover:bg-neutral-900/60 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-neutral-200 truncate">
                  Reprendre le dernier brouillon
                </p>
                <p className="text-[11px] text-neutral-500 truncate tabular-nums">
                  {latestDraft.kind === 'credits' ? 'Générique' : 'Sous-titres'} ·{' '}
                  {formatProjectDate(latestDraft.updatedAt)}
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={handleDismissDraft}
              aria-label="Ignorer le brouillon"
              className="w-10 h-10 rounded-xl text-neutral-500 hover:text-neutral-200 flex items-center justify-center shrink-0 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </main>

      {/* PWA Install Button area */}
      <footer className="w-full max-w-md mx-auto flex justify-center pb-2">
        <PWAInstallButton variant="full" />
      </footer>

      <ProjectSaveLoadSheet
        isOpen={showProjectsSheet}
        mode="home"
        onClose={() => setShowProjectsSheet(false)}
        onLoadProject={onOpenSavedProject}
        onProjectsChanged={setSummaries}
      />
    </div>
  );
};
