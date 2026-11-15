import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceSyncedClock, createSyncedClockState } from './syncClock';

test('advanceSyncedClock waits during async audio startup buffering without racing ahead', () => {
  let state = createSyncedClockState(0, 0);

  // Audio is still seeking / buffering for 120ms -> timeline must hold at 0
  for (let i = 0; i < 6; i++) {
    const res = advanceSyncedClock(
      state,
      { active: true, ready: false, mediaTime: 0, mediaDuration: 30, outputLatencySec: 0.05 },
      0.02,
      25
    );
    state = res.nextState;
    assert.equal(res.nextTimelineTime, 0);
  }
});

test('advanceSyncedClock compensates outputLatency and stays locked to audio clock without drift', () => {
  let state = createSyncedClockState(0, 0);

  // Latch first ready frame at mediaTime = 0
  let res = advanceSyncedClock(
    state,
    { active: true, ready: true, mediaTime: 0, mediaDuration: 30, outputLatencySec: 0.08 },
    0.016,
    25
  );
  state = res.nextState;
  assert.equal(res.nextTimelineTime, 0);

  // At mediaTime = 0.08s, outputLatency of 0.08s means sample 0.00s just reached ears
  res = advanceSyncedClock(
    state,
    { active: true, ready: true, mediaTime: 0.08, mediaDuration: 30, outputLatencySec: 0.08 },
    0.08,
    25
  );
  state = res.nextState;
  assert.ok(Math.abs(res.nextTimelineTime - 0) < 0.001);

  // At mediaTime = 10.08s, heard audio is exactly 10.00s (even if wall deltas were noisy)
  res = advanceSyncedClock(
    state,
    { active: true, ready: true, mediaTime: 10.08, mediaDuration: 30, outputLatencySec: 0.08 },
    0.05,
    25
  );
  state = res.nextState;
  assert.ok(Math.abs(res.nextTimelineTime - 10.0) < 0.001);
});

test('advanceSyncedClock handles seamless track looping without snapping timeline backward', () => {
  let state = createSyncedClockState(0, 9.5);

  // Latch ready at 9.5s
  let res = advanceSyncedClock(
    state,
    { active: true, ready: true, mediaTime: 9.5, mediaDuration: 10, outputLatencySec: 0 },
    0.016,
    25
  );
  state = res.nextState;

  // Advance to 9.9s (+0.4s)
  res = advanceSyncedClock(
    state,
    { active: true, ready: true, mediaTime: 9.9, mediaDuration: 10, outputLatencySec: 0 },
    0.4,
    25
  );
  state = res.nextState;
  assert.ok(Math.abs(res.nextTimelineTime - 0.4) < 0.001);

  // Wrap past 10.0s end to 0.2s (+0.3s across loop boundary)
  res = advanceSyncedClock(
    state,
    { active: true, ready: true, mediaTime: 0.2, mediaDuration: 10, outputLatencySec: 0 },
    0.3,
    25
  );
  state = res.nextState;
  assert.ok(Math.abs(res.nextTimelineTime - 0.7) < 0.001);
});
