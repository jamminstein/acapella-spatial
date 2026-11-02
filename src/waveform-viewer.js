import * as THREE from 'three';
import { HOME, LISTENER_Z, boundPosition, describePosition } from './spatial-position.js';
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
  plain: 'no effects', hum: 'an octave down, in a cathedral', chant: 'telephone voice + long echoes',
  scream: 'everything broken + bitcrush', whisper: 'a tiny, airy voice',
  clap: 'chopped into little beats', vocode: 'all robot, an octave down'
};
let position = { ...HOME };
let constrainToView = boundPosition;
const spatial = spatialAudio(audio, () => position);
let placeObject = () => {};
function place(next, announce = false) {
  position = constrainToView(next);
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
    spatial.unlock().catch(() => {
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
  camera.position.set(0, HOME.y, LISTENER_Z);
  camera.lookAt(0, HOME.y, 0);
  scene.add(new THREE.HemisphereLight(0xfffbf4, 0xb0b3ad, 1.8));
  const key = new THREE.DirectionalLight(0xfffbf4, 2.0);
  key.position.set(-3, 5, 4); scene.add(key);
  const fill = new THREE.DirectionalLight(0xe6f5ff, 1.2);
  fill.position.set(4, 1, -3); scene.add(fill);

  // The ribbon floats freely; its projected shadow falls on the controls.
  const modes = root.querySelector('.waveform-modes');
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
    const color = new THREE.Color(asset.color).lerp(new THREE.Color('#e8ded5'), .28);
    const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .025,
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
    object.rotation.y = Math.atan2(-position.x, LISTENER_Z - position.z);
    object.updateMatrixWorld(true);
    const projected = object.position.clone().project(camera);
    const left = startPearl.getWorldPosition(new THREE.Vector3()).project(camera);
    const right = endPearl.getWorldPosition(new THREE.Vector3()).project(camera);
    const depthScale = LISTENER_Z / (LISTENER_Z - position.z);
    const width = Math.abs(right.x - left.x) * canvas.clientWidth / 2;
    modes.style.setProperty('--shadow-x', `${(projected.x + 1) * 50}%`);
    modes.style.setProperty('--shadow-width', `${Math.max(45, width * .95)}px`);
    modes.style.setProperty('--shadow-height', `${42 * depthScale}px`);
    modes.style.setProperty('--shadow-y', `${(depthScale - 1) * 24}px`);
    modes.style.setProperty('--shadow-blur', `${8 + depthScale * 2 + (position.y - HOME.y) * 5}px`);
    modes.style.setProperty('--shadow-opacity', String(.11 + depthScale * .04 - (position.y - HOME.y) * .035));
    renderScene();
  };
  changeMesh = mode => {
    for (const [id, value] of prepared) value.mesh.visible = id === mode;
    const selected = prepared.get(mode); path = selected.path;
    pointAt(0, startPearl.position); pointAt(1, endPearl.position); placeObject();
  };

  // Fit the permitted horizontal travel to the viewport at the current depth.
  // A constant world-space limit would trap the ribbon near the middle on desktop.
  constrainToView = next => {
    const p = boundPosition(next);
    const depth = LISTENER_Z - p.z;
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const halfHeight = depth * tangent;
    // Include the turn toward the viewer: at the side, the nearer tip grows.
    const fits = x => {
      const angle = Math.atan2(-x, depth), c = Math.cos(angle), s = Math.sin(angle);
      return [-.97, .97].every(dx => [-.17, .17].every(dz =>
        Math.abs((x + dx*c + dz*s) / ((depth + dx*s - dz*c) * tangent * camera.aspect)) <= .96));
    };
    if (!fits(p.x)) {
      let low = 0, high = Math.abs(p.x);
      for (let i = 0; i < 10; i++) {
        const middle = (low + high) / 2;
        if (fits(middle)) low = middle; else high = middle;
      }
      p.x = Math.sign(p.x) * low;
    }
    const verticalRoom = Math.max(0, halfHeight - .82);
    p.y = THREE.MathUtils.clamp(p.y, HOME.y - verticalRoom, HOME.y + verticalRoom);
    return p;
  };
  let drag = null;
  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    const projected = object.position.clone().project(camera);
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY,
      screenX: projected.x, position: { ...position }, heightDrag: event.shiftKey };
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(event.pointerId); canvas.classList.add('is-grabbing');
    event.preventDefault();
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const rect = canvas.getBoundingClientRect();
    const dy = (event.clientY - drag.y) / rect.height;
    const next = boundPosition({ ...drag.position,
      y: drag.heightDrag ? drag.position.y - dy * 3 : drag.position.y,
      z: drag.heightDrag ? drag.position.z : drag.position.z + dy * 8 });
    const halfWidth = (LISTENER_Z - next.z) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    next.x = (drag.screenX + (event.clientX - drag.x) / rect.width * 2) * halfWidth;
    place(next);
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
    // Keep the full ribbon visible when close, including on a phone.
    camera.fov = width < 600 ? 52 : 42;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false); place(position);
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
