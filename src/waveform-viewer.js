import * as THREE from 'three';
import { HOME, boundPosition, describePosition } from './spatial-position.js';
import { spatialAudio } from './spatial-audio.js';

const root = document.querySelector('.sound-playground');
const audio = root.querySelector('audio');
const play = root.querySelector('[data-wave-play]');
const label = play.querySelector('span');
const status = root.querySelector('[data-wave-status]');
const note = root.querySelector('[data-wave-note]');
const modeButtons = [...root.querySelectorAll('[data-wave-mode]')];
const canvas = root.querySelector('canvas');
const fallback = root.querySelector('.waveform-fallback');
const reset = root.querySelector('[data-wave-reset]');
const mediaRoot = root.dataset.mediaRoot;
const positionOutput = root.querySelector('[data-wave-position]');
const descriptions = {
  plain: 'just a little hum', hum: 'an octave down, in a cathedral', chant: 'telephone voice + long echoes',
  scream: 'everything broken + bitcrush', whisper: 'a tiny, airy voice',
  clap: 'chopped into little beats', vocode: 'all robot, an octave down'
};
let position = { ...HOME };
const spatial = spatialAudio(audio, () => position);
let placeObject = () => {};
function place(next, announce = false) {
  position = boundPosition(next);
  if (announce) positionOutput.textContent = describePosition(position);
  spatial.move(); placeObject();
}
reset.addEventListener('click', () => place(HOME, true));
let selected = 'plain';
let requestId = 0;
let renderScene = () => {};
let changeMesh = () => {};
let requestFrame = () => {};

function updateButton() {
  const playing = !audio.paused && !audio.ended;
  play.classList.toggle('is-playing', playing);
  label.textContent = playing ? 'Pause' : audio.ended ? 'Again' : 'Listen';
  play.setAttribute('aria-label', `${label.textContent}, ${selected === 'clap' ? 'TSK' : selected} sample`);
}
function startAudio() {
  const current = ++requestId;
  status.textContent = '';
  if (audio.error) audio.load();
  if (audio.ended) audio.currentTime = 0;
  // Keep play() in the original click gesture, including Safari source changes.
  try {
    spatial.unlock().then(available => {
      root.querySelector('.waveform-headphones').hidden = !available;
    }).catch(() => {
      if (current !== requestId) return;
      audio.pause(); status.textContent = 'Tap Listen to reconnect the sound';
    });
  } catch {
    status.textContent = 'Spatial audio couldn’t start. Tap Listen to retry';
    return;
  }
  const promise = audio.play();
  promise?.catch(() => {
    if (current !== requestId) return;
    status.textContent = 'Tap Listen to try again';
    updateButton();
  });
}
play.addEventListener('click', () => {
  if (!audio.paused && !audio.ended) { ++requestId; audio.pause(); }
  else startAudio();
});
audio.addEventListener('play', () => {
  document.querySelectorAll('video').forEach(video => video.pause());
  updateButton(); requestFrame();
});
for (const event of ['pause', 'ended', 'loadedmetadata']) audio.addEventListener(event, () => {
  updateButton(); renderScene();
});
audio.addEventListener('error', () => {
  status.textContent = 'This sample couldn’t load. Tap Listen to retry';
  updateButton();
});
document.querySelectorAll('video').forEach(video => video.addEventListener('play', () => {
  ++requestId; audio.pause();
}));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { ++requestId; audio.pause(); }
});

for (const button of modeButtons) button.addEventListener('click', () => {
  const mode = button.dataset.waveMode;
  if (mode === selected) return;
  const continuePlaying = !audio.paused && !audio.ended;
  ++requestId;
  selected = mode;
  audio.pause();
  audio.src = `${mediaRoot}/${mode}.m4a`;
  fallback.src = `${mediaRoot}/${mode}.svg`;
  fallback.alt = `${button.textContent.trim()} waveform`;
  note.textContent = descriptions[mode];
  status.textContent = '';
  modeButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  canvas.setAttribute('aria-label', `${button.textContent.trim()} waveform. Drag to place the sound. Up moves it away; down brings it closer. Arrow keys move it; Shift and up/down change height. Home returns it to the center.`);
  changeMesh(mode);
  updateButton();
  if (continuePlaying) startAudio();
});
root.querySelector('.waveform-modes').hidden = false;
place(HOME);
play.hidden = false;
audio.controls = false;
updateButton();

