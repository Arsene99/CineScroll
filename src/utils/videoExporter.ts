import * as Mp4Muxer from 'mp4-muxer';
import * as WebMMuxer from 'webm-muxer';
import { AudioConfig } from '../types';
import { ExportFormat } from './creditsEngine';
import { globalAudioEngine, prepareOfflineAudio, PreparedOfflineAudio } from './audioSynth';
import {
  SegmentedBlobStore,
  VideoEncoderCandidate,
  buildWebCodecsVideoCandidates,
  getWebCodecsResolutionAttempts,
  capMediaRecorderSettings,
} from './exportMemory';

export interface ExportVideoOptions {
  width: number;
  height: number;
  fps?: number;
  durationSec: number;
  bitrate: number;
  audioBitrate?: number;
  format: ExportFormat;
  audio?: AudioConfig;
  bgImage?: HTMLImageElement | null;
  bgVideo?: HTMLVideoElement | null;
  signal: { cancelled: boolean };
  drawFrame: (ctx: CanvasRenderingContext2D, timeSec: number) => void;
  onProgress: (percent: number, renderedSec: number, statusText?: string) => void;
}

export interface ExportVideoResult {
  blob: Blob;
  format: ExportFormat;
  renderDurationMs: number;
  usedFastEngine: boolean;
  actualWidth: number;
  actualHeight: number;
  usedResolutionFallback?: boolean;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function seekVideoElement(video: HTMLVideoElement, timeSec: number): Promise<void> {
  if (!video.duration || !Number.isFinite(video.duration) || video.duration <= 0) {
    return;
  }
  const wrappedTime = timeSec % video.duration;
  if (Math.abs(video.currentTime - wrappedTime) < 0.03) {
    return;
  }
  await new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener('seeked', done);
      resolve();
    };
    const timer = window.setTimeout(done, 180);
    video.addEventListener(
      'seeked',
      () => {
        window.clearTimeout(timer);
        done();
      },
      { once: true }
    );
    try {
      video.currentTime = wrappedTime;
    } catch {
      window.clearTimeout(timer);
      done();
    }
  });
}

