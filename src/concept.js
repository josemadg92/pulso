import { createOverlay, MOTION } from './overlay.js';

// Enlaces que en la web final llevan a contenido del cliente (legales, redes, correo).
// En este concepto abren un aviso que explica qué habría detrás.
const COPY = {
  privacidad: ['Política de privacidad', 'En la web final, aquí va la política de privacidad de PULSO, redactada y revisada por su asesoría legal.'],
  cookies: ['Política de cookies', 'En la web final, aquí va la política de cookies junto al panel para elegir qué cookies aceptas.'],
  condiciones: ['Condiciones de venta', 'En la web final, aquí van las condiciones de compra, cambios y devoluciones de entradas.'],
  instagram: ['PULSO en Instagram', 'En la web final, este enlace abre el perfil oficial de PULSO en Instagram.'],
  tiktok: ['PULSO en TikTok', 'En la web final, este enlace abre el perfil oficial de PULSO en TikTok.'],
  soundcloud: ['PULSO en SoundCloud', 'En la web final, este enlace abre las sesiones de PULSO en SoundCloud.'],
  contacto: ['Escribir a PULSO', 'En la web final, este enlace abre tu correo con la dirección de contacto de PULSO.'],
  prensa: ['Prensa', 'En la web final, este enlace abre tu correo con la dirección de prensa de PULSO.'],
};

export function initConcept() {
  const dialog = document.querySelector('[data-concept-dialog]');
  if (!dialog) return;

  const title = dialog.querySelector('[data-c-title]');
  const text = dialog.querySelector('[data-c-text]');
  const overlay = createOverlay(dialog, { motion: MOTION.notice });

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-concept]');
    if (!trigger || !COPY[trigger.dataset.concept]) return;
    e.preventDefault();
    [title.textContent, text.textContent] = COPY[trigger.dataset.concept];
    overlay.open();
  });
}
