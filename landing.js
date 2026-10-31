'use strict';

const policy = document.querySelector('.privacy-details');
function revealLinkedPolicy() {
  if (window.location.hash === '#privacy' && policy) policy.open = true;
}
revealLinkedPolicy();
window.addEventListener('hashchange', revealLinkedPolicy);
document.querySelectorAll('a[href="#privacy"]').forEach(link => {
  link.addEventListener('click', () => { if (policy) policy.open = true; });
});

(() => {
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const nativePlayback = window.matchMedia('(any-pointer: coarse)').matches ||
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
document.body.dataset.player = nativePlayback ? 'native' : 'enhanced';
const automaticPlaybackEnabled = document.body.dataset.autoplay !== 'off';
const filmRoot = document.body.dataset.filmRoot || 'media/videos/soundtracks-v2';
const soundtracks = [
  'mouth-made-symphony',
  'breath-and-clicks-2',
  'breath-and-clicks',
  'clicks-in-cheek'
];
// Shuffle once per visit. Each perspective gets a different song, and its
// music stays put across pauses, scrolling, and replays.
for (let i = soundtracks.length - 1; i > 0; i -= 1) {
  const j = Math.floor(Math.random() * (i + 1));
  [soundtracks[i], soundtracks[j]] = [soundtracks[j], soundtracks[i]];
}
const filmStates = Array.from(document.querySelectorAll('video')).map(video => ({
  video,
  button: document.querySelector(`.sound-toggle[aria-controls="${video.id}"]`),
  playButton: document.querySelector(`.film-play[aria-controls="${video.id}"]`),
  recovery: document.querySelector(`[data-film-recovery="${video.id}"]`),
  directLink: document.querySelector(`[data-film-direct="${video.id}"]`),
  source: video.querySelector('source'),
  caption: video.querySelector('track'),
  perspective: video.dataset.perspective,
  soundtrack: video.dataset.soundtrack,
  visible: false,
  ratio: 0,
  userPaused: false,
  autoBlocked: false,
  starting: false,
  ignoredPauses: 0,
  playKind: null,
  presentation: 'inline',
  request: 0,
  soundSnapshot: { muted: video.muted, volume: video.volume }
}));
let activeFilm = null;
// Visit-local preference. A browser's muted fallback never changes this choice.
let soundWanted = true;
let soundVolume = 1;
let lastAudibleVolume = 1;

function syncSound(state) {
  const stopped = state.video.paused || state.video.ended || Boolean(state.video.error);
  if (state.playButton) {
    state.playButton.hidden = !stopped;
    const action = state.video.error ? 'Try again' : state.video.ended ? 'Replay' : 'Play';
    const label = state.playButton.querySelector('[data-play-label]');
    if (label) label.textContent = action;
    const perspective = state.perspective === 'third' ? 'viewer’s' : 'user’s';
    state.playButton.setAttribute('aria-label', `${action}, ${perspective} perspective video`);
  }
  if (!state.button) return;
  state.button.hidden = stopped;
  const audible = !state.video.muted && state.video.volume > 0;
  state.button.setAttribute('aria-pressed', String(audible));
  const label = state.button.querySelector('[data-sound-label]');
  if (label) label.textContent = audible ? 'Sound off' : 'Sound on';
}

function setFilmSound(state, muted, volume = soundVolume) {
  state.video.muted = muted;
  state.video.volume = volume;
  // volumechange is queued, so track values rather than counting events. This
  // also distinguishes native controls from our own preference/fallback writes.
  state.soundSnapshot = { muted: state.video.muted, volume: state.video.volume };
  syncSound(state);
}

function shareSoundPreference(enabled, volume = soundVolume) {
  soundWanted = enabled;
  soundVolume = volume;
  if (volume > 0) lastAudibleVolume = volume;
  filmStates.forEach(state => setFilmSound(state, !enabled, volume));
}

function rememberNativeSound(state) {
  const { video, soundSnapshot } = state;
  if (video.muted !== soundSnapshot.muted || video.volume !== soundSnapshot.volume) {
    shareSoundPreference(!video.muted && video.volume > 0, video.volume);
  }
}

function pauseFilm(state) {
  state.request += 1;
  state.starting = false;
  state.playKind = null;
  if (!state.video.paused) state.ignoredPauses += 1;
  // Also cancel a pending play() request, even if playback has not begun.
  state.video.pause();
  if (activeFilm === state) activeFilm = null;
  syncSound(state);
}

function isPresentedSeparately(state) {
  const video = state.video;
  return state.presentation !== 'inline' || video.webkitDisplayingFullscreen ||
    video.webkitPresentationMode === 'fullscreen' ||
    video.webkitPresentationMode === 'picture-in-picture' ||
    document.fullscreenElement === video || document.pictureInPictureElement === video;
}

function canContinue(state, kind) {
  const details = state.video.closest('.inside-view');
  const separate = isPresentedSeparately(state);
  return (!document.hidden || separate) && (!details || details.open) &&
    (kind === 'manual' || ((state.visible || separate) && !state.userPaused && !reducedMotion.matches));
}

function startFilm(state, kind) {
  if (!canContinue(state, kind)) return;
  if (kind === 'auto') filmStates.forEach(rememberNativeSound);
  filmStates.forEach(other => { if (other !== state) pauseFilm(other); });
  if (kind === 'manual') state.userPaused = false;
  state.autoBlocked = false;
  state.starting = true;
  state.playKind = kind;
  activeFilm = state;
  const request = ++state.request;
  setFilmSound(state, !soundWanted);

  const isCurrent = () => state.request === request && activeFilm === state;
  function failed(error, allowFallback) {
    if (!isCurrent()) return;
    if (!canContinue(state, kind)) {
      pauseFilm(state);
      return;
    }
    // Only autoplay-policy rejection warrants another play attempt. Network,
    // decoding and interrupted-request failures must not create a retry loop.
    if (allowFallback && error && error.name === 'NotAllowedError') {
      rememberNativeSound(state);
      setFilmSound(state, true);
      attempt(false);
      return;
    }
    pauseFilm(state);
    state.autoBlocked = true;
  }
  function attempt(allowFallback) {
    if (!isCurrent() || !canContinue(state, kind)) return;
    try {
      // Keep this call synchronous with Play and Sound on taps so browsers
      // can grant their normal user-activation permission for audible playback.
      const started = state.video.play();
      Promise.resolve(started).then(() => {
        if (!isCurrent()) return;
        state.starting = false;
        if (!canContinue(state, kind)) pauseFilm(state);
        syncSound(state);
      }, error => failed(error, allowFallback));
    } catch (error) {
      failed(error, allowFallback);
    }
  }
  attempt(!state.video.muted && state.video.volume > 0);
}

function playVisibleFilm() {
  if (!automaticPlaybackEnabled || reducedMotion.matches || document.hidden) return;
  // A native player owns the experience even when the user pauses it.
  if (filmStates.some(isPresentedSeparately)) return;
  // Keep explicit playback in control until it leaves the viewport.
  if (activeFilm && (activeFilm.starting || !activeFilm.video.paused) &&
      (isPresentedSeparately(activeFilm) || activeFilm.playKind === 'manual' ||
       (activeFilm.visible && activeFilm.ratio >= 0.35))) return;
  const candidate = filmStates
    .filter(state => state.visible && state.ratio >= 0.35 && !state.userPaused &&
      !state.autoBlocked && !state.video.ended)
    .sort((a, b) => b.ratio - a.ratio)[0];
  if (!candidate || candidate.starting || !candidate.video.paused) return;
  startFilm(candidate, 'auto');
}

// HTML starts with preload=none. Choose one URL before asking for metadata;
// assigning video.src performs resource selection without a second load().
// A visitor may tap native Play before this deferred script arrives: leave
// that video alone, including its source and playback position.
filmStates.forEach((state, index) => {
  const video = state.video;
  if (video.paused && video.currentTime === 0 && !video.played.length) {
    const soundtrack = soundtracks[index % soundtracks.length];
    state.soundtrack = soundtrack;
    video.dataset.soundtrack = soundtrack;
    // Safari can reject the media source while an external text track is
    // attached during source selection. Restore captions after metadata loads.
    if (state.caption) {
      state.caption.remove();
      state.caption.src = `${filmRoot}/${soundtrack}.vtt`;
      video.addEventListener('loadedmetadata', () => video.append(state.caption), { once: true });
    }
    state.source.src = `${filmRoot}/${state.perspective}-${soundtrack}.mp4`;
    video.src = state.source.src;
  }
  const fallback = state.video.querySelector('[data-film-fallback]');
  if (fallback) fallback.href = state.source.src;
  if (state.directLink) state.directLink.href = video.src || video.currentSrc || state.source.src;
  video.preload = 'metadata';
  const syncRecovery = () => { if (state.recovery) state.recovery.hidden = !video.error; };
  video.addEventListener('error', syncRecovery);
  video.addEventListener('playing', syncRecovery);
  syncRecovery();
});

if (nativePlayback) {
  // On phones and tablets, Safari owns Play, sound, seeking, fullscreen and
  // background behavior. No autoplay attempts, overlays, mute writes, or
  // scroll/visibility listeners can interrupt a native user action.
  filmStates.forEach(({ video }) => {
    video.addEventListener('play', () => {
      if (video.paused) return;
      filmStates.forEach(other => {
        if (other.video !== video && !other.video.paused) other.video.pause();
      });
    });
  });
  document.querySelectorAll('.inside-view').forEach(details => {
    details.addEventListener('toggle', () => {
      if (!details.open) filmStates.forEach(({ video }) => {
        if (details.contains(video) && !video.paused) video.pause();
      });
    });
  });
  return;
}

filmStates.forEach(state => {
  const video = state.video;
  setFilmSound(state, !soundWanted);
  video.addEventListener('volumechange', () => {
    rememberNativeSound(state);
    syncSound(state);
  });
  video.addEventListener('play', () => {
    if (video.paused) return;
    const kind = state.playKind || 'manual';
    if (!canContinue(state, kind)) {
      pauseFilm(state);
      return;
    }
    if (!state.playKind) state.request += 1;
    state.playKind = kind;
    state.userPaused = false;
    state.autoBlocked = false;
    filmStates.forEach(other => { if (other !== state) pauseFilm(other); });
    activeFilm = state;
    syncSound(state);
  });
  video.addEventListener('playing', () => syncSound(state));
  video.addEventListener('pause', () => {
    if (state.ignoredPauses > 0) {
      state.ignoredPauses -= 1;
      return;
    }
    if (!video.paused) return;
    state.request += 1;
    // A manual pause survives scrolling away and back. Explicit play is the
    // only action that clears it; our own offscreen pauses are ignored above.
    if (!video.ended) state.userPaused = true;
    state.starting = false;
    state.playKind = null;
    if (activeFilm === state) activeFilm = null;
    syncSound(state);
  });
  video.addEventListener('ended', () => {
    state.request += 1;
    state.starting = false;
    state.playKind = null;
    if (activeFilm === state) activeFilm = null;
    syncSound(state);
  });
  video.addEventListener('error', () => {
    pauseFilm(state);
    state.autoBlocked = true;
  });
  if (state.playButton) {
    state.playButton.addEventListener('click', () => {
      filmStates.forEach(rememberNativeSound);
      if (video.error) {
        video.load();
        state.ignoredPauses = 0;
      }
      // Safari requires play() in the tap handler itself, before any await or
      // media-ready callback. Keep the selected song and explicit mute choice.
      startFilm(state, 'manual');
    });
  }
  if (state.button) {
    state.button.addEventListener('click', () => {
      const enable = video.muted || video.volume === 0;
      shareSoundPreference(enable, enable && video.volume === 0 ? lastAudibleVolume : video.volume);
      // Muting an intentionally paused film does not resume it.
      if (enable) startFilm(state, 'manual');
    });
  }
  function presentationChanged(mode) {
    state.presentation = mode;
    if (mode !== 'inline' && !video.paused) state.playKind = 'manual';
    if (mode === 'inline' && !isPresentedSeparately(state) &&
        (!state.visible || document.hidden)) pauseFilm(state);
  }
  video.addEventListener('webkitbeginfullscreen', () => presentationChanged('fullscreen'));
  video.addEventListener('webkitendfullscreen', () => presentationChanged('inline'));
  video.addEventListener('webkitpresentationmodechanged', () => {
    presentationChanged(video.webkitPresentationMode || 'inline');
  });
  video.addEventListener('enterpictureinpicture', () => presentationChanged('picture-in-picture'));
  video.addEventListener('leavepictureinpicture', () => presentationChanged('inline'));
});

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const state = filmStates.find(item => item.video === entry.target);
      if (!state) return;
      state.visible = entry.isIntersecting && entry.intersectionRatio > 0;
      state.ratio = entry.intersectionRatio;
      if (!state.visible) {
        if (!isPresentedSeparately(state)) pauseFilm(state);
        state.autoBlocked = false;
      } else if (state.video.preload === 'none') {
        state.video.preload = 'metadata';
      }
    });
    playVisibleFilm();
  }, { threshold: [0, 0.05, 0.2, 0.35, 0.6, 1] });
  filmStates.forEach(state => observer.observe(state.video));
}

reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) {
    filmStates.forEach(state => {
      if (state.playKind === 'auto') pauseFilm(state);
    });
  } else {
    playVisibleFilm();
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) filmStates.forEach(state => {
    if (!isPresentedSeparately(state)) pauseFilm(state);
  });
  else playVisibleFilm();
});
document.addEventListener('fullscreenchange', () => {
  filmStates.forEach(state => {
    if (!isPresentedSeparately(state) && (!state.visible || document.hidden)) pauseFilm(state);
  });
});
document.querySelectorAll('.inside-view').forEach(details => {
  details.addEventListener('toggle', () => {
    if (details.open) return;
    filmStates.filter(state => details.contains(state.video)).forEach(state => {
      pauseFilm(state);
      state.visible = false;
      state.ratio = 0;
    });
  });
});
})();
