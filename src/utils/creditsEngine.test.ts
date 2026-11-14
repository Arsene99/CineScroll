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
  normalizeHexColor,
  hexToHsl,
  hslToHex,
  interpolateHexColor,
  computeLinearGradientPoints,
  getAnimatedGradientState,
  gradientToCss,
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

test('getResolutionDimensions and estimateExportSizeMB scale with FPS and keep 720p exports compact', () => {
  const compact720 = getResolutionDimensions('9:16', '720p', 'compact', false, 24);
  const balanced720 = getResolutionDimensions('9:16', '720p', 'balanced', false, 24);
  const high720 = getResolutionDimensions('9:16', '720p', 'high', false, 24);

  assert.ok(compact720.bitrate < balanced720.bitrate);
  assert.ok(balanced720.bitrate < high720.bitrate);

  const fps15 = getResolutionDimensions('9:16', '720p', 'balanced', false, 15);
  const fps60 = getResolutionDimensions('9:16', '720p', 'balanced', false, 60);
  assert.ok(fps15.bitrate < balanced720.bitrate);
  assert.ok(balanced720.bitrate < fps60.bitrate);

  // 2-minute (120s) 720p 24fps Compact text export should estimate compactly (~3-4.5 Mo)
  const est120Compact = estimateExportSizeMB(120, compact720.bitrate, true, compact720.audioBitrate);
  const est120Balanced = estimateExportSizeMB(120, balanced720.bitrate, true, balanced720.audioBitrate);
  assert.ok(est120Compact <= 4.5, `Expected 120s compact <= 4.5 MB, got ${est120Compact}`);
  assert.ok(est120Balanced <= 6.8, `Expected 120s balanced <= 6.8 MB, got ${est120Balanced}`);
});

test('formatFileSize formats bytes cleanly in Ko and Mo', () => {
  assert.equal(formatFileSize(512 * 1024), '512 Ko');
  assert.equal(formatFileSize(1.8 * 1024 * 1024), '1.8 Mo');
});

test('normalizeHexColor normalizes short and uppercase hex codes safely', () => {
  assert.equal(normalizeHexColor('#F0A'), '#ff00aa');
  assert.equal(normalizeHexColor('EC4899'), '#ec4899');
  assert.equal(normalizeHexColor('invalid', '#8b5cf6'), '#8b5cf6');
});

test('hexToHsl and hslToHex round-trip pink, purple, white, and black accurately', () => {
  for (const hex of ['#ec4899', '#8b5cf6', '#ffffff', '#000000']) {
    const hsl = hexToHsl(hex);
    const roundTripped = hslToHex(hsl.h, hsl.s, hsl.l);
    const orig = hexToHsl(roundTripped);
    assert.ok(Math.abs(hsl.h - orig.h) <= 2, `Hue mismatch for ${hex}`);
    assert.ok(Math.abs(hsl.s - orig.s) <= 2, `Sat mismatch for ${hex}`);
    assert.ok(Math.abs(hsl.l - orig.l) <= 2, `Lig mismatch for ${hex}`);
  }
});

test('interpolateHexColor blends endpoints and midpoint accurately', () => {
  assert.equal(interpolateHexColor('#000000', '#ffffff', 0), '#000000');
  assert.equal(interpolateHexColor('#000000', '#ffffff', 1), '#ffffff');
  assert.equal(interpolateHexColor('#000000', '#fe00fe', 0.5), '#7f007f');
});

test('computeLinearGradientPoints respects CSS gradient angles', () => {
  const horiz = computeLinearGradientPoints(1000, 500, 90);
  assert.ok(horiz.x1 > horiz.x0, '90deg should flow left-to-right');
  assert.ok(Math.abs(horiz.y1 - horiz.y0) < 0.01);

  const vert = computeLinearGradientPoints(1000, 500, 180);
  assert.ok(vert.y1 > vert.y0, '180deg should flow top-to-bottom');
  assert.ok(Math.abs(vert.x1 - vert.x0) < 0.01);
});

test('getAnimatedGradientState preserves static gradients and shifts animated ones over time', () => {
  const staticGrad = {
    colors: ['#4c1d95', '#ec4899'],
    angle: 135,
    animated: false,
    animationSpeed: 1,
  };
  const staticAt2s = getAnimatedGradientState(staticGrad, 2);
  assert.equal(staticAt2s.angle, 135);
  assert.deepEqual(staticAt2s.colors, ['#4c1d95', '#ec4899']);

  const animGrad = {
    colors: ['#4c1d95', '#ec4899', '#38bdf8'],
    angle: 135,
    animated: true,
    animationSpeed: 1,
  };
  const t0 = getAnimatedGradientState(animGrad, 0);
  const t2 = getAnimatedGradientState(animGrad, 2);
  assert.notEqual(t0.angle, t2.angle);
  assert.notDeepEqual(t0.colors, t2.colors);
  assert.equal(gradientToCss(staticGrad), 'linear-gradient(135deg, #4c1d95, #ec4899)');
});



