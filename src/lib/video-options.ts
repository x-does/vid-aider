export const resolutionPresets = [
  { label: 'Square 720', width: 720, height: 720 },
  { label: 'Shorts 1080x1920', width: 1080, height: 1920 },
  { label: 'HD 1920x1080', width: 1920, height: 1080 },
  { label: '4K 3840x2160', width: 3840, height: 2160 },
] as const;

export const fpsPresets = [24, 30, 60] as const;

export type ResolutionPreset = (typeof resolutionPresets)[number];
export type FpsPreset = (typeof fpsPresets)[number];

export function getResolutionPreset(label: string): ResolutionPreset {
  const preset = resolutionPresets.find((item) => item.label === label);
  return preset ?? resolutionPresets[0];
}

export function clampFps(value: number): number {
  if (!Number.isFinite(value)) return 30;
  return Math.min(120, Math.max(1, Math.round(value)));
}

export function secondsToFrameCount(seconds: number, fps: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.round(seconds * clampFps(fps));
}
