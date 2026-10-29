import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from './spring.js';

gsap.registerPlugin(ScrollTrigger);

// Scroll suave solo con ratón/trackpad: en táctil manda el scroll nativo del sistema
// y con "reducir movimiento" no añadimos inercia artificial.
export const lenis =
  prefersReducedMotion() || window.matchMedia('(pointer: coarse)').matches
    ? null
    : new Lenis({ lerp: 0.1, anchors: { offset: -8 } });

if (lenis) {
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

if (import.meta.env.DEV) window.__pulso = { lenis, ScrollTrigger };

export function scrollToY(y) {
  if (lenis) lenis.scrollTo(y, { duration: 0.9, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else window.scrollTo({ top: y, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

export { gsap, ScrollTrigger };
