import * as Mp4Muxer from 'mp4-muxer';
import * as WebMMuxer from 'webm-muxer';
import { AudioConfig } from '../types';
import { ExportFormat } from './creditsEngine';
import { globalAudioEngine, prepareOfflineAudio, PreparedOfflineAudio } from './audioSynth';

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

async function pickWebCodecsVideoConfig(
  format: ExportFormat,
  width: number,
  height: number,
  bitrate: number,
  fps: number,
  forceSoftware = false
): Promise<{
  encoderConfig: VideoEncoderConfig;
  muxerCodec: string;
  targetFormat: ExportFormat;
} | null> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    return null;
  }

  const pixelCount = width * height;
  // Main Profile (CABAC) first for ~25-35% tighter compression than Baseline CAVLC, while realtime mode prevents B-frame stalls
  const avcCandidates =
    pixelCount > 1920 * 1080
      ? ['avc1.4d0033', 'avc1.640033', 'avc1.420033', 'avc1.640034']
      : pixelCount > 1280 * 720
        ? ['avc1.4d002a', 'avc1.42002a', 'avc1.64002a', 'avc1.4d001f']
        : ['avc1.4d001f', 'avc1.42001f', 'avc1.42E01E', 'avc1.64001f'];

  const candidates =
    format === 'mp4'
      ? avcCandidates.map((c) => ({ codec: c, muxerCodec: 'avc', fmt: 'mp4' as ExportFormat }))
      : [
          { codec: 'vp09.00.10.08', muxerCodec: 'V_VP9', fmt: 'webm' as ExportFormat },
          { codec: 'vp8', muxerCodec: 'V_VP8', fmt: 'webm' as ExportFormat },
        ];

  const hwMode: HardwareAcceleration = forceSoftware ? 'prefer-software' : 'no-preference';

  for (const item of candidates) {
    // Try CBR ('constant') first so mobile MediaCodec/VideoToolbox encoders strictly obey target bitrate instead of overshooting 2x
    for (const mode of ['constant', 'variable'] as BitrateMode[]) {
      const realtimeConfig: VideoEncoderConfig = {
        codec: item.codec,
        width,
        height,
        bitrate,
        framerate: fps,
        bitrateMode: mode,
        latencyMode: 'realtime',
        hardwareAcceleration: hwMode,
      };
      try {
        const support = await VideoEncoder.isConfigSupported(realtimeConfig);
        if (support.supported && support.config) {
          return {
            encoderConfig: support.config,
            muxerCodec: item.muxerCodec,
            targetFormat: item.fmt,
          };
        }
      } catch {
        // Try next bitrateMode / basic config
      }
    }

    const basicConfig: VideoEncoderConfig = {
      codec: item.codec,
      width,
      height,
      bitrate,
      framerate: fps,
      hardwareAcceleration: hwMode,
    };
    try {
      const support = await VideoEncoder.isConfigSupported(basicConfig);
      if (support.supported && support.config) {
        return {
          encoderConfig: support.config,
          muxerCodec: item.muxerCodec,
          targetFormat: item.fmt,
        };
      }
    } catch {
      // Try next candidate
    }
  }

  return null;
}

async function pickWebCodecsAudioConfig(
  format: ExportFormat,
  sampleRate: number,
  audioBitrate = 64_000
): Promise<{
  encoderConfig: AudioEncoderConfig;
  mp4Codec: 'aac' | 'opus';
  webmCodec: string;
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

  for (const item of codecs) {
    const cfg: AudioEncoderConfig = {
      codec: item.codec,
      sampleRate,
      numberOfChannels: 2,
      bitrate: audioBitrate,
    };
    try {
      const support = await AudioEncoder.isConfigSupported(cfg);
      if (support.supported && support.config) {
        return {
          encoderConfig: support.config,
          mp4Codec: item.mp4Codec,
          webmCodec: item.webmCodec,
        };
      }
    } catch {
      // Ignore unsupported candidate
    }
  }

  return null;
}

/**
 * Encodes canvas frames + fast-prepared audio via WebCodecs offline.
 * Includes a stall detector so hardware encoder hiccups fall back cleanly instead of hanging at 0%.
 */
