import { EVENTS } from './data/events.js';
import { createOverlay, MOTION } from './overlay.js';
import { enhance } from './forms.js';

const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' });
const MAX_PER_ORDER = 6;

const NOTE = (text) => `
  <div class="concept-note">
    <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" /><path d="M8 7.2v4M8 4.8v.01" /></svg>
    <p><span class="mono">Concepto de La Trama</span>${text}</p>
  </div>`;

// Tipos de entrada a partir del precio base. Con "últimas entradas", la anticipada ya se agotó.
function tiersFor(ev) {
  return [
    { id: 'anticipada', name: 'Anticipada', note: 'Precio de lanzamiento', price: ev.priceFrom, soldOut: ev.status === 'last' },
    { id: 'general', name: 'General', note: 'Acceso a todas las salas', price: ev.priceFrom + 8 },
    { id: 'vip', name: 'Preferente', note: 'Entrada sin colas, zona elevada y guardarropa', price: ev.priceFrom + 32 },
  ];
}

export function initTickets() {
  const dialog = document.querySelector('[data-tickets-dialog]');
  if (!dialog) return;

  const panel = dialog.querySelector('[data-overlay-panel]');
  const body = dialog.querySelector('[data-t-body]');
  const kicker = dialog.querySelector('[data-t-kicker]');
  const title = dialog.querySelector('[data-t-title]');
  const meta = dialog.querySelector('[data-t-meta]');
  const overlay = createOverlay(dialog, { motion: MOTION.sheet });

  let ev = null;
  let qty = {};

  const order = () =>
    tiersFor(ev)
      .filter((t) => qty[t.id] > 0)
      .map((t) => ({ ...t, qty: qty[t.id] }));
  const total = () => order().reduce((sum, t) => sum + t.price * t.qty, 0);
  const count = () => order().reduce((sum, t) => sum + t.qty, 0);

  const renderSelect = () => {
    const tiers = tiersFor(ev);
    body.innerHTML = `
      <ul class="tiers">
        ${tiers
          .map(
            (t) => `
          <li class="tier" ${t.soldOut ? 'data-sold-out' : ''}>
            <div class="tier__info">
              <p class="tier__name">${t.name}</p>
              <p class="tier__note">${t.note}</p>
            </div>
            <p class="tier__price">${euro.format(t.price)}</p>
            ${
              t.soldOut
                ? '<p class="tier__out mono">Agotada</p>'
                : `<div class="stepper">
                    <button class="stepper__btn" type="button" data-step="-1" data-tier="${t.id}" aria-label="Quitar una entrada ${t.name}">−</button>
                    <output class="stepper__qty" data-qty="${t.id}" aria-live="polite">${qty[t.id] ?? 0}</output>
                    <button class="stepper__btn" type="button" data-step="1" data-tier="${t.id}" aria-label="Añadir una entrada ${t.name}">+</button>
                  </div>`
            }
          </li>`,
          )
          .join('')}
      </ul>
      <div class="sheet__summary">
        <div>
          <p class="mono">Total</p>
          <p class="sheet__total" data-total></p>
        </div>
        <p class="mono sheet__fees">Gastos de gestión incluidos · Máx. ${MAX_PER_ORDER} por compra</p>
      </div>
      <button class="btn btn--event sheet__cta" type="button" data-checkout>Continuar al pago</button>`;
    sync();
  };

  const sync = () => {
    const n = count();
    body.querySelector('[data-total]').textContent = euro.format(total());
    body.querySelector('[data-checkout]').disabled = n === 0;
    tiersFor(ev).forEach((t) => {
      const out = body.querySelector(`[data-qty="${t.id}"]`);
      if (!out) return;
      out.textContent = qty[t.id] ?? 0;
      body.querySelector(`[data-tier="${t.id}"][data-step="-1"]`).disabled = !qty[t.id];
      body.querySelector(`[data-tier="${t.id}"][data-step="1"]`).disabled = n >= MAX_PER_ORDER;
    });
  };

  const renderCheckout = () => {
    const items = order();
    body.innerHTML = `
      <ul class="receipt">
        ${items.map((t) => `<li><span>${t.qty} × ${t.name}</span><span>${euro.format(t.price * t.qty)}</span></li>`).join('')}
        <li class="receipt__total"><span>Total</span><span>${euro.format(total())}</span></li>
      </ul>
      ${NOTE('Aquí la compra continuaría en la plataforma de venta de entradas de PULSO, con pago seguro. En este concepto el recorrido termina aquí.')}
      <button class="btn btn--ghost sheet__cta" type="button" data-back>Volver a las entradas</button>`;
    body.querySelector('[data-back]').focus();
  };

  const renderWaitlist = () => {
    body.innerHTML = `
      <p class="sheet__lede">Las entradas para esta noche se han agotado. Si se liberan, avisamos primero a quien esté en la lista de espera.</p>
      <form class="newsletter" data-waitlist novalidate>
        <label class="sr-only" for="wl-email">Tu correo electrónico</label>
        <input id="wl-email" name="email" type="email" autocomplete="email" inputmode="email" placeholder="Tu correo electrónico" required />
        <button class="btn btn--event" type="submit">Apuntarme</button>
        <p class="newsletter__status" role="status" data-form-status></p>
      </form>
      ${NOTE('Formulario de demostración: no se envía ningún dato.')}`;
    enhance(body.querySelector('[data-waitlist]'), {
      success: 'En la web final, aquí te confirmaríamos tu plaza en la lista de espera.',
    });
  };

  body.addEventListener('click', (e) => {
    const step = e.target.closest('[data-step]');
    if (step) {
      const id = step.dataset.tier;
      qty[id] = Math.max(0, Math.min(MAX_PER_ORDER, (qty[id] ?? 0) + Number(step.dataset.step)));
      sync();
      return;
    }
    if (e.target.closest('[data-checkout]')) renderCheckout();
    if (e.target.closest('[data-back]')) {
      renderSelect();
      body.querySelector('[data-checkout]').focus();
    }
  });

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-tickets]');
    if (!trigger) return;
    e.preventDefault();
    ev = EVENTS.find((x) => x.id === trigger.dataset.tickets);
    if (!ev) return;
    qty = {};
    panel.style.cssText = `--a:${ev.theme.a};--b:${ev.theme.b};--bg:${ev.theme.bg}`;
    kicker.textContent = ev.series;
    title.textContent = ev.name;
    meta.textContent = `${dateFmt.format(new Date(`${ev.date}T12:00:00`))} · ${ev.venue}, ${ev.area}`;
    ev.status === 'sold-out' ? renderWaitlist() : renderSelect();
    overlay.open();
  });
}
