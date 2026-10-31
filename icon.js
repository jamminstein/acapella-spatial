'use strict';

// Keep the original visionOS artwork as separate planes. No motion sensors,
// animation loop, or touch interception: a phone can still scroll normally.
(() => {
  const icon = document.querySelector('.icon-showcase');
  if (!icon) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  let pointer = null;
  let frame = 0;
  const clamp = value => Math.max(-1, Math.min(1, value));

  function reset() {
    cancelAnimationFrame(frame);
    frame = 0;
    pointer = null;
    icon.classList.remove('is-peeking');
    icon.style.setProperty('--icon-x', '0');
    icon.style.setProperty('--icon-y', '0');
  }

  function update() {
    frame = 0;
    if (!visible || motion.matches || document.hidden) return;
    const rect = icon.getBoundingClientRect();
    const position = clamp((window.innerHeight * .45 - rect.top - rect.height / 2) / (window.innerHeight * .65));
    const x = pointer ? clamp((pointer.x - rect.left) / rect.width * 2 - 1) : position * .45;
    const y = pointer ? clamp((pointer.y - rect.top) / rect.height * 2 - 1) : position * .65;
    icon.style.setProperty('--icon-x', x.toFixed(3));
    icon.style.setProperty('--icon-y', y.toFixed(3));
  }

  function schedule() {
    if (!frame && visible && !motion.matches && !document.hidden) frame = requestAnimationFrame(update);
  }

  function motionChanged() {
    reset();
    icon.disabled = motion.matches;
    icon.setAttribute('aria-label', motion.matches ? 'Acapella app icon' : 'Tilt the Acapella app icon');
    schedule();
  }

  icon.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    pointer = { x: event.clientX, y: event.clientY };
    schedule();
  }, { passive: true });
  icon.addEventListener('pointerleave', () => { pointer = null; schedule(); });
  icon.addEventListener('pointercancel', () => { pointer = null; schedule(); });
  icon.addEventListener('click', () => {
    if (!motion.matches) icon.classList.add('is-peeking');
  });
  icon.addEventListener('animationend', () => icon.classList.remove('is-peeking'));
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); else schedule(); });
  motion.addEventListener('change', motionChanged);

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) schedule(); else reset();
    });
    observer.observe(icon);
  } else {
    visible = true;
  }
  motionChanged();
})();
