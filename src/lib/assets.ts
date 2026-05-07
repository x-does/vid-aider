export type Axis = 'x' | 'y' | 'z';
export type AssetControlMode = 'selected' | 'all' | 'group';
export type ModelKind = 'stl' | 'obj' | 'gltf' | 'glb' | 'demo';

export type StudioTransform = {
  position: { x: number; y: number; z: number };
  baseRotation: { x: number; y: number; z: number };
  spinRotation: { x: number; y: number; z: number };
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
  baseRotation?: Partial<StudioTransform['baseRotation']>;
  spinRotation?: Partial<StudioTransform['spinRotation']>;
  scale?: number;
};

const defaultTransform: StudioTransform = {
  position: { x: 0, y: 0, z: 0 },
  baseRotation: { x: 0, y: 0, z: 0 },
  spinRotation: { x: 0, y: 0, z: 0 },
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
        baseRotation: { ...asset.transform.baseRotation, ...input.patch.baseRotation },
        spinRotation: { ...asset.transform.spinRotation, ...input.patch.spinRotation },
        scale: input.patch.scale ?? asset.transform.scale,
      },
    };
  });
}

export function advanceSpinForAssets(assets: StudioAsset[], deltaSeconds: number): StudioAsset[] {
  if (deltaSeconds <= 0) return assets;
  return assets.map((asset) => {
    if (!asset.visible || !asset.spin.enabled || asset.spin.rpm <= 0) return asset;
    const radians = (asset.spin.rpm * Math.PI * 2 * deltaSeconds) / 60;
    return {
      ...asset,
      transform: {
        ...asset.transform,
        spinRotation: {
          ...asset.transform.spinRotation,
          [asset.spin.axis]: asset.transform.spinRotation[asset.spin.axis] + radians,
        },
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
