import { ScrollTrigger } from './scroll.js';
import { prefersReducedMotion } from './spring.js';

export function initManifesto() {
  const section = document.querySelector('[data-manifesto]');
  if (!section) return;

  const steps = [...section.querySelectorAll('[data-step]')];
  const bar = section.querySelector('[data-manifesto-bar]');
  const canvas = section.querySelector('[data-manifesto-canvas]');
  const reduce = prefersReducedMotion();
  const state = { progress: reduce ? 0.62 : 0 };

  // Con movimiento reducido los tres textos se leen seguidos, sin escena anclada
  if (reduce) section.setAttribute('data-static', '');

  let active = -1;
  const setActive = (i) => {
    if (i === active) return;
    active = i;
    steps.forEach((el, n) => el.toggleAttribute('data-active', n === i));
  };

  if (!reduce) {
    ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        state.progress = self.progress;
        bar.style.transform = `scaleX(${self.progress.toFixed(4)})`;
        setActive(Math.min(steps.length - 1, Math.floor(self.progress * steps.length * 0.999)));
      },
      onLeaveBack: () => setActive(0),
    });
    setActive(0);
  }

  // La escena 3D se carga cuando el manifiesto está a punto de entrar
  const io = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      import('./manifesto-scene.js')
        .then(({ createManifestoScene }) => createManifestoScene({ canvas, section, state, reduce }))
        .catch((err) => console.warn('[PULSO] Manifiesto sin WebGL.', err));
    },
    { rootMargin: '50% 0px' },
  );
  io.observe(section);
}
