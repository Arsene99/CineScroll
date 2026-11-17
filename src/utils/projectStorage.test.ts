import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProjectSummary,
  createMemoryStorageDriver,
  createProjectRepository,
  formatProjectDate,
  suggestProjectName,
} from './projectStorage';
import { CreditsConfig, SubtitlesStudioConfig } from '../types';

function makeCreditsConfig(overrides: Partial<CreditsConfig> = {}): CreditsConfig {
  return {
    text: 'UN FILM DE\nCLAIRE MARTIN\n\nMONTAGE\nLUCAS DUBOIS',
    fontFamily: 'Cinzel',
    fontSize: 24,
    color: '#ffffff',
    alignment: 'center',
    direction: 'bottom-to-top',
    speedDuration: 30,
    lineSpacing: 1.6,
    roleSeparation: true,
    textShadow: true,
    background: {
      source: 'color',
      value: '#050508',
      overlayOpacity: 0,
      blur: 0,
    },
    audio: {
      presetId: 'cinema-epic',
      volume: 0.6,
      muted: false,
    },
    aspectRatio: '9:16',
    ...overrides,
  };
}

function makeSubtitlesConfig(overrides: Partial<SubtitlesStudioConfig> = {}): SubtitlesStudioConfig {
  return {
    rawText: 'Première phrase\nDeuxième phrase\nTroisième phrase',
    cues: [
      { id: 'c1', time: 1.25, lineIndex: 0 },
      { id: 'c2', time: 3.8, lineIndex: 1 },
    ],
    fontFamily: 'Montserrat',
    fontSize: 26,
    color: '#ffdd55',
    position: 'bottom',
    boxStyle: 'pill-dark',
    durationSec: 42,
    background: {
      source: 'color',
      value: '#120824',
      overlayOpacity: 0.15,
      blur: 0,
    },
    audio: {
      presetId: 'zen-piano',
      volume: 0.75,
      muted: false,
    },
    aspectRatio: '16:9',
    ...overrides,
  };
}

test('saves and restores a credits project with custom gradient and text cleanly', async () => {
  const driver = createMemoryStorageDriver();
  let tick = 1000;
  let idSeq = 0;
  const repo = createProjectRepository(driver, {
    now: () => (tick += 1000),
    idFactory: (prefix) => `${prefix}-${++idSeq}`,
  });

  const config = makeCreditsConfig({
    color: '#ff77aa',
    background: {
      source: 'gradient',
      value: '#1a0b2e',
      gradient: { colors: ['#1a0b2e', '#4b1248'], angle: 135, animated: true, animationSpeed: 1.5 },
      overlayOpacity: 0.2,
      blur: 0,
    },
  });

  const saved = await repo.saveProject({
    name: 'Mon court-métrage',
    kind: 'credits',
    creditsConfig: config,
  });

  assert.equal(saved.name, 'Mon court-métrage');
  const list = await repo.listProjects();
  assert.equal(list.length, 1);
  assert.equal(list[0].id, saved.id);

  const loaded = await repo.getProject(saved.id);
  assert.ok(loaded);
  assert.equal(loaded.creditsConfig?.text, config.text);
  assert.equal(loaded.creditsConfig?.color, '#ff77aa');
  assert.equal(loaded.creditsConfig?.background.gradient?.animated, true);
  assert.deepEqual(loaded.creditsConfig?.background.gradient?.colors, ['#1a0b2e', '#4b1248']);
});

