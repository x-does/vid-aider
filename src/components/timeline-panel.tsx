'use client';

import type { TimelineClip, TimelineKeyframe, TimelineStage, TimelineState } from '@/lib/timeline';

const stageOptions: { value: TimelineStage; label: string; heading: string; copy: string }[] = [
  {
    value: 'object-motion',
    label: 'Stage 1: Object Motion',
    heading: 'Stage 1 — Set object movement',
    copy: 'Move, scale, rotate, and spin the object. Add keyframes to build motion.',
  },
  {
    value: 'camera-motion',
    label: 'Stage 2: Camera Motion',
    heading: 'Stage 2 — Set camera movement',
    copy: 'Orbit around the object and add camera keyframes after object motion is ready.',
  },
  {
    value: 'record',
    label: 'Stage 3: Record/Edit/Export',
    heading: 'Stage 3 — Record, edit, export',
    copy: 'Cut or trim enabled timeline sections, then record the preview path to WebM.',
  },
];

type Props = {
  timeline: TimelineState;
  selectedClipId: string | null;
  selectedKeyframeId: string | null;
  onStageChange: (stage: TimelineStage) => void;
  onPlayPause: () => void;
  onStop: () => void;
  onScrub: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onAddKeyframe: () => void;
  onCut: () => void;
  onDeleteSelected: () => void;
  onTrimStart: () => void;
  onTrimEnd: () => void;
  onSelectClip: (id: string) => void;
  onSelectKeyframe: (id: string) => void;
};

function fmt(seconds: number) {
  return `${seconds.toFixed(2)}s`;
}

function stageCta(stage: TimelineStage) {
  if (stage === 'object-motion') return 'Add object keyframe';
  if (stage === 'camera-motion') return 'Add camera keyframe';
  return 'Add keyframe';
}

export function TimelinePanel({
  timeline,
  selectedClipId,
  selectedKeyframeId,
  onStageChange,
  onPlayPause,
  onStop,
  onScrub,
  onDurationChange,
  onAddKeyframe,
  onCut,
  onDeleteSelected,
  onTrimStart,
  onTrimEnd,
  onSelectClip,
  onSelectKeyframe,
}: Props) {
  const stage = stageOptions.find((item) => item.value === timeline.stage) ?? stageOptions[0];
  const keyframes = [...timeline.keyframes].sort((a, b) => a.time - b.time);
  const clips = [...timeline.clips].sort((a, b) => a.start - b.start);

  return (
    <div className="space-y-4 rounded-3xl border border-[#7f6b9d]/16 bg-[#0b0811]/35 p-4" id="timeline">
      <div className="space-y-2">
        <label className="block text-xs text-[#9f91ba]">
          Stage selector
          <select value={timeline.stage} onChange={(event) => onStageChange(event.target.value as TimelineStage)} className="mt-1 w-full rounded-xl border border-[#7f6b9d]/20 bg-[#0b0811]/80 px-3 py-2 text-sm text-[#f3edff]">
            {stageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <div className="rounded-2xl border border-[#c6a8ff]/18 bg-[#c6a8ff]/8 p-3">
          <h3 className="text-sm font-semibold text-[#f3edff]">{stage.heading}</h3>
          <p className="mt-1 text-xs leading-5 text-[#b9accf]">{stage.copy}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onPlayPause} className="rounded-full border border-[#c6a8ff]/30 bg-[#c6a8ff]/10 px-3 py-1.5 text-sm text-[#f3edff]">
          {timeline.playing ? 'Pause preview' : 'Play preview'}
        </button>
        <button type="button" onClick={onStop} className="rounded-full border border-[#7f6b9d]/18 px-3 py-1.5 text-sm text-[#cfc3e6]">Stop preview</button>
        <span className="text-xs text-[#9f91ba]">{fmt(timeline.currentTime)} / {fmt(timeline.duration)}</span>
      </div>

      <label className="block text-xs text-[#9f91ba]">
        Scrubber
        <input className="va-slider mt-2 w-full" type="range" min="0" max={timeline.duration} step="0.01" value={timeline.currentTime} onChange={(event) => onScrub(Number(event.target.value))} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-[#9f91ba]">
          Duration
          <input type="number" min="1" max="120" step="0.5" value={timeline.duration} onChange={(event) => onDurationChange(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-[#7f6b9d]/20 bg-[#0b0811]/80 px-3 py-2 text-sm text-[#f3edff]" />
        </label>
        <button type="button" onClick={onAddKeyframe} className="mt-5 rounded-xl border border-[#c6a8ff]/30 bg-[#c6a8ff]/10 px-3 py-2 text-sm text-[#f3edff]">
          {stageCta(timeline.stage)}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <button type="button" onClick={onCut} className="rounded-xl border border-[#7f6b9d]/18 px-3 py-2 text-[#cfc3e6]">Cut at playhead</button>
        <button type="button" onClick={onDeleteSelected} className="rounded-xl border border-[#7f6b9d]/18 px-3 py-2 text-[#cfc3e6]">Delete selected</button>
        <button type="button" onClick={onTrimStart} className="rounded-xl border border-[#7f6b9d]/18 px-3 py-2 text-[#cfc3e6]">Trim start to playhead</button>
        <button type="button" onClick={onTrimEnd} className="rounded-xl border border-[#7f6b9d]/18 px-3 py-2 text-[#cfc3e6]">Trim end to playhead</button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <TimelineList title="Clips" empty="No clips" items={clips} selectedId={selectedClipId} onSelect={onSelectClip} render={(clip) => `${clip.enabled ? '●' : '○'} ${clip.name} · ${fmt(clip.start)}-${fmt(clip.end)}`} />
        <TimelineList title="Keyframes" empty="No keyframes" items={keyframes} selectedId={selectedKeyframeId} onSelect={onSelectKeyframe} render={(keyframe) => `${keyframe.targetType} · ${fmt(keyframe.time)}`} />
      </div>
    </div>
  );
}

function TimelineList<T extends TimelineClip | TimelineKeyframe>({
  title,
  empty,
  items,
  selectedId,
  onSelect,
  render,
}: {
  title: string;
  empty: string;
  items: T[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  render: (item: T) => string;
}) {
  return (
    <div className="rounded-2xl border border-[#7f6b9d]/14 bg-[#0b0811]/30 p-2">
      <div className="mb-2 text-[0.65rem] uppercase tracking-[0.16em] text-[#9f91ba]">{title}</div>
      <div className="max-h-28 space-y-1 overflow-auto">
        {items.length ? items.map((item) => (
          <button key={item.id} type="button" onClick={() => onSelect(item.id)} className={`block w-full rounded-lg px-2 py-1 text-left text-xs ${selectedId === item.id ? 'bg-[#c6a8ff]/14 text-[#f3edff]' : 'text-[#b9accf] hover:bg-[#7f6b9d]/10'}`}>
            {render(item)}
          </button>
        )) : <div className="px-2 py-1 text-xs text-[#8f82a8]">{empty}</div>}
      </div>
    </div>
  );
}
