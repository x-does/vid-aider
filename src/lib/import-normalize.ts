export type BoundsSize = { x: number; y: number; z: number };

export function getLargestDimension(size: BoundsSize) {
  const dimensions = [size.x, size.y, size.z];
  if (dimensions.some((value) => !Number.isFinite(value))) return 0;
  return Math.max(...dimensions.map((value) => Math.abs(value)));
}

export function getImportScale(size: BoundsSize, targetSize = 2) {
  const largest = getLargestDimension(size);
  if (!largest || !Number.isFinite(largest) || largest <= 0) return 1;
  return targetSize / largest;
}

export function getCameraFarPlane(largestDimension: number) {
  if (!Number.isFinite(largestDimension) || largestDimension <= 0) return 100;
  return Math.max(100, largestDimension * 3);
}