test('extracts and rehydrates image and custom audio blobs across sessions without keeping dead blob URLs', async () => {
  const driver = createMemoryStorageDriver();
  const blobStore = new Map<string, Blob>();
  let urlSeq = 0;
  let idSeq = 0;

  const originalBgUrl = 'blob:http://localhost:3000/old-bg-1';
  const originalAudioUrl = 'blob:http://localhost:3000/old-audio-1';
  blobStore.set(originalBgUrl, new Blob(['fake-png-bytes'], { type: 'image/png' }));
  blobStore.set(originalAudioUrl, new Blob(['fake-wav-bytes'], { type: 'audio/wav' }));

  const repo = createProjectRepository(driver, {
    blobFetcher: async (url) => blobStore.get(url) ?? null,
    urlCreator: (blob) => {
      const fresh = `blob:http://localhost:3000/rehydrated-${++urlSeq}`;
      blobStore.set(fresh, blob);
      return fresh;
    },
    idFactory: (prefix) => `${prefix}-${++idSeq}`,
    now: () => 5000,
  });

  const subCfg = makeSubtitlesConfig({
    background: {
      source: 'image',
      value: originalBgUrl,
      overlayOpacity: 0.25,
      blur: 0,
      customFileName: 'affiche.png',
    },
    audio: {
      presetId: 'custom',
      customFileUrl: originalAudioUrl,
      customFileName: 'chanson.wav',
      customFileDuration: 42,
      volume: 0.85,
      muted: false,
    },
  });

  const saved = await repo.saveProject({
    name: 'Clip lyrique',
    kind: 'subtitles',
    subtitlesConfig: subCfg,
  });

  // Persisted raw record must NOT store ephemeral blob URL
  const rawRecord = await driver.getProjectRecord(saved.id);
  assert.equal(rawRecord?.subtitlesConfig?.background.value, '');
  assert.equal(rawRecord?.subtitlesConfig?.audio.customFileUrl, undefined);
  assert.ok(rawRecord?.mediaKeys?.bgBlobKey);
  assert.ok(rawRecord?.mediaKeys?.audioBlobKey);

  // Simulate app restart by clearing original session blob URLs
  blobStore.delete(originalBgUrl);
  blobStore.delete(originalAudioUrl);

  const reloaded = await repo.getProject(saved.id);
  assert.ok(reloaded?.subtitlesConfig);
  assert.match(reloaded.subtitlesConfig.background.value, /^blob:http:\/\/localhost:3000\/rehydrated-/);
  assert.equal(reloaded.subtitlesConfig.background.customFileName, 'affiche.png');
  assert.match(reloaded.subtitlesConfig.audio.customFileUrl || '', /^blob:http:\/\/localhost:3000\/rehydrated-/);
  assert.equal(reloaded.subtitlesConfig.audio.customFileName, 'chanson.wav');
  assert.equal(reloaded.subtitlesConfig.cues.length, 2);
  assert.equal(reloaded.subtitlesConfig.cues[1].time, 3.8);

  // Deleting project removes associated media blobs from store
  const bgKey = rawRecord!.mediaKeys!.bgBlobKey!;
  const audKey = rawRecord!.mediaKeys!.audioBlobKey!;
  await repo.deleteProject(saved.id);
  assert.equal(await repo.getProject(saved.id), null);
  assert.equal(await driver.getMediaBlob(bgKey), null);
  assert.equal(await driver.getMediaBlob(audKey), null);
});

test('updating a saved project overwrites in place and cleans up superseded blobs only when unreferenced', async () => {
  const driver = createMemoryStorageDriver();
  let idSeq = 0;
  let nowTick = 100;
  const repo = createProjectRepository(driver, {
    blobFetcher: async () => new Blob(['img'], { type: 'image/png' }),
    urlCreator: () => `blob:fresh-${++idSeq}`,
    idFactory: (prefix) => `${prefix}-${++idSeq}`,
    now: () => (nowTick += 100),
  });

  const first = await repo.saveProject({
    name: 'Projet A',
    kind: 'credits',
    creditsConfig: makeCreditsConfig({
      background: {
        source: 'image',
        value: 'blob:img-1',
        overlayOpacity: 0,
        blur: 0,
        customFileName: 'photo1.png',
      },
    }),
  });
  const firstBgKey = first.mediaKeys!.bgBlobKey!;

  // Update same project ID removing background image
  const updated = await repo.saveProject({
    id: first.id,
    name: 'Projet A v2',
    kind: 'credits',
    creditsConfig: makeCreditsConfig({
      text: 'NOUVEAU TEXTE',
      background: { source: 'color', value: '#000000', overlayOpacity: 0, blur: 0 },
    }),
  });

  assert.equal(updated.id, first.id);
  assert.equal((await repo.listProjects()).length, 1);
  assert.equal(await driver.getMediaBlob(firstBgKey), null);
  assert.equal(updated.creditsConfig?.text, 'NOUVEAU TEXTE');
});

test('drafts do not appear in saved project list and can be resumed independently', async () => {
  const driver = createMemoryStorageDriver();
  let nowTick = 1000;
  const repo = createProjectRepository(driver, {
    now: () => (nowTick += 500),
  });

  await repo.saveDraft('credits', makeCreditsConfig({ text: 'Brouillon en cours' }));
  assert.equal((await repo.listProjects()).length, 0);

  const latest = await repo.getLatestDraft();
  assert.ok(latest);
  assert.equal(latest.kind, 'credits');
  assert.equal(latest.creditsConfig?.text, 'Brouillon en cours');

  await repo.clearDraft('credits');
  assert.equal(await repo.getLatestDraft(), null);
});

test('suggestProjectName, formatProjectDate, and buildProjectSummary format cleanly', () => {
  const name1 = suggestProjectName('credits', [], 'RÉALISÉ PAR : ALICE\nSCÉNARIO : BOB');
  assert.equal(name1, 'RÉALISÉ PAR — ALICE');

  const name2 = suggestProjectName('credits', [{ name: name1, kind: 'credits' }], 'RÉALISÉ PAR : ALICE');
  assert.equal(name2, 'Générique 1');

  const summary = buildProjectSummary({
    id: 'p1',
    name: 'Clip',
    kind: 'subtitles',
    createdAt: 1000,
    updatedAt: 2000,
    subtitlesConfig: makeSubtitlesConfig(),
  });
  assert.equal(summary.lineCount, 3);
  assert.equal(summary.cueCount, 2);
  assert.equal(summary.aspectRatio, '16:9');
  assert.equal(summary.hasCustomMedia, false);

  assert.equal(formatProjectDate(10000, 15000), "À l'instant");
  assert.equal(formatProjectDate(10000, 10000 + 5 * 60_000), 'Il y a 5 min');
});
