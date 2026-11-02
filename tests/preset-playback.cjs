const { test } = require('node:test');
const assert = require('node:assert/strict');

async function fixture({ selected = 'plain', unlock } = {}) {
  const { presetPlayback } = await import('../src/preset-playback.js');
  const modes = ['plain', 'hum', 'chant', 'scream', 'whisper', 'clap', 'vocode'];
  const events = [];
  const listeners = new Map();
  const pending = [];
  const calls = [];
  const selections = [];
  let visible = true, message = '', starts = 0, unlocks = 0;
  const audio = {
    src: `/samples/${selected}.m4a`, paused: true, ended: false, loop: true,
    error: null, currentTime: 0, plans: [], loads: 0,
    addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback); },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
    emit(type) { for (const callback of listeners.get(type) || []) callback(); },
    load() {
      this.loads++; this.paused = true; this.ended = false; this.currentTime = 0; this.error = null;
      // HTML's load algorithm discards old resource media tasks.
      events.length = 0;
    },
    play() {
      calls.push(this.src);
      const plan = this.plans.shift();
      if (plan === 'throw') throw Error('blocked');
      if (plan === 'reject') return Promise.reject(Error('blocked'));
      this.paused = false; this.ended = false;
      events.push(() => this.emit('play'));
      if (plan === 'pending') return new Promise((resolve, reject) => pending.push({ resolve, reject }));
      return Promise.resolve();
    },
    pause() { if (!this.paused) { this.paused = true; events.push(() => this.emit('pause')); } }
  };
  const cycle = presetPlayback({ audio, modes, initialMode: selected,
    sourceForMode: mode => `/samples/${mode}.m4a`,
    unlock: () => { unlocks++; return unlock ? unlock() : Promise.resolve(); },
    canPlay: () => visible,
    onSelect: mode => selections.push(mode),
    onStarted: () => starts++,
    onMessage: value => { message = value; }
  });
  const flush = async () => {
    for (let i = 0; i < 8; i++) {
      await Promise.resolve();
      for (const event of events.splice(0)) event();
    }
  };
  const end = () => {
    audio.paused = true; audio.ended = true; audio.currentTime = 5;
    audio.emit('pause'); audio.emit('ended');
  };
  return { audio, cycle, modes, calls, selections, pending, flush, end,
    hide() { visible = false; cycle.pause(); },
    show() { visible = true; },
    get message() { return message; }, get starts() { return starts; }, get unlocks() { return unlocks; } };
}

test('Play synchronously uses one audio element and cycles all displayed presets with wraparound', async () => {
  const f = await fixture();
  f.cycle.play();
  assert.equal(f.calls.length, 1, 'play must stay in the original user gesture');
  assert.equal(f.unlocks, 1);
  assert.equal(f.audio.loop, false);
  await f.flush();
  for (let i = 0; i < 9; i++) { f.end(); await f.flush(); }
  assert.deepEqual(f.calls, Array.from({ length: 10 }, (_, i) => `/samples/${f.modes[i % 7]}.m4a`));
  assert.equal(f.cycle.active, true);
});

test('starting at another preset continues from there in displayed order', async () => {
  const f = await fixture({ selected: 'whisper' });
  f.cycle.play(); await f.flush();
  for (let i = 0; i < 3; i++) { f.end(); await f.flush(); }
  assert.deepEqual(f.calls, ['/samples/whisper.m4a', '/samples/clap.m4a', '/samples/vocode.m4a', '/samples/plain.m4a']);
});

test('manual selection while playing starts the selected preset in the same click and keeps cycling', async () => {
  const f = await fixture(); f.cycle.play(); await f.flush();
  f.audio.currentTime = 2;
  f.cycle.select('chant');
  assert.equal(f.calls.length, 2, 'replacement play must happen synchronously in the selection gesture');
  assert.equal(f.audio.paused, false); assert.equal(f.cycle.active, true);
  assert.equal(f.cycle.selected, 'chant'); assert.equal(f.audio.currentTime, 0);
  f.audio.emit('loadedmetadata'); f.audio.emit('ended'); await f.flush();
  assert.equal(f.calls.length, 2, 'a queued old ended event must not skip the selected preset');
  f.end(); await f.flush();
  assert.deepEqual(f.calls, ['/samples/plain.m4a', '/samples/chant.m4a', '/samples/scream.m4a']);
});

