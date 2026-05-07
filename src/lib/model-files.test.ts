import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatBytes, getModelKind, isSupportedModelFile } from './model-files';

describe('model file helpers', () => {
  it('detects common browser-loadable 3D formats', () => {
    assert.equal(getModelKind('gear.STL'), 'stl');
    assert.equal(getModelKind('set.obj'), 'obj');
    assert.equal(getModelKind('scene.gltf'), 'gltf');
    assert.equal(getModelKind('loop.glb'), 'glb');
  });

  it('rejects unknown formats', () => {
    assert.equal(getModelKind('notes.txt'), null);
    assert.equal(isSupportedModelFile('clip.mp4'), false);
  });

  it('formats upload sizes for UI status copy', () => {
    assert.equal(formatBytes(512), '512 B');
    assert.equal(formatBytes(1536), '1.5 KB');
    assert.equal(formatBytes(1048576), '1.0 MB');
  });
});
