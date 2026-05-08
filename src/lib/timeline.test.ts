import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addKeyframe,
  deleteClip,
  getActiveClipsAtTime,
  getEnabledClipSegments,
  interpolateAssetTransform,
  interpolateCameraTransform,
  removeKeyframe,
  sortKeyframes,
  splitClipAtTime,
  trimClipEnd,
  trimClipStart,
  updateKeyframe,
  type TimelineClip,
  type TimelineKeyframe,
} from './timeline';

const assetKeyframe = (id: string, time: number, x: number, rpm = 0): TimelineKeyframe => ({
  id,
  time,
  targetType: 'asset',
  targetId: 'asset-1',
  transform: {
    position: { x, y: x * 2, z: 0 },
    rotation: { x: 0, y: x, z: 0 },
    scale: 1 + x,
    spin: { enabled: rpm > 0, axis: 'y', rpm },
  },
});

const cameraKeyframe = (id: string, time: number, x: number): TimelineKeyframe => ({
  id,
  time,
  targetType: 'camera',
  targetId: 'camera',
  transform: {
    cameraPosition: { x, y: x + 1, z: x + 2 },
    cameraTarget: { x: x * 2, y: 0, z: 0 },
  },
});

describe('timeline keyframes', () => {
  it('sorts keyframes by time without mutating the source array', () => {
    const input = [assetKeyframe('late', 2, 2), assetKeyframe('early', 0, 0)];
    const sorted = sortKeyframes(input);
    assert.deepEqual(sorted.map((item) => item.id), ['early', 'late']);
    assert.deepEqual(input.map((item) => item.id), ['late', 'early']);
  });

  it('adds, updates, and removes keyframes by id', () => {
    const first = assetKeyframe('a', 2, 2);
    const second = assetKeyframe('b', 1, 1);
    const added = addKeyframe([first], second);
    assert.deepEqual(added.map((item) => item.id), ['b', 'a']);

    const updated = updateKeyframe(added, 'a', { time: 0.5 });
    assert.equal(updated.find((item) => item.id === 'a')?.time, 0.5);

    const removed = removeKeyframe(updated, 'b');
    assert.deepEqual(removed.map((item) => item.id), ['a']);
  });
});

describe('timeline interpolation', () => {
  it('linearly interpolates asset transforms between neighboring keyframes', () => {
    const result = interpolateAssetTransform([assetKeyframe('a', 0, 0, 0), assetKeyframe('b', 10, 10, 60)], 'asset-1', 5);
    assert.deepEqual(result?.position, { x: 5, y: 10, z: 0 });
    assert.deepEqual(result?.rotation, { x: 0, y: 5, z: 0 });
    assert.equal(result?.scale, 6);
    assert.deepEqual(result?.spin, { enabled: true, axis: 'y', rpm: 30 });
  });

  it('clamps asset interpolation before first and after last keyframes', () => {
    const keyframes = [assetKeyframe('a', 2, 2), assetKeyframe('b', 4, 4)];
    assert.equal(interpolateAssetTransform(keyframes, 'asset-1', 0)?.position.x, 2);
    assert.equal(interpolateAssetTransform(keyframes, 'asset-1', 99)?.position.x, 4);
  });

  it('linearly interpolates camera position and target', () => {
    const result = interpolateCameraTransform([cameraKeyframe('a', 0, 0), cameraKeyframe('b', 10, 10)], 2.5);
    assert.deepEqual(result?.cameraPosition, { x: 2.5, y: 3.5, z: 4.5 });
    assert.deepEqual(result?.cameraTarget, { x: 5, y: 0, z: 0 });
  });
});

describe('timeline clips', () => {
  const clips: TimelineClip[] = [{ id: 'clip-a', name: 'A', start: 0, end: 10, enabled: true }];

  it('splits an active clip at the playhead', () => {
    const split = splitClipAtTime(clips, 4);
    assert.deepEqual(split.map((clip) => [clip.name, clip.start, clip.end, clip.enabled]), [
      ['A', 0, 4, true],
      ['A cut', 4, 10, true],
    ]);
  });

  it('does not split at clip boundaries', () => {
    assert.equal(splitClipAtTime(clips, 0).length, 1);
    assert.equal(splitClipAtTime(clips, 10).length, 1);
  });

  it('trims clip start and end to the playhead', () => {
    assert.deepEqual(trimClipStart(clips, 'clip-a', 3)[0], { id: 'clip-a', name: 'A', start: 3, end: 10, enabled: true });
    assert.deepEqual(trimClipEnd(clips, 'clip-a', 7)[0], { id: 'clip-a', name: 'A', start: 0, end: 7, enabled: true });
  });

  it('disables clips instead of editing finished video bytes', () => {
    assert.equal(deleteClip(clips, 'clip-a')[0].enabled, false);
  });

  it('returns active enabled clips at time and ordered enabled segments', () => {
    const mixed: TimelineClip[] = [
      { id: 'off', name: 'Off', start: 0, end: 2, enabled: false },
      { id: 'late', name: 'Late', start: 6, end: 8, enabled: true },
      { id: 'early', name: 'Early', start: 1, end: 5, enabled: true },
    ];
    assert.deepEqual(getActiveClipsAtTime(mixed, 3).map((clip) => clip.id), ['early']);
    assert.deepEqual(getEnabledClipSegments(mixed).map((clip) => clip.id), ['early', 'late']);
  });
});