test('a paused selection stays paused and same-preset clicks do not restart playback', async () => {
  const f = await fixture(); f.cycle.select('hum'); await f.flush();
  assert.equal(f.calls.length, 0); assert.equal(f.cycle.active, false);
  f.cycle.play(); await f.flush(); f.audio.currentTime = 2;
  const loads = f.audio.loads;
  f.cycle.select('hum'); await f.flush();
  assert.equal(f.calls.length, 1); assert.equal(f.audio.loads, loads); assert.equal(f.audio.currentTime, 2);
  assert.equal(f.cycle.active, true);
});

test('explicit pause invalidates a queued ended event', async () => {
  const f = await fixture(); f.cycle.play(); await f.flush();
  f.audio.ended = true; f.audio.paused = true;
  f.cycle.pause(); f.audio.emit('ended'); await f.flush();
  assert.equal(f.calls.length, 1); assert.equal(f.cycle.selected, 'plain'); assert.equal(f.cycle.active, false);
});

test('duplicate ended events cannot skip the next preset', async () => {
  const f = await fixture(); f.cycle.play(); await f.flush();
  f.end(); f.audio.emit('ended'); await f.flush();
  assert.equal(f.cycle.selected, 'hum'); assert.equal(f.calls.length, 2);
});

test('manual selection supersedes pending playback without stopping the new preset', async () => {
  const f = await fixture(); f.audio.plans.push('pending'); f.cycle.play(); await f.flush();
  f.cycle.select('vocode');
  f.audio.emit('ended');
  f.pending.shift().resolve(); await f.flush();
  assert.equal(f.audio.paused, false); assert.equal(f.cycle.active, true);
  assert.equal(f.cycle.selected, 'vocode'); assert.equal(f.calls.length, 2);
  f.end(); await f.flush(); assert.equal(f.cycle.selected, 'plain');
});

test('old play rejection cannot overwrite a new selection or its explicit playback', async () => {
  const f = await fixture(); f.audio.plans.push('pending'); f.cycle.play(); await f.flush();
  f.cycle.select('clap'); await f.flush();
  f.pending.shift().reject(Error('old failure')); await f.flush();
  assert.equal(f.cycle.selected, 'clap'); assert.equal(f.cycle.active, true);
  assert.equal(f.audio.paused, false); assert.equal(f.message, '');
});

test('old play success cannot stop a newer explicit Play', async () => {
  const f = await fixture(); f.audio.plans.push('pending'); f.cycle.play(); await f.flush();
  f.cycle.select('hum'); await f.flush();
  f.pending.shift().resolve(); await f.flush();
  assert.equal(f.cycle.active, true); assert.equal(f.audio.paused, false);
});

test('Pause also cancels a pending start', async () => {
  const f = await fixture(); f.audio.plans.push('pending'); f.cycle.toggle();
  f.cycle.toggle(); f.pending.shift().resolve(); await f.flush();
  assert.equal(f.cycle.active, false); assert.equal(f.audio.paused, true);
  f.audio.ended = true; f.audio.emit('ended'); assert.equal(f.calls.length, 1);
});

test('native pause or interruption stops cycling, but natural end pause does not', async () => {
  const f = await fixture(); f.cycle.play(); await f.flush();
  f.audio.pause(); await f.flush();
  assert.equal(f.cycle.active, false);
  f.audio.ended = true; f.audio.emit('ended'); assert.equal(f.calls.length, 1);
  f.cycle.play(); await f.flush(); f.end(); await f.flush();
  assert.equal(f.cycle.selected, 'hum'); assert.equal(f.cycle.active, true);
});

test('hiding the page cancels pending work and returning does not restart it', async () => {
  const f = await fixture(); f.audio.plans.push('pending'); f.cycle.play();
  f.hide(); f.pending.shift().resolve(); await f.flush(); f.show();
  f.audio.ended = true; f.audio.emit('ended'); await f.flush();
  assert.equal(f.calls.length, 1); assert.equal(f.cycle.active, false);
});

test('automatic-play rejection stops at the next preset until an explicit retry', async () => {
  const f = await fixture(); f.cycle.play(); await f.flush();
  f.audio.plans.push('reject'); f.end(); await f.flush();
  assert.equal(f.cycle.selected, 'hum'); assert.equal(f.cycle.active, false);
  assert.match(f.message, /Tap Listen/);
  f.audio.ended = true; f.audio.emit('ended'); assert.equal(f.calls.length, 2);
  f.cycle.play(); await f.flush(); assert.equal(f.cycle.active, true); assert.equal(f.message, '');
});

