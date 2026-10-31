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

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const automaticPlaybackEnabled = document.body.dataset.autoplay !== 'off';
const filmRoot = document.body.dataset.filmRoot || 'media/videos/soundtracks-v2';
const fullTrackRoot = document.body.dataset.fullTrackRoot || 'media/audio/soundtracks-v2';
const soundtracks = [
  { id: 'mouth-made-symphony', title: 'Mouth-Made Symphony' },
  { id: 'breath-and-clicks-2', title: 'Breath and Clicks 2' },
  { id: 'breath-and-clicks', title: 'Breath and Clicks' },
  { id: 'clicks-in-cheek', title: 'Clicks in Cheek' }
];
let selectedSoundtrack = soundtracks[0].id;
const filmStates = Array.from(document.querySelectorAll('video')).map(video => ({
  video,
  button: document.querySelector(`.sound-toggle[aria-controls="${video.id}"]`),
  source: video.querySelector('source'),
  caption: video.querySelector('track'),
  perspective: video.dataset.perspective,
  soundtrack: video.dataset.soundtrack || selectedSoundtrack,
  visible: false,
  ratio: 0,
  userPaused: false,
  autoBlocked: false,
  starting: false,
  ignoredPauses: 0,
  playKind: null,
  wasUnpaused: false,
  request: 0,
  soundSnapshot: { muted: video.muted, volume: video.volume }
}));
let activeFilm = null;
// Visit-local preference. A browser's muted fallback never changes this choice.
let soundWanted = true;
let soundVolume = 1;
let lastAudibleVolume = 1;

function syncSound(state) {
  if (!state.button) return;
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
}

function canContinue(state, kind) {
  const details = state.video.closest('.inside-view');
  return !document.hidden && (!details || details.open) &&
    (kind === 'manual' || (state.visible && !state.userPaused && !reducedMotion.matches));
}

function startFilm(state, kind) {
  if (!canContinue(state, kind)) return;
  if (kind === 'auto') filmStates.forEach(rememberNativeSound);
  filmStates.forEach(other => { if (other !== state) pauseFilm(other); });
  if (kind === 'manual') state.userPaused = false;
  state.autoBlocked = false;
  state.starting = true;
  state.wasUnpaused = false;
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
      // Keep this call synchronous with Sound on / Watch clicks so browsers
      // can grant their normal user-activation permission for audible playback.
      const started = state.video.play();
      state.wasUnpaused = !state.video.paused;
      Promise.resolve(started).then(() => {
        if (!isCurrent()) return;
        state.starting = false;
        if (!canContinue(state, kind)) pauseFilm(state);
      }, error => failed(error, allowFallback));
    } catch (error) {
      failed(error, allowFallback);
    }
  }
  attempt(!state.video.muted && state.video.volume > 0);
}

function playVisibleFilm() {
  if (!automaticPlaybackEnabled || reducedMotion.matches || document.hidden) return;
  // An explicit Watch click may start while its anchor is scrolling into view.
  // Intersection/visibility events still cancel it when the film leaves view.
  if (activeFilm && (activeFilm.starting || !activeFilm.video.paused) &&
      (activeFilm.playKind === 'manual' ||
       (activeFilm.visible && activeFilm.ratio >= 0.35))) return;
  const candidate = filmStates
    .filter(state => state.visible && state.ratio >= 0.35 && !state.userPaused &&
      !state.autoBlocked && !state.video.ended)
    .sort((a, b) => b.ratio - a.ratio)[0];
  if (!candidate || candidate.starting || !candidate.video.paused) return;
  startFilm(candidate, 'auto');
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
    state.wasUnpaused = true;
    state.userPaused = false;
    state.autoBlocked = false;
    filmStates.forEach(other => { if (other !== state) pauseFilm(other); });
    activeFilm = state;
  });
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
  });
  video.addEventListener('ended', () => {
    state.request += 1;
    state.starting = false;
    state.playKind = null;
    if (activeFilm === state) activeFilm = null;
  });
  if (state.button) {
    state.button.addEventListener('click', () => {
      const enable = video.muted || video.volume === 0;
      shareSoundPreference(enable, enable && video.volume === 0 ? lastAudibleVolume : video.volume);
      // Muting an intentionally paused film does not resume it.
      if (enable) startFilm(state, 'manual');
    });
  }
});

