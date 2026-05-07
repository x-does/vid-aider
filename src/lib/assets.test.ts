import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyTransformToTargets,
  createAssetRecord,
  getTargetAssetIds,
  toggleAssetVisibility,
  type AssetControlMode,
  type StudioAsset,
} from './assets';

const sampleAssets: StudioAsset[] = [
  createAssetRecord({ id: 'a', name: 'robot.stl', kind: 'stl', size: 1024 }),
  createAssetRecord({ id: 'b', name: 'logo.obj', kind: 'obj', size: 2048 }),
  createAssetRecord({ id: 'c', name: 'scene.glb', kind: 'glb', size: 4096, group: 'hero' }),
];

describe('multi-asset studio helpers', () => {
  it('creates compact controllable asset records with sensible defaults', () => {
    const asset = createAssetRecord({ id: 'mesh-1', name: 'gear.stl', kind: 'stl', size: 1536 });

    assert.equal(asset.id, 'mesh-1');
    assert.equal(asset.name, 'gear.stl');
    assert.equal(asset.group, 'stl');
    assert.equal(asset.visible, true);
    assert.deepEqual(asset.transform.position, { x: 0, y: 0, z: 0 });
    assert.deepEqual(asset.spin, { enabled: true, axis: 'y', rpm: 8 });
  });

  it('resolves selected, all, and group control targets', () => {
    assert.deepEqual(getTargetAssetIds(sampleAssets, 'selected', 'b', 'stl'), ['b']);
    assert.deepEqual(getTargetAssetIds(sampleAssets, 'all', 'b', 'stl'), ['a', 'b', 'c']);
    assert.deepEqual(getTargetAssetIds(sampleAssets, 'group', 'b', 'stl'), ['a']);
  });

  it('applies transform patches only to the requested control target mixture', () => {
    const updated = applyTransformToTargets(sampleAssets, {
      mode: 'group' as AssetControlMode,
      selectedId: 'c',
      group: 'hero',
      patch: { scale: 1.8, position: { y: 0.4 } },
    });

    assert.equal(updated.find((asset) => asset.id === 'a')?.transform.scale, 1);
    assert.equal(updated.find((asset) => asset.id === 'c')?.transform.scale, 1.8);
    assert.equal(updated.find((asset) => asset.id === 'c')?.transform.position.y, 0.4);
  });

  it('toggles asset visibility without mutating other assets', () => {
    const updated = toggleAssetVisibility(sampleAssets, 'b');

    assert.equal(updated.find((asset) => asset.id === 'a')?.visible, true);
    assert.equal(updated.find((asset) => asset.id === 'b')?.visible, false);
  });
});