async function getSupportedVideoCandidates(
  format: ExportFormat,
  width: number,
  height: number,
  bitrate: number,
  fps: number,
  forceSoftware = false
): Promise<VideoEncoderCandidate[]> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    return [];
  }

  const rawCandidates = buildWebCodecsVideoCandidates(
    format,
    width,
    height,
    bitrate,
    fps,
    forceSoftware
  );

  const supported: VideoEncoderCandidate[] = [];
  const seenKeys = new Set<string>();

  for (const cand of rawCandidates) {
    try {
      const check = await VideoEncoder.isConfigSupported(cand.encoderConfig);
      if (check.supported && check.config) {
        const key = `${check.config.codec}|${check.config.bitrateMode ?? 'default'}|${check.config.latencyMode ?? 'default'}|${check.config.hardwareAcceleration ?? 'no-preference'}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          supported.push({
            encoderConfig: check.config,
            muxerCodec: cand.muxerCodec,
            targetFormat: cand.targetFormat,
          });
          if (supported.length >= 4) break;
        }
      }
    } catch {
      // Ignore unsupported candidate
    }
  }

  return supported;
}

async function pickWebCodecsAudioConfig(
  format: ExportFormat,
  audioBitrate = 64_000
): Promise<{
  encoderConfig: AudioEncoderConfig;
  mp4Codec: 'aac' | 'opus';
  webmCodec: string;
  sampleRate: number;
} | null> {
  if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined') {
    return null;
  }

  const codecs: Array<{ codec: string; mp4Codec: 'aac' | 'opus'; webmCodec: string }> =
    format === 'mp4'
      ? [
          { codec: 'mp4a.40.2', mp4Codec: 'aac', webmCodec: 'A_OPUS' },
          { codec: 'opus', mp4Codec: 'opus', webmCodec: 'A_OPUS' },
        ]
      : [{ codec: 'opus', mp4Codec: 'opus', webmCodec: 'A_OPUS' }];

  const sampleRates = [48000, 44100];
  const bitrates = Array.from(new Set([audioBitrate, 64_000, 96_000, 128_000]));

  for (const item of codecs) {
    for (const sampleRate of sampleRates) {
      for (const bitrate of bitrates) {
        const cfg: AudioEncoderConfig = {
          codec: item.codec,
          sampleRate,
          numberOfChannels: 2,
          bitrate,
        };
        try {
          const support = await AudioEncoder.isConfigSupported(cfg);
          if (support.supported && support.config) {
            return {
              encoderConfig: support.config,
              mp4Codec: item.mp4Codec,
              webmCodec: item.webmCodec,
              sampleRate: support.config.sampleRate || sampleRate,
            };
          }
        } catch {
          // Ignore unsupported candidate
        }
      }
    }
  }

  return null;
}

/**
 * Encodes canvas frames + fast-prepared audio via WebCodecs offline using SegmentedBlobStore
 * so high-res MP4/WebM exports never spike V8 heap with ArrayBuffer doubling or huge VideoFrame queues.
 */
async function encodeWithVideoCandidate(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  options: ExportVideoOptions,
  targetWidth: number,
  targetHeight: number,
  videoSelection: VideoEncoderCandidate,
  preparedAudio: PreparedOfflineAudio | null,
  audioSelection: Awaited<ReturnType<typeof pickWebCodecsAudioConfig>>,
  isStepDown: boolean
): Promise<ExportVideoResult | null> {
  const fps = options.fps ?? 30;
  const exportStartMs = performance.now();
  const hasAudioTrack = Boolean(preparedAudio && audioSelection);
  const audioSampleRate = preparedAudio?.buffer.sampleRate ?? 48000;

  const totalFrames = Math.max(1, Math.round(options.durationSec * fps));
  const totalTargetSamples = hasAudioTrack
    ? Math.max(1, Math.ceil(options.durationSec * audioSampleRate))
    : 0;

  const store = new SegmentedBlobStore(512 * 1024);

  const mp4Target =
    videoSelection.targetFormat === 'mp4'
      ? new Mp4Muxer.StreamTarget({
          chunked: false,
          onData: (data: Uint8Array, position: number) => store.write(data, position),
        })
      : null;

  const webmTarget =
    videoSelection.targetFormat === 'webm'
      ? new WebMMuxer.StreamTarget({
          chunked: false,
          onData: (data: Uint8Array, position: number) => store.write(data, position),
        })
      : null;

  const mp4Muxer = mp4Target
    ? new Mp4Muxer.Muxer({
        target: mp4Target,
        video: {
          codec: videoSelection.muxerCodec as 'avc',
          width: targetWidth,
          height: targetHeight,
          frameRate: fps,
        },
        audio: hasAudioTrack
          ? {
              codec: audioSelection!.mp4Codec,
              numberOfChannels: 2,
              sampleRate: audioSampleRate,
            }
          : undefined,
        fastStart: {
          expectedVideoChunks: totalFrames + 16,
          expectedAudioChunks: hasAudioTrack ? Math.ceil(totalTargetSamples / 960) + 128 : 0,
        },
        firstTimestampBehavior: 'offset',
      })
    : null;

  const webmMuxer = webmTarget
    ? new WebMMuxer.Muxer({
        target: webmTarget,
        video: {
          codec: videoSelection.muxerCodec,
          width: targetWidth,
          height: targetHeight,
          frameRate: fps,
        },
        audio: hasAudioTrack
          ? {
              codec: audioSelection!.webmCodec,
              numberOfChannels: 2,
              sampleRate: audioSampleRate,
            }
          : undefined,
        firstTimestampBehavior: 'offset',
      })
    : null;

  let encoderError: Error | null = null;
  let lastOutputTimeMs = performance.now();

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      lastOutputTimeMs = performance.now();
      if (mp4Muxer) {
        mp4Muxer.addVideoChunk(chunk, meta);
      } else if (webmMuxer) {
        webmMuxer.addVideoChunk(chunk, meta);
      }
    },
    error: (err) => {
      encoderError = err;
    },
  });

  try {
    videoEncoder.configure(videoSelection.encoderConfig);
  } catch {
    try {
      if (videoEncoder.state !== 'closed') videoEncoder.close();
    } catch {}
    store.clear();
    return null;
  }

  let audioEncoder: AudioEncoder | null = null;
  if (hasAudioTrack && audioSelection) {
    try {
      audioEncoder = new AudioEncoder({
        output: (chunk, meta) => {
          if (mp4Muxer) {
            mp4Muxer.addAudioChunk(chunk, meta);
          } else if (webmMuxer) {
            webmMuxer.addAudioChunk(chunk, meta);
          }
        },
        error: (err) => {
          encoderError = err;
        },
      });
      audioEncoder.configure(audioSelection.encoderConfig);
    } catch {
      try {
        if (videoEncoder.state !== 'closed') videoEncoder.close();
        if (audioEncoder && audioEncoder.state !== 'closed') audioEncoder.close();
      } catch {}
      store.clear();
      return null;
    }
  }

  try {
    if (options.bgVideo) {
      options.bgVideo.pause();
    }

    const frameDurationUs = Math.round(1_000_000 / fps);
    const keyFrameEvery = fps * 2;
    let lastProgressUiMs = performance.now();

    options.onProgress(5, 0, `Image 1 / ${totalFrames}`);
    await sleep(0);

    for (let frameIdx = 0; frameIdx <= totalFrames; frameIdx++) {
      if (options.signal.cancelled || encoderError) {
        break;
      }

      const frameTime = Math.min(options.durationSec, frameIdx / fps);

      if (options.bgVideo) {
        await seekVideoElement(options.bgVideo, frameTime);
      }

      options.drawFrame(ctx, frameTime);

      const timestampUs = Math.round((frameIdx / fps) * 1_000_000);
      const videoFrame = new VideoFrame(canvas, {
        timestamp: timestampUs,
        duration: frameDurationUs,
      });

      const isKeyFrame = frameIdx % keyFrameEvery === 0;
      try {
        videoEncoder.encode(videoFrame, { keyFrame: isKeyFrame });
      } finally {
        videoFrame.close();
      }

      const nowMs = performance.now();
      if (
        frameIdx === 2 ||
        frameIdx === 6 ||
        nowMs - lastProgressUiMs >= 120 ||
        frameIdx === totalFrames
      ) {
        lastProgressUiMs = nowMs;
        const pct = Math.min(92, Math.max(5, Math.round(5 + (frameIdx / totalFrames) * 87)));
        options.onProgress(
          pct,
          Math.floor(frameTime),
          `Image ${Math.min(frameIdx + 1, totalFrames)} / ${totalFrames}`
        );
        await sleep(0);
      }

      // Keep at most 2 VideoFrames queued (prevents >300MB RAM spike at 4K on mobile)
      // while allowing up to 15s for slower software/high-res frames
      if (videoEncoder.encodeQueueSize >= 2) {
        const waitStartedMs = performance.now();
        while (videoEncoder.encodeQueueSize >= 2 && !options.signal.cancelled && !encoderError) {
          await sleep(4);
          if (performance.now() - Math.max(waitStartedMs, lastOutputTimeMs) > 15_000) {
            throw new Error('VideoEncoder backpressure timeout');
          }
        }
      }
    }

    if (options.signal.cancelled) {
      throw new DOMException('Export cancelled', 'AbortError');
    }

    if (encoderError) {
      throw encoderError;
    }

    if (audioEncoder && preparedAudio) {
      options.onProgress(93, Math.round(options.durationSec), 'Encodage audio...');
      await sleep(0);

      const { buffer, volume } = preparedAudio;
      const sampleRate = buffer.sampleRate;
      const srcLength = buffer.length;
      const left = buffer.getChannelData(0);
      const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
      const chunkFrames = 1024;
      let chunkCounter = 0;

      for (let offset = 0; offset < totalTargetSamples; offset += chunkFrames) {
        if (options.signal.cancelled || encoderError) break;

        const count = Math.min(chunkFrames, totalTargetSamples - offset);
        const planar = new Float32Array(count * 2);

        for (let i = 0; i < count; i++) {
          const srcIdx = (offset + i) % srcLength;
          planar[i] = left[srcIdx] * volume;
          planar[count + i] = right[srcIdx] * volume;
        }

        const audioData = new AudioData({
          format: 'f32-planar',
          sampleRate,
          numberOfFrames: count,
          numberOfChannels: 2,
          timestamp: Math.round((offset / sampleRate) * 1_000_000),
          data: planar,
        });

        try {
          audioEncoder.encode(audioData);
        } finally {
          audioData.close();
        }

        while (audioEncoder.encodeQueueSize >= 12 && !options.signal.cancelled && !encoderError) {
          await sleep(2);
        }

        chunkCounter++;
        if (chunkCounter % 64 === 0) {
          const audioPct = 93 + Math.min(4, Math.round((offset / totalTargetSamples) * 4));
          options.onProgress(audioPct, Math.round(options.durationSec), 'Encodage audio...');
          await sleep(0);
        }
      }

      if (encoderError) throw encoderError;
      await audioEncoder.flush();
      audioEncoder.close();
      audioEncoder = null;
    }

    options.onProgress(98, Math.round(options.durationSec), 'Finalisation...');
    await sleep(0);

    await videoEncoder.flush();
    videoEncoder.close();

    if (encoderError) {
      throw encoderError;
    }

    if (mp4Muxer) {
      mp4Muxer.finalize();
      const blob = store.toBlob('video/mp4');
      store.clear();
      options.onProgress(100, Math.round(options.durationSec), 'Terminé');
      return {
        blob,
        format: 'mp4',
        renderDurationMs: Math.round(performance.now() - exportStartMs),
        usedFastEngine: true,
        actualWidth: targetWidth,
        actualHeight: targetHeight,
        usedResolutionFallback: isStepDown,
      };
    }

    if (webmMuxer) {
      webmMuxer.finalize();
      const blob = store.toBlob('video/webm');
      store.clear();
      options.onProgress(100, Math.round(options.durationSec), 'Terminé');
      return {
        blob,
        format: 'webm',
        renderDurationMs: Math.round(performance.now() - exportStartMs),
        usedFastEngine: true,
        actualWidth: targetWidth,
        actualHeight: targetHeight,
        usedResolutionFallback: isStepDown,
      };
    }

    store.clear();
    return null;
  } catch (err) {
    try {
      if (videoEncoder.state !== 'closed') videoEncoder.close();
      if (audioEncoder && audioEncoder.state !== 'closed') audioEncoder.close();
    } catch {}
    store.clear();
    if ((err as Error)?.name === 'AbortError') {
      throw err;
    }
    return null;
  }
}

async function tryWebCodecsAtResolution(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  options: ExportVideoOptions,
  width: number,
  height: number,
  bitrate: number,
  forceSoftware: boolean,
  preparedAudio: PreparedOfflineAudio | null,
  audioSelection: Awaited<ReturnType<typeof pickWebCodecsAudioConfig>>,
  isStepDown: boolean
): Promise<ExportVideoResult | null> {
  const fps = options.fps ?? 30;
  const candidates = await getSupportedVideoCandidates(
    options.format,
    width,
    height,
    bitrate,
    fps,
    forceSoftware
  );

  for (const candidate of candidates) {
    if (options.signal.cancelled) {
      throw new DOMException('Export cancelled', 'AbortError');
    }
    const result = await encodeWithVideoCandidate(
      canvas,
      ctx,
      options,
      width,
      height,
      candidate,
      preparedAudio,
      audioSelection,
      isStepDown
    );
    if (result) {
      return result;
    }
  }

  return null;
}

/**
 * Fallback real-time MediaRecorder exporter when WebCodecs isn't supported.
 * Safely caps resolution (<=720p) and FPS (<=24) so mobile browsers never crash with OOM.
 */
async function exportWithMediaRecorder(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  options: ExportVideoOptions
): Promise<ExportVideoResult> {
  const exportStartMs = performance.now();
  const safe = capMediaRecorderSettings(
    options.width,
    options.height,
    options.fps ?? 24,
    options.bitrate
  );

  if (canvas.width !== safe.width || canvas.height !== safe.height) {
    canvas.width = safe.width;
    canvas.height = safe.height;
  }

  const fps = safe.fps;
  const frameIntervalMs = 1000 / fps;

  const canvasStream = canvas.captureStream
    ? canvas.captureStream(fps)
    : (canvas as unknown as { mozCaptureStream: (fps: number) => MediaStream }).mozCaptureStream(fps);
  const videoTrack = canvasStream.getVideoTracks()[0];

  const wantsAudio = Boolean(
    options.audio &&
      !options.audio.muted &&
      options.audio.presetId !== 'none' &&
      options.audio.volume > 0
  );

  if (wantsAudio) {
    const audioDestination = globalAudioEngine.getAudioStreamDestination();
    if (audioDestination) {
      const audioTracks = audioDestination.stream.getAudioTracks();
      if (audioTracks.length > 0) {
        canvasStream.addTrack(audioTracks[0]);
      }
    }
  }

  let chosenMime = '';
  let ext: ExportFormat = options.format;

  if (options.format === 'mp4') {
    for (const cand of ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4']) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(cand)) {
        chosenMime = cand;
        ext = 'mp4';
        break;
      }
    }
    if (!chosenMime) {
      chosenMime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      ext = 'webm';
    }
  } else {
    for (const cand of ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp9', 'video/webm']) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(cand)) {
        chosenMime = cand;
        ext = 'webm';
        break;
      }
    }
    if (!chosenMime) {
      chosenMime = 'video/mp4';
      ext = 'mp4';
    }
  }

  const recordedChunks: Blob[] = [];
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(canvasStream, {
      mimeType: chosenMime || undefined,
      videoBitsPerSecond: safe.bitrate,
      audioBitsPerSecond: options.audioBitrate ?? 64_000,
    });
  } catch {
    recorder = new MediaRecorder(canvasStream, {
      videoBitsPerSecond: safe.bitrate,
    });
  }

  const stopPromise = new Promise<Blob>((resolve) => {
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    recorder.onstop = () => {
      const type = recorder.mimeType || (ext === 'mp4' ? 'video/mp4' : 'video/webm');
      resolve(new Blob(recordedChunks, { type }));
    };
  });

  try {
    recorder.start(1000);
    if (wantsAudio) {
      globalAudioEngine.play(0);
    }

    const totalFrames = Math.max(1, Math.round(options.durationSec * fps));
    const loopStartTime = performance.now();

    for (let frameIdx = 0; frameIdx <= totalFrames; frameIdx++) {
      if (options.signal.cancelled) break;

      const frameTime = Math.min(options.durationSec, frameIdx / fps);
      if (options.bgVideo) {
        await seekVideoElement(options.bgVideo, frameTime);
      }
      options.drawFrame(ctx, frameTime);

      const reqFrame = (videoTrack as unknown as { requestFrame?: () => void })?.requestFrame;
      if (typeof reqFrame === 'function') {
        try {
          reqFrame.call(videoTrack);
        } catch {}
      }

      const pct = Math.min(99, Math.max(1, Math.round((frameIdx / totalFrames) * 100)));
      options.onProgress(pct, Math.floor(frameTime), 'Mode compatibilité...');

      const nextTargetTime = loopStartTime + (frameIdx + 1) * frameIntervalMs;
      const waitMs = Math.max(0, nextTargetTime - performance.now());
      await new Promise((r) => setTimeout(r, waitMs > 0 ? waitMs : 0));
    }

    if (options.signal.cancelled) {
      throw new DOMException('Export cancelled', 'AbortError');
    }

    await new Promise((r) => setTimeout(r, 150));
    if (recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {}
    }
    globalAudioEngine.stop();

    const blob = await stopPromise;
    options.onProgress(100, Math.round(options.durationSec), 'Terminé');
    return {
      blob,
      format: ext,
      renderDurationMs: Math.round(performance.now() - exportStartMs),
      usedFastEngine: false,
      actualWidth: safe.width,
      actualHeight: safe.height,
      usedResolutionFallback: safe.width < options.width || safe.height < options.height,
    };
  } finally {
    if (recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {}
    }
    globalAudioEngine.stop();
    canvasStream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {}
    });
    recordedChunks.length = 0;
  }
}

/**
 * Main video export entrypoint:
 * 1) Uses SegmentedBlobStore + StreamTarget + VideoFrame queue cap (<=2) to prevent mobile RAM OOMs.
 * 2) Tries all WebCodecs hardware & software configs, including 44.1kHz/48kHz audio fallback.
 * 3) If device hardware/codecs reject 4K, steps down cleanly inside WebCodecs (1080p -> 720p) before MediaRecorder.
 * 4) If MediaRecorder fallback is ever reached, safely caps canvas to <=720p / 24fps so the app never crashes.
 */
export async function exportVideo(options: ExportVideoOptions): Promise<ExportVideoResult> {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = options.width;
  exportCanvas.height = options.height;
  const ctx = exportCanvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('Impossible de créer le contexte graphique Canvas 2D.');
  }

  try {
    options.onProgress(1, 0, 'Initialisation...');

    const wantsAudio = Boolean(
      options.audio &&
        !options.audio.muted &&
        options.audio.presetId !== 'none' &&
        options.audio.volume > 0
    );

    let preparedAudio: PreparedOfflineAudio | null = null;
    let audioSelection: Awaited<ReturnType<typeof pickWebCodecsAudioConfig>> = null;
    let canUseWebCodecsAudio = true;

    if (wantsAudio && options.audio) {
      options.onProgress(3, 0, 'Préparation audio...');
      audioSelection = await pickWebCodecsAudioConfig(
        options.format,
        options.audioBitrate ?? 64_000
      );
      if (audioSelection) {
        preparedAudio = await prepareOfflineAudio(
          options.audio,
          options.durationSec,
          audioSelection.sampleRate
        );
        if (!preparedAudio) {
          canUseWebCodecsAudio = false;
        }
      } else {
        canUseWebCodecsAudio = false;
      }
    }

    if (options.signal.cancelled) {
      throw new DOMException('Export cancelled', 'AbortError');
    }

    if (canUseWebCodecsAudio && typeof VideoEncoder !== 'undefined') {
      const resolutionAttempts = getWebCodecsResolutionAttempts(
        options.width,
        options.height,
        options.bitrate
      );

      for (let i = 0; i < resolutionAttempts.length; i++) {
        const attempt = resolutionAttempts[i];
        if (exportCanvas.width !== attempt.width || exportCanvas.height !== attempt.height) {
          exportCanvas.width = attempt.width;
          exportCanvas.height = attempt.height;
        }

        if (attempt.isStepDown) {
          options.onProgress(
            2,
            0,
            `Adaptation ${attempt.width}×${attempt.height}...`
          );
        }

        // 1. Hardware / default acceleration
        const hwResult = await tryWebCodecsAtResolution(
          exportCanvas,
          ctx,
          options,
          attempt.width,
          attempt.height,
          attempt.bitrate,
          false,
          preparedAudio,
          audioSelection,
          attempt.isStepDown
        );
        if (hwResult) {
          return hwResult;
        }

        if (options.signal.cancelled) {
          throw new DOMException('Export cancelled', 'AbortError');
        }

        // 2. Software encoder retry at this resolution
        options.onProgress(
          2,
          0,
          attempt.isStepDown
            ? `Encodeur logiciel ${attempt.width}×${attempt.height}...`
            : 'Relance encodeur...'
        );
        const swResult = await tryWebCodecsAtResolution(
          exportCanvas,
          ctx,
          options,
          attempt.width,
          attempt.height,
          attempt.bitrate,
          true,
          preparedAudio,
          audioSelection,
          attempt.isStepDown
        );
        if (swResult) {
          return swResult;
        }
      }
    }

    if (options.signal.cancelled) {
      throw new DOMException('Export cancelled', 'AbortError');
    }

    // 3. Safe capped legacy fallback (<=720p, <=24fps)
    return await exportWithMediaRecorder(exportCanvas, ctx, options);
  } finally {
    // Release high-res RGBA canvas backing store immediately
    exportCanvas.width = 0;
    exportCanvas.height = 0;
  }
}