function updateSoundtrackControls() {
  const track = soundtracks.find(item => item.id === selectedSoundtrack);
  document.querySelectorAll('.soundtrack-button').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.soundtrack === selectedSoundtrack));
  });
  document.querySelectorAll('[data-full-track]').forEach(link => {
    link.href = `${fullTrackRoot}/${selectedSoundtrack}.m4a`;
    link.setAttribute('aria-label', `Listen to the full ${track.title} track`);
  });
}

function replaceSoundtrack(state, id) {
  if (state.soundtrack === id) return;
  pauseFilm(state);
  state.soundtrack = id;
  state.video.dataset.soundtrack = id;
  const captionMode = state.caption && state.caption.track && state.caption.track.mode;
  state.source.src = `${filmRoot}/${state.perspective}-${id}.mp4`;
  if (state.caption) state.caption.src = `${filmRoot}/${id}.vtt`;
  const fallback = state.video.querySelector('[data-film-fallback]');
  if (fallback) fallback.href = state.source.src;
  // load() aborts old resource requests and clears their queued media events.
  // Reset only our consumed-pause accounting; preserve an explicit user pause.
  state.video.load();
  state.ignoredPauses = 0;
  state.autoBlocked = false;
  if (captionMode && state.caption.track) state.caption.track.mode = captionMode;
}

function chooseSoundtrack(state, id) {
  if (!soundtracks.some(track => track.id === id)) return;
  filmStates.forEach(film => {
    rememberNativeSound(film);
    // load() discards queued native pause events. Preserve a pause already
    // visible on a playing film before replacing either media resource.
    // Blocked play requests and our own pending pauses are not user pauses.
    if (film.playKind && film.wasUnpaused && film.video.paused &&
        !film.video.ended && film.ignoredPauses === 0) film.userPaused = true;
  });
  selectedSoundtrack = id;
  filmStates.forEach(film => replaceSoundtrack(film, id));
  updateSoundtrackControls();
  // A choice is an explicit play action. Keep play() in the click stack, and
  // keep the user's mute/volume preference while changing the muxed resource.
  startFilm(state, 'manual');
}

document.querySelectorAll('.soundtrack-button').forEach(button => {
  button.addEventListener('click', () => {
    const state = filmStates.find(film => film.video.id === button.getAttribute('aria-controls'));
    if (state) chooseSoundtrack(state, button.dataset.soundtrack);
  });
});
document.querySelectorAll('[data-full-track]').forEach(link => {
  link.addEventListener('click', () => {
    filmStates.forEach(state => {
      pauseFilm(state);
      state.userPaused = true;
    });
  });
});
updateSoundtrackControls();

// This dedicated film action can request sound; unrelated page clicks cannot.
document.querySelectorAll('.actions a[href="#films"]').forEach(link => {
  link.addEventListener('click', event => {
    if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey ||
        event.shiftKey || event.altKey) return;
    const state = filmStates.find(item => item.video.id === 'third-person-film');
    if (!state) return;
    shareSoundPreference(true, soundVolume || lastAudibleVolume);
    startFilm(state, 'manual');
  });
});

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const state = filmStates.find(item => item.video === entry.target);
      if (!state) return;
      state.visible = entry.isIntersecting && entry.intersectionRatio > 0;
      state.ratio = entry.intersectionRatio;
      if (!state.visible) {
        pauseFilm(state);
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
  if (document.hidden) filmStates.forEach(state => pauseFilm(state));
  else playVisibleFilm();
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
