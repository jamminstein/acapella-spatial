const playground = document.querySelector('.sound-playground');
if (playground) {
  let loaded = false;
  const load = () => {
    if (loaded) return;
    loaded = true;
    import('./waveform-viewer.bundle.js?v=20261102-cycle-depth-1').catch(() => {
      playground.querySelector('[data-wave-status]').textContent = 'You can listen to the original phrase below';
    });
  };
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); }
    }, { rootMargin: '500px' });
    observer.observe(playground);
  } else load();
}
