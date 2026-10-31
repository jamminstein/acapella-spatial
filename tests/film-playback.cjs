'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'landing.js'), 'utf8');

function fixture({ reduced = false, hash = '', autoplay = true, seed = 1 } = {}) {
  const mediaEvents = [];
  class Target {
    constructor() { this.listeners = {}; }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
    emit(name, detail = {}) { for (const fn of this.listeners[name] || []) fn({ button: 0, ...detail }); }
  }
  class Button extends Target {
    constructor() { super(); this.attrs = {}; this.dataset = {}; this.label = { textContent: '' }; }
    getAttribute(name) { return this.attrs[name]; }
    setAttribute(name, value) { this.attrs[name] = value; }
    querySelector() { return this.label; }
  }
  const details = new Target();
  details.open = true;
  details.contains = video => video.id === 'first-person-film';
  class Video extends Target {
    constructor(id) {
      super(); Object.assign(this, { id, _muted: false, _volume: 1, paused: true,
        ended: false, preload: 'none', calls: [], plans: [], pending: [], loads: 0, currentTime: 0 });
      this.dataset = { perspective: id.startsWith('third') ? 'third' : 'first', soundtrack: 'mouth-made-symphony' };
      this.source = { src: `media/videos/soundtracks-v2/${this.dataset.perspective}-mouth-made-symphony.mp4` };
      this.caption = { src: 'media/videos/soundtracks-v2/mouth-made-symphony.vtt', track: { mode: 'disabled' } };
      this.fallback = { href: this.source.src };
    }
    queue(name) {
      const event = () => this.emit(name); event.video = this; event.mediaType = name; mediaEvents.push(event);
    }
    querySelector(selector) { return { 'source': this.source, 'track': this.caption, '[data-film-fallback]': this.fallback }[selector] || null; }
    load() {
      this.loads++; this.paused = true; this.ended = false; this.currentTime = 0;
      // A native load clears queued tasks from the old media resource.
      for (let n = mediaEvents.length - 1; n >= 0; n--) {
        if (mediaEvents[n].video === this && ['play', 'pause'].includes(mediaEvents[n].mediaType)) mediaEvents.splice(n, 1);
      }
    }
    get muted() { return this._muted; }
    set muted(value) {
      if (this._muted !== value) { this._muted = value; this.queue('volumechange'); }
    }
    get volume() { return this._volume; }
    set volume(value) {
      if (this._volume !== value) { this._volume = value; this.queue('volumechange'); }
    }
    closest() { return details.contains(this) ? details : null; }
    play() {
      this.calls.push({ muted: this.muted, volume: this.volume });
      const plan = this.plans.shift() || 'ok';
      if (plan === 'throwPolicy') throw Object.assign(new Error('blocked'), { name: 'NotAllowedError' });
      if (plan === 'policy' || plan === 'decode' || plan === 'abort') {
        const name = { policy: 'NotAllowedError', decode: 'NotSupportedError', abort: 'AbortError' }[plan];
        return Promise.reject(Object.assign(new Error(plan), { name }));
      }
      const wasPaused = this.paused;
      this.paused = false;
      if (wasPaused) this.queue('play');
      if (plan === 'pending') return new Promise((resolve, reject) => this.pending.push({ resolve, reject }));
      return Promise.resolve();
    }
    pause() {
      if (!this.paused) { this.paused = true; this.queue('pause'); }
    }
  }
  const videos = [new Video('third-person-film'), new Video('first-person-film')];
  const buttons = [new Button(), new Button()];
  const motion = new Target(); motion.matches = reduced;
  const policy = { open: false };
  const privacyLink = new Target();
  const document = new Target(); document.hidden = false; document.body = { dataset: { autoplay: autoplay ? 'on' : 'off' } };
  document.querySelector = selector => selector === '.privacy-details' ? policy :
    buttons[videos.findIndex(video => selector === `.sound-toggle[aria-controls="${video.id}"]`)];
  document.querySelectorAll = selector => ({
    'video': videos, 'a[href="#privacy"]': [privacyLink], '.inside-view': [details]
  })[selector] || [];
  let notify;
  class IntersectionObserver {
    constructor(callback) { notify = callback; }
    observe() {}
  }
  const window = new Target();
  window.location = { hash };
  window.matchMedia = () => motion;
  window.IntersectionObserver = IntersectionObserver;
  const randomMath = Object.create(Math);
  randomMath.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  vm.runInNewContext(source, { window, document, IntersectionObserver, Promise, Math: randomMath });
  const enter = (index, ratio = .8) => notify([{ target: videos[index], isIntersecting: ratio > 0, intersectionRatio: ratio }]);
  const switchTo = (from, to) => notify([
    { target: videos[from], isIntersecting: false, intersectionRatio: 0 },
    { target: videos[to], isIntersecting: true, intersectionRatio: .8 }
  ]);
  async function flush() {
    for (let n = 0; n < 12; n++) {
      await Promise.resolve();
      const events = mediaEvents.splice(0);
      for (const event of events) event();
    }
  }
  const rejectPolicy = (index) => videos[index].pending.shift().reject(Object.assign(new Error('late policy'), { name: 'NotAllowedError' }));
  const soundOn = index => { videos[index].muted = true; buttons[index].emit('click'); };
  return { videos, buttons, enter, switchTo, flush, rejectPolicy, motion, document,
    details, window, policy, privacyLink, soundOn };
}