test('a synchronous play failure stops safely without an unhandled promise', async () => {
  const f = await fixture(); f.audio.plans.push('throw'); f.cycle.play(); await f.flush();
  assert.equal(f.cycle.active, false); assert.equal(f.audio.paused, true); assert.match(f.message, /Tap Listen/);
});

test('a stale AudioContext rejection cannot cancel a newer explicit selection', async () => {
  let rejectUnlock;
  let first = true;
  const f = await fixture({ unlock: () => first ? (first = false, new Promise((_, reject) => { rejectUnlock = reject; })) : Promise.resolve() });
  f.cycle.play(); await f.flush(); f.cycle.select('chant'); await f.flush();
  rejectUnlock(Error('old interruption')); await f.flush();
  assert.equal(f.cycle.active, true); assert.equal(f.audio.paused, false); assert.equal(f.message, '');
});

test('teardown stops audio and removes all automatic advancement listeners', async () => {
  const f = await fixture(); f.audio.plans.push('pending'); f.cycle.play();
  f.cycle.destroy(); f.pending.shift().resolve(); await f.flush();
  f.audio.ended = true; f.audio.emit('ended'); f.cycle.play();
  assert.equal(f.calls.length, 1); assert.equal(f.audio.paused, true); assert.equal(f.cycle.active, false);
});

test('a media error stops the cycle and explicit Play reloads that same preset', async () => {
  const f = await fixture(); f.cycle.play(); await f.flush();
  f.audio.error = { code: 3 }; f.audio.emit('error'); await f.flush();
  assert.equal(f.cycle.active, false); assert.match(f.message, /couldn’t load/);
  f.audio.emit('ended'); assert.equal(f.cycle.selected, 'plain');
  f.cycle.play(); await f.flush();
  assert.equal(f.audio.loads, 1); assert.equal(f.cycle.active, true); assert.equal(f.message, '');
  assert.deepEqual(f.calls, ['/samples/plain.m4a', '/samples/plain.m4a']);
});

test('current AudioContext failure stops playback and offers an explicit retry', async () => {
  const f = await fixture({ unlock: () => Promise.reject(Error('interrupted')) });
  f.cycle.play(); await f.flush();
  assert.equal(f.cycle.active, false); assert.equal(f.audio.paused, true); assert.match(f.message, /reconnect/);
});

test('a queued native pause cannot stop a newer explicit Play', async () => {
  const f = await fixture(); f.cycle.play(); await f.flush();
  f.cycle.pause(); f.cycle.play(); await f.flush();
  assert.equal(f.cycle.active, true); assert.equal(f.audio.paused, false);
  f.end(); await f.flush(); assert.equal(f.cycle.selected, 'hum');
});


test('Pause after a selection cancels both old and replacement pending playback', async () => {
  const f = await fixture(); f.audio.plans.push('pending', 'pending');
  f.cycle.play(); f.cycle.select('hum'); f.cycle.pause();
  f.audio.paused = false; // Model a late native start after the explicit pause.
  for (const request of f.pending.splice(0)) request.resolve();
  await f.flush();
  f.audio.ended = true; f.audio.emit('ended');
  assert.equal(f.audio.paused, true); assert.equal(f.cycle.active, false);
  assert.equal(f.cycle.selected, 'hum'); assert.equal(f.calls.length, 2);
});

test('a native pause queued before selection keeps the new preset paused', async () => {
  const f = await fixture(); f.cycle.play(); await f.flush();
  f.audio.pause(); // The pause event has not been dispatched yet.
  f.cycle.select('whisper'); await f.flush();
  assert.equal(f.cycle.active, false); assert.equal(f.audio.paused, true);
  assert.equal(f.cycle.selected, 'whisper'); assert.equal(f.calls.length, 1);
});

test('rapid selections keep only the latest preset and advance from it', async () => {
  const f = await fixture(); f.audio.plans.push('pending', 'pending', 'pending');
  f.cycle.play(); f.cycle.select('hum'); f.cycle.select('clap');
  const [first, second, current] = f.pending.splice(0);
  second.reject(Error('superseded')); current.resolve(); first.resolve();
  await f.flush();
  assert.equal(f.cycle.selected, 'clap'); assert.equal(f.cycle.active, true); assert.equal(f.message, '');
  f.end(); await f.flush(); assert.equal(f.cycle.selected, 'vocode');
});
