import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getRecorderTransition, type RecorderState } from './recorder';

describe('recorder state transitions', () => {
  it('starts from idle or stopped', () => {
    assert.equal(getRecorderTransition('idle', 'start'), 'recording');
    assert.equal(getRecorderTransition('stopped', 'start'), 'recording');
  });

  it('pauses and resumes active recording', () => {
    assert.equal(getRecorderTransition('recording', 'pause'), 'paused');
    assert.equal(getRecorderTransition('paused', 'resume'), 'recording');
  });

  it('stops recording or paused sessions', () => {
    assert.equal(getRecorderTransition('recording', 'stop'), 'stopped');
    assert.equal(getRecorderTransition('paused', 'stop'), 'stopped');
  });

  it('keeps invalid transitions unchanged', () => {
    const states: RecorderState[] = ['idle', 'recording', 'paused', 'stopped'];
    assert.deepEqual(states.map((state) => getRecorderTransition(state, 'resume')), ['idle', 'recording', 'recording', 'stopped']);
    assert.equal(getRecorderTransition('idle', 'pause'), 'idle');
  });
});
