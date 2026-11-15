import { ExportFormat } from './creditsEngine';

export interface SegmentedWriteBlock {
  blockIndex: number;
  data: Uint8Array;
}

/**
 * Memory-safe segmented byte store for Mp4Muxer / WebMMuxer StreamTarget.
 * Avoids ArrayBufferTarget's 2x doubling reallocations and final full-file .slice() copy,
 * while supporting random-access front-patching (e.g. MP4 fastStart moov atom at offset 0).
 */
export class SegmentedBlobStore {
  public readonly blockSize: number;
  private blocks = new Map<number, Uint8Array>();
  private maxByteLength = 0;

  constructor(blockSize = 512 * 1024) {
    this.blockSize = Math.max(4096, blockSize);
  }

  public write(data: Uint8Array, position: number): void {
    if (!data || data.byteLength === 0 || position < 0) return;

    let srcOffset = 0;
    let remaining = data.byteLength;
    let cursor = position;

    while (remaining > 0) {
      const blockIndex = Math.floor(cursor / this.blockSize);
      const offsetInBlock = cursor % this.blockSize;
      const bytesToCopy = Math.min(remaining, this.blockSize - offsetInBlock);

      let block = this.blocks.get(blockIndex);
      if (!block) {
        block = new Uint8Array(this.blockSize);
        this.blocks.set(blockIndex, block);
      }

      block.set(data.subarray(srcOffset, srcOffset + bytesToCopy), offsetInBlock);

      srcOffset += bytesToCopy;
      remaining -= bytesToCopy;
      cursor += bytesToCopy;
    }

    if (cursor > this.maxByteLength) {
      this.maxByteLength = cursor;
    }
  }

  public get byteLength(): number {
    return this.maxByteLength;
  }

  public toBlob(mimeType: string): Blob {
    if (this.maxByteLength === 0) {
      return new Blob([], { type: mimeType });
    }

    const totalBlocks = Math.ceil(this.maxByteLength / this.blockSize);
    const parts: BlobPart[] = [];

    for (let i = 0; i < totalBlocks; i++) {
      const isLast = i === totalBlocks - 1;
      const validLength = isLast
        ? this.maxByteLength - i * this.blockSize
        : this.blockSize;
      const block = this.blocks.get(i);
      if (block) {
        const view = validLength === block.byteLength ? block : block.subarray(0, validLength);
        parts.push(view as unknown as BlobPart);
      } else {
        parts.push(new Uint8Array(validLength));
      }
    }

    return new Blob(parts, { type: mimeType });
  }

  public clear(): void {
    this.blocks.clear();
    this.maxByteLength = 0;
  }
}

export interface VideoEncoderCandidate {
  encoderConfig: VideoEncoderConfig;
  muxerCodec: string;
  targetFormat: ExportFormat;
}

/**
 * Generates an ordered list of WebCodecs VideoEncoderConfig candidates for a target resolution & format.
 * Prioritizes profiles/levels compatible with mobile hardware + software encoders and avoids strict flags
 * that cause Android MediaCodec / VideoToolbox configure() failures at 1080p and 4K.
 */
