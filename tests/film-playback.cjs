'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'landing.js'), 'utf8');

function fixture({ reduced = false, hash = '', autoplay = true } = {}) {
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
  const trackIds = ['mouth-made-symphony', 'breath-and-clicks-2', 'breath-and-clicks', 'clicks-in-cheek'];
  const trackButtons = videos.flatMap(video => trackIds.map(id => {
    const button = new Button(); button.dataset.soundtrack = id; button.attrs['aria-controls'] = video.id; return button;
  }));
  const fullLinks = [new Button(), new Button()];
  const motion = new Target(); motion.matches = reduced;
  const policy = { open: false };
  const privacyLink = new Target();
  const cta = new Target();
  const document = new Target(); document.hidden = false; document.body = { dataset: { autoplay: autoplay ? 'on' : 'off' } };
  document.querySelector = selector => selector === '.privacy-details' ? policy :
    buttons[videos.findIndex(video => selector === `.sound-toggle[aria-controls="${video.id}"]`)];
  document.querySelectorAll = selector => ({
    'video': videos, 'a[href="#privacy"]': [privacyLink], '.inside-view': [details],
    '.actions a[href="#films"]': [cta], '.soundtrack-button': trackButtons, '[data-full-track]': fullLinks
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
  vm.runInNewContext(source, { window, document, IntersectionObserver, Promise });
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
  const choose = (index, id) => trackButtons.find(button => button.attrs['aria-controls'] === videos[index].id && button.dataset.soundtrack === id).emit('click');
  return { videos, buttons, trackButtons, fullLinks, choose, enter, switchTo, flush, rejectPolicy, motion, document,
    details, window, policy, privacyLink, cta };
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
  f.cta.emit('click'); f.videos[0].pending.shift().resolve(); await f.flush();
  assert.equal(f.videos[0].calls.length, 2); assert.equal(f.videos[0].paused, false);
});
test('manual pause survives scroll-out, scroll-back and tab visibility', async () => {
  const f = fixture(); f.enter(0); await f.flush(); f.videos[0].pause(); await f.flush();
  f.enter(0, 0); f.enter(0); f.document.hidden = true; f.document.emit('visibilitychange');
  f.document.hidden = false; f.document.emit('visibilitychange'); await f.flush();
  assert.equal(f.videos[0].calls.length, 1); assert.equal(f.videos[0].paused, true);
  f.cta.emit('click'); await f.flush(); assert.equal(f.videos[0].paused, false);
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
test('reduced motion blocks autoplay, but dedicated Watch permits manual playback', async () => {
  const f = fixture({ reduced: true }); f.enter(0); await f.flush();
  assert.equal(f.videos[0].calls.length, 0);
  f.cta.emit('click'); assert.equal(f.videos[0].calls.length, 1);
  await f.flush(); assert.equal(f.videos[0].muted, false); assert.equal(f.videos[0].paused, false);
});
test('enabling reduced motion cancels pending auto fallback', async () => {
  const f = fixture(); f.videos[0].plans.push('pending'); f.enter(0);
  f.motion.matches = true; f.motion.emit('change'); f.rejectPolicy(0); await f.flush();
  assert.equal(f.videos[0].calls.length, 1); assert.equal(f.videos[0].paused, true);
});
test('reduced motion does not pause a film explicitly started with Watch', async () => {
  const f = fixture(); f.enter(0); f.cta.emit('click'); await f.flush();
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
test('modified Watch navigation does not force current-page sound', async () => {
  const f = fixture(); f.cta.emit('click', { metaKey: true }); await f.flush();
  assert.equal(f.videos[0].calls.length, 0);
});
test('privacy hash, privacy link and hashchange continue to reveal policy', async () => {
  const f = fixture({ hash: '#privacy' }); assert.equal(f.policy.open, true);
  f.policy.open = false; f.privacyLink.emit('click'); assert.equal(f.policy.open, true);
  f.policy.open = false; f.window.emit('hashchange'); assert.equal(f.policy.open, true);
  assert.equal((f.document.listeners.click || []).length, 0);
  assert.equal((f.window.listeners.click || []).length, 0);
});

test('both film palettes default to Mouth-Made Symphony', async () => {
  const f = fixture();
  assert.equal(f.trackButtons.filter(b => b.attrs['aria-pressed'] === 'true').length, 2);
  assert(f.videos.every(v => v.source.src.endsWith('-mouth-made-symphony.mp4')));
  assert(f.fullLinks.every(link => link.href.endsWith('/mouth-made-symphony.m4a')));
});
test('choosing music swaps both sources but synchronously plays only the clicked film', async () => {
  const f = fixture(); f.enter(0); await f.flush(); f.videos[0].currentTime = 12;
  f.choose(1, 'breath-and-clicks-2');
  assert.equal(f.videos[1].calls.length, 1);
  assert(f.videos.every(v => v.loads === 1 && v.currentTime === 0));
  await f.flush();
  assert.equal(f.videos[0].paused, true); assert.equal(f.videos[1].paused, false);
  assert(f.videos.every(v => v.source.src.endsWith('-breath-and-clicks-2.mp4')));
  assert(f.trackButtons.filter(b => b.attrs['aria-pressed'] === 'true').every(b => b.dataset.soundtrack === 'breath-and-clicks-2'));
});
test('next viewport perspective uses the shared chosen track', async () => {
  const f = fixture(); f.enter(0); await f.flush(); f.choose(0, 'clicks-in-cheek'); await f.flush();
  f.switchTo(0, 1); await f.flush();
  assert.equal(f.videos[0].paused, true); assert.equal(f.videos[1].paused, false);
  assert(f.videos[1].source.src.endsWith('/first-clicks-in-cheek.mp4'));
});
test('track choice preserves an explicit mute and native volume', async () => {
  const f = fixture(); f.enter(0); await f.flush(); f.videos[0].volume = .3; f.videos[0].muted = true;
  f.choose(1, 'breath-and-clicks'); await f.flush();
  assert.equal(f.videos[1].calls[0].muted, true); assert.equal(f.videos[1].calls[0].volume, .3);
});
test('choice permits manual playback with reduced motion', async () => {
  const f = fixture({ reduced: true }); f.enter(1); await f.flush();
  assert.equal(f.videos[1].calls.length, 0); f.choose(1, 'clicks-in-cheek');
  assert.equal(f.videos[1].calls.length, 1); await f.flush(); assert.equal(f.videos[1].paused, false);
});
test('source swap does not swallow the next manual pause', async () => {
  const f = fixture(); f.enter(0); await f.flush(); f.choose(0, 'breath-and-clicks'); await f.flush();
  f.videos[0].pause(); await f.flush(); const calls = f.videos[0].calls.length;
  f.enter(0, .6); f.enter(0, 0); f.enter(0); await f.flush();
  assert.equal(f.videos[0].calls.length, calls); assert.equal(f.videos[0].paused, true);
});
test('changing music preserves a manual pause on the other perspective', async () => {
  const f = fixture(); f.enter(1); await f.flush(); f.videos[1].pause(); await f.flush();
  f.choose(0, 'clicks-in-cheek'); await f.flush(); const calls = f.videos[1].calls.length;
  f.switchTo(0, 1); await f.flush(); assert.equal(f.videos[1].calls.length, calls);
  f.choose(1, 'clicks-in-cheek'); await f.flush(); assert.equal(f.videos[1].paused, false);
});
test('queued native pause survives a source switch before its event is delivered', async () => {
  const f = fixture(); f.enter(1); await f.flush(); f.videos[1].pause();
  f.choose(0, 'clicks-in-cheek'); await f.flush(); f.switchTo(0, 1); await f.flush();
  assert.equal(f.videos[1].paused, true); assert.equal(f.videos[1].calls.length, 1);
});
test('native pause during a pending play remains explicit after changing sources', async () => {
  const f = fixture(); f.videos[1].plans.push('pending'); f.enter(1); f.videos[1].pause();
  f.choose(0, 'breath-and-clicks'); f.rejectPolicy(1); await f.flush(); f.switchTo(0, 1); await f.flush();
  assert.equal(f.videos[1].paused, true); assert.equal(f.videos[1].calls.length, 1);
});
test('pending policy rejection is not mistaken for a manual pause during a source swap', async () => {
  const f = fixture(); f.videos[1].plans.push('policy'); f.enter(1);
  f.choose(0, 'clicks-in-cheek'); await f.flush(); f.switchTo(0, 1); await f.flush();
  assert.equal(f.videos[1].paused, false); assert.equal(f.videos[1].calls.length, 2);
});
test('queued offscreen pause still permits automatic playback after a source swap', async () => {
  const f = fixture(); f.enter(1); await f.flush(); f.enter(1, 0);
  f.choose(0, 'clicks-in-cheek'); await f.flush(); f.switchTo(0, 1); await f.flush();
  assert.equal(f.videos[1].paused, false); assert.equal(f.videos[1].calls.length, 2);
});
test('same selected track resumes without reloading or resetting playhead', async () => {
  const f = fixture(); f.enter(0); await f.flush(); f.videos[0].currentTime = 14; f.videos[0].pause(); await f.flush();
  f.choose(0, 'mouth-made-symphony'); await f.flush();
  assert.equal(f.videos[0].loads, 0); assert.equal(f.videos[0].currentTime, 14); assert.equal(f.videos[0].paused, false);
});
test('late old-track rejection cannot steal playback after a perspective choice', async () => {
  const f = fixture(); f.videos[0].plans.push('pending'); f.enter(0);
  f.choose(1, 'breath-and-clicks'); f.rejectPolicy(0); await f.flush();
  assert.equal(f.videos[0].calls.length, 1); assert.equal(f.videos[0].paused, true); assert.equal(f.videos[1].paused, false);
});
test('rapid choices retain the latest source after an old pending success', async () => {
  const f = fixture(); f.videos[0].plans.push('pending'); f.choose(0, 'breath-and-clicks');
  f.choose(0, 'clicks-in-cheek'); f.videos[0].pending.shift().resolve(); await f.flush();
  assert.equal(f.videos[0].calls.length, 2); assert.equal(f.videos[0].paused, false);
  assert(f.videos[0].source.src.endsWith('-clicks-in-cheek.mp4'));
});
test('selected track falls back to muted on policy rejection without changing preference', async () => {
  const f = fixture(); f.videos[0].plans.push('policy'); f.choose(0, 'breath-and-clicks'); await f.flush();
  assert.deepEqual(f.videos[0].calls.map(c => c.muted), [false, true]);
  f.switchTo(0, 1); await f.flush(); assert.equal(f.videos[1].calls[0].muted, false);
});
test('source decode error remains stopped without retrying every intersection', async () => {
  const f = fixture(); f.videos[0].plans.push('decode'); f.choose(0, 'breath-and-clicks'); await f.flush();
  f.enter(0); f.enter(0, .6); await f.flush(); assert.equal(f.videos[0].calls.length, 1);
});
test('offscreen transition cancels pending track-selection playback', async () => {
  const f = fixture(); f.videos[0].plans.push('pending'); f.choose(0, 'clicks-in-cheek');
  f.enter(0, 0); f.rejectPolicy(0); await f.flush(); assert.equal(f.videos[0].paused, true); assert.equal(f.videos[0].calls.length, 1);
});
test('full-track links follow selection and pause films until explicit playback', async () => {
  const f = fixture(); f.choose(0, 'breath-and-clicks-2'); await f.flush();
  assert(f.fullLinks.every(link => link.href.endsWith('/breath-and-clicks-2.m4a')));
  assert(f.fullLinks.every(link => link.attrs['aria-label'].includes('Breath and Clicks 2')));
  f.fullLinks[0].emit('click'); await f.flush(); f.enter(0); f.enter(1); await f.flush();
  assert(f.videos.every(v => v.paused)); f.choose(1, 'mouth-made-symphony'); await f.flush(); assert.equal(f.videos[1].paused, false);
});
test('caption choice and fallback movie link follow the selected music', async () => {
  const f = fixture(); f.videos[0].caption.track.mode = 'showing'; f.choose(0, 'clicks-in-cheek'); await f.flush();
  assert.equal(f.videos[0].caption.track.mode, 'showing');
  assert(f.videos.every(v => v.caption.src.endsWith('/clicks-in-cheek.vtt') && v.fallback.href === v.source.src));
});
test('invalid soundtrack identifiers are ignored without changing media', async () => {
  const f = fixture(); const button = f.trackButtons[0]; button.dataset.soundtrack = '../unknown'; button.emit('click'); await f.flush();
  assert(f.videos.every(v => v.loads === 0 && v.calls.length === 0));
});
test('portable review mode stays manual while track choices remain functional', async () => {
  const f = fixture({ autoplay: false }); f.enter(0); f.enter(1); await f.flush();
  assert(f.videos.every(v => v.calls.length === 0)); f.choose(1, 'breath-and-clicks'); await f.flush(); assert.equal(f.videos[1].paused, false);
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
