import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SegmentedBlobStore,
  buildWebCodecsVideoCandidates,
  getWebCodecsResolutionAttempts,
  capMediaRecorderSettings,
} from './exportMemory';

test('SegmentedBlobStore writes across blocks and supports front-patching moov header', async () => {
  const store = new SegmentedBlobStore(4096);

  // Reserve front 128 bytes and write payload across a 4096-byte block boundary
  const payload = new Uint8Array(5000);
  for (let i = 0; i < payload.length; i++) {
    payload[i] = (i * 7) % 251;
  }
  store.write(payload, 128);

  // Patch header at offset 0 (like mp4-muxer fastStart finalizing moov)
  const header = new Uint8Array([0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]);
  store.write(header, 0);

  assert.equal(store.byteLength, 5128);

  const blob = store.toBlob('video/mp4');
  assert.equal(blob.size, 5128);

  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.deepEqual(Array.from(bytes.slice(0, 8)), Array.from(header));
  assert.equal(bytes[128], payload[0]);
  assert.equal(bytes[128 + 4095], payload[4095]);
  assert.equal(bytes[5127], payload[4999]);

  store.clear();
  assert.equal(store.byteLength, 0);
});

test('buildWebCodecsVideoCandidates provides resilient 4K/1080p MP4 and WebM fallback candidates', () => {
  const mp4_4k = buildWebCodecsVideoCandidates('mp4', 2160, 3840, 4_000_000, 24, false);
  assert.ok(mp4_4k.length >= 8);
  assert.equal(mp4_4k[0].targetFormat, 'mp4');
  assert.equal(mp4_4k[0].muxerCodec, 'avc');
  // 4K skips strict CBR ('constant') first to avoid mobile MediaCodec configure errors
  assert.notEqual(mp4_4k[0].encoderConfig.bitrateMode, 'constant');

  const webm_1080 = buildWebCodecsVideoCandidates('webm', 1080, 1920, 1_000_000, 30, false);
  assert.ok(webm_1080.some((c) => c.muxerCodec === 'V_VP9'));
  assert.ok(webm_1080.some((c) => c.muxerCodec === 'V_VP8'));
});

test('getWebCodecsResolutionAttempts produces progressive 4K -> 1080p -> 720p step-downs with even dimensions', () => {
  const attempts = getWebCodecsResolutionAttempts(2160, 3840, 4_000_000);
  assert.equal(attempts.length, 3);
  assert.deepEqual(
    attempts.map((a) => [a.width, a.height, a.isStepDown]),
    [
      [2160, 3840, false],
      [1080, 1920, true],
      [720, 1280, true],
    ]
  );

  const hdAttempts = getWebCodecsResolutionAttempts(720, 1280, 400_000);
  assert.equal(hdAttempts.length, 1);
  assert.equal(hdAttempts[0].isStepDown, false);
});

test('capMediaRecorderSettings keeps compatibility fallback within safe mobile memory bounds', () => {
  const capped4k = capMediaRecorderSettings(2160, 3840, 60, 5_000_000);
  assert.ok(Math.max(capped4k.width, capped4k.height) <= 1280);
  assert.equal(capped4k.width % 2, 0);
  assert.equal(capped4k.height % 2, 0);
  assert.ok(capped4k.fps <= 24);
  assert.ok(capped4k.bitrate <= 2_200_000);
});
