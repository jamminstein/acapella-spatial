(() => {
  const notes = Array.from(document.querySelectorAll('.margin-note'));
  if (!notes.length) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let queued = false;

  function updateNotes() {
    queued = false;
    if (reducedMotion.matches) {
      notes.forEach(note => note.style.removeProperty('--note-drift'));
      return;
    }

    const viewportCenter = window.innerHeight / 2;
    const positions = notes.map(note => {
      // Measure the untransformed position so drift never feeds back on itself.
      const parent = note.offsetParent;
      if (!parent) return 0;
      const center = parent.getBoundingClientRect().top + note.offsetTop + note.offsetHeight / 2;
      return Math.max(-12, Math.min(12, (viewportCenter - center) * .04));
    });
    notes.forEach((note, index) => {
      note.style.setProperty('--note-drift', `${positions[index].toFixed(2)}px`);
    });
  }

  function scheduleNotes() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(updateNotes);
  }

  window.addEventListener('scroll', scheduleNotes, { passive: true });
  window.addEventListener('resize', scheduleNotes, { passive: true });
  reducedMotion.addEventListener('change', scheduleNotes);
  if (document.fonts) document.fonts.ready.then(scheduleNotes);
  scheduleNotes();
})();
