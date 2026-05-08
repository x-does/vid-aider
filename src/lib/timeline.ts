import type { Axis } from './assets';

export type TimelineStage = 'object-motion' | 'camera-motion' | 'record';
export type Vec3 = { x: number; y: number; z: number };

export type TimelineAssetTransform = {
  position: Vec3;
  rotation: Vec3;
  scale: number;
  spin: { enabled: boolean; axis: Axis; rpm: number };
};

export type TimelineCameraTransform = {
  cameraPosition: Vec3;
  cameraTarget: Vec3;
};

export type TimelineTransform = Partial<TimelineAssetTransform & TimelineCameraTransform>;

export type TimelineKeyframe = {
  id: string;
  time: number;
  targetType: 'asset' | 'camera';
  targetId: string;
  transform: TimelineTransform;
};

export type TimelineClip = {
  id: string;
  name: string;
  start: number;
  end: number;
  enabled: boolean;
};

export type TimelineState = {
  duration: number;
  currentTime: number;
  playing: boolean;
  stage: TimelineStage;
  keyframes: TimelineKeyframe[];
  clips: TimelineClip[];
};

export function createDefaultTimeline(duration = 6): TimelineState {
  return {
    duration,
    currentTime: 0,
    playing: false,
    stage: 'object-motion',
    keyframes: [],
    clips: [{ id: 'clip-1', name: 'Full timeline', start: 0, end: duration, enabled: true }],
  };
}

export function sortKeyframes(keyframes: TimelineKeyframe[]): TimelineKeyframe[] {
  return [...keyframes].sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
}

export function addKeyframe(keyframes: TimelineKeyframe[], keyframe: TimelineKeyframe): TimelineKeyframe[] {
  return sortKeyframes([...keyframes.filter((item) => item.id !== keyframe.id), keyframe]);
}

export function removeKeyframe(keyframes: TimelineKeyframe[], id: string): TimelineKeyframe[] {
  return keyframes.filter((item) => item.id !== id);
}

export function updateKeyframe(
  keyframes: TimelineKeyframe[],
  id: string,
  patch: Partial<Omit<TimelineKeyframe, 'id'>>,
): TimelineKeyframe[] {
  return sortKeyframes(keyframes.map((item) => (item.id === id ? { ...item, ...patch } : item)));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
}

function neighboringKeyframes(keyframes: TimelineKeyframe[], time: number) {
  const sorted = sortKeyframes(keyframes);
  if (!sorted.length) return null;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (time <= first.time) return { before: first, after: first, amount: 0 };
  if (time >= last.time) return { before: last, after: last, amount: 0 };
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const before = sorted[index];
    const after = sorted[index + 1];
    if (time >= before.time && time <= after.time) {
      const span = after.time - before.time;
      return { before, after, amount: span <= 0 ? 0 : (time - before.time) / span };
    }
  }
  return { before: last, after: last, amount: 0 };
}

function asAssetTransform(keyframe: TimelineKeyframe): TimelineAssetTransform | null {
  const transform = keyframe.transform;
  if (!transform.position || !transform.rotation || transform.scale === undefined || !transform.spin) return null;
  return {
    position: transform.position,
    rotation: transform.rotation,
    scale: transform.scale,
    spin: transform.spin,
  };
}

function asCameraTransform(keyframe: TimelineKeyframe): TimelineCameraTransform | null {
  const transform = keyframe.transform;
  if (!transform.cameraPosition || !transform.cameraTarget) return null;
  return { cameraPosition: transform.cameraPosition, cameraTarget: transform.cameraTarget };
}

export function interpolateAssetTransform(
  keyframes: TimelineKeyframe[],
  targetId: string,
  time: number,
): TimelineAssetTransform | null {
  const neighbors = neighboringKeyframes(
    keyframes.filter((item) => item.targetType === 'asset' && item.targetId === targetId),
    time,
  );
  if (!neighbors) return null;
  const before = asAssetTransform(neighbors.before);
  const after = asAssetTransform(neighbors.after);
  if (!before || !after) return before ?? after;
  const amount = neighbors.amount;
  return {
    position: lerpVec3(before.position, after.position, amount),
    rotation: lerpVec3(before.rotation, after.rotation, amount),
    scale: lerp(before.scale, after.scale, amount),
    spin: {
      enabled: amount < 0.5 ? before.spin.enabled : after.spin.enabled,
      axis: amount < 0.5 ? before.spin.axis : after.spin.axis,
      rpm: lerp(before.spin.rpm, after.spin.rpm, amount),
    },
  };
}

export function interpolateCameraTransform(keyframes: TimelineKeyframe[], time: number): TimelineCameraTransform | null {
  const neighbors = neighboringKeyframes(
    keyframes.filter((item) => item.targetType === 'camera'),
    time,
  );
  if (!neighbors) return null;
  const before = asCameraTransform(neighbors.before);
  const after = asCameraTransform(neighbors.after);
  if (!before || !after) return before ?? after;
  return {
    cameraPosition: lerpVec3(before.cameraPosition, after.cameraPosition, neighbors.amount),
    cameraTarget: lerpVec3(before.cameraTarget, after.cameraTarget, neighbors.amount),
  };
}

export function splitClipAtTime(clips: TimelineClip[], time: number): TimelineClip[] {
  const next: TimelineClip[] = [];
  let didSplit = false;
  for (const clip of clips) {
    if (!didSplit && clip.enabled && time > clip.start && time < clip.end) {
      next.push({ ...clip, end: time });
      next.push({ ...clip, id: `${clip.id}-cut-${Math.round(time * 1000)}`, name: `${clip.name} cut`, start: time });
      didSplit = true;
    } else {
      next.push(clip);
    }
  }
  return sortClips(next);
}

function sortClips(clips: TimelineClip[]): TimelineClip[] {
  return [...clips].sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id));
}

export function trimClipStart(clips: TimelineClip[], id: string, time: number): TimelineClip[] {
  return sortClips(clips.map((clip) => (clip.id === id && time < clip.end ? { ...clip, start: Math.max(clip.start, time) } : clip)));
}

export function trimClipEnd(clips: TimelineClip[], id: string, time: number): TimelineClip[] {
  return sortClips(clips.map((clip) => (clip.id === id && time > clip.start ? { ...clip, end: Math.min(clip.end, time) } : clip)));
}

export function deleteClip(clips: TimelineClip[], id: string): TimelineClip[] {
  return clips.map((clip) => (clip.id === id ? { ...clip, enabled: false } : clip));
}

export function getActiveClipsAtTime(clips: TimelineClip[], time: number): TimelineClip[] {
  return sortClips(clips.filter((clip) => clip.enabled && time >= clip.start && time < clip.end));
}

export function getEnabledClipSegments(clips: TimelineClip[]): TimelineClip[] {
  return sortClips(clips.filter((clip) => clip.enabled && clip.end > clip.start));
}
