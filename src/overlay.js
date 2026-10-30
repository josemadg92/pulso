import { lenis } from './scroll.js';
import { prefersReducedMotion } from './spring.js';

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
const EASE_DRAWER = 'cubic-bezier(0.32, 0.72, 0, 1)';

export const lockPage = (on) => {
  document.documentElement.classList.toggle('is-locked', on);
  if (lenis) on ? lenis.stop() : lenis.start();
};

// Variantes de movimiento para los paneles. El cierre siempre es más rápido que la apertura.
export const MOTION = {
  // Panel lateral en escritorio, hoja inferior en móvil
  sheet: () => {
    const mobile = window.matchMedia('(max-width: 640px)').matches;
    const hidden = mobile ? 'translateY(100%)' : 'translateX(100%)';
    return {
      enter: [[{ transform: hidden }, { transform: 'none' }], { duration: 420, easing: EASE_DRAWER }],
      exit: [[{ transform: 'none' }, { transform: hidden }], { duration: 260, easing: EASE_DRAWER }],
    };
  },
  // Aviso centrado: los modales no tienen disparador, así que crecen desde el centro
  notice: () => ({
    enter: [
      [
        { opacity: 0, transform: 'scale(0.96)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 220, easing: EASE_OUT },
    ],
    exit: [
      [
        { opacity: 1, transform: 'none' },
        { opacity: 0, transform: 'scale(0.97)' },
      ],
      { duration: 150, easing: EASE_OUT },
    ],
  }),
};

// <dialog> a pantalla completa con un velo (.scrim) y un panel animado.
// Escape, clic en el velo y el botón [data-overlay-close] cierran con animación.
export function createOverlay(dialog, { motion, onClose } = {}) {
  const panel = dialog.querySelector('[data-overlay-panel]');
  const scrim = dialog.querySelector('.scrim');
  let anim = null;
  let closing = false;
  let origin = null;

  const play = (phase) => {
    const reduce = prefersReducedMotion();
    const [frames, options] = reduce
      ? [phase === 'enter' ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease' }]
      : motion()[phase];
    scrim?.animate(phase === 'enter' ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }], {
      duration: options.duration,
      easing: 'ease',
      fill: 'forwards',
    });
    return panel.animate(frames, options);
  };

  const finish = () => {
    dialog.close();
    lockPage(false);
    scrim?.getAnimations().forEach((a) => a.cancel());
    origin?.focus?.({ preventScroll: true });
    anim = null;
    onClose?.();
  };

  const open = () => {
    origin = document.activeElement;
    closing = false;
    dialog.showModal();
    lockPage(true);
    anim = play('enter');
  };

  const close = () => {
    if (!dialog.open || closing) return;
    closing = true;
    // Interrumpido a mitad de la entrada: se invierte desde donde esté
    if (anim && anim.playState === 'running') {
      anim.reverse();
      scrim?.getAnimations().forEach((a) => a.reverse());
    } else {
      anim = play('exit');
    }
    anim.onfinish = finish;
  };

  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  scrim?.addEventListener('click', close);
  dialog.querySelectorAll('[data-overlay-close]').forEach((b) => b.addEventListener('click', close));

  return { open, close };
}
