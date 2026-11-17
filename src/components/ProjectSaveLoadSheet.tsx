import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CopyPlus,
  Film,
  FolderOpen,
  Loader2,
  Plus,
  Save,
  Subtitles,
  Trash2,
  X,
} from 'lucide-react';
import {
  CreditsConfig,
  ProjectSummary,
  SavedProject,
  SavedProjectKind,
  SubtitlesStudioConfig,
} from '../types';
import {
  formatProjectDate,
  projectRepository,
  suggestProjectName,
} from '../utils/projectStorage';

interface ProjectSaveLoadSheetProps {
  isOpen: boolean;
  mode: 'home' | 'studio';
  currentKind?: SavedProjectKind;
  currentCreditsConfig?: CreditsConfig;
  currentSubtitlesConfig?: SubtitlesStudioConfig;
  activeProjectId?: string | null;
  activeProjectName?: string;
  onClose: () => void;
  onSaved?: (saved: SavedProject) => void;
  onLoadProject: (project: SavedProject) => void;
  onStartNew?: () => void;
  onProjectsChanged?: (summaries: ProjectSummary[]) => void;
}

export const ProjectSaveLoadSheet: React.FC<ProjectSaveLoadSheetProps> = ({
  isOpen,
  mode,
  currentKind,
  currentCreditsConfig,
  currentSubtitlesConfig,
  activeProjectId,
  activeProjectName,
  onClose,
  onSaved,
  onLoadProject,
  onStartNew,
  onProjectsChanged,
}) => {
  const [summaries, setSummaries] = useState<ProjectSummary[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [projectName, setProjectName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sourceText = useMemo(() => {
    if (currentKind === 'credits') return currentCreditsConfig?.text || '';
    if (currentKind === 'subtitles') return currentSubtitlesConfig?.rawText || '';
    return '';
  }, [currentKind, currentCreditsConfig?.text, currentSubtitlesConfig?.rawText]);

  const refreshList = async () => {
    setIsLoadingList(true);
    try {
      const list = await projectRepository.listSummaries();
      setSummaries(list);
      onProjectsChanged?.(list);
      return list;
    } catch {
      setErrorMessage('Impossible de lire les projets enregistrés sur cet appareil.');
      return [];
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setStatusMessage(null);
    setErrorMessage(null);
    setLoadingProjectId(null);

    let cancelled = false;
    (async () => {
      const list = await refreshList();
      if (cancelled) return;
      if (mode === 'studio' && currentKind) {
        if (activeProjectName) {
          setProjectName(activeProjectName);
        } else {
          setProjectName(suggestProjectName(currentKind, list, sourceText));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode, activeProjectId, activeProjectName, currentKind]);

  if (!isOpen) return null;

  const handleSave = async (asNewCopy = false) => {
    if (!currentKind) return;
    const cleanedName = projectName.trim();
    if (!cleanedName) {
      setErrorMessage('Veuillez saisir un nom pour votre projet.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const saved = await projectRepository.saveProject({
        id: asNewCopy ? undefined : activeProjectId || undefined,
        name: cleanedName,
        kind: currentKind,
        creditsConfig: currentKind === 'credits' ? currentCreditsConfig : undefined,
        subtitlesConfig: currentKind === 'subtitles' ? currentSubtitlesConfig : undefined,
      });

      onSaved?.(saved);
      await projectRepository.clearDraft(currentKind).catch(() => {});
      await refreshList();
      setStatusMessage(asNewCopy ? 'Nouvelle copie enregistrée' : 'Projet enregistré sur cet appareil');
    } catch {
      setErrorMessage("Échec de l'enregistrement sur l'appareil.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectProject = async (id: string) => {
    setLoadingProjectId(id);
    setErrorMessage(null);
    try {
      const loaded = await projectRepository.getProject(id);
      if (!loaded) {
        setErrorMessage('Ce projet est introuvable.');
        await refreshList();
        return;
      }
      onLoadProject(loaded);
      onClose();
    } catch {
      setErrorMessage('Impossible de charger ce projet.');
    } finally {
      setLoadingProjectId(null);
    }
  };

  const handleDeleteProject = async (id: string) => {
    setErrorMessage(null);
    try {
      await projectRepository.deleteProject(id);
      await refreshList();
    } catch {
      setErrorMessage('Impossible de supprimer ce projet.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Mes projets enregistrés"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-neutral-950 border-t sm:border border-neutral-800 rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[84vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-neutral-900">
          <div className="flex items-center gap-2.5">
            <FolderOpen className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white tracking-tight">
              {mode === 'studio' ? 'Enregistrer & Projets' : 'Mes projets enregistrés'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer les projets"
            className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 no-scrollbar">
          {/* Studio Save Section */}
          {mode === 'studio' && currentKind && (
            <section className="p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 space-y-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="cinescroll-project-name"
                  className="block text-xs font-medium text-neutral-300"
                >
                  Nom du projet
                </label>
                <input
                  id="cinescroll-project-name"
                  type="text"
                  value={projectName}
                  onChange={(e) => {
                    setProjectName(e.target.value);
                    if (statusMessage) setStatusMessage(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSave(false);
                    }
                  }}
                  placeholder={currentKind === 'credits' ? 'Mon générique' : 'Mes sous-titres'}
                  maxLength={60}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-amber-500 outline-none text-sm text-white placeholder:text-neutral-600 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  disabled={isSaving}
                  className="flex-1 min-h-[44px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>
                    {activeProjectId ? 'Mettre à jour' : "Enregistrer sur l'appareil"}
                  </span>
                </button>

                {activeProjectId && (
                  <button
                    type="button"
                    onClick={() => handleSave(true)}
                    disabled={isSaving}
                    aria-label="Enregistrer comme nouveau projet"
                    title="Enregistrer comme nouveau projet"
                    className="min-h-[44px] px-3.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 font-medium text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 whitespace-nowrap"
                  >
                    <CopyPlus className="w-4 h-4 text-neutral-400" />
                    <span>Copie</span>
                  </button>
                )}
              </div>

              {statusMessage && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium pt-0.5">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{statusMessage}</span>
                </div>
              )}
            </section>
          )}

          {errorMessage && (
            <p className="text-xs text-red-400 font-medium px-1">{errorMessage}</p>
          )}

          {/* Saved Projects List */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-neutral-400 tabular-nums">
                Projets enregistrés ({summaries.length})
              </span>

              {mode === 'studio' && onStartNew && activeProjectId && (
                <button
                  type="button"
                  onClick={() => {
                    onStartNew();
                    onClose();
                  }}
                  className="flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nouveau vierge</span>
                </button>
              )}
            </div>

            {isLoadingList ? (
              <div className="flex items-center justify-center py-8 text-neutral-500">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : summaries.length === 0 ? (
              <div className="py-8 px-4 rounded-2xl bg-neutral-900/40 border border-neutral-900 text-center space-y-1">
                <p className="text-xs font-medium text-neutral-300">
                  Aucun projet enregistré sur cet appareil
                </p>
                <p className="text-[11px] text-neutral-500">
                  {mode === 'home'
                    ? 'Ouvrez Génériques ou Sous-titres et appuyez sur Enregistrer pour retrouver votre travail ici.'
                    : "Saisissez un nom ci-dessus et enregistrez pour reprendre votre projet à tout moment."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {summaries.map((item) => {
                  const isActive = item.id === activeProjectId;
                  const isLoadingThis = loadingProjectId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-1.5 rounded-2xl border p-1.5 transition-colors ${
                        isActive
                          ? 'bg-neutral-900 border-amber-500/60'
                          : 'bg-neutral-900/60 border-neutral-800/90 hover:border-neutral-700'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectProject(item.id)}
                        disabled={Boolean(loadingProjectId)}
                        aria-label={`Ouvrir le projet ${item.name}`}
                        className="flex-1 min-w-0 flex items-center gap-3 px-2 py-2 text-left rounded-xl active:scale-[0.99] transition-transform"
                      >
                        <div className="w-9 h-9 rounded-xl bg-neutral-800 text-amber-400 flex items-center justify-center shrink-0">
                          {isLoadingThis ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : item.kind === 'credits' ? (
                            <Film className="w-4 h-4" />
                          ) : (
                            <Subtitles className="w-4 h-4" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white truncate">
                              {item.name}
                            </span>
                            {isActive && (
                              <span className="text-[11px] font-medium text-amber-400 shrink-0">
                                Ouvert
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-neutral-400 tabular-nums truncate mt-0.5">
                            {item.kind === 'credits' ? 'Générique' : 'Sous-titres'} ·{' '}
                            {item.aspectRatio} ·{' '}
                            {item.kind === 'subtitles'
                              ? `${item.cueCount} repère${item.cueCount > 1 ? 's' : ''}`
                              : `${item.lineCount} ligne${item.lineCount > 1 ? 's' : ''}`}
                            {item.hasCustomMedia ? ' · Média' : ''} ·{' '}
                            {formatProjectDate(item.updatedAt)}
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteProject(item.id)}
                        aria-label={`Supprimer le projet ${item.name}`}
                        className="w-10 h-10 rounded-xl text-neutral-500 hover:text-red-400 hover:bg-neutral-800/70 flex items-center justify-center shrink-0 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
