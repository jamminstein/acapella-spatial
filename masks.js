'use strict';

(() => {
  const buttons = [...document.querySelectorAll('[data-mask]')];
  const logos = [...document.querySelectorAll('.wordmark')];
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if ((!buttons.length && !logos.length) || !AudioContext) return;
  let context;
  let master;
  let wave;
  let generation = 0;
  const voices = new Map();
  const requests = new Map();
  let ahemBuffer;
  let ahemLoad;
  let ahemVoice;
  let ahemTicket = 0;
  let lastAhem = -Infinity;

  const filmAudible = () => [...document.querySelectorAll('video')]
    .some(video => !video.paused && !video.ended && !video.muted && video.volume > 0);

  function audio() {
    if (context && context.state !== 'closed') return context;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = .20;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -15;
    limiter.knee.value = 12;
    limiter.ratio.value = 8;
    master.connect(limiter).connect(context.destination);
    const real = new Float32Array(25);
    const imaginary = new Float32Array(25);
    for (let i = 1; i < imaginary.length; i++) imaginary[i] = 1 / Math.pow(i, 1.4);
    wave = context.createPeriodicWave(real, imaginary);
    return context;
  }

  function stop(button) {
    const voice = voices.get(button);
    if (!voice) return;
    voices.delete(button);
    delete button.dataset.singing;
    clearTimeout(voice.timer);
    const now = context.currentTime;
    voice.envelope.gain.cancelScheduledValues(now);
    voice.envelope.gain.setTargetAtTime(0, now, .025);
    voice.sources.forEach(source => { try { source.stop(now + .12); } catch (_) {} });
  }

  function sing(button) {
    if (voices.has(button)) return;
    const ctx = context;
    const now = ctx.currentTime;
    const high = button.dataset.mask === 'high';
    const pitch = high ? 196 : 130.81;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(.75, now + .045);
    envelope.gain.setTargetAtTime(.5, now + .20, .2);
    envelope.gain.setTargetAtTime(0, now + .67, .065);
    const pan = ctx.createStereoPanner();
    pan.pan.value = high ? .18 : -.18;
    envelope.connect(pan).connect(master);
    const source = ctx.createOscillator();
    source.setPeriodicWave(wave);
    source.frequency.setValueAtTime(pitch * .94, now);
    source.frequency.exponentialRampToValueAtTime(pitch, now + .14);
    source.frequency.exponentialRampToValueAtTime(pitch * .97, now + .78);
    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 5.4;
    const depth = ctx.createGain();
    depth.gain.value = pitch * .004;
    vibrato.connect(depth).connect(source.frequency);
    const nodes = [source, vibrato, depth, envelope, pan];
    [[330, 780, 390, 1], [760, high ? 1650 : 1180, 850, .65], [2400, 2800, 2450, .25]].forEach(([oo, ah, ow, level], i) => {
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 7 + i * 2;
      const scale = high ? 1.12 : 1;
      filter.frequency.setValueAtTime(oo * scale, now);
      filter.frequency.exponentialRampToValueAtTime(ah * scale, now + .28);
      filter.frequency.exponentialRampToValueAtTime(ow * scale, now + .72);
      const gain = ctx.createGain();
      gain.gain.value = level;
      source.connect(filter).connect(gain).connect(envelope);
      nodes.push(filter, gain);
    });
    const voice = { sources: [source, vibrato], envelope, timer: null };
    voices.set(button, voice);
    button.dataset.singing = 'true';
    source.onended = () => {
      nodes.forEach(node => node.disconnect());
      if (voices.get(button) === voice) {
        voices.delete(button);
        delete button.dataset.singing;
      }
    };
    source.start(now); vibrato.start(now);
    source.stop(now + 1); vibrato.stop(now + 1);
    voice.timer = setTimeout(() => {
      if (voices.get(button) === voice) delete button.dataset.singing;
    }, 900);
  }

  function request(button) {
    if (document.hidden || filmAudible()) return;
    quietAhem();
    const ticket = ++generation;
    requests.set(button, ticket);
    const started = performance.now();
    try {
      const ctx = audio();
      const play = () => {
        if (ctx.state === 'running' && !document.hidden && !filmAudible() && requests.get(button) === ticket && performance.now() - started < 700) sing(button);
      };
      if (ctx.state === 'running') play();
      else ctx.resume().then(play).catch(() => {});
    } catch (_) { /* The illustration remains usable if browser audio is unavailable. */ }
  }

  function quietAhem() {
    ahemTicket += 1;
    if (!ahemVoice) return;
    const { source, envelope, logo } = ahemVoice;
    ahemVoice = null;
    delete logo.dataset.clearing;
    const now = context.currentTime;
    envelope.gain.cancelScheduledValues(now);
    envelope.gain.setTargetAtTime(0, now, .012);
    try { source.stop(now + .05); } catch (_) {}
  }

  function loadAhem(ctx) {
    if (ahemBuffer) return Promise.resolve(ahemBuffer);
    if (!ahemLoad) {
      ahemLoad = fetch('media/audio/easter-eggs/ahem-v1.mp3')
        .then(response => {
          if (!response.ok) throw new Error('Sound unavailable');
          return response.arrayBuffer();
        })
        .then(bytes => ctx.decodeAudioData(bytes))
        .then(buffer => { ahemBuffer = buffer; return buffer; })
        .catch(error => { ahemLoad = null; throw error; });
    }
    return ahemLoad;
  }

  function requestAhem(logo) {
    if (document.hidden || filmAudible() || ahemVoice || performance.now() - lastAhem < 4000) return;
    const ticket = ++ahemTicket;
    const requested = performance.now();
    try {
      const ctx = audio();
      // Resume inside the gesture. Never queue a blocked hover for a later click.
      const resumed = ctx.state === 'running' ? Promise.resolve() : ctx.resume();
      Promise.all([resumed, loadAhem(ctx)]).then(([, buffer]) => {
        if (ticket !== ahemTicket || ctx.state !== 'running' || document.hidden ||
            filmAudible() || performance.now() - requested > 700 || performance.now() - lastAhem < 4000) return;
        requests.clear();
        buttons.forEach(stop);
        const now = ctx.currentTime;
        const source = ctx.createBufferSource();
        const envelope = ctx.createGain();
        source.buffer = buffer;
        // The shared master and limiter keep this little voice close and quiet.
        envelope.gain.setValueAtTime(0, now);
        envelope.gain.linearRampToValueAtTime(2, now + .008);
        envelope.gain.setValueAtTime(2, now + buffer.duration - .025);
        envelope.gain.linearRampToValueAtTime(0, now + buffer.duration);
        source.connect(envelope).connect(master);
        const voice = { source, envelope, logo };
        ahemVoice = voice;
        lastAhem = performance.now();
        logo.dataset.clearing = 'true';
        source.onended = () => {
          source.disconnect(); envelope.disconnect();
          if (ahemVoice === voice) {
            ahemVoice = null;
            delete logo.dataset.clearing;
          }
        };
        source.start(now);
      }).catch(() => {});
    } catch (_) { /* The home link works even when browser audio is unavailable. */ }
  }

  // A normal page click unlocks later hover notes, without making any sound.
  // Safari can require the first note to be a tap/click on the mask itself.
  function arm() {
    try { const ctx = audio(); if (ctx.state !== 'running') ctx.resume().catch(() => {}); } catch (_) {}
  }
  document.addEventListener('pointerdown', arm, { once: true, passive: true });
  buttons.forEach(button => {
    button.disabled = false;
    button.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') request(button); });
    button.addEventListener('pointerleave', () => { requests.delete(button); stop(button); });
    button.addEventListener('click', () => request(button));
    button.addEventListener('blur', () => { requests.delete(button); stop(button); });
  });
  logos.forEach(logo => {
    logo.addEventListener('pointerenter', event => {
      if (event.pointerType === 'touch') return;
      requestAhem(logo);
    });
    logo.addEventListener('click', () => requestAhem(logo));
  });
  function quiet() { requests.clear(); buttons.forEach(stop); quietAhem(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) quiet(); });
  window.addEventListener('pagehide', quiet);
  window.addEventListener('keydown', event => { if (event.key === 'Escape') quiet(); });
  document.querySelectorAll('video').forEach(video => {
    video.addEventListener('play', quiet);
    video.addEventListener('volumechange', () => { if (filmAudible()) quiet(); });
  });
})();
