export type SupportedModelKind = 'stl' | 'obj' | 'gltf' | 'glb';

const extensionToKind: Record<string, SupportedModelKind> = {
  stl: 'stl',
  obj: 'obj',
  gltf: 'gltf',
  glb: 'glb',
};

export function getModelKind(fileName: string): SupportedModelKind | null {
  const normalized = fileName.trim().toLowerCase();
  const extension = normalized.split('.').pop() ?? '';
  return extensionToKind[extension] ?? null;
}

export function isSupportedModelFile(fileName: string): boolean {
  return getModelKind(fileName) !== null;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  for (const unit of units) {
    if (value < 1024) return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`;
    value /= 1024;
  }
  return `${value.toFixed(1)} TB`;
}
