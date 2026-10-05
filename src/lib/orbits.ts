import type { Vector3 } from 'three';

export type OrbitTrack = {
  radius: number;
  height: number;
  depth: number;
  node: number;
};

const TAU = Math.PI * 2;
const ARC_STEPS = 1024;

/**
 * Create once per track. Phase advances through normalized arc distance, in
 * radians: 0 and 2π mark the same point after one complete revolution.
 * The returned sampler mutates and returns target without allocating vectors.
 */
export function createOrbitSampler(track: OrbitTrack): (target: Vector3, phase: number) => Vector3 {
  const { radius, height, depth, node } = track;
  if (!Number.isFinite(radius) || radius <= 0 || !Number.isFinite(height) || height <= 0
    || !Number.isFinite(depth) || !Number.isFinite(node)) {
    throw new RangeError('An orbit requires positive finite radius and height, and finite depth and node.');
  }

  const minorRadius = radius * height;
  const cosineNode = Math.cos(node);
  const sineNode = Math.sin(node);
  const stepAngle = TAU / ARC_STEPS;
  const cumulative = new Float64Array(ARC_STEPS + 1);

  // Node rotates the XY plane and preserves distances. The sin-axis also
  // contains depth, so its full 3D length is used for arc integration.
  const speedAt = (angle: number) => {
    const sine = Math.sin(angle);
    const cosine = Math.cos(angle);
    return Math.hypot(radius * sine, minorRadius * cosine, depth * cosine);
  };

  const arcBetween = (start: number, end: number) => (end - start) / 6
    * (speedAt(start) + 4 * speedAt((start + end) / 2) + speedAt(end));

  for (let index = 1; index <= ARC_STEPS; index += 1) {
    cumulative[index] = cumulative[index - 1]
      + arcBetween((index - 1) * stepAngle, index * stepAngle);
  }
  const perimeter = cumulative[ARC_STEPS];

  return (target, phase) => {
    if (!Number.isFinite(phase)) throw new RangeError('Orbit phase must be finite.');
    const remainder = phase % TAU;
    const wrappedPhase = remainder < 0 ? remainder + TAU : remainder;
    const distance = wrappedPhase / TAU * perimeter;

    let low = 0;
    let high = ARC_STEPS;
    while (high - low > 1) {
      const middle = (low + high) >>> 1;
      if (cumulative[middle] <= distance) low = middle;
      else high = middle;
    }

    const startAngle = low * stepAngle;
    const endAngle = high * stepAngle;
    const distanceInSegment = distance - cumulative[low];
    const segmentLength = cumulative[high] - cumulative[low];
    let angle = startAngle + distanceInSegment / segmentLength * stepAngle;

    // Two local Newton refinements avoid velocity steps at lookup boundaries.
    // The lookup bracket keeps the solve bounded even for eccentric ellipses.
    for (let iteration = 0; iteration < 2; iteration += 1) {
      const error = arcBetween(startAngle, angle) - distanceInSegment;
      angle = Math.max(startAngle, Math.min(endAngle, angle - error / speedAt(angle)));
    }

    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * minorRadius;
    return target.set(
      x * cosineNode - y * sineNode,
      x * sineNode + y * cosineNode,
      Math.sin(angle) * depth,
    );
  };
}