async function createViewer() {
  const response = await fetch(`${mediaRoot}/meshes.json`);
  if (!response.ok) throw new Error('Mesh data unavailable');
  const assets = await response.json();
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .9;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, .01, 30);
  camera.position.set(0, 2.8, 4.8);
  camera.lookAt(0, .55, 0);
  scene.add(new THREE.HemisphereLight(0xfff9ef, 0x8f989a, 1.6));
  const key = new THREE.DirectionalLight(0xfff2df, 2.0);
  key.position.set(-3, 5, 4); scene.add(key);
  const fill = new THREE.DirectionalLight(0xe6f5ff, .9);
  fill.position.set(4, 1, -3); scene.add(fill);

  // A fixed point of view: the ribbon moves around the room, never the camera.
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(1.84, 1.84, .035, 96),
    [new THREE.MeshStandardMaterial({ color: 0xd8cebc, roughness: .9 }),
     new THREE.MeshBasicMaterial({ color: 0xeee7dc, toneMapped: false }),
     new THREE.MeshBasicMaterial({ color: 0xeee7dc, toneMapped: false })]);
  floor.position.y = -.026; scene.add(floor);
  for (const radius of [.5, 1, 1.5]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius + .004, 96),
      new THREE.MeshBasicMaterial({ color: 0x9b9589, transparent: true, opacity: .16, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = -.003; scene.add(ring);
  }
  const gridMaterial = new THREE.LineBasicMaterial({ color: 0xb3aaa0, transparent: true, opacity: .18 });
  for (const axis of [0, 1]) {
    const points = axis ? [new THREE.Vector3(0, 0, -1.75), new THREE.Vector3(0, 0, 1.75)] :
      [new THREE.Vector3(-1.75, 0, 0), new THREE.Vector3(1.75, 0, 0)];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), gridMaterial));
  }
  const foot = new THREE.Mesh(new THREE.RingGeometry(.07, .077, 48),
    new THREE.MeshBasicMaterial({ color: 0xb0714a, transparent: true, opacity: .5, depthWrite: false }));
  foot.rotation.x = -Math.PI / 2; scene.add(foot);
  const tetherGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const tether = new THREE.Line(tetherGeometry, new THREE.LineDashedMaterial({ color: 0xa79c8c, transparent: true, opacity: .4, dashSize: .025, gapSize: .035 }));
  scene.add(tether);
  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 128;
  const brush = shadowCanvas.getContext('2d');
  const gradient = brush.createRadialGradient(64, 64, 1, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(82,65,49,.19)'); gradient.addColorStop(1, 'rgba(82,65,49,0)');
  brush.fillStyle = gradient; brush.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.3, .55), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; scene.add(shadow);

  const object = new THREE.Group(); scene.add(object);
  const pearlMaterial = new THREE.MeshStandardMaterial({ color: 0xfffdf7, roughness: .23 });
  const pearlGeometry = new THREE.SphereGeometry(.0055, 20, 16);
  const startPearl = new THREE.Mesh(pearlGeometry, pearlMaterial);
  const endPearl = new THREE.Mesh(pearlGeometry, pearlMaterial);
  const cursor = new THREE.Mesh(new THREE.SphereGeometry(.0075, 24, 16), pearlMaterial);
  object.add(startPearl, endPearl, cursor);
  const prepared = new Map();
  for (const asset of assets) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(asset.positions, 3));
    geometry.setIndex(asset.indices); geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ color: asset.color, emissive: asset.color, emissiveIntensity: .06,
      roughness: asset.style === 'rounded' ? .3 : .5, flatShading: ['pixelated', 'dotted'].includes(asset.style), side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material); mesh.visible = false; object.add(mesh);
    prepared.set(asset.id, { mesh, path: asset.path, color: asset.color });
  }
  let path = [];
  function pointAt(progress, target) {
    const count = path.length / 3, n = Math.max(0, Math.min(1, progress)) * (count - 1);
    const a = Math.floor(n), b = Math.min(a + 1, count - 1), t = n - a;
    target.set(path[a*3] + (path[b*3] - path[a*3])*t,
      path[a*3+1] + (path[b*3+1] - path[a*3+1])*t,
      path[a*3+2] + (path[b*3+2] - path[a*3+2])*t + .003);
  }
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let visible = true, frame = 0;
  renderScene = () => {
    if (!visible || document.hidden || !path.length) return;
    pointAt(Number.isFinite(audio.duration) ? audio.currentTime / audio.duration : 0, cursor.position);
    cursor.visible = audio.currentTime > 0 && !audio.ended;
    const breath = !audio.paused && !reduceMotion.matches ? 1 + .01 * Math.sin(audio.currentTime * 4) : 1;
    object.scale.set(4.5 * breath, 7 * breath, 4.5 * breath);
    renderer.render(scene, camera);
  };
  function tick() {
    frame = 0;
    if (!visible || document.hidden) return;
    renderScene();
    if (!audio.paused && !audio.ended) requestFrame();
  }
  requestFrame = () => { if (!frame && visible && !document.hidden) frame = requestAnimationFrame(tick); };
  placeObject = () => {
    object.position.set(position.x, position.y, position.z);
    object.rotation.y = Math.atan2(-position.x, 2.1 - position.z);
    foot.position.set(position.x, .005, position.z);
    shadow.position.set(position.x, .003, position.z);
    shadow.scale.setScalar(.7 + position.y * .5);
    shadow.material.opacity = 1 - position.y * .28;
    const points = tetherGeometry.attributes.position;
    points.setXYZ(0, position.x, .012, position.z); points.setXYZ(1, position.x, position.y - .06, position.z);
    points.needsUpdate = true; tether.computeLineDistances();
    renderScene();
  };
  changeMesh = mode => {
    for (const [id, value] of prepared) value.mesh.visible = id === mode;
    const selected = prepared.get(mode); path = selected.path; foot.material.color.set(selected.color);
    pointAt(0, startPearl.position); pointAt(1, endPearl.position); renderScene();
  };

  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const dragPlane = new THREE.Plane(), hit = new THREE.Vector3();
  let drag = null;
  function pointerPoint(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.ray.intersectPlane(dragPlane, hit);
  }
  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    const heightDrag = event.shiftKey;
    dragPlane.set(heightDrag ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0), heightDrag ? -position.z : -position.y);
    if (!pointerPoint(event)) return;
    drag = { id: event.pointerId, start: hit.clone(), position: { ...position }, heightDrag };
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(event.pointerId); canvas.classList.add('is-grabbing');
    event.preventDefault();
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId || !pointerPoint(event)) return;
    place({ x: drag.position.x + hit.x - drag.start.x,
      y: drag.heightDrag ? drag.position.y + hit.y - drag.start.y : position.y,
      z: drag.heightDrag ? position.z : drag.position.z + hit.z - drag.start.z });
  });
  function endDrag(event) {
    if (!drag || drag.id !== event.pointerId) return;
    drag = null; canvas.classList.remove('is-grabbing'); place(position, true);
  }
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, endDrag);
  canvas.addEventListener('keydown', event => {
    const step = .12, next = { ...position };
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') return place(HOME, true);
    if (event.key === 'ArrowLeft') next.x -= step;
    if (event.key === 'ArrowRight') next.x += step;
    if (event.key === 'ArrowUp') { if (event.shiftKey) next.y += step; else next.z -= step; }
    if (event.key === 'ArrowDown') { if (event.shiftKey) next.y -= step; else next.z += step; }
    place(next, true);
  });
  function resize() {
    const width = canvas.parentElement.clientWidth, height = canvas.parentElement.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    // Keep the whole stage and permitted placement range visible on a phone.
    camera.fov = width < 600 ? 52 : 42;
    camera.position.z = 4.8;
    camera.lookAt(0, .55, 0); camera.updateProjectionMatrix();
    renderer.setSize(width, height, false); renderScene();
  }
  canvas.hidden = false; fallback.hidden = true; reset.hidden = false;
  root.querySelector('.waveform-drag-hint').hidden = false;
  changeMesh(selected); placeObject();
  new ResizeObserver(resize).observe(canvas.parentElement);
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) requestFrame(); else if (frame) { cancelAnimationFrame(frame); frame = 0; }
  }).observe(canvas);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) requestFrame(); });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); canvas.hidden = true; fallback.hidden = false; reset.hidden = true;
    root.querySelector('.waveform-drag-hint').hidden = true;
    status.textContent = '3D view paused. You can still try the sounds';
  });
  canvas.addEventListener('webglcontextrestored', () => {
    canvas.hidden = false; fallback.hidden = true; reset.hidden = false;
    root.querySelector('.waveform-drag-hint').hidden = false; status.textContent = ''; resize();
  });
  resize(); requestFrame();
}
createViewer().catch(() => { status.textContent = '3D view unavailable. You can still try the sounds'; });
