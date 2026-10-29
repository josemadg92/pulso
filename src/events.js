import { EVENTS, STATUS_LABEL } from './data/events.js';
import { gsap, ScrollTrigger, scrollToY } from './scroll.js';
import { prefersReducedMotion } from './spring.js';

const dateFmt = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Europe/Madrid' });
const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const escape = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function themeVars({ theme }) {
  return `--a:${theme.a};--b:${theme.b};--bg:${theme.bg};--wdth:${theme.wdth};--wght:${theme.wght};--track:${theme.track}em`;
}

function cardTemplate(ev, i, total) {
  const parts = Object.fromEntries(
    dateFmt.formatToParts(new Date(`${ev.date}T12:00:00`)).map((p) => [p.type, p.value.replace('.', '')]),
  );
  const soldOut = ev.status === 'sold-out';
  const titleId = `event-${ev.id}`;

  return `
    <li class="event" data-index="${i}" data-status="${ev.status}" style="${themeVars(ev)}">
      <article class="event__card" aria-labelledby="${titleId}" aria-roledescription="evento" aria-label="${i + 1} de ${total}">
        <div class="event__art art art--${ev.theme.art}" aria-hidden="true">
          <span class="event__art-word">${escape(ev.series)}</span>
        </div>

        <div class="event__body">
          <div class="event__top">
            <time class="event__date" datetime="${ev.date}">
              <span class="event__day">${parts.day}</span>
              <span class="mono">${parts.month} ${parts.year}</span>
            </time>
            <span class="event__status mono">${STATUS_LABEL[ev.status]}</span>
          </div>

          <p class="event__series mono">${escape(ev.series)}</p>
          <h3 class="event__name" id="${titleId}">${escape(ev.name)}</h3>

          <dl class="event__info">
            <div><dt class="mono">Lugar</dt><dd>${escape(ev.venue)} · ${escape(ev.area)}</dd></div>
            <div><dt class="mono">Horario</dt><dd>${escape(ev.doors)}</dd></div>
            <div><dt class="mono">Line-up</dt><dd>${ev.lineup.map(escape).join(' · ')}</dd></div>
          </dl>

          <div class="event__buy">
            <p class="event__price"><span class="mono">Desde</span> ${euro.format(ev.priceFrom)}</p>
            ${
              soldOut
                ? `<a class="btn btn--ghost" href="${ev.tickets}?waitlist=1">Lista de espera</a>`
                : `<a class="btn btn--event" href="${ev.tickets}">Comprar entradas
                     <svg class="btn__icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg></a>`
            }
          </div>

          <div class="event__bar" role="meter" aria-label="Entradas vendidas" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(ev.sold * 100)}">
            <span style="transform: scaleX(${ev.sold})"></span>
          </div>
        </div>
      </article>
    </li>`;
}

export function initEvents() {
  const section = document.querySelector('[data-events]');
  if (!section) return;

  const pin = section.querySelector('[data-events-pin]');
  const viewport = section.querySelector('[data-events-viewport]');
  const track = section.querySelector('[data-events-track]');
  const bgs = section.querySelector('[data-events-bgs]');
  const current = section.querySelector('[data-events-current]');
  const prevBtn = section.querySelector('[data-events-prev]');
  const nextBtn = section.querySelector('[data-events-next]');

  const n = EVENTS.length;
  track.innerHTML = EVENTS.map((ev, i) => cardTemplate(ev, i, n)).join('');
  bgs.innerHTML = EVENTS.map((ev) => `<div class="events__bg" style="${themeVars(ev)}"></div>`).join('');
  section.querySelector('[data-events-total]').textContent = String(n).padStart(2, '0');
  pin.prepend(bgs); // el fondo viaja con la parte anclada

  const cards = [...track.children];
  const layers = [...bgs.children];

  let active = -1;
  const setActive = (i) => {
    i = Math.max(0, Math.min(n - 1, i));
    if (i === active) return;
    active = i;
    cards.forEach((el, k) => el.toggleAttribute('data-active', k === i));
    layers.forEach((el, k) => el.toggleAttribute('data-active', k === i));
    section.style.setProperty('--accent', EVENTS[i].theme.a);
    current.textContent = String(i + 1).padStart(2, '0');
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === n - 1;
  };
  setActive(0);

  // Carrusel nativo con scroll-snap: táctil, pantallas pequeñas o movimiento reducido
  const nativeGoTo = (i) => {
    const pad = parseFloat(getComputedStyle(track).paddingLeft);
    viewport.scrollTo({ left: cards[i].offsetLeft - pad, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };
  let goTo = nativeGoTo;

  const io = new IntersectionObserver(
    (entries) => {
      if (section.hasAttribute('data-pinned')) return;
      entries.forEach((e) => e.isIntersecting && setActive(Number(e.target.dataset.index)));
    },
    { root: viewport, threshold: 0.6 },
  );
  cards.forEach((c) => io.observe(c));

  // Escritorio con ratón: el scroll vertical desplaza las tarjetas en horizontal.
  // gsap.matchMedia deshace el anclaje solo si la ventana cambia de tamaño o de preferencia.
  gsap
    .matchMedia()
    .add('(min-width: 900px) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
      section.setAttribute('data-pinned', '');
      viewport.scrollLeft = 0;

      const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          pin,
          start: 'top top',
          end: () => `+=${distance()}`,
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => setActive(Math.round(self.progress * (n - 1))),
        },
      });
      goTo = (i) => {
        const st = tween.scrollTrigger;
        scrollToY(st.start + ((st.end - st.start) * i) / (n - 1));
      };
      document.fonts.ready.then(() => ScrollTrigger.refresh());

      return () => {
        section.removeAttribute('data-pinned');
        goTo = nativeGoTo;
      };
    });

  prevBtn.addEventListener('click', () => goTo(active - 1));
  nextBtn.addEventListener('click', () => goTo(active + 1));
}
