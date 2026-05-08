'use client';

import type { RecorderState } from '@/lib/recorder';

type Props = {
  state: RecorderState;
  canDownload: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onDownload: () => void;
};

export function RecordingControls({ state, canDownload, onStart, onPause, onResume, onStop, onDownload }: Props) {
  return (
    <div className="rounded-3xl border border-[#7f6b9d]/16 bg-[#0b0811]/35 p-4" id="recording-controls">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#f3edff]">Recording</h3>
          <p className="text-xs text-[#9f91ba]">State: {state}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[0.65rem] uppercase tracking-[0.14em] ${state === 'recording' ? 'bg-red-500/15 text-red-200' : 'bg-[#7f6b9d]/14 text-[#b9accf]'}`}>
          {state === 'recording' ? 'REC' : state}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <button type="button" onClick={onStart} disabled={state === 'recording' || state === 'paused'} className="rounded-xl border border-[#c6a8ff]/30 bg-[#c6a8ff]/10 px-3 py-2 text-[#f3edff] disabled:cursor-not-allowed disabled:opacity-40">Start recording</button>
        <button type="button" onClick={onPause} disabled={state !== 'recording'} className="rounded-xl border border-[#7f6b9d]/18 px-3 py-2 text-[#cfc3e6] disabled:cursor-not-allowed disabled:opacity-40">Pause recording</button>
        <button type="button" onClick={onResume} disabled={state !== 'paused'} className="rounded-xl border border-[#7f6b9d]/18 px-3 py-2 text-[#cfc3e6] disabled:cursor-not-allowed disabled:opacity-40">Resume recording</button>
        <button type="button" onClick={onStop} disabled={state !== 'recording' && state !== 'paused'} className="rounded-xl border border-[#7f6b9d]/18 px-3 py-2 text-[#cfc3e6] disabled:cursor-not-allowed disabled:opacity-40">Stop recording</button>
        <button type="button" onClick={onDownload} disabled={!canDownload} className="col-span-2 rounded-xl border border-[#c6a8ff]/30 bg-[#c6a8ff]/10 px-3 py-2 text-[#f3edff] disabled:cursor-not-allowed disabled:opacity-40">Download WebM</button>
      </div>
    </div>
  );
}
