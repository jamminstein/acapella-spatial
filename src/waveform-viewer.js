import * as THREE from 'three';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';

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
const descriptions = {
  plain: 'just your voice', hum: 'cathedral reverb + echo', chant: 'a little detune + room',
  scream: 'distortion + sub-bass', whisper: 'a little air + a tiny room',
  clap: 'a chopped-up rhythm', vocode: 'your voice, sung by a robot'
};
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
  canvas.setAttribute('aria-label', `${button.textContent.trim()} waveform. Drag to rotate freely, or use arrow keys. Home resets the view.`);
  changeMesh(mode);
  updateButton();
  if (continuePlaying) startAudio();
});
root.querySelector('.waveform-modes').hidden = false;
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
  renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, .01, 10);
  camera.position.set(.11, .07, .64);
  scene.add(new THREE.HemisphereLight(0xfff9ef, 0x8f989a, 2.8));
  const key = new THREE.DirectionalLight(0xfff2df, 3.2);
  key.position.set(-.4, .7, .8); scene.add(key);
  const fill = new THREE.DirectionalLight(0xe6f5ff, 1.8);
  fill.position.set(.5, .1, -.5); scene.add(fill);

  const object = new THREE.Group();
  scene.add(object);
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
    geometry.setIndex(asset.indices);
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      color: asset.color, emissive: asset.color, emissiveIntensity: .06,
      roughness: asset.style === 'rounded' ? .3 : .5, metalness: 0,
      flatShading: ['pixelated', 'dotted'].includes(asset.style), side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false; object.add(mesh);
    prepared.set(asset.id, { mesh, path: asset.path });
  }
  let path = [];
  function pointAt(progress, target) {
    const count = path.length / 3;
    const n = Math.max(0, Math.min(1, progress)) * (count - 1);
    const a = Math.floor(n), b = Math.min(a + 1, count - 1), t = n - a;
    target.set(path[a*3] + (path[b*3] - path[a*3])*t,
      path[a*3+1] + (path[b*3+1] - path[a*3+1])*t,
      path[a*3+2] + (path[b*3+2] - path[a*3+2])*t + .003);
  }
  const controls = new TrackballControls(camera, canvas);
  controls.noPan = true;
  controls.noZoom = true;
  controls.rotateSpeed = 2.2;
  controls.staticMoving = true;
  controls.target.set(0, 0, 0);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let visible = true, activePointer = false, frame = 0;
  renderScene = () => {
    if (!visible || document.hidden || !path.length) return;
    const progress = Number.isFinite(audio.duration) ? audio.currentTime / audio.duration : 0;
    pointAt(progress, cursor.position);
    cursor.visible = audio.currentTime > 0 && !audio.ended;
    // The marker and mesh share the same transform, so it follows the ribbon.
    const breath = !audio.paused && !reduceMotion.matches ? 1 + .012 * Math.sin(audio.currentTime * 4) : 1;
    object.scale.setScalar(breath);
    renderer.render(scene, camera);
  };
  function tick() {
    frame = 0;
    if (!visible || document.hidden) return;
    controls.update(); renderScene();
    if (activePointer || (!audio.paused && !audio.ended)) requestFrame();
  }
  requestFrame = () => { if (!frame && visible && !document.hidden) frame = requestAnimationFrame(tick); };
  controls.addEventListener('change', renderScene);
  controls.addEventListener('start', () => { activePointer = true; requestFrame(); });
  controls.addEventListener('end', () => { activePointer = false; requestFrame(); });
  canvas.addEventListener('keydown', event => {
    const step = .12;
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') { controls.reset(); object.rotation.set(0,0,0); }
    if (event.key === 'ArrowLeft') object.rotateY(-step);
    if (event.key === 'ArrowRight') object.rotateY(step);
    if (event.key === 'ArrowUp') object.rotateX(-step);
    if (event.key === 'ArrowDown') object.rotateX(step);
    renderScene();
  });
  reset.addEventListener('click', () => { controls.reset(); object.rotation.set(0,0,0); renderScene(); });
  changeMesh = mode => {
    for (const [id, value] of prepared) value.mesh.visible = id === mode;
    path = prepared.get(mode).path;
    pointAt(0, startPearl.position); pointAt(1, endPearl.position);
    renderScene();
  };
  function resize() {
    const width = canvas.parentElement.clientWidth;
    const height = canvas.parentElement.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.fov = width < 600 ? 46 : 36;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    controls.handleResize(); renderScene();
  }
  canvas.hidden = false;
  fallback.hidden = true;
  reset.hidden = false;
  root.querySelector('.waveform-drag-hint').hidden = false;
  changeMesh(selected);
  new ResizeObserver(resize).observe(canvas.parentElement);
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) requestFrame();
    else if (frame) { cancelAnimationFrame(frame); frame = 0; }
  }).observe(canvas);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) requestFrame(); });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    canvas.hidden = true; fallback.hidden = false;
    reset.hidden = true; root.querySelector('.waveform-drag-hint').hidden = true;
    status.textContent = '3D view paused. You can still try the sounds';
  });
  canvas.addEventListener('webglcontextrestored', () => {
    canvas.hidden = false; fallback.hidden = true; reset.hidden = false;
    root.querySelector('.waveform-drag-hint').hidden = false;
    status.textContent = ''; resize();
  });
  resize(); requestFrame();
}
createViewer().catch(() => {
  status.textContent = '3D view unavailable. You can still try the sounds';
});
