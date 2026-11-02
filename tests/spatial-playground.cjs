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
