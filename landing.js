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
const filmStates = Array.from(document.querySelectorAll('video')).map(video => ({
  video,
  button: document.querySelector(`[aria-controls="${video.id}"]`),
  visible: false,
  ratio: 0,
  userPaused: false,
  autoBlocked: false,
  autoStarting: false,
  ignorePause: false,
  playKind: null,
  request: 0
}));
let activeFilm = null;

function syncSound(state) {
  if (!state.button) return;
  const audible = !state.video.muted && state.video.volume > 0;
  state.button.setAttribute('aria-pressed', String(audible));
  state.button.querySelector('[data-sound-label]').textContent = audible ? 'Sound off' : 'Sound on';
}

function pauseFilm(state, mute = false) {
  state.request += 1;
  if (!state.video.paused) {
    state.ignorePause = true;
    state.video.pause();
  } else if (state.autoStarting) {
    state.video.pause();
  }
  state.autoStarting = false;
  state.playKind = null;
  if (mute) state.video.muted = true;
  if (activeFilm === state) activeFilm = null;
  syncSound(state);
}

function playVisibleFilm() {
  if (reducedMotion.matches || document.hidden) return;
  // Keep a visible manual playback, and avoid switching between two similarly
  // visible films as an intersection threshold fluctuates.
  if (activeFilm && !activeFilm.video.paused && activeFilm.visible &&
      (activeFilm.playKind === 'manual' || activeFilm.ratio >= 0.35)) return;

  const candidate = filmStates
    .filter(state => state.visible && state.ratio >= 0.35 && !state.userPaused &&
      !state.autoBlocked && !state.video.ended)
    .sort((a, b) => b.ratio - a.ratio)[0];
  if (!candidate || candidate.autoStarting || !candidate.video.paused) return;
  filmStates.forEach(state => { if (state !== candidate) pauseFilm(state, true); });

  candidate.video.muted = true;
  candidate.autoStarting = true;
  candidate.playKind = 'auto';
  activeFilm = candidate;
  const request = ++candidate.request;
  syncSound(candidate);
  try {
    const started = candidate.video.play();
    if (started && typeof started.then === 'function') {
      started.then(() => {
        if (candidate.request !== request) return;
        if (!candidate.visible || reducedMotion.matches || document.hidden) pauseFilm(candidate, true);
      }).catch(() => {
        if (candidate.request !== request) return;
        candidate.autoStarting = false;
        candidate.autoBlocked = true;
        if (activeFilm === candidate) activeFilm = null;
      });
    }
  } catch (_) {
    candidate.autoStarting = false;
    candidate.autoBlocked = true;
    if (activeFilm === candidate) activeFilm = null;
  }
}

filmStates.forEach(state => {
  const video = state.video;
  video.muted = true;
  syncSound(state);
  video.addEventListener('volumechange', () => syncSound(state));
  video.addEventListener('play', () => {
    if (video.paused) return;
    state.playKind = state.autoStarting ? 'auto' : 'manual';
    state.autoStarting = false;
    state.userPaused = false;
    state.autoBlocked = false;
    filmStates.forEach(other => { if (other !== state) pauseFilm(other, true); });
    activeFilm = state;
  });
  video.addEventListener('pause', () => {
    if (state.ignorePause) {
      state.ignorePause = false;
      return;
    }
    // A user pause remains in force until the film fully leaves the viewport.
    if (state.visible && !video.ended) state.userPaused = true;
    state.autoStarting = false;
    state.playKind = null;
    if (activeFilm === state) activeFilm = null;
  });
  video.addEventListener('ended', () => {
    if (activeFilm === state) activeFilm = null;
  });
  if (state.button) {
    state.button.addEventListener('click', () => {
      const enable = video.muted || video.volume === 0;
      if (enable && video.volume === 0) video.volume = 0.5;
      video.muted = !enable;
      syncSound(state);
    });
  }
});

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const state = filmStates.find(item => item.video === entry.target);
      if (!state) return;
      state.visible = entry.isIntersecting && entry.intersectionRatio > 0;
      state.ratio = entry.intersectionRatio;
      if (!state.visible) {
        pauseFilm(state, true);
        state.userPaused = false;
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
      if (state.playKind === 'auto' || state.autoStarting) pauseFilm(state, true);
    });
  } else {
    playVisibleFilm();
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) filmStates.forEach(state => pauseFilm(state, true));
  else playVisibleFilm();
});
document.querySelectorAll('.inside-view').forEach(details => {
  details.addEventListener('toggle', () => {
    if (details.open) return;
    filmStates.filter(state => details.contains(state.video)).forEach(state => {
      pauseFilm(state, true);
      state.visible = false;
      state.ratio = 0;
      state.userPaused = false;
    });
  });
});
