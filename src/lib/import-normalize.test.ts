import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getImportScale, getCameraFarPlane } from './import-normalize';

describe('3D import normalization', () => {
  it('scales very large CAD/STL models down to a viewport-safe target size', () => {
    assert.equal(getImportScale({ x: 1000, y: 500, z: 250 }, 2), 0.002);
  });

  it('scales tiny models up to a visible target size', () => {
    assert.equal(getImportScale({ x: 0.01, y: 0.02, z: 0.01 }, 2), 100);
  });

  it('uses safe defaults for empty or invalid bounds', () => {
    assert.equal(getImportScale({ x: 0, y: 0, z: 0 }, 2), 1);
    assert.equal(getImportScale({ x: Number.NaN, y: 1, z: 1 }, 2), 1);
  });

  it('keeps camera far plane beyond large framed objects', () => {
    assert.ok(getCameraFarPlane(1000) > 2400);
    assert.ok(getCameraFarPlane(2) >= 100);
  });
});