const tests = [];
function test(name, run) { tests.push({ name, run }); }

test('audible playback is the first viewport attempt', async () => {
  const f = fixture(); f.enter(0); await f.flush();
  assert.deepEqual(f.videos[0].calls, [{ muted: false, volume: 1 }]);
  assert.equal(f.buttons[0].label.textContent, 'Sound off');
});
test('policy rejection falls back once, without making mute a shared preference', async () => {
  const f = fixture(); f.videos[0].plans.push('policy'); f.enter(0); await f.flush();
  assert.deepEqual(f.videos[0].calls.map(c => c.muted), [false, true]);
  f.switchTo(0, 1); await f.flush();
  assert.equal(f.videos[1].calls[0].muted, false);
});
test('synchronous policy throw falls back to muted playback', async () => {
  const f = fixture(); f.videos[0].plans.push('throwPolicy'); f.enter(0); await f.flush();
  assert.deepEqual(f.videos[0].calls.map(c => c.muted), [false, true]);
});
for (const error of ['decode', 'abort']) test(`${error} failure does not trigger muted fallback`, async () => {
  const f = fixture(); f.videos[0].plans.push(error); f.enter(0); await f.flush();
  assert.equal(f.videos[0].calls.length, 1); assert.equal(f.videos[0].paused, true);
});
test('a blocked muted attempt does not loop, but can retry after re-entry', async () => {
  const f = fixture(); f.videos[0].plans.push('policy', 'policy'); f.enter(0); await f.flush();
  f.enter(0, .6); await f.flush(); assert.equal(f.videos[0].calls.length, 2);
  f.enter(0, 0); f.enter(0); await f.flush(); assert.equal(f.videos[0].calls.length, 3);
});
test('late rejection cannot restart an offscreen film', async () => {
  const f = fixture(); f.videos[0].plans.push('pending'); f.enter(0); f.enter(0, 0);
  f.rejectPolicy(0); await f.flush();
  assert.equal(f.videos[0].calls.length, 1); assert.equal(f.videos[0].paused, true);
});
test('late resolution of muted fallback cannot restart an offscreen film', async () => {
  const f = fixture(); f.videos[0].plans.push('policy', 'pending'); f.enter(0); await f.flush();
  f.enter(0, 0); f.videos[0].pending.shift().resolve(); await f.flush();
  assert.equal(f.videos[0].calls.length, 2); assert.equal(f.videos[0].paused, true);
});
test('superseded request cannot steal playback from the other film', async () => {
  const f = fixture(); f.videos[0].plans.push('pending'); f.enter(0); f.switchTo(0, 1);
  f.rejectPolicy(0); await f.flush();
  assert.equal(f.videos[0].paused, true); assert.equal(f.videos[1].paused, false);
  assert.equal(f.videos[0].calls.length, 1); assert.equal(f.videos[1].muted, false);
});
test('hidden tab cancels pending request and late rejection', async () => {
  const f = fixture(); f.videos[0].plans.push('pending'); f.enter(0);
  f.document.hidden = true; f.document.emit('visibilitychange'); f.rejectPolicy(0); await f.flush();
  assert.equal(f.videos[0].calls.length, 1); assert.equal(f.videos[0].paused, true);
});
test('a late old success does not cancel a newer explicit playback', async () => {
  const f = fixture(); f.videos[0].plans.push('pending'); f.enter(0); f.enter(0, 0);
  f.soundOn(0); f.videos[0].pending.shift().resolve(); await f.flush();
  assert.equal(f.videos[0].calls.length, 2); assert.equal(f.videos[0].paused, false);
});
test('manual pause survives scroll-out, scroll-back and tab visibility', async () => {
  const f = fixture(); f.enter(0); await f.flush(); f.videos[0].pause(); await f.flush();
  f.enter(0, 0); f.enter(0); f.document.hidden = true; f.document.emit('visibilitychange');
  f.document.hidden = false; f.document.emit('visibilitychange'); await f.flush();
  assert.equal(f.videos[0].calls.length, 1); assert.equal(f.videos[0].paused, true);
  f.soundOn(0); await f.flush(); assert.equal(f.videos[0].paused, false);
});
test('native play takes exclusive ownership', async () => {
  const f = fixture(); f.enter(0); f.enter(1); await f.flush();
  await f.videos[1].play(); await f.flush();
  assert.equal(f.videos[0].paused, true); assert.equal(f.videos[1].paused, false);
});
test('dedicated mute preference follows the next film', async () => {
  const f = fixture(); f.enter(0); await f.flush(); f.buttons[0].emit('click'); await f.flush();
  f.switchTo(0, 1); await f.flush(); assert.equal(f.videos[1].calls[0].muted, true);
});
test('native mute preference follows the next film', async () => {
  const f = fixture(); f.enter(0); await f.flush(); f.videos[0].muted = true; await f.flush();
  f.switchTo(0, 1); await f.flush(); assert.equal(f.videos[1].calls[0].muted, true);
});
test('native volume follows both films and Sound on restores nonzero volume', async () => {
  const f = fixture(); f.enter(0); await f.flush(); f.videos[0].volume = .25; await f.flush();
  f.switchTo(0, 1); await f.flush(); assert.equal(f.videos[1].calls[0].volume, .25);
  f.videos[1].volume = 0; await f.flush(); assert.equal(f.videos[0].muted, true);
  f.buttons[1].emit('click'); await f.flush();
  assert.equal(f.videos[1].volume, .25); assert.equal(f.videos[1].muted, false);
  assert.equal(f.videos[0].volume, .25); assert.equal(f.videos[0].muted, false);
});
test('a queued native mute is not lost when viewport changes before volumechange', async () => {
  const f = fixture(); f.enter(0); await f.flush(); f.videos[0].muted = true;
  f.switchTo(0, 1); await f.flush(); assert.equal(f.videos[1].calls[0].muted, true);
});
test('a queued native mute is not erased by policy fallback', async () => {
  const f = fixture(); f.videos[0].plans.push('pending'); f.enter(0);
  f.videos[0].muted = true; f.rejectPolicy(0); await f.flush();
  f.switchTo(0, 1); await f.flush(); assert.equal(f.videos[1].calls[0].muted, true);
});
test('Sound on requests playback synchronously during its click', async () => {
  const f = fixture(); f.videos[0].plans.push('policy'); f.enter(0); await f.flush();
  f.videos[0].pause(); await f.flush(); f.buttons[0].emit('click');
  assert.equal(f.videos[0].calls.length, 3); assert.equal(f.videos[0].calls[2].muted, false);
  await f.flush(); assert.equal(f.videos[0].paused, false);
});
test('Sound off does not resume a manually paused film', async () => {
  const f = fixture(); f.enter(0); await f.flush(); f.videos[0].pause(); await f.flush();
  f.buttons[0].emit('click'); await f.flush();
  assert.equal(f.videos[0].paused, true); assert.equal(f.videos[0].calls.length, 1);
});
test('reduced motion blocks autoplay, but Sound on permits manual playback', async () => {
  const f = fixture({ reduced: true }); f.enter(0); await f.flush();
  assert.equal(f.videos[0].calls.length, 0);
  f.soundOn(0); assert.equal(f.videos[0].calls.length, 1);
  await f.flush(); assert.equal(f.videos[0].muted, false); assert.equal(f.videos[0].paused, false);
});
test('enabling reduced motion cancels pending auto fallback', async () => {
  const f = fixture(); f.videos[0].plans.push('pending'); f.enter(0);
  f.motion.matches = true; f.motion.emit('change'); f.rejectPolicy(0); await f.flush();
  assert.equal(f.videos[0].calls.length, 1); assert.equal(f.videos[0].paused, true);
});
test('reduced motion does not pause a film explicitly started with Sound on', async () => {
  const f = fixture(); f.enter(0); f.soundOn(0); await f.flush();
  f.motion.matches = true; f.motion.emit('change'); await f.flush();
  assert.equal(f.videos[0].paused, false);
});
test('closed first-person details cancel pending fallback', async () => {
  const f = fixture(); f.videos[1].plans.push('pending'); f.enter(1);
  f.details.open = false; f.details.emit('toggle'); f.rejectPolicy(1); await f.flush();
  assert.equal(f.videos[1].calls.length, 1); assert.equal(f.videos[1].paused, true);
});
test('finished film does not autoplay again after viewport re-entry', async () => {
  const f = fixture(); f.enter(0); await f.flush();
  f.videos[0].ended = true; f.videos[0].pause(); f.videos[0].emit('ended'); await f.flush();
  f.enter(0, 0); f.enter(0); await f.flush(); assert.equal(f.videos[0].calls.length, 1);
});
test('privacy hash, privacy link and hashchange continue to reveal policy', async () => {
  const f = fixture({ hash: '#privacy' }); assert.equal(f.policy.open, true);
  f.policy.open = false; f.privacyLink.emit('click'); assert.equal(f.policy.open, true);
  f.policy.open = false; f.window.emit('hashchange'); assert.equal(f.policy.open, true);
  assert.equal((f.document.listeners.click || []).length, 0);
  assert.equal((f.window.listeners.click || []).length, 0);
});