export function buildWebCodecsVideoCandidates(
  format: ExportFormat,
  width: number,
  height: number,
  bitrate: number,
  fps: number,
  forceSoftware = false
): VideoEncoderCandidate[] {
  const pixelCount = width * height;
  const avcCodecs =
    pixelCount > 1920 * 1080
      ? [
          'avc1.4d0033',
          'avc1.640033',
          'avc1.640034',
          'avc1.4d0034',
          'avc1.420033',
          'avc1.42E033',
          'avc1.4d0032',
          'avc1.640032',
        ]
      : pixelCount > 1280 * 720
        ? [
            'avc1.4d002a',
            'avc1.64002a',
            'avc1.42002a',
            'avc1.42E028',
            'avc1.4d0028',
            'avc1.640028',
            'avc1.4d001f',
          ]
        : ['avc1.4d001f', 'avc1.42001f', 'avc1.42E01E', 'avc1.64001f'];

  const rawCodecs =
    format === 'mp4'
      ? avcCodecs.map((codec) => ({ codec, muxerCodec: 'avc', targetFormat: 'mp4' as ExportFormat }))
      : [
          { codec: 'vp09.00.10.08', muxerCodec: 'V_VP9', targetFormat: 'webm' as ExportFormat },
          { codec: 'vp8', muxerCodec: 'V_VP8', targetFormat: 'webm' as ExportFormat },
        ];

  const hwMode: HardwareAcceleration = forceSoftware ? 'prefer-software' : 'no-preference';
  const candidates: VideoEncoderCandidate[] = [];

  for (const item of rawCodecs) {
    // Variable / unconstrained basic config works best at 4K/1080p on mobile MediaCodec;
    // try constant+realtime first only at <=1080p when not in software fallback
    if (pixelCount <= 1920 * 1080 && !forceSoftware) {
      candidates.push({
        encoderConfig: {
          codec: item.codec,
          width,
          height,
          bitrate,
          framerate: fps,
          bitrateMode: 'constant',
          latencyMode: 'realtime',
          hardwareAcceleration: hwMode,
        },
        muxerCodec: item.muxerCodec,
        targetFormat: item.targetFormat,
      });
    }

    candidates.push({
      encoderConfig: {
        codec: item.codec,
        width,
        height,
        bitrate,
        framerate: fps,
        bitrateMode: 'variable',
        latencyMode: 'realtime',
        hardwareAcceleration: hwMode,
      },
      muxerCodec: item.muxerCodec,
      targetFormat: item.targetFormat,
    });

    candidates.push({
      encoderConfig: {
        codec: item.codec,
        width,
        height,
        bitrate,
        framerate: fps,
        hardwareAcceleration: hwMode,
      },
      muxerCodec: item.muxerCodec,
      targetFormat: item.targetFormat,
    });
  }

  return candidates;
}

export interface ResolutionAttempt {
  width: number;
  height: number;
  bitrate: number;
  isStepDown: boolean;
}

/**
 * Computes progressive WebCodecs resolution fallback steps so a 4K hardware/codec rejection
 * steps down cleanly to Full HD 1080p or 720p inside WebCodecs instead of crashing in MediaRecorder.
 */
export function getWebCodecsResolutionAttempts(
  width: number,
  height: number,
  bitrate: number
): ResolutionAttempt[] {
  const attempts: ResolutionAttempt[] = [{ width, height, bitrate, isStepDown: false }];
  const maxDim = Math.max(width, height);
  const minDim = Math.min(width, height);

  const scaleToShortEdge = (targetShort: number): { w: number; h: number } => {
    const ratio = targetShort / minDim;
    const rawW = Math.round(width * ratio);
    const rawH = Math.round(height * ratio);
    return {
      w: rawW % 2 === 0 ? rawW : rawW + 1,
      h: rawH % 2 === 0 ? rawH : rawH + 1,
    };
  };

  if (maxDim > 1920 || minDim > 1080) {
    const hd = scaleToShortEdge(1080);
    attempts.push({
      width: hd.w,
      height: hd.h,
      bitrate: Math.round(bitrate * 0.48),
      isStepDown: true,
    });
  }

  if (maxDim > 1280 || minDim > 720) {
    const sd = scaleToShortEdge(720);
    attempts.push({
      width: sd.w,
      height: sd.h,
      bitrate: Math.round(bitrate * 0.28),
      isStepDown: true,
    });
  }

  return attempts;
}

/**
 * Safely caps dimensions & FPS for legacy MediaRecorder fallback ("Mode compatibilité")
 * so mobile browsers never hit OOM crashes trying to captureStream() 1080p or 4K canvases.
 */
export function capMediaRecorderSettings(
  width: number,
  height: number,
  fps: number,
  bitrate: number
): { width: number; height: number; fps: number; bitrate: number } {
  const maxLongEdge = 1280;
  const longEdge = Math.max(width, height);
  const scale = longEdge > maxLongEdge ? maxLongEdge / longEdge : 1;

  const rawW = Math.max(2, Math.round(width * scale));
  const rawH = Math.max(2, Math.round(height * scale));
  const safeW = rawW % 2 === 0 ? rawW : rawW - 1;
  const safeH = rawH % 2 === 0 ? rawH : rawH - 1;
  const safeFps = Math.min(fps, 24);
  const safeBitrate = Math.min(bitrate, 2_200_000);

  return {
    width: safeW,
    height: safeH,
    fps: safeFps,
    bitrate: safeBitrate,
  };
}