async function exportWithWebCodecs(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  options: ExportVideoOptions,
  forceSoftware: boolean,
  preparedAudio: PreparedOfflineAudio | null,
  audioSelection: Awaited<ReturnType<typeof pickWebCodecsAudioConfig>>
): Promise<ExportVideoResult | null> {
  const fps = options.fps ?? 30;

  const videoSelection = await pickWebCodecsVideoConfig(
    options.format,
    options.width,
    options.height,
    options.bitrate,
    fps,
    forceSoftware
  );

  if (!videoSelection) {
    return null;
  }

  const exportStartMs = performance.now();
  const hasAudioTrack = Boolean(preparedAudio && audioSelection);
  const audioSampleRate = preparedAudio?.buffer.sampleRate ?? 48000;

  const mp4Target = videoSelection.targetFormat === 'mp4' ? new Mp4Muxer.ArrayBufferTarget() : null;
  const webmTarget = videoSelection.targetFormat === 'webm' ? new WebMMuxer.ArrayBufferTarget() : null;

  const mp4Muxer = mp4Target
    ? new Mp4Muxer.Muxer({
        target: mp4Target,
        video: {
          codec: videoSelection.muxerCodec as 'avc',
          width: options.width,
          height: options.height,
          frameRate: fps,
        },
        audio: hasAudioTrack
          ? {
              codec: audioSelection!.mp4Codec,
              numberOfChannels: 2,
              sampleRate: audioSampleRate,
            }
          : undefined,
        fastStart: 'in-memory',
        firstTimestampBehavior: 'offset',
      })
    : null;

  const webmMuxer = webmTarget
    ? new WebMMuxer.Muxer({
        target: webmTarget,
        video: {
          codec: videoSelection.muxerCodec,
          width: options.width,
          height: options.height,
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

  videoEncoder.configure(videoSelection.encoderConfig);

  let audioEncoder: AudioEncoder | null = null;
  if (hasAudioTrack && audioSelection) {
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
  }

  try {
    if (options.bgVideo) {
      options.bgVideo.pause();
    }

    const totalFrames = Math.max(1, Math.round(options.durationSec * fps));
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

      const timestampUs = frameIdx * frameDurationUs;
      const videoFrame = new VideoFrame(canvas, {
        timestamp: timestampUs,
        duration: frameDurationUs,
      });

      const isKeyFrame = frameIdx % keyFrameEvery === 0;
      videoEncoder.encode(videoFrame, { keyFrame: isKeyFrame });
      videoFrame.close();

      const nowMs = performance.now();
      if (frameIdx === 2 || frameIdx === 6 || nowMs - lastProgressUiMs >= 120 || frameIdx === totalFrames) {
        lastProgressUiMs = nowMs;
        const pct = Math.min(92, Math.max(5, Math.round(5 + (frameIdx / totalFrames) * 87)));
        options.onProgress(pct, Math.floor(frameTime), `Image ${Math.min(frameIdx + 1, totalFrames)} / ${totalFrames}`);
        await sleep(0);
      }

      // Let encoder worker thread work without main-thread busy-looping (with 4s stall guard)
      if (videoEncoder.encodeQueueSize >= 10) {
        const waitStartedMs = performance.now();
        while (videoEncoder.encodeQueueSize >= 10 && !options.signal.cancelled && !encoderError) {
          await sleep(4);
          if (performance.now() - Math.max(waitStartedMs, lastOutputTimeMs) > 4000) {
            throw new Error('VideoEncoder backpressure timeout');
          }
        }
      }
    }

    if (options.signal.cancelled) {
      try {
        if (videoEncoder.state !== 'closed') videoEncoder.close();
        if (audioEncoder && audioEncoder.state !== 'closed') audioEncoder.close();
      } catch {}
      throw new DOMException('Export cancelled', 'AbortError');
    }

    if (encoderError) {
      throw encoderError;
    }

    // Encode prepared audio buffer (looping seamlessly up to durationSec without duplicating huge buffers in RAM)
    if (audioEncoder && preparedAudio) {
      options.onProgress(93, Math.round(options.durationSec), 'Encodage audio...');
      await sleep(0);

      const { buffer, volume } = preparedAudio;
      const sampleRate = buffer.sampleRate;
      const srcLength = buffer.length;
      const totalTargetSamples = Math.max(1, Math.ceil(options.durationSec * sampleRate));
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

        audioEncoder.encode(audioData);
        audioData.close();

        while (audioEncoder.encodeQueueSize >= 16 && !options.signal.cancelled && !encoderError) {
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
    }

    options.onProgress(98, Math.round(options.durationSec), 'Finalisation...');
    await sleep(0);

    await videoEncoder.flush();
    videoEncoder.close();

    if (encoderError) {
      throw encoderError;
    }

    if (mp4Muxer && mp4Target) {
      mp4Muxer.finalize();
      const blob = new Blob([mp4Target.buffer], { type: 'video/mp4' });
      options.onProgress(100, Math.round(options.durationSec), 'Terminé');
      return {
        blob,
        format: 'mp4',
        renderDurationMs: Math.round(performance.now() - exportStartMs),
        usedFastEngine: true,
      };
    }

    if (webmMuxer && webmTarget) {
      webmMuxer.finalize();
      const blob = new Blob([webmTarget.buffer], { type: 'video/webm' });
      options.onProgress(100, Math.round(options.durationSec), 'Terminé');
      return {
        blob,
        format: 'webm',
        renderDurationMs: Math.round(performance.now() - exportStartMs),
        usedFastEngine: true,
      };
    }

    return null;
  } catch (err) {
    try {
      if (videoEncoder.state !== 'closed') videoEncoder.close();
      if (audioEncoder && audioEncoder.state !== 'closed') audioEncoder.close();
    } catch {}
    if ((err as Error)?.name === 'AbortError') {
      throw err;
    }
    return null;
  }
}

/**
 * Fallback real-time MediaRecorder exporter when WebCodecs isn't supported.
 */
async function exportWithMediaRecorder(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  options: ExportVideoOptions
): Promise<ExportVideoResult> {
  const exportStartMs = performance.now();
  const fps = options.fps ?? 30;
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
      videoBitsPerSecond: options.bitrate,
      audioBitsPerSecond: options.audioBitrate ?? 64_000,
    });
  } catch {
    recorder = new MediaRecorder(canvasStream, {
      videoBitsPerSecond: options.bitrate,
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

  recorder.start(1000);
  if (wantsAudio) {
    globalAudioEngine.play(0);
  }

  const totalFrames = Math.max(1, Math.round(options.durationSec * fps));
  const loopStartTime = performance.now();

  for (let frameIdx = 0; frameIdx <= totalFrames; frameIdx++) {
    if (options.signal.cancelled) break;

    const frameTime = Math.min(options.durationSec, frameIdx / fps);
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
    if (recorder.state !== 'inactive') {
      try { recorder.stop(); } catch {}
    }
    globalAudioEngine.stop();
    throw new DOMException('Export cancelled', 'AbortError');
  }

  await new Promise((r) => setTimeout(r, 150));
  if (recorder.state !== 'inactive') {
    try { recorder.stop(); } catch {}
  }
  globalAudioEngine.stop();

  const blob = await stopPromise;
  options.onProgress(100, Math.round(options.durationSec), 'Terminé');
  return {
    blob,
    format: ext,
    renderDurationMs: Math.round(performance.now() - exportStartMs),
    usedFastEngine: false,
  };
}

/**
 * Main video export entrypoint:
 * 1) Reports progress immediately (never stuck silently at 0%).
 * 2) Prepares audio in milliseconds (single synth cycle or decoded file).
 * 3) Encodes via WebCodecs (realtime latencyMode to prevent hardware B-frame stalls),
 *    retrying in software WebCodecs if hardware stalls, with MediaRecorder as final fallback.
 */
export async function exportVideo(options: ExportVideoOptions): Promise<ExportVideoResult> {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = options.width;
  exportCanvas.height = options.height;
  const ctx = exportCanvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('Impossible de créer le contexte graphique Canvas 2D.');
  }

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
    const sampleRate = 48000;
    audioSelection = await pickWebCodecsAudioConfig(
      options.format,
      sampleRate,
      options.audioBitrate ?? 64_000
    );
    if (audioSelection) {
      preparedAudio = await prepareOfflineAudio(options.audio, options.durationSec, sampleRate);
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

  if (canUseWebCodecsAudio) {
    // 1. Standard WebCodecs (auto/hardware without lookahead stall)
    const primaryResult = await exportWithWebCodecs(
      exportCanvas,
      ctx,
      options,
      false,
      preparedAudio,
      audioSelection
    );
    if (primaryResult) {
      return primaryResult;
    }

    if (options.signal.cancelled) {
      throw new DOMException('Export cancelled', 'AbortError');
    }

    // 2. Software WebCodecs retry if hardware stalled/rejected
    options.onProgress(2, 0, 'Relance encodeur...');
    const softwareResult = await exportWithWebCodecs(
      exportCanvas,
      ctx,
      options,
      true,
      preparedAudio,
      audioSelection
    );
    if (softwareResult) {
      return softwareResult;
    }
  }

  if (options.signal.cancelled) {
    throw new DOMException('Export cancelled', 'AbortError');
  }

  // 3. Legacy fallback
  return await exportWithMediaRecorder(exportCanvas, ctx, options);
}
