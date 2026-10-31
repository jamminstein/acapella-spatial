'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'landing.js'), 'utf8');

function fixture({ reduced = false, hash = '', autoplay = true, seed = 1, coarse = false, ios = false, ipad = false, alreadyPlaying = false } = {}) {
  const mediaEvents = [];
  class Target {
    constructor() { this.listeners = {}; }
    addEventListener(name, fn, options = {}) {
      const listener = options.once ? event => {
        this.listeners[name] = this.listeners[name].filter(item => item !== listener);
        fn(event);
      } : fn;
      (this.listeners[name] ||= []).push(listener);
    }
    emit(name, detail = {}) { for (const fn of this.listeners[name] || []) fn({ button: 0, ...detail }); }
  }
  class Button extends Target {
    constructor() { super(); this.attrs = {}; this.dataset = {}; this.hidden = true; this.label = { textContent: '' }; }
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
        ended: false, preload: 'none', played: { length: 0 }, soundWrites: [], error: null, webkitDisplayingFullscreen: false, webkitPresentationMode: 'inline', calls: [], plans: [], pending: [], loads: 0, currentTime: 0 });
      this.dataset = { perspective: id.startsWith('third') ? 'third' : 'first', soundtrack: 'mouth-made-symphony' };
      this.source = { src: `media/videos/soundtracks-v2/${this.dataset.perspective}-mouth-made-symphony.mp4` };
      this.caption = { src: 'media/videos/soundtracks-v2/mouth-made-symphony.vtt', track: { mode: 'disabled' },
        attached: true, remove() { this.attached = false; } };
      this.captionAtLoad = [];
      this.fallback = { href: this.source.src };
    }
    get src() { return this._src || ''; }
    set src(value) { this._src = value; this.load(); }
    append(element) { element.attached = true; }
    queue(name) {
      const event = () => this.emit(name); event.video = this; event.mediaType = name; mediaEvents.push(event);
    }
    querySelector(selector) { return { 'source': this.source, 'track': this.caption, '[data-film-fallback]': this.fallback }[selector] || null; }
    load() {
      this.captionAtLoad.push(this.caption.attached);
      this.loads++; this.paused = true; this.ended = false; this.error = null; this.currentTime = 0;
      // A native load clears queued tasks from the old media resource.
      for (let n = mediaEvents.length - 1; n >= 0; n--) {
        if (mediaEvents[n].video === this && ['play', 'pause'].includes(mediaEvents[n].mediaType)) mediaEvents.splice(n, 1);
      }
    }
    get muted() { return this._muted; }
    set muted(value) {
      this.soundWrites.push({ muted: value });
      if (this._muted !== value) { this._muted = value; this.queue('volumechange'); }
    }
    get volume() { return this._volume; }
    set volume(value) {
      this.soundWrites.push({ volume: value });
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
  if (alreadyPlaying) { videos[0].paused = false; videos[0].currentTime = 7; videos[0].played.length = 1; }
  const recovery = [{ hidden: true }, { hidden: true }];
  const directLinks = [{ href: '' }, { href: '' }];
  const buttons = [new Button(), new Button()];
  const playButtons = [new Button(), new Button()];
  const motion = new Target(); motion.matches = reduced;
  const policy = { open: false };
  const privacyLink = new Target();
  const document = new Target(); document.hidden = false; document.body = { dataset: { autoplay: autoplay ? 'on' : 'off' } };
  document.querySelector = selector => selector === '.privacy-details' ? policy :
    buttons[videos.findIndex(video => selector === `.sound-toggle[aria-controls="${video.id}"]`)] ||
    playButtons[videos.findIndex(video => selector === `.film-play[aria-controls="${video.id}"]`)] ||
    recovery[videos.findIndex(video => selector === `[data-film-recovery="${video.id}"]`)] ||
    directLinks[videos.findIndex(video => selector === `[data-film-direct="${video.id}"]`)];
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
  window.matchMedia = query => query.includes('prefers-reduced-motion') ? motion : { matches: coarse };
  window.IntersectionObserver = IntersectionObserver;
  const randomMath = Object.create(Math);
  randomMath.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  vm.runInNewContext(source, { window, document, IntersectionObserver, Promise, Math: randomMath, navigator: { userAgent: ios ? 'iPhone' : 'Macintosh', platform: 'MacIntel', maxTouchPoints: ipad ? 5 : 0 } });
  const enter = (index, ratio = .8) => notify?.([{ target: videos[index], isIntersecting: ratio > 0, intersectionRatio: ratio }]);
  const switchTo = (from, to) => notify?.([
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
  return { videos, buttons, playButtons, recovery, directLinks, observed: Boolean(notify), enter, switchTo, flush, rejectPolicy, motion, document,
    details, window, policy, privacyLink, soundOn };
}

const tests = [];
function test(name, run) { tests.push({ name, run }); }

for (const ios of [false, true]) test(`captions remain available without blocking ${ios ? 'iPhone' : 'desktop'} source loading`, async () => {
  const f = fixture({ ios });
  for (const video of f.videos) {
    assert.deepEqual(video.captionAtLoad, [false]);
    assert.equal(video.caption.attached, false);
    assert.ok(video.caption.src.endsWith(`/${video.dataset.soundtrack}.vtt`));
    video.emit('loadedmetadata');
    assert.equal(video.caption.attached, true);
    assert.equal(video.listeners.loadedmetadata.length, 0);
    assert.equal(video.loads, 1);
  }
});
test('a film already started before initialization keeps its captions and source', () => {
  const f = fixture({ ios: true, alreadyPlaying: true });
  assert.equal(f.videos[0].caption.attached, true);
  assert.equal(f.videos[0].loads, 0);
  assert.equal(f.videos[0].currentTime, 7);
});

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
      assert.equal(video.preload, 'metadata');
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

test('a stopped video offers Play instead of a misleading sound toggle', async () => {
  const f = fixture({ reduced: true });
  assert.equal(f.playButtons[0].hidden, false);
  assert.equal(f.playButtons[0].label.textContent, 'Play');
  assert.equal(f.buttons[0].hidden, true);
  f.playButtons[0].emit('click');
  assert.deepEqual(f.videos[0].calls, [{ muted: false, volume: 1 }]);
  await f.flush();
  assert.equal(f.playButtons[0].hidden, true);
  assert.equal(f.buttons[0].hidden, false);
});
test('one Play tap recovers when Safari blocks both autoplay attempts', async () => {
  const f = fixture(); f.videos[0].plans.push('policy', 'policy'); f.enter(0); await f.flush();
  assert.equal(f.playButtons[0].hidden, false);
  assert.equal(f.buttons[0].hidden, true);
  f.playButtons[0].emit('click');
  assert.equal(f.videos[0].calls.length, 3);
  assert.equal(f.videos[0].calls[2].muted, false);
  await f.flush(); assert.equal(f.videos[0].paused, false);
});
test('native pause reveals Play and one tap resumes without resetting the song or playhead', async () => {
  const f = fixture(); f.enter(0); await f.flush();
  const resource = f.videos[0].source.src;
  f.videos[0].currentTime = 12; f.videos[0].pause(); await f.flush();
  assert.equal(f.playButtons[0].hidden, false); assert.equal(f.buttons[0].hidden, true);
  f.playButtons[0].emit('click'); await f.flush();
  assert.equal(f.videos[0].paused, false); assert.equal(f.videos[0].currentTime, 12);
  assert.equal(f.videos[0].source.src, resource);
});
test('Play respects a deliberate mute', async () => {
  const f = fixture(); f.enter(0); await f.flush();
  f.buttons[0].emit('click'); await f.flush(); f.videos[0].pause(); await f.flush();
  f.playButtons[0].emit('click'); await f.flush();
  assert.equal(f.videos[0].paused, false); assert.equal(f.videos[0].muted, true);
});
test('a media error exposes a retry that reloads and plays in the same click', async () => {
  const f = fixture(); const loads = f.videos[0].loads;
  f.videos[0].error = { code: 2 }; f.videos[0].emit('error'); await f.flush();
  assert.equal(f.playButtons[0].hidden, false); assert.equal(f.playButtons[0].label.textContent, 'Try again');
  f.playButtons[0].emit('click');
  assert.equal(f.videos[0].loads, loads + 1); assert.equal(f.videos[0].calls.length, 1);
  await f.flush(); assert.equal(f.videos[0].paused, false);
});
test('an ended video offers Replay', async () => {
  const f = fixture(); f.enter(0); await f.flush();
  f.videos[0].ended = true; f.videos[0].pause(); f.videos[0].emit('ended'); await f.flush();
  assert.equal(f.playButtons[0].hidden, false); assert.equal(f.playButtons[0].label.textContent, 'Replay');
});
test('Safari fullscreen survives offscreen reports and page visibility changes', async () => {
  const f = fixture(); f.enter(0); await f.flush();
  f.videos[0].webkitDisplayingFullscreen = true; f.videos[0].emit('webkitbeginfullscreen');
  f.enter(0, 0); f.document.hidden = true; f.document.emit('visibilitychange'); await f.flush();
  assert.equal(f.videos[0].paused, false);
  f.videos[0].webkitDisplayingFullscreen = false; f.videos[0].emit('webkitendfullscreen'); await f.flush();
  assert.equal(f.videos[0].paused, true);
});
test('inline autoplay cannot steal playback from Safari fullscreen', async () => {
  const f = fixture(); f.enter(0); await f.flush();
  f.videos[0].webkitDisplayingFullscreen = true; f.videos[0].emit('webkitbeginfullscreen');
  f.switchTo(0, 1); await f.flush();
  assert.equal(f.videos[0].paused, false); assert.equal(f.videos[1].calls.length, 0);
});
test('picture-in-picture continues outside the page and pauses on return offscreen', async () => {
  const f = fixture(); f.enter(1); await f.flush();
  f.videos[1].webkitPresentationMode = 'picture-in-picture'; f.videos[1].emit('webkitpresentationmodechanged');
  f.enter(1, 0); f.document.hidden = true; f.document.emit('visibilitychange'); await f.flush();
  assert.equal(f.videos[1].paused, false);
  f.videos[1].webkitPresentationMode = 'inline'; f.videos[1].emit('webkitpresentationmodechanged'); await f.flush();
  assert.equal(f.videos[1].paused, true);
});
test('standard fullscreen receives the same offscreen protection', async () => {
  const f = fixture(); f.enter(0); await f.flush();
  f.document.fullscreenElement = f.videos[0]; f.document.emit('fullscreenchange');
  f.switchTo(0, 1); await f.flush(); assert.equal(f.videos[0].paused, false);
  f.document.fullscreenElement = null; f.document.emit('fullscreenchange'); await f.flush();
  assert.equal(f.videos[0].paused, true);
});

test('pausing fullscreen does not start a different inline video', async () => {
  const f = fixture(); f.enter(0); await f.flush();
  f.videos[0].webkitDisplayingFullscreen = true; f.videos[0].emit('webkitbeginfullscreen');
  f.videos[0].pause(); await f.flush(); f.switchTo(0, 1); await f.flush();
  assert.equal(f.videos[1].calls.length, 0);
});
test('fullscreen-to-PiP handoff does not pause between Safari presentation events', async () => {
  const f = fixture(); f.enter(0); await f.flush();
  f.videos[0].webkitDisplayingFullscreen = true; f.videos[0].emit('webkitbeginfullscreen'); f.enter(0, 0);
  f.videos[0].webkitPresentationMode = 'picture-in-picture';
  f.videos[0].webkitDisplayingFullscreen = false; f.videos[0].emit('webkitendfullscreen');
  f.videos[0].emit('webkitpresentationmodechanged'); await f.flush();
  assert.equal(f.videos[0].paused, false);
});

for (const [device, options] of [['touch phone', { coarse: true }], ['iPhone with fine pointer', { ios: true }], ['iPad desktop identity', { ipad: true }]]) {
  test(`${device} uses native playback without custom controls or automatic play`, async () => {
    const f = fixture(options); f.enter(0); f.document.emit('visibilitychange'); await f.flush();
    assert.equal(f.document.body.dataset.player, 'native'); assert.equal(f.observed, false);
    f.videos.forEach(v => { assert.equal(v.calls.length, 0); assert.equal(v.soundWrites.length, 0); });
    assert(f.playButtons.every(b => b.hidden)); assert(f.buttons.every(b => b.hidden));
  });
}
test('native playback survives visibility, scrolling, and fullscreen event ordering', async () => {
  const f = fixture({ ios: true }); await f.videos[0].play(); await f.flush();
  f.videos[0].currentTime = 12;
  f.enter(0, 0); f.document.hidden = true; f.document.emit('visibilitychange');
  f.videos[0].emit('webkitbeginfullscreen'); f.videos[0].emit('webkitendfullscreen');
  f.document.emit('fullscreenchange'); await f.flush();
  assert.equal(f.videos[0].paused, false); assert.equal(f.videos[0].currentTime, 12);
  assert.equal(f.videos[0].calls.length, 1);
});
test('native manual pause never triggers an automatic restart', async () => {
  const f = fixture({ ios: true }); await f.videos[0].play(); await f.flush();
  f.videos[0].pause(); await f.flush(); f.enter(0); f.document.emit('visibilitychange'); f.motion.emit('change'); await f.flush();
  assert.equal(f.videos[0].paused, true); assert.equal(f.videos[0].calls.length, 1);
});
test('native play stops only the previously playing film and preserves native mute', async () => {
  const f = fixture({ ios: true }); await f.videos[0].play(); await f.flush();
  f.videos[0].muted = true; await f.flush(); await f.videos[1].play(); await f.flush();
  assert.equal(f.videos[0].paused, true); assert.equal(f.videos[1].paused, false);
  assert.equal(f.videos[0].muted, true); assert.equal(f.videos[1].muted, false);
  assert.equal(f.videos[0].soundWrites.length, 1); assert.equal(f.videos[1].soundWrites.length, 0);
});
test('native source assignment never interrupts a play started before the script arrives', async () => {
  const f = fixture({ ios: true, alreadyPlaying: true }); await f.flush();
  assert.equal(f.videos[0].loads, 0); assert.equal(f.videos[0].currentTime, 7);
  assert.equal(f.videos[0].paused, false); assert.equal(f.videos[0].dataset.soundtrack, 'mouth-made-symphony');
});
test('native songs, captions and direct links stay fixed across replay and scrolling', async () => {
  const f = fixture({ ios: true });
  const sources = f.videos.map(v => v.src);
  assert.notEqual(f.videos[0].dataset.soundtrack, f.videos[1].dataset.soundtrack);
  f.videos.forEach((v, i) => { assert.equal(v.src, v.source.src); assert.equal(f.directLinks[i].href, v.src); });
  await f.videos[0].play(); await f.flush(); f.videos[0].pause(); await f.flush();
  f.enter(0, 0); f.enter(0); await f.videos[0].play(); await f.flush();
  assert.deepEqual(f.videos.map(v => v.src), sources); assert(f.videos.every(v => v.loads === 1));
});
test('a native media error exposes the selected file as a direct fallback', async () => {
  const f = fixture({ ios: true }); f.videos[0].error = { code: 2 }; f.videos[0].emit('error');
  assert.equal(f.recovery[0].hidden, false); assert.equal(f.directLinks[0].href, f.videos[0].src);
  f.videos[0].error = null; f.videos[0].emit('playing'); assert.equal(f.recovery[0].hidden, true);
});
test('closing the native perspective explicitly pauses its video', async () => {
  const f = fixture({ ios: true }); await f.videos[1].play(); await f.flush();
  f.details.open = false; f.details.emit('toggle'); await f.flush();
  assert.equal(f.videos[1].paused, true);
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
