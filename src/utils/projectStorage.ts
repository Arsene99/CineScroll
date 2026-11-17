import {
  AudioConfig,
  BackgroundConfig,
  CreditsConfig,
  ProjectSummary,
  SavedProject,
  SavedProjectKind,
  SavedProjectMediaKeys,
  SubtitlesStudioConfig,
} from '../types';
import { parseSubtitleScript } from './subtitlesEngine';

export const DRAFT_CREDITS_ID = '__draft_credits__';
export const DRAFT_SUBTITLES_ID = '__draft_subtitles__';

const DB_NAME = 'cinescroll-local-db';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_MEDIA = 'media';

export interface ProjectStorageDriver {
  listProjectRecords(): Promise<SavedProject[]>;
  getProjectRecord(id: string): Promise<SavedProject | null>;
  putProjectRecord(record: SavedProject): Promise<void>;
  deleteProjectRecord(id: string): Promise<void>;
  getMediaBlob(key: string): Promise<Blob | null>;
  putMediaBlob(key: string, blob: Blob): Promise<void>;
  deleteMediaBlob(key: string): Promise<void>;
}

export interface ProjectRepoDeps {
  blobFetcher?: (url: string) => Promise<Blob | null>;
  urlCreator?: (blob: Blob) => string;
  now?: () => number;
  idFactory?: (prefix: string) => string;
}

export function isDraftProjectId(id: string): boolean {
  return id === DRAFT_CREDITS_ID || id === DRAFT_SUBTITLES_ID;
}

export function generateProjectId(prefix = 'proj'): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

export function suggestProjectName(
  kind: SavedProjectKind,
  existingProjects: Array<Pick<SavedProject, 'name' | 'kind'>>,
  sourceText?: string
): string {
  const cleanFirstLine = (sourceText || '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length >= 2 && !/^[-_=*•·]+$/.test(line));

  if (cleanFirstLine) {
    const normalized = cleanFirstLine
      .replace(/\s*:\s*/g, ' — ')
      .replace(/\s+/g, ' ')
      .trim();
    const truncated = normalized.length > 32 ? `${normalized.slice(0, 31).trimEnd()}…` : normalized;
    const existingSet = new Set(existingProjects.map((p) => p.name.trim().toLowerCase()));
    if (!existingSet.has(truncated.toLowerCase())) {
      return truncated;
    }
  }

  const base = kind === 'credits' ? 'Générique' : 'Sous-titres';
  const existingSet = new Set(existingProjects.map((p) => p.name.trim().toLowerCase()));
  let idx = 1;
  while (existingSet.has(`${base} ${idx}`.toLowerCase())) {
    idx++;
  }
  return `${base} ${idx}`;
}

export function formatProjectDate(timestamp: number, nowMs = Date.now()): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 'Récent';
  const diffSec = Math.max(0, Math.floor((nowMs - timestamp) / 1000));
  if (diffSec < 60) return "À l'instant";
  if (diffSec < 3600) return `Il y a ${Math.floor(diffSec / 60)} min`;

  const date = new Date(timestamp);
  const today = new Date(nowMs);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');

  const isSameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  if (isSameDay) return `Aujourd'hui · ${hh}:${mm}`;

  const yesterday = new Date(nowMs - 86400_000);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  if (isYesterday) return `Hier · ${hh}:${mm}`;

  const months = [
    'janv.',
    'févr.',
    'mars',
    'avr.',
    'mai',
    'juin',
    'juil.',
    'août',
    'sept.',
    'oct.',
    'nov.',
    'déc.',
  ];
  return `${date.getDate()} ${months[date.getMonth()] || ''}`.trim();
}

export function buildProjectSummary(project: SavedProject): ProjectSummary {
  if (project.kind === 'credits' && project.creditsConfig) {
    const cfg = project.creditsConfig;
    const lineCount = cfg.text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean).length;
    const hasCustomMedia =
      cfg.background.source === 'image' ||
      cfg.background.source === 'video' ||
      cfg.audio.presetId === 'custom';
    return {
      id: project.id,
      name: project.name,
      kind: 'credits',
      updatedAt: project.updatedAt,
      aspectRatio: cfg.aspectRatio,
      lineCount,
      cueCount: 0,
      hasCustomMedia,
    };
  }

  const subCfg = project.subtitlesConfig;
  const lineCount = subCfg ? parseSubtitleScript(subCfg.rawText).length : 0;
  const cueCount = subCfg ? subCfg.cues.length : 0;
  const hasCustomMedia = Boolean(
    subCfg &&
      (subCfg.background.source === 'image' ||
        subCfg.background.source === 'video' ||
        subCfg.audio.presetId === 'custom')
  );

  return {
    id: project.id,
    name: project.name,
    kind: project.kind,
    updatedAt: project.updatedAt,
    aspectRatio: subCfg?.aspectRatio ?? '9:16',
    lineCount,
    cueCount,
    hasCustomMedia,
  };
}