test('each visit assigns distinct playable songs with matching captions and fallback links', async () => {
  const expected = new Set(['mouth-made-symphony', 'breath-and-clicks-2', 'breath-and-clicks', 'clicks-in-cheek']);
  const heard = [new Set(), new Set()];
  for (let seed = 1; seed <= 40; seed++) {
    const f = fixture({ seed: seed * 7919 });
    assert.notEqual(f.videos[0].dataset.soundtrack, f.videos[1].dataset.soundtrack);
    f.videos.forEach((video, index) => {
      const id = video.dataset.soundtrack;
      assert(expected.has(id)); heard[index].add(id);
      assert(video.source.src.endsWith(`/${video.dataset.perspective}-${id}.mp4`));
      assert(video.caption.src.endsWith(`/${id}.vtt`));
      assert.equal(video.fallback.href, video.source.src);
      for (const resource of [video.source.src, video.caption.src]) {
        assert(fs.existsSync(path.join(__dirname, '..', resource)), `Missing media: ${resource}`);
      }
      assert.equal(video.calls.length, 0);
      assert.equal(video.preload, 'none');
    });
  }
  heard.forEach(songs => assert.deepEqual(songs, expected));
});
test('songs and playheads stay fixed through scrolling, manual pauses and replays', async () => {
  const f = fixture();
  const resources = f.videos.map(video => ({ src: video.source.src, loads: video.loads }));
  f.enter(0); await f.flush(); f.videos[0].currentTime = 14;
  f.switchTo(0, 1); await f.flush(); f.switchTo(1, 0); await f.flush();
  f.videos[0].pause(); await f.flush(); f.soundOn(0); await f.flush();
  assert.equal(f.videos[0].currentTime, 14);
  f.videos[0].ended = true; f.videos[0].pause(); f.videos[0].emit('ended'); await f.flush();
  f.videos[0].ended = false; f.videos[0].currentTime = 0;
  await f.videos[0].play(); await f.flush();
  assert.equal(f.videos[0].paused, false);
  assert.deepEqual(f.videos.map(video => ({ src: video.source.src, loads: video.loads })), resources);
});
test('manual-only mode still allows Sound on without autoplay', async () => {
  const f = fixture({ autoplay: false }); f.enter(0); f.enter(1); await f.flush();
  assert(f.videos.every(video => video.calls.length === 0));
  f.soundOn(1); await f.flush(); assert.equal(f.videos[1].paused, false);
});

(async () => {
  let failures = 0;
  for (const { name, run } of tests) {
    try { await run(); console.log(`PASS ${name}`); }
    catch (error) { failures++; console.error(`FAIL ${name}\n${error.stack}`); }
  }
  console.log(`${tests.length - failures}/${tests.length} passed`);
  process.exitCode = failures ? 1 : 0;
})();
