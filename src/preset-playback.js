// One user-authorized media element plays the displayed presets in order.
// Source changes stay synchronous with explicit Play; no canplay callback can
// resurrect playback after a pause or supersede a newer preset selection.
export function presetPlayback({ audio, modes, initialMode = modes[0], sourceForMode,
  unlock = () => Promise.resolve(), canPlay = () => true,
  onSelect = () => {}, onStateChange = () => {}, onStarted = () => {}, onMessage = () => {} }) {
  let selected = initialMode;
  let wanted = !audio.paused && !audio.ended;
  let startedSource = wanted;
  let request = 0;
  let disposed = false;
  audio.loop = false;

  function pause() {
    ++request;
    wanted = false;
    startedSource = false;
    audio.pause();
    onStateChange();
  }
  function fail(token, message) {
    if (disposed || token !== request) return;
    pause();
    onMessage(message);
  }
  function play() {
    if (disposed || !canPlay()) return;
    const token = ++request;
    wanted = true;
    onMessage('');
    try {
      if (audio.error) { startedSource = false; audio.load(); }
      if (audio.ended) audio.currentTime = 0;
      // Do not await AudioContext.resume: Safari needs media.play in the same
      // explicit click. Subsequent presets reuse this exact authorized element.
      Promise.resolve(unlock()).catch(() => fail(token, 'Tap Listen to reconnect the sound'));
      const result = audio.play();
      startedSource = !audio.paused && !audio.ended;
      result?.then(() => {
        if (disposed || token !== request) {
          // A stale resolution cannot wake a manually paused selection, but
          // must not pause a newer explicit Play on this shared element.
          if (!wanted) audio.pause();
          return;
        }
        if (!wanted || !canPlay()) { pause(); return; }
        startedSource = !audio.paused && !audio.ended;
        onStateChange();
      }, () => fail(token, 'Tap Listen to try again'));
    } catch {
      fail(token, 'Tap Listen to try again');
    }
    onStateChange();
  }
  function changeSource(mode) {
    ++request;
    startedSource = false;
    selected = mode;
    audio.src = sourceForMode(mode);
    // Reset ended/currentTime and cancel old resource tasks before play().
    audio.load();
    onSelect(mode);
  }
  function select(mode) {
    if (disposed || mode === selected || !modes.includes(mode)) return;
    // Preserve the active cycle, including a pending start, but observe a
    // native pause immediately even if its queued pause event has not arrived.
    const nativePause = startedSource && audio.paused && !audio.ended;
    const continuePlaying = wanted && !nativePause && canPlay();
    pause();
    changeSource(mode);
    onMessage('');
    // Keep the replacement play inside this click for Safari/iPhone permission.
    if (continuePlaying) play();
    else onStateChange();
  }
  const listeners = {
    play() {
      if (audio.paused) return;
      if (!wanted || !canPlay()) { pause(); return; }
      startedSource = true;
      onStarted();
      onStateChange();
    },
    pause() {
      // Natural completion sends pause before ended. A source load can also
      // send a pause; neither represents the user stopping the cycle.
      if (audio.paused && !audio.ended && startedSource) pause();
      else onStateChange();
    },
    ended() {
      // A duplicated/queued event from a previous source sees ended=false
      // after load. Explicit pause also revokes wanted immediately.
      if (!audio.ended || !wanted || !startedSource) return;
      if (!canPlay()) { pause(); return; }
      const next = modes[(modes.indexOf(selected) + 1) % modes.length];
      changeSource(next);
      play();
    },
    error() {
      if (audio.error) fail(request, 'This sample couldn’t load. Tap Listen to retry');
    },
    loadedmetadata: onStateChange
  };
  for (const [event, listener] of Object.entries(listeners)) audio.addEventListener(event, listener);
  return {
    get selected() { return selected; },
    get active() { return wanted; },
    play, pause, select,
    toggle() { if (wanted) pause(); else play(); },
    destroy() {
      pause();
      disposed = true;
      for (const [event, listener] of Object.entries(listeners)) audio.removeEventListener(event, listener);
    }
  };
}
