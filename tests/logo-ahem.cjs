'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const code = fs.readFileSync(process.env.AHEM_SOURCE || path.join(__dirname, '../masks.js'), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));

function target() {
  const handlers = new Map();
  return {
    dataset: {},
    addEventListener(name, callback, options = {}) {
      const list = handlers.get(name) || [];
      list.push({ callback, once: options.once }); handlers.set(name, list);
    },
    fire(name, event = {}) {
      const list = handlers.get(name) || [];
      handlers.set(name, list.filter(listener => !listener.once));
      list.forEach(listener => listener.callback(event));
    }
  };
}

function fixture() {
  let clock = 0;
  const contexts = [], sources = [], downloads = [];
  const logos = [target(), target()];
  const video = Object.assign(target(), { paused: true, ended: false, muted: false, volume: 1 });
  const parameter = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} });
  const node = () => ({ connect(next) { return next; }, disconnect() {} });
  class AudioContext {
    constructor() { this.state = 'suspended'; this.destination = node(); this.resumes = 0; contexts.push(this); }
    get currentTime() { return clock / 1000; }
    resume() { this.resumes++; this.state = 'running'; return Promise.resolve(); }
    createGain() { return Object.assign(node(), { gain: parameter() }); }
    createDynamicsCompressor() { return Object.assign(node(), { threshold: parameter(), knee: parameter(), ratio: parameter() }); }
    createPeriodicWave() { return {}; }
    decodeAudioData() { return Promise.resolve({ duration: .487 }); }
    createBufferSource() {
      const source = Object.assign(node(), { starts: [], stops: [], start(t) { this.starts.push(t); }, stop(t) { this.stops.push(t); }, finish() { this.onended(); } });
      sources.push(source); return source;
    }
  }
  const document = Object.assign(target(), {
    hidden: false,
    querySelectorAll(selector) { return selector === '.wordmark' ? logos : selector === 'video' ? [video] : []; }
  });
  const window = Object.assign(target(), { AudioContext });
  vm.runInNewContext(code, {
    document, window, performance: { now: () => clock }, Float32Array, setTimeout, clearTimeout,
    fetch() { return new Promise((resolve, reject) => downloads.push({ resolve, reject })); }
  });
  return {
    logos, video, document, window, contexts, sources, downloads,
    time(value) { clock = value; },
    deliver() { downloads.at(-1).resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(16)) }); },
    click(logo = logos[0]) { document.fire('pointerdown'); logo.fire('click'); document.fire('click'); },
    hover(logo = logos[0]) { logo.fire('pointerenter', { pointerType: 'mouse' }); }
  };
}

test('warms the recording without opening an audio context or playing', async () => {
  const f = fixture(); assert.equal(f.downloads.length, 1);
  f.deliver(); await settle(); assert.equal(f.contexts.length, 0); assert.equal(f.sources.length, 0);
});

test('a slow first download does not discard an accepted click', async () => {
  const f = fixture(); f.click(); f.time(1400); f.deliver(); await settle();
  assert.equal(f.sources.length, 1); assert.equal(f.logos[0].dataset.clearing, 'true');
});

test('a quick hover plays the whole sound after pointer exit and blur', async () => {
  const f = fixture(); f.deliver(); f.document.fire('click'); await settle();
  f.hover(); await settle(); f.logos[0].fire('pointerleave'); f.logos[0].fire('blur');
  assert.equal(f.sources.length, 1); assert.deepEqual(f.sources[0].stops, []);
  assert.equal(f.logos[0].dataset.clearing, 'true');
  f.sources[0].finish(); assert.equal(f.logos[0].dataset.clearing, undefined);
});

test('both wordmarks share the four-second cooldown', async () => {
  const f = fixture(); f.deliver(); f.click(); await settle(); f.sources[0].finish();
  f.time(3999); f.hover(f.logos[1]); await settle(); assert.equal(f.sources.length, 1);
  f.time(4000); f.hover(f.logos[1]); await settle(); assert.equal(f.sources.length, 2);
});

test('a locked hover is not queued for an unrelated later click', async () => {
  const f = fixture(); f.deliver(); f.hover(); await settle();
  assert.equal(f.contexts[0].resumes, 0); assert.equal(f.sources.length, 0);
  f.time(100); f.document.fire('click'); await settle(); assert.equal(f.sources.length, 0);
  f.hover(); await settle(); assert.equal(f.sources.length, 1);
});

test('touch entry stays silent and a tap plays immediately', async () => {
  const f = fixture(); f.deliver(); f.logos[0].fire('pointerenter', { pointerType: 'touch' }); await settle();
  assert.equal(f.contexts.length, 0); f.click(); await settle(); assert.equal(f.sources.length, 1);
});

for (const event of ['pointerdown', 'click', 'keydown']) {
  test(`a new ${event} recovers interrupted audio`, async () => {
    const f = fixture(); f.deliver(); f.document.fire(event); await settle();
    const ctx = f.contexts[0]; ctx.state = 'interrupted';
    f.document.fire(event); await settle(); f.hover(); await settle();
    assert.equal(ctx.state, 'running'); assert.equal(ctx.resumes, 2); assert.equal(f.sources.length, 1);
  });
}

test('a film cancels a pending recording download and takes audio priority', async () => {
  const f = fixture(); f.click(); f.video.paused = false; f.video.fire('play');
  f.deliver(); await settle(); assert.equal(f.sources.length, 0);
  f.click(); await settle(); assert.equal(f.sources.length, 0);
});

test('a failed preload can retry on the next interaction', async () => {
  const f = fixture(); f.downloads[0].reject(new Error('Offline')); await settle();
  f.click(); assert.equal(f.downloads.length, 2); f.deliver(); await settle();
  assert.equal(f.sources.length, 1);
});

for (const exit of ['hidden', 'Escape', 'film']) {
  test(`${exit} can silence the sound intentionally`, async () => {
    const f = fixture(); f.deliver(); f.click(); await settle();
    if (exit === 'hidden') { f.document.hidden = true; f.document.fire('visibilitychange'); }
    if (exit === 'Escape') f.window.fire('keydown', { key: 'Escape' });
    if (exit === 'film') f.video.fire('play');
    assert.equal(f.sources[0].stops.length, 1); assert.equal(f.logos[0].dataset.clearing, undefined);
  });
}
