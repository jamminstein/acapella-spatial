const { test } = require('node:test');
const assert = require('node:assert/strict');

test('placement stays finite and reachable, even with extreme or invalid input', async () => {
  const { boundPosition, LIMITS } = await import('../src/spatial-position.js');
  for (const x of [-Infinity, -100, -.5, 0, .5, 100, NaN]) {
    for (const y of [-100, .5, 100, NaN]) {
      const p = boundPosition({ x, y, z: -x });
      for (const axis of ['x','y','z']) {
        assert(Number.isFinite(p[axis]));
        assert(p[axis] >= LIMITS[axis][0] && p[axis] <= LIMITS[axis][1]);
      }
    }
  }
});
test('screen left/right and near/far map to the listener without crossing behind them', async () => {
  const { listeningPosition, HOME, LIMITS } = await import('../src/spatial-position.js');
  assert(listeningPosition({ ...HOME, x: -1 }).x < 0);
  assert(listeningPosition({ ...HOME, x: 1 }).x > 0);
  const near = listeningPosition({ ...HOME, z: LIMITS.z[1] });
  const far = listeningPosition({ ...HOME, z: LIMITS.z[0] });
  assert(near.z < 0 && far.z < 0 && Math.abs(near.z) < Math.abs(far.z));
  assert(listeningPosition({ ...HOME, y: 1.5 }).y > 0);
});
test('audio resumes inside the gesture, reuses its media source, and recovers after interruption', async () => {
  const { spatialAudio } = await import('../src/spatial-audio.js');
  let context, sources = 0, resumed = 0, connected = 0;
  const values = {};
  class Context {
    constructor() { context = this; this.state = 'suspended'; this.currentTime = 0; this.destination = {}; }
    createPanner() {
      this.panner = { connect() { connected++; } };
      for (const axis of ['X','Y','Z']) this.panner[`position${axis}`] = { setTargetAtTime(value) { values[axis] = value; } };
      return this.panner;
    }
    createMediaElementSource() { sources++; return { connect() { connected++; } }; }
    resume() { resumed++; this.state = 'running'; return Promise.resolve(); }
  }
  let position = { x: -1, y: 1, z: 0 };
  const spatial = spatialAudio({}, () => position, Context);
  const first = spatial.unlock();
  assert.equal(resumed, 1, 'resume must happen before yielding out of the gesture');
  assert(await first);
  assert.equal(context.panner.panningModel, 'HRTF');
  assert(values.X < 0);
  position.x = 1; spatial.move(); assert(values.X > 0);
  await spatial.unlock(); assert.equal(sources, 1); assert.equal(connected, 2);
  context.state = 'interrupted'; await spatial.unlock(); assert.equal(resumed, 2);
});
test('unsupported spatial audio keeps native sample playback available', async () => {
  const { spatialAudio } = await import('../src/spatial-audio.js');
  assert.equal(await spatialAudio({}, () => ({}), null).unlock(), false);
});

test('orbit is visibly stronger than a billboard but keeps its front toward the listener', async () => {
  const { ribbonYaw, HOME, LISTENER_Z } = await import('../src/spatial-position.js');
  const viewport = { aspect: 3, fov: 42 };
  const depth = LISTENER_Z - HOME.z;
  const halfWidth = depth * Math.tan(viewport.fov * Math.PI / 360) * viewport.aspect;
  assert(Math.abs(ribbonYaw(HOME, viewport)) < 1e-12);
  for (const fraction of [.25, .5, .9]) {
    const right = { ...HOME, x: halfWidth * fraction };
    const left = { ...right, x: -right.x };
    const yaw = ribbonYaw(right, viewport);
    const bearing = Math.atan2(-right.x, depth);
    assert(Math.abs(yaw - bearing) > 25 * Math.PI / 180, 'drag must produce a visible turn');
    assert(Math.cos(yaw - bearing) > .4, 'front stays toward the listener');
    assert(Math.abs(yaw + ribbonYaw(left, viewport)) < 1e-12, 'left and right remain symmetric');
  }
});

