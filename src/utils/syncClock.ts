export interface MediaClockSnapshot {
  active: boolean;
  ready: boolean;
  mediaTime: number;
  mediaDuration: number;
  outputLatencySec: number;
}

export interface SyncedClockState {
  anchorTimelineTime: number;
  prevTimelineTime: number;
  prevMediaTime: number;
  accumulatedMediaTime: number;
  initializedFromMedia: boolean;
}

export function createSyncedClockState(
  timelineTime: number,
  mediaTime = 0
): SyncedClockState {
  return {
    anchorTimelineTime: Math.max(0, timelineTime),
    prevTimelineTime: Math.max(0, timelineTime),
    prevMediaTime: Math.max(0, mediaTime),
    accumulatedMediaTime: 0,
    initializedFromMedia: false,
  };
}

/**
 * Advances the studio timeline locked to the hardware audio (or background video) clock.
 * - Waits cleanly during async audio/video startup buffering (0ms startup lead drift).
 * - Compensates for AudioContext outputLatency so visual cues & tap stamps align with
 *   what the user hears, matching offline export sample 0 timing 1:1.
 * - Handles seamless audio looping past track duration.
 */
export function advanceSyncedClock(
  state: SyncedClockState,
  snapshot: MediaClockSnapshot,
  wallDeltaSec: number,
  maxDuration: number
): { nextState: SyncedClockState; nextTimelineTime: number; reachedEnd: boolean } {
  const safeWallDelta = Math.max(0, Math.min(0.25, wallDeltaSec));

  if (!snapshot.active) {
    const rawNext = state.prevTimelineTime + safeWallDelta;
    const reachedEnd = rawNext >= maxDuration;
    const clamped = reachedEnd ? maxDuration : rawNext;
    return {
      nextState: {
        ...state,
        prevTimelineTime: clamped,
      },
      nextTimelineTime: clamped,
      reachedEnd,
    };
  }

  // Wait for audio/video element to finish seeking/buffering before advancing timeline
  if (!snapshot.ready) {
    return {
      nextState: {
        ...state,
        prevMediaTime: Math.max(0, snapshot.mediaTime),
      },
      nextTimelineTime: state.prevTimelineTime,
      reachedEnd: false,
    };
  }

  const latency = Math.max(0, Math.min(0.25, snapshot.outputLatencySec));

  // Latch first ready media position after play/seek so startup seek offset doesn't jump
  if (!state.initializedFromMedia) {
    return {
      nextState: {
        ...state,
        prevMediaTime: Math.max(0, snapshot.mediaTime),
        accumulatedMediaTime: 0,
        initializedFromMedia: true,
      },
      nextTimelineTime: state.prevTimelineTime,
      reachedEnd: false,
    };
  }

  let mediaDelta = snapshot.mediaTime - state.prevMediaTime;
  if (
    snapshot.mediaDuration > 0 &&
    mediaDelta < -snapshot.mediaDuration * 0.5
  ) {
    mediaDelta += snapshot.mediaDuration;
  }
  if (mediaDelta < 0) {
    mediaDelta = 0;
  }

  const nextAccumulated = state.accumulatedMediaTime + mediaDelta;
  const heardElapsed = Math.max(0, nextAccumulated - latency);
  const audioTarget = state.anchorTimelineTime + heardElapsed;

  // Smooth interpolation between coarse HTMLMediaElement.currentTime updates
  let nextTimeline: number;
  if (mediaDelta > 0) {
    nextTimeline = audioTarget;
  } else {
    const wallProposed = state.prevTimelineTime + safeWallDelta;
    nextTimeline = Math.min(wallProposed, audioTarget + 0.03);
    nextTimeline = Math.max(state.prevTimelineTime, nextTimeline);
  }

  const reachedEnd = nextTimeline >= maxDuration;
  const clamped = reachedEnd ? maxDuration : nextTimeline;

  return {
    nextState: {
      anchorTimelineTime: state.anchorTimelineTime,
      prevTimelineTime: clamped,
      prevMediaTime: Math.max(0, snapshot.mediaTime),
      accumulatedMediaTime: nextAccumulated,
      initializedFromMedia: true,
    },
    nextTimelineTime: clamped,
    reachedEnd,
  };
}
