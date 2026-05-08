export type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped';
export type RecorderAction = 'start' | 'pause' | 'resume' | 'stop';

export function getRecorderTransition(state: RecorderState, action: RecorderAction): RecorderState {
  if (action === 'start' && (state === 'idle' || state === 'stopped')) return 'recording';
  if (action === 'pause' && state === 'recording') return 'paused';
  if (action === 'resume' && state === 'paused') return 'recording';
  if (action === 'stop' && (state === 'recording' || state === 'paused')) return 'stopped';
  return state;
}

export function canDownloadRecording(state: RecorderState, hasBlob: boolean): boolean {
  return hasBlob && (state === 'stopped' || state === 'idle');
}
