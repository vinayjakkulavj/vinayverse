import type { Vector3 } from 'three';

export type EclipseReading = { amount: number; occluder: string | null };

const clampUnit = (value: number) => Math.max(-1, Math.min(1, value));

/**
 * Fraction of a finite Sun's apparent disc hidden by a nearer spherical body,
 * as viewed from the receiving planet's centre. Angular discs give a continuous
 * penumbra, including partial eclipses, without an arbitrary alignment timer.
 */
export function eclipseCoverage(
  sun: Vector3,
  sunRadius: number,
  occluder: Vector3,
  occluderRadius: number,
  receiver: Vector3,
): number {
  const sx = sun.x - receiver.x;
  const sy = sun.y - receiver.y;
  const sz = sun.z - receiver.z;
  const ox = occluder.x - receiver.x;
  const oy = occluder.y - receiver.y;
  const oz = occluder.z - receiver.z;
  const sunDistance = Math.hypot(sx, sy, sz);
  const occluderDistance = Math.hypot(ox, oy, oz);
  if (sunDistance <= sunRadius || occluderDistance <= occluderRadius
    || occluderDistance >= sunDistance) return 0;

  const cosine = (sx * ox + sy * oy + sz * oz) / (sunDistance * occluderDistance);
  if (cosine <= 0) return 0;
  const separation = Math.acos(clampUnit(cosine));
  const sourceAngle = Math.asin(Math.min(1, sunRadius / sunDistance));
  const bodyAngle = Math.asin(Math.min(1, occluderRadius / occluderDistance));
  if (separation >= sourceAngle + bodyAngle) return 0;
  if (separation <= Math.abs(sourceAngle - bodyAngle)) {
    return bodyAngle >= sourceAngle ? 1 : bodyAngle * bodyAngle / (sourceAngle * sourceAngle);
  }

  const sourceSquared = sourceAngle * sourceAngle;
  const bodySquared = bodyAngle * bodyAngle;
  const separationSquared = separation * separation;
  const sourceSector = Math.acos(clampUnit((separationSquared + sourceSquared - bodySquared) / (2 * separation * sourceAngle)));
  const bodySector = Math.acos(clampUnit((separationSquared + bodySquared - sourceSquared) / (2 * separation * bodyAngle)));
  const chordArea = .5 * Math.sqrt(Math.max(0,
    (-separation + sourceAngle + bodyAngle)
    * (separation + sourceAngle - bodyAngle)
    * (separation - sourceAngle + bodyAngle)
    * (separation + sourceAngle + bodyAngle),
  ));
  const overlap = sourceSquared * sourceSector + bodySquared * bodySector - chordArea;
  return Math.max(0, Math.min(1, overlap / (Math.PI * sourceSquared)));
}
