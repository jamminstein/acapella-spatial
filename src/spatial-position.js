export const HOME = Object.freeze({ x: 0, y: .95, z: 0 });
export const LISTENER_Z = 4.8;
export const LIMITS = Object.freeze({ x: [-12, 12], y: [.24, 1.75], z: [-4, 2.6] });
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
