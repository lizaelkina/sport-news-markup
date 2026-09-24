document.addEventListener('DOMContentLoaded', () => {
  // eslint-disable-next-line no-undef
  AOS.init({
    once: true,
    duration: 1000,
    easing: 'ease',
    disable: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  });
});
