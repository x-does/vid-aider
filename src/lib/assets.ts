export type Axis = 'x' | 'y' | 'z';
export type AssetControlMode = 'selected' | 'all' | 'group';
export type ModelKind = 'stl' | 'obj' | 'gltf' | 'glb' | 'demo';

export type StudioTransform = {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: number;
};

export type StudioSpin = {
  enabled: boolean;
  axis: Axis;
  rpm: number;
};

export type StudioAsset = {
  id: string;
  name: string;
  kind: ModelKind;
  size: number;
  group: string;
  visible: boolean;
  selected: boolean;
  transform: StudioTransform;
  spin: StudioSpin;
};

export type CreateAssetInput = {
  id: string;
  name: string;
  kind: ModelKind;
  size: number;
  group?: string;
  selected?: boolean;
};

export type TransformPatch = {
  position?: Partial<StudioTransform['position']>;
  rotation?: Partial<StudioTransform['rotation']>;
  scale?: number;
};

const defaultTransform: StudioTransform = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: 1,
};

export function createAssetRecord(input: CreateAssetInput): StudioAsset {
  return {
    id: input.id,
    name: input.name,
    kind: input.kind,
    size: input.size,
    group: input.group ?? input.kind,
    visible: true,
    selected: input.selected ?? false,
    transform: structuredClone(defaultTransform),
    spin: { enabled: true, axis: 'y', rpm: 8 },
  };
}

export function getTargetAssetIds(
  assets: StudioAsset[],
  mode: AssetControlMode,
  selectedId: string | null,
  group: string | null,
): string[] {
  if (mode === 'all') return assets.map((asset) => asset.id);
  if (mode === 'group') return assets.filter((asset) => asset.group === group).map((asset) => asset.id);
  return selectedId ? assets.filter((asset) => asset.id === selectedId).map((asset) => asset.id) : [];
}

export function applyTransformToTargets(
  assets: StudioAsset[],
  input: {
    mode: AssetControlMode;
    selectedId: string | null;
    group: string | null;
    patch: TransformPatch;
  },
): StudioAsset[] {
  const targets = new Set(getTargetAssetIds(assets, input.mode, input.selectedId, input.group));
  return assets.map((asset) => {
    if (!targets.has(asset.id)) return asset;
    return {
      ...asset,
      transform: {
        position: { ...asset.transform.position, ...input.patch.position },
        rotation: { ...asset.transform.rotation, ...input.patch.rotation },
        scale: input.patch.scale ?? asset.transform.scale,
      },
    };
  });
}

export function applySpinToTargets(
  assets: StudioAsset[],
  input: {
    mode: AssetControlMode;
    selectedId: string | null;
    group: string | null;
    patch: Partial<StudioSpin>;
  },
): StudioAsset[] {
  const targets = new Set(getTargetAssetIds(assets, input.mode, input.selectedId, input.group));
  return assets.map((asset) => (targets.has(asset.id) ? { ...asset, spin: { ...asset.spin, ...input.patch } } : asset));
}

export function toggleAssetVisibility(assets: StudioAsset[], id: string): StudioAsset[] {
  return assets.map((asset) => (asset.id === id ? { ...asset, visible: !asset.visible } : asset));
}

export function selectAsset(assets: StudioAsset[], id: string): StudioAsset[] {
  return assets.map((asset) => ({ ...asset, selected: asset.id === id }));
}

export function uniqueGroups(assets: StudioAsset[]): string[] {
  return [...new Set(assets.map((asset) => asset.group))].sort();
}
