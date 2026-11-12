import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCreditsText,
  calculateScrollPosition,
  measureCreditsContentHeight,
  formatTime,
  getCanvasDimensions,
  getResolutionDimensions,
  getCanvasFont,
  estimateExportSizeMB,
  formatFileSize,
} from './creditsEngine';

test('parseCreditsText identifies headers, role-pairs, and blank lines', () => {
  const sample = `# LE VOYAGEUR
RÉALISATION : Alexandre Dumas
DIRECTEUR PHOTO : Marie Curie

Acteurs Principaux
FIN`;

  const parsed = parseCreditsText(sample);
  assert.equal(parsed.length, 6);
  assert.equal(parsed[0].type, 'title');
  assert.equal(parsed[0].title, 'LE VOYAGEUR');

  assert.equal(parsed[1].type, 'role-pair');
  assert.equal(parsed[1].role, 'RÉALISATION');
  assert.equal(parsed[1].name, 'Alexandre Dumas');

  assert.equal(parsed[2].type, 'role-pair');
  assert.equal(parsed[2].role, 'DIRECTEUR PHOTO');
  assert.equal(parsed[2].name, 'Marie Curie');

  assert.equal(parsed[3].type, 'blank');

  assert.equal(parsed[4].type, 'regular');
  assert.equal(parsed[4].text, 'Acteurs Principaux');

  assert.equal(parsed[5].type, 'title'); // all caps word FIN
  assert.equal(parsed[5].title, 'FIN');
});

test('calculateScrollPosition bottom-to-top ascends smoothly', () => {
  const canvasHeight = 1000;
  const contentHeight = 400;

  // At progress 0: start at bottom of canvas
  const start = calculateScrollPosition(0, canvasHeight, contentHeight, 'bottom-to-top');
  assert.equal(start, 1000);

  // At progress 1: finishes when scrolled completely above top
  const end = calculateScrollPosition(1, canvasHeight, contentHeight, 'bottom-to-top');
  assert.equal(end, -400);

  // At progress 0.5: exactly midway
  const mid = calculateScrollPosition(0.5, canvasHeight, contentHeight, 'bottom-to-top');
  assert.equal(mid, 300);
});

test('calculateScrollPosition top-to-bottom descends smoothly', () => {
  const canvasHeight = 1000;
  const contentHeight = 400;

  const start = calculateScrollPosition(0, canvasHeight, contentHeight, 'top-to-bottom');
  assert.equal(start, -400);

  const end = calculateScrollPosition(1, canvasHeight, contentHeight, 'top-to-bottom');
  assert.equal(end, 1000);
});

test('calculateScrollPosition fade-in centers vertically', () => {
  const canvasHeight = 1000;
  const contentHeight = 400;
  const pos = calculateScrollPosition(0.5, canvasHeight, contentHeight, 'fade-in');
  assert.equal(pos, (1000 - 400) / 2);
});

test('formatTime outputs exact MM:SS format', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(9), '00:09');
  assert.equal(formatTime(65), '01:05');
  assert.equal(formatTime(720), '12:00');
  assert.equal(formatTime(4.5, true), '00:04.5');
});

test('getCanvasDimensions returns correct aspect ratio proportions', () => {
  const dims916 = getCanvasDimensions('9:16', 1080);
  assert.equal(dims916.height, 1080);
  assert.equal(dims916.width, 608);

  const dims169 = getCanvasDimensions('16:9', 1080);
  assert.equal(dims169.width, 1080);
  assert.equal(dims169.height, 608);

  const dims11 = getCanvasDimensions('1:1', 800);
  assert.equal(dims11.width, 800);
  assert.equal(dims11.height, 800);
});

test('getResolutionDimensions produces even pixel dimensions for all resolutions', () => {
  const res720 = getResolutionDimensions('9:16', '720p');
  assert.equal(res720.width % 2, 0);
  assert.equal(res720.height % 2, 0);
  assert.equal(res720.width, 720);
  assert.equal(res720.height, 1280);

  const res1080 = getResolutionDimensions('16:9', '1080p');
  assert.equal(res1080.width, 1920);
  assert.equal(res1080.height, 1080);

  const res4k = getResolutionDimensions('9:16', '4k');
  assert.equal(res4k.width, 2160);
  assert.equal(res4k.height, 3840);
});

test('getCanvasFont produces valid font strings with fallbacks', () => {
  const cinzel = getCanvasFont(700, 24, 'Cinzel');
  assert.match(cinzel, /700 24px "Cinzel", Georgia/);

  const bebas = getCanvasFont(400, 30, 'Bebas Neue');
  assert.match(bebas, /400 30px "Bebas Neue", Impact/);

  const montserrat = getCanvasFont('bold', 18, 'Montserrat');
  assert.match(montserrat, /bold 18px "Montserrat", "Segoe UI"/);
});

test('getResolutionDimensions and estimateExportSizeMB keep 720p text exports compact', () => {
  const compact720 = getResolutionDimensions('9:16', '720p', 'compact', false);
  const balanced720 = getResolutionDimensions('9:16', '720p', 'balanced', false);
  const high720 = getResolutionDimensions('9:16', '720p', 'high', false);

  assert.ok(compact720.bitrate < balanced720.bitrate);
  assert.ok(balanced720.bitrate < high720.bitrate);

  // 25s 720p balanced text-only export should estimate well under 3 MB (vs 17 MB previously)
  const estBalanced = estimateExportSizeMB(25, balanced720.bitrate, false);
  const estCompact = estimateExportSizeMB(25, compact720.bitrate, false);
  assert.ok(estCompact <= 1.5, `Expected compact <= 1.5 MB, got ${estCompact}`);
  assert.ok(estBalanced <= 2.5, `Expected balanced <= 2.5 MB, got ${estBalanced}`);
});

test('formatFileSize formats bytes cleanly in Ko and Mo', () => {
  assert.equal(formatFileSize(512 * 1024), '512 Ko');
  assert.equal(formatFileSize(1.8 * 1024 * 1024), '1.8 Mo');
});



