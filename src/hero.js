import { createSpring, prefersReducedMotion, finePointer } from './spring.js';

export function initHero() {
  const hero = document.querySelector('.hero');
  const screen = hero?.querySelector('[data-screen]');
  if (!hero || !screen) return;

  // Escalonado de las piezas que entran (60ms entre cada una)
  hero.querySelectorAll('[data-reveal]').forEach((el, i) => el.style.setProperty('--i', i));

  // Puntero normalizado (-1..1) compartido por titular y escena 3D
  const pointer = { x: 0, y: 0, speed: 0 };
  let last = null;
  window.addEventListener(
    'pointermove',
    (e) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      if (last) pointer.speed = Math.min(1, pointer.speed + Math.hypot(x - last.x, y - last.y) * 2);
      pointer.x = x;
      pointer.y = y;
      last = { x, y };
    },
    { passive: true },
  );

  fitTitle(hero.querySelector('[data-title]'));

  const reduce = prefersReducedMotion();
  if (!reduce && finePointer()) initLayerParallax(hero, pointer);

  // Three.js se carga después del primer pintado: el texto nunca espera al 3D
  const canvas = screen.querySelector('[data-canvas]');
  const start = () =>
    import('./scene.js')
      .then(({ createScene }) => createScene({ canvas, screen, pointer, reduce }))
      .catch((err) => console.warn('[PULSO] Sin WebGL, se queda el degradado de respaldo.', err));
  'requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 600 }) : setTimeout(start, 200);
}

// El titular ocupa exactamente el ancho útil, sea cual sea la pantalla o la fuente cargada.
function fitTitle(title) {
  if (!title) return;
  const layer = title.querySelector('.hero__layer--tinta');
  const fit = () => {
    const styles = getComputedStyle(title);
    const available = title.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
    const size = parseFloat(styles.fontSize);
    const width = layer.getBoundingClientRect().width;
    if (width > 0) title.style.fontSize = `${((size * available) / width).toFixed(2)}px`;
  };
  document.fonts.ready.then(fit);
  new ResizeObserver(fit).observe(title);
}

// Las capas de color se desplazan en sentido contrario al ratón, como tintas mal registradas.
function initLayerParallax(hero, pointer) {
  const layers = [...hero.querySelectorAll('[data-layer]')].slice(0, 2);
  const depth = [-14, 10]; // px de recorrido máximo por capa
  const springs = layers.map(() => ({
    x: createSpring(0, { stiffness: 90, damping: 15 }),
    y: createSpring(0, { stiffness: 90, damping: 15 }),
  }));

  let visible = true;
  new IntersectionObserver(([entry]) => (visible = entry.isIntersecting)).observe(hero);

  let prev = performance.now();
  const tick = (now) => {
    const dt = Math.min(0.032, (now - prev) / 1000);
    prev = now;
    if (visible) {
      layers.forEach((el, i) => {
        const s = springs[i];
        s.x.target = pointer.x * depth[i];
        s.y.target = pointer.y * depth[i] * 0.5;
        if (s.x.resting && s.y.resting) return;
        el.style.transform = `translate3d(${s.x.step(dt).toFixed(2)}px, ${s.y.step(dt).toFixed(2)}px, 0)`;
      });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
