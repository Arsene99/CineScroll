import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSubtitleScript,
  stampNextLineCue,
  stampClearCue,
  undoLastCueAndRewind,
  rewindTimeWithoutUndo,
  getActiveSubtitleText,
  getNextLineIndexAtTime,
  wrapSubtitleLines,
} from './subtitlesEngine';
import { SubtitleCueEvent } from '../types';

test('parseSubtitleScript extracts non-empty trimmed lines cleanly', () => {
  const lines = parseSubtitleScript('  Bonjour le monde \n\n  Deuxième phrase\r\n  \nTroisième ');
  assert.deepEqual(lines, ['Bonjour le monde', 'Deuxième phrase', 'Troisième']);
});

test('stampNextLineCue advances line by line and shows each line at its stamped timestamp', () => {
  const lines = ['Ligne 1', 'Ligne 2', 'Ligne 3'];
  let cues: SubtitleCueEvent[] = [];

  // Before first tap, nothing is displayed and next line is 0
  assert.equal(getActiveSubtitleText(cues, lines, 0.5), null);
  assert.equal(getNextLineIndexAtTime(cues, 0.5, lines.length), 0);

  // Tap 1 at 1.2s -> Ligne 1
  const step1 = stampNextLineCue(cues, 1.2, lines.length, () => 'c1');
  cues = step1.cues;
  assert.equal(step1.stampedLineIndex, 0);
  assert.equal(step1.nextLineIndex, 1);
  assert.equal(getActiveSubtitleText(cues, lines, 1.1), null);
  assert.equal(getActiveSubtitleText(cues, lines, 1.2)?.text, 'Ligne 1');

  // Tap 2 at 4.0s -> Ligne 2
  const step2 = stampNextLineCue(cues, 4.0, lines.length, () => 'c2');
  cues = step2.cues;
  assert.equal(step2.stampedLineIndex, 1);
  assert.equal(step2.nextLineIndex, 2);
  assert.equal(getActiveSubtitleText(cues, lines, 3.9)?.text, 'Ligne 1');
  assert.equal(getActiveSubtitleText(cues, lines, 4.0)?.text, 'Ligne 2');
});

test('stampClearCue hides screen text without advancing nextLineIndex', () => {
  const lines = ['Ligne 1', 'Ligne 2', 'Ligne 3'];
  let cues: SubtitleCueEvent[] = [{ id: 'c1', time: 1.0, lineIndex: 0 }];

  // User clears screen at 3.5s for a long silence
  cues = stampClearCue(cues, 3.5, () => 'clr1');
  assert.equal(getActiveSubtitleText(cues, lines, 3.4)?.text, 'Ligne 1');
  assert.equal(getActiveSubtitleText(cues, lines, 3.5), null);
  assert.equal(getActiveSubtitleText(cues, lines, 8.0), null);

  // Next line index MUST remain 1 (Ligne 2), not skip ahead
  assert.equal(getNextLineIndexAtTime(cues, 8.0, lines.length), 1);

  // Tapping next line at 8.5s displays Ligne 2
  const step2 = stampNextLineCue(cues, 8.5, lines.length, () => 'c2');
  assert.equal(step2.stampedLineIndex, 1);
  assert.equal(getActiveSubtitleText(step2.cues, lines, 8.5)?.text, 'Ligne 2');
});

test('undoLastCueAndRewind removes the last stamped cue and rewinds before it', () => {
  const lines = ['Ligne 1', 'Ligne 2', 'Ligne 3'];
  const cues: SubtitleCueEvent[] = [
    { id: 'c1', time: 1.0, lineIndex: 0 },
    { id: 'c2', time: 5.0, lineIndex: 1 },
  ];

  // Mistakenly tapped Ligne 2 at 5.0s; currently at 5.8s -> undo & rewind
  const undone = undoLastCueAndRewind(cues, 5.8, 1.5);
  assert.equal(undone.removedCue?.id, 'c2');
  assert.equal(undone.cues.length, 1);
  assert.equal(undone.rewindTime, 3.5);
  assert.equal(getActiveSubtitleText(undone.cues, lines, undone.rewindTime)?.text, 'Ligne 1');
  assert.equal(getNextLineIndexAtTime(undone.cues, undone.rewindTime, lines.length), 1);
});

test('rewindTimeWithoutUndo moves playback back without cancelling any stamped cue', () => {
  const lines = ['Ligne 1', 'Ligne 2'];
  const cues: SubtitleCueEvent[] = [
    { id: 'c1', time: 1.0, lineIndex: 0 },
    { id: 'c2', time: 5.0, lineIndex: 1 },
  ];

  const rewound = rewindTimeWithoutUndo(6.5, 3);
  assert.equal(rewound, 3.5);
  // Both cues remain intact
  assert.equal(cues.length, 2);
  assert.equal(getActiveSubtitleText(cues, lines, rewound)?.text, 'Ligne 1');
  assert.equal(getActiveSubtitleText(cues, lines, 5.1)?.text, 'Ligne 2');
});

test('wrapSubtitleLines wraps long lines within maxWidth without clipping words', () => {
  const measure = (txt: string) => txt.length * 10;
  const wrapped = wrapSubtitleLines(measure, 'Voici une longue phrase de sous-titre pour mobile', 200);
  assert.ok(wrapped.length >= 2);
  for (const l of wrapped) {
    assert.ok(measure(l) <= 200 || !l.includes(' '));
  }
});