function cloneBackground(bg: BackgroundConfig): BackgroundConfig {
  return {
    ...bg,
    gradient: bg.gradient
      ? {
          ...bg.gradient,
          colors: [...bg.gradient.colors],
        }
      : undefined,
  };
}

function cloneAudio(audio: AudioConfig): AudioConfig {
  return { ...audio };
}

export function cloneCreditsConfig(config: CreditsConfig): CreditsConfig {
  return {
    ...config,
    textGradient: config.textGradient
      ? {
          ...config.textGradient,
          colors: [...config.textGradient.colors],
        }
      : undefined,
    background: cloneBackground(config.background),
    audio: cloneAudio(config.audio),
  };
}

export function cloneSubtitlesConfig(config: SubtitlesStudioConfig): SubtitlesStudioConfig {
  return {
    ...config,
    cues: config.cues.map((c) => ({ ...c })),
    textGradient: config.textGradient
      ? {
          ...config.textGradient,
          colors: [...config.textGradient.colors],
        }
      : undefined,
    background: cloneBackground(config.background),
    audio: cloneAudio(config.audio),
  };
}

function isLocalBlobOrDataUrl(url: string | undefined): boolean {
  return Boolean(url && (url.startsWith('blob:') || url.startsWith('data:')));
}

async function defaultBlobFetcher(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

function defaultUrlCreator(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/**
 * In-memory storage driver used in unit tests or environments without IndexedDB.
 */
export function createMemoryStorageDriver(): ProjectStorageDriver {
  const projects = new Map<string, SavedProject>();
  const media = new Map<string, Blob>();

  return {
    async listProjectRecords() {
      return Array.from(projects.values()).map((p) => ({
        ...p,
        creditsConfig: p.creditsConfig ? cloneCreditsConfig(p.creditsConfig) : undefined,
        subtitlesConfig: p.subtitlesConfig ? cloneSubtitlesConfig(p.subtitlesConfig) : undefined,
        mediaKeys: p.mediaKeys ? { ...p.mediaKeys } : undefined,
      }));
    },
    async getProjectRecord(id) {
      const found = projects.get(id);
      if (!found) return null;
      return {
        ...found,
        creditsConfig: found.creditsConfig ? cloneCreditsConfig(found.creditsConfig) : undefined,
        subtitlesConfig: found.subtitlesConfig ? cloneSubtitlesConfig(found.subtitlesConfig) : undefined,
        mediaKeys: found.mediaKeys ? { ...found.mediaKeys } : undefined,
      };
    },
    async putProjectRecord(record) {
      projects.set(record.id, {
        ...record,
        creditsConfig: record.creditsConfig ? cloneCreditsConfig(record.creditsConfig) : undefined,
        subtitlesConfig: record.subtitlesConfig ? cloneSubtitlesConfig(record.subtitlesConfig) : undefined,
        mediaKeys: record.mediaKeys ? { ...record.mediaKeys } : undefined,
      });
    },
    async deleteProjectRecord(id) {
      projects.delete(id);
    },
    async getMediaBlob(key) {
      return media.get(key) ?? null;
    },
    async putMediaBlob(key, blob) {
      media.set(key, blob);
    },
    async deleteMediaBlob(key) {
      media.delete(key);
    },
  };
}

/**
 * Persistent IndexedDB driver for saving projects + media blobs directly on mobile/desktop device.
 */
export function createIndexedDBDriver(): ProjectStorageDriver {
  let dbPromise: Promise<IDBDatabase> | null = null;

  const openDb = (): Promise<IDBDatabase> => {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB indisponible'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_MEDIA)) {
          db.createObjectStore(STORE_MEDIA);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Erreur ouverture IndexedDB'));
    });
    return dbPromise;
  };

  return {
    async listProjectRecords() {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PROJECTS, 'readonly');
        const store = tx.objectStore(STORE_PROJECTS);
        const req = store.getAll();
        req.onsuccess = () => resolve((req.result as SavedProject[]) || []);
        req.onerror = () => reject(req.error);
      });
    },
    async getProjectRecord(id) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PROJECTS, 'readonly');
        const store = tx.objectStore(STORE_PROJECTS);
        const req = store.get(id);
        req.onsuccess = () => resolve((req.result as SavedProject) || null);
        req.onerror = () => reject(req.error);
      });
    },
    async putProjectRecord(record) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PROJECTS, 'readwrite');
        tx.objectStore(STORE_PROJECTS).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    async deleteProjectRecord(id) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PROJECTS, 'readwrite');
        tx.objectStore(STORE_PROJECTS).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    async getMediaBlob(key) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_MEDIA, 'readonly');
        const req = tx.objectStore(STORE_MEDIA).get(key);
        req.onsuccess = () => resolve((req.result as Blob) || null);
        req.onerror = () => reject(req.error);
      });
    },
    async putMediaBlob(key, blob) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_MEDIA, 'readwrite');
        tx.objectStore(STORE_MEDIA).put(blob, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    async deleteMediaBlob(key) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_MEDIA, 'readwrite');
        tx.objectStore(STORE_MEDIA).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
  };
}

