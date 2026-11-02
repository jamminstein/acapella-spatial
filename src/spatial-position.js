export const HOME = Object.freeze({ x: 0, y: .95, z: 0 });
export const LISTENER_Z = 4.8;
export const LIMITS = Object.freeze({ x: [-24, 24], y: [.24, 1.75], z: [-8, 3.85] });
export function boundPosition(position) {
  return Object.fromEntries(Object.entries(LIMITS).map(([axis, [min, max]]) =>
    [axis, Math.min(max, Math.max(min, Number.isFinite(position[axis]) ? position[axis] : HOME[axis]))]));
}
export function listeningPosition(position) {
  const p = boundPosition(position);
  return { x: p.x * .7, y: (p.y - HOME.y) * .7, z: (p.z - LISTENER_Z) * .7 };
}
export function describePosition(position) {
  const p = boundPosition(position);
  return `${p.x < -.25 ? 'left' : p.x > .25 ? 'right' : 'center'}, ${p.y < .7 ? 'low' : p.y > 1.2 ? 'high' : 'at eye level'}, ${p.z < -.4 ? 'farther away' : p.z > .4 ? 'closer' : 'middle distance'}`;
}

// A true billboard cancels most of the visible turn. Add a bounded, responsive
// orbit angle so dragging reads as moving around the listener, while the front
// of the ribbon remains turned toward them (less than 90° from the sightline).
export function ribbonYaw(position, { aspect, fov }) {
  const depth = LISTENER_Z - position.z;
  const halfWidth = depth * Math.tan(fov * Math.PI / 360) * aspect;
  const screenX = Math.max(-1, Math.min(1, position.x / halfWidth));
  return Math.atan2(-position.x, depth) - Math.atan(screenX * 2.4) * .95;
}

// Covers all seven meshes, their pearls, and the maximum playback pulse after
// scaling. Use the same yaw as the renderer, including the nearer rotated tip.
export const RIBBON_BOUNDS = Object.freeze({ x: .97, y: .85, z: .19 });
export const RIBBON_SCALE = Object.freeze({ x: 4.5, y: 7, z: 4.5 });
export function ribbonBounds(asset) {
  const extent = [0, 0, 0];
  for (let i = 0; i < asset.positions.length; i++) {
    extent[i % 3] = Math.max(extent[i % 3], Math.abs(asset.positions[i]));
  }
  // Cursor/pearls travel the whole native path; include their radius and the
  // cursor's small forward offset, not just the mesh vertices.
  for (let i = 0; i < asset.path.length; i++) {
    extent[i % 3] = Math.max(extent[i % 3], Math.abs(asset.path[i] + (i % 3 === 2 ? .003 : 0)) + .0075);
  }
  return Object.fromEntries(['x', 'y', 'z'].map((axis, i) => [axis, extent[i] * RIBBON_SCALE[axis] * 1.01 + .005]));
}

export function fitRibbonToView(next, viewport, bounds = RIBBON_BOUNDS) {
  const p = boundPosition(next);
  const tangent = Math.tan(viewport.fov * Math.PI / 360);
  const edge = .96;
  const { x: width, y: height, z: thickness } = bounds;
  let depth = LISTENER_Z - p.z;
  // Allow the selected waveform to fill the view. Plain must not inherit Tsk's
  // much taller silhouette, while every preset still fits when cycling near us.
  const centerDepth = Math.max(width / (edge * tangent * viewport.aspect), height / (edge * tangent)) + thickness;
  depth = Math.max(depth, centerDepth + .00001);
  // A sideways gesture may make room, but must not throw a close ribbon all
  // the way across the room. Beyond this gentle retreat, trim lateral travel.
  const maxDepth = Math.min(LISTENER_Z - LIMITS.z[0], depth + 1.4);
  // Keep the requested center inside the viewport, but preserve lateral intent
  // before fitting the ribbon. Fitting X first can collapse a closest-phone
  // drag to zero: the rotated tip needs depth that only appears after turning.
  const centerLimit = depth * tangent * viewport.aspect * .9;
  p.x = Math.max(-centerLimit, Math.min(centerLimit, p.x));
  for (let pass = 0; pass < 64; pass++) {
    p.z = LISTENER_Z - depth;
    const angle = ribbonYaw(p, viewport), c = Math.cos(angle), s = Math.sin(angle);
    const nearTip = width * Math.abs(s) + thickness * Math.abs(c);
    let requiredDepth = height / (edge * tangent) + nearTip;
    // Solve every projected corner for its required depth. This does not assume
    // that fit versus X is monotonic while yaw changes (it is not near a phone).
    for (const dx of [-width, width]) for (const dz of [-thickness, thickness]) {
      requiredDepth = Math.max(requiredDepth,
        Math.abs(p.x + dx*c + dz*s) / (edge * tangent * viewport.aspect) - dx*s + dz*c);
    }
    if (requiredDepth <= depth + .000001) break;
    if (depth < maxDepth) {
      // Retreat only as much as these corners require, then recalculate yaw.
      depth = Math.min(maxDepth, requiredDepth + .00001);
    } else {
      // At the retreat limit, make small lateral corrections. A binary search in X
      // can skip valid off-center positions when the ribbon is turning strongly.
      p.x *= .98;
    }
  }
  p.z = LISTENER_Z - depth;
  const angle = ribbonYaw(p, viewport);
  const nearTip = width * Math.abs(Math.sin(angle)) + thickness * Math.abs(Math.cos(angle));
  const verticalRoom = Math.max(0, (depth - nearTip) * tangent * edge - height);
  p.y = Math.max(HOME.y - verticalRoom, Math.min(HOME.y + verticalRoom, p.y));
  return boundPosition(p);
}


// A projected shadow across the effects area makes Z readable even without
// sound. It travels almost the full row and grows/softens as the ribbon nears us.
export function ribbonShadow(position, { projectedX, projectedWidth, areaWidth, areaHeight }) {
  const scale = LISTENER_Z / (LISTENER_Z - position.z);
  const proximity = Math.max(0, Math.min(1, Math.log2(scale / .375) / Math.log2(2.2 / .375)));
  const width = Math.min(areaWidth * .94, Math.max(28, projectedWidth * (.35 + 1.15 * proximity)));
  const half = width / (2 * Math.max(1, areaWidth));
  return {
    x: Math.max(half, Math.min(1 - half, (projectedX + 1) / 2)) * 100,
    width,
    height: 9 + areaHeight * .95 * proximity * proximity,
    y: (proximity - .5) * areaHeight * .88,
    blur: 3 + proximity * 23 + Math.max(0, position.y - HOME.y) * 4,
    opacity: .055 + proximity * .19
  };
}