test('rotated ribbons and their nearer tips stay inside phone and desktop viewports', async () => {
  const { fitRibbonToView, ribbonYaw, HOME, LISTENER_Z, RIBBON_BOUNDS } = await import('../src/spatial-position.js');
  for (const [width, height] of [[280,340], [320,340], [390,340], [768,330], [1440,440], [1920,440]]) {
    const viewport = { aspect: width / height, fov: width < 600 ? 52 : 42 };
    const tangent = Math.tan(viewport.fov * Math.PI / 360);
    for (const x of [-12,-4,-1,0,1,4,12]) for (const y of [.24,.95,1.75]) for (const z of [-4,0,2.6]) {
      const p = fitRibbonToView({ x, y, z }, viewport);
      const yaw = ribbonYaw(p, viewport), c = Math.cos(yaw), s = Math.sin(yaw);
      for (const dx of [-RIBBON_BOUNDS.x,RIBBON_BOUNDS.x]) {
        for (const dy of [-RIBBON_BOUNDS.y,RIBBON_BOUNDS.y]) {
          for (const dz of [-RIBBON_BOUNDS.z,RIBBON_BOUNDS.z]) {
            const depth = LISTENER_Z - p.z + dx*s - dz*c;
            assert(depth > 0);
            const screenX = (p.x + dx*c + dz*s) / (depth * tangent * viewport.aspect);
            const screenY = (p.y - HOME.y + dy) / (depth * tangent);
            assert(Math.abs(screenX) <= .9601 && Math.abs(screenY) <= .9601,
              `clipped at ${width}×${height}, source ${JSON.stringify({x,y,z})}`);
          }
        }
      }
    }
  }
});

test('fitting preserves full-width travel and closer/farther placement', async () => {
  const { fitRibbonToView, HOME, LISTENER_Z } = await import('../src/spatial-position.js');
  const viewport = { aspect: 1440/440, fov: 42 };
  const far = fitRibbonToView({ ...HOME, z: -4 }, viewport);
  const near = fitRibbonToView({ ...HOME, z: 2.6 }, viewport);
  assert(near.z > far.z + 5);
  const right = fitRibbonToView({ ...HOME, x: 12 }, viewport);
  const halfWidth = (LISTENER_Z - right.z) * Math.tan(viewport.fov * Math.PI / 360) * viewport.aspect;
  assert(right.x > halfWidth * .7, 'desktop movement must not shrink back into the middle');
  const left = fitRibbonToView({ ...HOME, x: -12 }, viewport);
  assert(Math.abs(left.x + right.x) < 1e-9);
});


test('a sideways drag from the closest phone position turns instead of sticking at center', async () => {
  const { fitRibbonToView, ribbonYaw, HOME } = await import('../src/spatial-position.js');
  for (const width of [280, 320, 390, 430]) {
    const viewport = { aspect: width / 340, fov: 52 };
    const closest = fitRibbonToView({ ...HOME, z: 2.6 }, viewport);
    for (const direction of [-1, 1]) {
      const moved = fitRibbonToView({ ...closest, x: direction }, viewport);
      assert(moved.x * direction > .4, `closest ${width}px ribbon must move sideways`);
      assert(Math.abs(ribbonYaw(moved, viewport)) > 40 * Math.PI / 180,
        `closest ${width}px ribbon must visibly turn`);
      assert(moved.z <= closest.z, 'retreat when the nearer rotated tip needs room');
      assert(moved.z > closest.z - 1.5, 'a short sideways drag must not jump to the far limit');
      const repeated = fitRibbonToView(moved, viewport);
      assert(Math.abs(repeated.x - moved.x) < 1e-5 && Math.abs(repeated.z - moved.z) < 1e-5,
        'a second drag must start from a stable fitted position');
    }
  }
});
