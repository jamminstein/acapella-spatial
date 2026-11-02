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

test('selected native bounds allow Plain much closer without using the tallest preset bounds', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { ribbonBounds, fitRibbonToView, HOME, LIMITS, LISTENER_Z } = await import('../src/spatial-position.js');
  const assets = JSON.parse(fs.readFileSync(path.join(__dirname, '../media/playground/v2/meshes.json'), 'utf8'));
  const plain = assets.find(asset => asset.id === 'plain');
  const viewport = { aspect: 1440/440, fov: 42 };
  const old = fitRibbonToView({ ...HOME, z: 2.6 }, viewport, { x: .97, y: .83, z: .17 });
  const near = fitRibbonToView({ ...HOME, z: LIMITS.z[1] }, viewport, ribbonBounds(plain));
  assert((LISTENER_Z - old.z) / (LISTENER_Z - near.z) > 1.5, 'Plain must be materially larger at the new near limit');
  assert(LIMITS.z[0] < -6, 'far range should also visibly expand');
});

test('every preset fits at the expanded near/far limits and when switching from a close Plain', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { ribbonBounds, fitRibbonToView, ribbonYaw, HOME, LIMITS, LISTENER_Z } = await import('../src/spatial-position.js');
  const assets = JSON.parse(fs.readFileSync(path.join(__dirname, '../media/playground/v2/meshes.json'), 'utf8'));
  for (const width of [280, 430, 1440, 1920]) {
    const viewport = { aspect: width / (width < 600 ? 340 : 440), fov: width < 600 ? 52 : 42 };
    const tangent = Math.tan(viewport.fov * Math.PI / 360);
    const nearPlain = fitRibbonToView({ ...HOME, z: LIMITS.z[1] }, viewport, ribbonBounds(assets[0]));
    for (const asset of assets) {
      const bounds = ribbonBounds(asset);
      for (const z of [LIMITS.z[0], 0, LIMITS.z[1], nearPlain.z]) for (const x of [-24, -1, 0, 1, 24]) {
        const p = fitRibbonToView({ ...HOME, x, z }, viewport, bounds);
        const angle = ribbonYaw(p, viewport), c = Math.cos(angle), s = Math.sin(angle);
        for (const dx of [-bounds.x, bounds.x]) for (const dy of [-bounds.y, bounds.y]) for (const dz of [-bounds.z, bounds.z]) {
          const depth = LISTENER_Z - p.z + dx*s - dz*c;
          const nx = (p.x + dx*c + dz*s) / (depth * tangent * viewport.aspect);
          const ny = (p.y - HOME.y + dy) / (depth * tangent);
          assert(depth > 0 && Math.abs(nx) <= .9601 && Math.abs(ny) <= .9601,
            `${asset.id} clipped at ${width}px, requested ${x},${z}`);
        }
      }
    }
  }
});

test('shadow visibly travels, broadens and softens with depth while staying over the effects area', async () => {
  const { ribbonShadow, HOME } = await import('../src/spatial-position.js');
  const dimensions = { projectedX: 0, projectedWidth: 220, areaWidth: 1200, areaHeight: 70 };
  const far = ribbonShadow({ ...HOME, z: -8 }, { ...dimensions, projectedWidth: 90 });
  const near = ribbonShadow({ ...HOME, z: 3.3 }, { ...dimensions, projectedWidth: 850 });
  assert(near.width > far.width * 8);
  assert(near.height > far.height * 5);
  assert(near.y - far.y > dimensions.areaHeight * .7);
  assert(near.blur > far.blur * 4);
  assert(near.opacity > far.opacity * 3);
  for (const projectedX of [-1, 0, 1]) {
    const shadow = ribbonShadow({ ...HOME, z: 3.3 }, { ...dimensions, projectedX, projectedWidth: 1800 });
    const center = shadow.x / 100 * dimensions.areaWidth;
    assert(center - shadow.width/2 >= -1e-9 && center + shadow.width/2 <= dimensions.areaWidth + 1e-9);
    assert(Math.abs(shadow.y) < dimensions.areaHeight/2);
  }
});

test('preset base colors, static selectors and SVG fallbacks match the native palette', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { MODE_COLORS } = await import('../src/mode-colors.js');
  const base = path.join(__dirname, '..');
  const assets = JSON.parse(fs.readFileSync(path.join(base, 'media/playground/v2/meshes.json'), 'utf8'));
  const html = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
  assert.deepEqual(MODE_COLORS, { plain: '#f48f78', hum: '#1270b8', chant: '#ffc003', scream: '#ce2021', whisper: '#a866e8', clap: '#1aa167', vocode: '#00beaa' });
  for (const asset of assets) {
    assert.equal(asset.color, MODE_COLORS[asset.id]);
    assert(html.includes(`data-wave-mode="${asset.id}" aria-pressed="${asset.id === 'plain'}" style="--mode-color:${asset.color}"`));
    assert(fs.readFileSync(path.join(base, `media/playground/v2/${asset.id}.svg`), 'utf8').includes(`fill="${asset.color}"`));
  }
});
