import { GALLERY } from './data/gallery.js';
import { lenis } from './scroll.js';
import { prefersReducedMotion } from './spring.js';

const escape = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const vars = ({ colors }) => `--a:${colors.a};--b:${colors.b};--bg:${colors.bg}`;
const TYPE_LABEL = { photo: 'Foto', video: 'Vídeo' };

function media(item) {
  if (item.src && item.type === 'video') {
    return `<video class="tile__file" src="${item.src}" poster="${item.poster ?? ''}" muted loop playsinline preload="none"></video>`;
  }
  if (item.src) return `<img class="tile__file" src="${item.src}" alt="" loading="lazy" decoding="async" />`;
  return `<span class="art__live"></span>`;
}

function tileTemplate(item) {
  return `
    <li class="tile tile--${item.size}" style="${vars(item)}">
      <button class="tile__btn" type="button" data-id="${item.id}" aria-haspopup="dialog">
        <span class="tile__media art art--${item.art}" aria-hidden="true">${media(item)}</span>
        <span class="tile__type mono">${item.type === 'video' ? '▶ ' : ''}${TYPE_LABEL[item.type]}</span>
        <span class="tile__caption">
          <span class="mono">${escape(item.event)} · ${item.year}</span>
          <span class="tile__title">${escape(item.title)}</span>
        </span>
      </button>
    </li>`;
}

export function initGallery() {
  const grid = document.querySelector('[data-gallery]');
  const dialog = document.querySelector('[data-project]');
  if (!grid || !dialog) return;

  grid.innerHTML = GALLERY.map(tileTemplate).join('');

  // Vídeos reales: solo se reproducen mientras se miran
  grid.querySelectorAll('video').forEach((video) => {
    const btn = video.closest('button');
    const play = () => video.play().catch(() => {});
    const stop = () => video.pause();
    btn.addEventListener('pointerenter', play);
    btn.addEventListener('focus', play);
    btn.addEventListener('pointerleave', stop);
    btn.addEventListener('blur', stop);
  });

  const panel = dialog.querySelector('[data-project-panel]');
  const art = dialog.querySelector('[data-project-art]');
  const body = dialog.querySelector('[data-project-body]');
  const note = dialog.querySelector('[data-project-note]');
  const fields = {
    meta: dialog.querySelector('[data-project-meta]'),
    title: dialog.querySelector('[data-project-title]'),
    text: dialog.querySelector('[data-project-text]'),
    credits: dialog.querySelector('[data-project-credits]'),
  };

  let origin = null; // botón desde el que se abrió
  let anim = null;
  let closing = false;
  let afterClose = null;

  // El panel nace recortado exactamente sobre la tarjeta y se expande a pantalla completa
  const clipFrom = () => {
    const r = origin.getBoundingClientRect();
    return `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px round 14px)`;
  };
  const CLIP_OPEN = 'inset(0px 0px 0px 0px round 0px)';

  const lock = (on) => {
    document.documentElement.classList.toggle('is-locked', on);
    if (lenis) on ? lenis.stop() : lenis.start();
  };

  const open = (item, btn) => {
    origin = btn;
    closing = false;
    panel.setAttribute('style', vars(item));
    art.className = `project__art art art--${item.art}`;
    art.innerHTML = `<span class="art__live"></span>`;
    fields.meta.textContent = `${item.event} · ${item.year} · ${TYPE_LABEL[item.type]}`;
    fields.title.textContent = item.title;
    fields.text.textContent = item.text;
    fields.credits.innerHTML = item.credits.map((c) => `<li>${escape(c)}</li>`).join('');
    // El aviso de pieza de muestra solo aparece mientras no haya material real
    note.hidden = Boolean(item.src);

    dialog.showModal();
    lock(true);

    if (prefersReducedMotion()) {
      anim = panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease' });
      return;
    }
    anim = panel.animate([{ clipPath: clipFrom() }, { clipPath: CLIP_OPEN }], {
      duration: 560,
      easing: 'cubic-bezier(0.77, 0, 0.175, 1)',
    });
    [body, note].forEach((el, i) =>
      el.animate(
        [
          { opacity: 0, translate: '0 16px' },
          { opacity: 1, translate: '0 0' },
        ],
        { duration: 420, delay: 300 + i * 60, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'backwards' },
      ),
    );
  };

  const finish = () => {
    dialog.close();
    lock(false);
    origin?.focus({ preventScroll: true });
    anim = null;
    afterClose?.();
    afterClose = null;
  };

  const close = () => {
    if (!dialog.open || closing) return;
    closing = true;

    // Si aún se está abriendo, invertimos la misma animación: vuelve desde donde esté
    if (anim && anim.playState === 'running') {
      anim.reverse();
      anim.onfinish = finish;
      return;
    }
    if (prefersReducedMotion()) {
      anim = panel.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: 'ease' });
    } else {
      [body, note].forEach((el) =>
        el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'ease', fill: 'forwards' }),
      );
      // Salida más rápida que la entrada: el sistema responde, no hay nada que decidir
      anim = panel.animate([{ clipPath: CLIP_OPEN }, { clipPath: clipFrom() }], {
        duration: 380,
        easing: 'cubic-bezier(0.77, 0, 0.175, 1)',
      });
    }
    anim.onfinish = () => {
      [body, note].forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
      finish();
    };
  };

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-id]');
    if (!btn) return;
    open(GALLERY.find((g) => g.id === btn.dataset.id), btn);
  });

  dialog.querySelector('[data-project-close]').addEventListener('click', close);
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault(); // Escape también cierra con la animación de vuelta
    close();
  });
  dialog.querySelector('[data-project-events]').addEventListener('click', (e) => {
    e.preventDefault();
    afterClose = () => (lenis ? lenis.scrollTo('#eventos') : document.getElementById('eventos').scrollIntoView());
    close();
  });
}
