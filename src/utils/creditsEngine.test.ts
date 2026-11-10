import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCreditsText,
  calculateScrollPosition,
  measureCreditsContentHeight,
  formatTime,
  getCanvasDimensions,
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
