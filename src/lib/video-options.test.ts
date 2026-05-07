import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { clampFps, getResolutionPreset, secondsToFrameCount } from './video-options';

describe('video export options', () => {
  it('falls back to the first resolution for unknown labels', () => {
    assert.equal(getResolutionPreset('cinema moon').label, 'Square 720');
  });

  it('clamps fps values to a browser-safe positive range', () => {
    assert.equal(clampFps(-10), 1);
    assert.equal(clampFps(29.6), 30);
    assert.equal(clampFps(999), 120);
  });

  it('converts seconds and fps into a deterministic frame count', () => {
    assert.equal(secondsToFrameCount(2.5, 24), 60);
  });
});