export interface SaveProjectInput {
  id?: string;
  name: string;
  kind: SavedProjectKind;
  creditsConfig?: CreditsConfig;
  subtitlesConfig?: SubtitlesStudioConfig;
  isDraft?: boolean;
  sourceProjectId?: string;
}

export function createProjectRepository(
  driver: ProjectStorageDriver,
  deps: ProjectRepoDeps = {}
) {
  const fetchBlob = deps.blobFetcher ?? defaultBlobFetcher;
  const createUrl = deps.urlCreator ?? defaultUrlCreator;
  const getNow = deps.now ?? (() => Date.now());
  const makeId = deps.idFactory ?? generateProjectId;

  async function cleanupUnreferencedMediaKeys(keys: Array<string | undefined>): Promise<void> {
    const candidates = Array.from(new Set(keys.filter((k): k is string => Boolean(k))));
    if (candidates.length === 0) return;

    const allRecords = await driver.listProjectRecords();
    const stillUsed = new Set<string>();
    for (const rec of allRecords) {
      if (rec.mediaKeys?.bgBlobKey) stillUsed.add(rec.mediaKeys.bgBlobKey);
      if (rec.mediaKeys?.audioBlobKey) stillUsed.add(rec.mediaKeys.audioBlobKey);
    }

    for (const key of candidates) {
      if (!stillUsed.has(key)) {
        await driver.deleteMediaBlob(key).catch(() => {});
      }
    }
  }

  async function extractAndPersistMedia(
    projectId: string,
    bg: BackgroundConfig,
    audio: AudioConfig,
    previousKeys?: SavedProjectMediaKeys
  ): Promise<{
    sanitizedBackground: BackgroundConfig;
    sanitizedAudio: AudioConfig;
    mediaKeys: SavedProjectMediaKeys;
    obsoleteKeys: string[];
  }> {
    const sanitizedBg = cloneBackground(bg);
    const sanitizedAudio = cloneAudio(audio);
    const mediaKeys: SavedProjectMediaKeys = {};
    const obsoleteKeys: string[] = [];

    // 1. Background image / video
    if ((bg.source === 'image' || bg.source === 'video') && bg.value) {
      if (isLocalBlobOrDataUrl(bg.value)) {
        const blob = await fetchBlob(bg.value);
        if (blob && blob.size > 0) {
          const newKey = makeId(`bg-${projectId}`);
          await driver.putMediaBlob(newKey, blob);
          mediaKeys.bgBlobKey = newKey;
          sanitizedBg.value = '';
          if (previousKeys?.bgBlobKey && previousKeys.bgBlobKey !== newKey) {
            obsoleteKeys.push(previousKeys.bgBlobKey);
          }
        } else if (previousKeys?.bgBlobKey) {
          // Keep existing stored blob key if blob URL couldn't be re-fetched
          mediaKeys.bgBlobKey = previousKeys.bgBlobKey;
          sanitizedBg.value = '';
        } else {
          sanitizedBg.source = 'color';
          sanitizedBg.value = '#050508';
          sanitizedBg.customFileName = undefined;
        }
      } else {
        // Non-blob URL string (if ever used)
        if (previousKeys?.bgBlobKey) obsoleteKeys.push(previousKeys.bgBlobKey);
      }
    } else if (previousKeys?.bgBlobKey) {
      obsoleteKeys.push(previousKeys.bgBlobKey);
    }

    // 2. Custom audio
    if (audio.presetId === 'custom' && audio.customFileUrl) {
      if (isLocalBlobOrDataUrl(audio.customFileUrl)) {
        const blob = await fetchBlob(audio.customFileUrl);
        if (blob && blob.size > 0) {
          const newKey = makeId(`aud-${projectId}`);
          await driver.putMediaBlob(newKey, blob);
          mediaKeys.audioBlobKey = newKey;
          sanitizedAudio.customFileUrl = undefined;
          if (previousKeys?.audioBlobKey && previousKeys.audioBlobKey !== newKey) {
            obsoleteKeys.push(previousKeys.audioBlobKey);
          }
        } else if (previousKeys?.audioBlobKey) {
          mediaKeys.audioBlobKey = previousKeys.audioBlobKey;
          sanitizedAudio.customFileUrl = undefined;
        } else {
          sanitizedAudio.presetId = 'cinema-epic';
          sanitizedAudio.customFileUrl = undefined;
          sanitizedAudio.customFileName = undefined;
          sanitizedAudio.customFileDuration = undefined;
        }
      } else {
        if (previousKeys?.audioBlobKey) obsoleteKeys.push(previousKeys.audioBlobKey);
      }
    } else if (previousKeys?.audioBlobKey) {
      obsoleteKeys.push(previousKeys.audioBlobKey);
    }

    return {
      sanitizedBackground: sanitizedBg,
      sanitizedAudio,
      mediaKeys,
      obsoleteKeys,
    };
  }

  async function hydrateRecord(record: SavedProject): Promise<SavedProject> {
    const hydrated: SavedProject = {
      ...record,
      mediaKeys: record.mediaKeys ? { ...record.mediaKeys } : undefined,
      creditsConfig: record.creditsConfig ? cloneCreditsConfig(record.creditsConfig) : undefined,
      subtitlesConfig: record.subtitlesConfig ? cloneSubtitlesConfig(record.subtitlesConfig) : undefined,
    };

    const hydratePair = async (bg: BackgroundConfig, audio: AudioConfig) => {
      if (bg.source === 'image' || bg.source === 'video') {
        if (hydrated.mediaKeys?.bgBlobKey) {
          const blob = await driver.getMediaBlob(hydrated.mediaKeys.bgBlobKey);
          if (blob && blob.size > 0) {
            bg.value = createUrl(blob);
          } else {
            bg.source = 'color';
            bg.value = '#050508';
            bg.customFileName = undefined;
          }
        } else if (!bg.value) {
          bg.source = 'color';
          bg.value = '#050508';
          bg.customFileName = undefined;
        }
      }

      if (audio.presetId === 'custom') {
        if (hydrated.mediaKeys?.audioBlobKey) {
          const blob = await driver.getMediaBlob(hydrated.mediaKeys.audioBlobKey);
          if (blob && blob.size > 0) {
            audio.customFileUrl = createUrl(blob);
          } else {
            audio.presetId = 'cinema-epic';
            audio.customFileUrl = undefined;
            audio.customFileName = undefined;
            audio.customFileDuration = undefined;
          }
        } else if (!audio.customFileUrl) {
          audio.presetId = 'cinema-epic';
          audio.customFileUrl = undefined;
          audio.customFileName = undefined;
          audio.customFileDuration = undefined;
        }
      }
    };

    if (hydrated.kind === 'credits' && hydrated.creditsConfig) {
      await hydratePair(hydrated.creditsConfig.background, hydrated.creditsConfig.audio);
    } else if (hydrated.kind === 'subtitles' && hydrated.subtitlesConfig) {
      await hydratePair(hydrated.subtitlesConfig.background, hydrated.subtitlesConfig.audio);
    }

    return hydrated;
  }

  return {
    async listProjects(): Promise<SavedProject[]> {
      const all = await driver.listProjectRecords();
      return all
        .filter((p) => !p.isDraft && !isDraftProjectId(p.id))
        .sort((a, b) => b.updatedAt - a.updatedAt);
    },

    async listSummaries(): Promise<ProjectSummary[]> {
      const list = await this.listProjects();
      return list.map(buildProjectSummary);
    },

    async getProject(id: string): Promise<SavedProject | null> {
      const record = await driver.getProjectRecord(id);
      if (!record) return null;
      return hydrateRecord(record);
    },

    async saveProject(input: SaveProjectInput): Promise<SavedProject> {
      const nowMs = getNow();
      const id = input.id || makeId('proj');
      const existing = input.id ? await driver.getProjectRecord(input.id) : null;
      const trimmedName = input.name.trim() || (input.kind === 'credits' ? 'Générique' : 'Sous-titres');

      let record: SavedProject;
      let obsoleteKeys: string[] = [];

      if (input.kind === 'credits' && input.creditsConfig) {
        const extracted = await extractAndPersistMedia(
          id,
          input.creditsConfig.background,
          input.creditsConfig.audio,
          existing?.mediaKeys
        );
        obsoleteKeys = extracted.obsoleteKeys;
        const sanitizedCredits = cloneCreditsConfig(input.creditsConfig);
        sanitizedCredits.background = extracted.sanitizedBackground;
        sanitizedCredits.audio = extracted.sanitizedAudio;

        record = {
          id,
          name: trimmedName,
          kind: 'credits',
          createdAt: existing?.createdAt ?? nowMs,
          updatedAt: nowMs,
          creditsConfig: sanitizedCredits,
          mediaKeys: extracted.mediaKeys,
          isDraft: Boolean(input.isDraft),
          sourceProjectId: input.sourceProjectId,
        };
      } else if (input.kind === 'subtitles' && input.subtitlesConfig) {
        const extracted = await extractAndPersistMedia(
          id,
          input.subtitlesConfig.background,
          input.subtitlesConfig.audio,
          existing?.mediaKeys
        );
        obsoleteKeys = extracted.obsoleteKeys;
        const sanitizedSubtitles = cloneSubtitlesConfig(input.subtitlesConfig);
        sanitizedSubtitles.background = extracted.sanitizedBackground;
        sanitizedSubtitles.audio = extracted.sanitizedAudio;

        record = {
          id,
          name: trimmedName,
          kind: 'subtitles',
          createdAt: existing?.createdAt ?? nowMs,
          updatedAt: nowMs,
          subtitlesConfig: sanitizedSubtitles,
          mediaKeys: extracted.mediaKeys,
          isDraft: Boolean(input.isDraft),
          sourceProjectId: input.sourceProjectId,
        };
      } else {
        throw new Error('Configuration du projet manquante');
      }

      await driver.putProjectRecord(record);
      await cleanupUnreferencedMediaKeys(obsoleteKeys);
      return hydrateRecord(record);
    },

    async deleteProject(id: string): Promise<void> {
      const existing = await driver.getProjectRecord(id);
      await driver.deleteProjectRecord(id);
      if (existing?.mediaKeys) {
        await cleanupUnreferencedMediaKeys([
          existing.mediaKeys.bgBlobKey,
          existing.mediaKeys.audioBlobKey,
        ]);
      }
    },

    async saveDraft(
      kind: SavedProjectKind,
      config: CreditsConfig | SubtitlesStudioConfig,
      sourceProjectId?: string,
      sourceName?: string
    ): Promise<void> {
      const draftId = kind === 'credits' ? DRAFT_CREDITS_ID : DRAFT_SUBTITLES_ID;
      await this.saveProject({
        id: draftId,
        name: sourceName || (kind === 'credits' ? 'Brouillon générique' : 'Brouillon sous-titres'),
        kind,
        creditsConfig: kind === 'credits' ? (config as CreditsConfig) : undefined,
        subtitlesConfig: kind === 'subtitles' ? (config as SubtitlesStudioConfig) : undefined,
        isDraft: true,
        sourceProjectId,
      });
    },

    async loadDraft(kind: SavedProjectKind): Promise<SavedProject | null> {
      const draftId = kind === 'credits' ? DRAFT_CREDITS_ID : DRAFT_SUBTITLES_ID;
      return this.getProject(draftId);
    },

    async getLatestDraft(): Promise<SavedProject | null> {
      const [c, s] = await Promise.all([
        driver.getProjectRecord(DRAFT_CREDITS_ID),
        driver.getProjectRecord(DRAFT_SUBTITLES_ID),
      ]);
      const candidates = [c, s].filter((d): d is SavedProject => Boolean(d));
      if (candidates.length === 0) return null;
      candidates.sort((a, b) => b.updatedAt - a.updatedAt);
      return hydrateRecord(candidates[0]);
    },

    async clearDraft(kind: SavedProjectKind): Promise<void> {
      const draftId = kind === 'credits' ? DRAFT_CREDITS_ID : DRAFT_SUBTITLES_ID;
      await this.deleteProject(draftId);
    },
  };
}

function createDefaultDriver(): ProjectStorageDriver {
  if (typeof indexedDB !== 'undefined') {
    return createIndexedDBDriver();
  }
  return createMemoryStorageDriver();
}

export const projectRepository = createProjectRepository(createDefaultDriver());
