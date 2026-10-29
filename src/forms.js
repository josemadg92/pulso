import { lenis } from './scroll.js';

const MESSAGES = {
  valueMissing: 'Este campo es obligatorio.',
  typeMismatch: 'Revisa el email: parece que falta algo.',
  tooShort: (el) => `Cuéntanos un poco más (mínimo ${el.minLength} caracteres).`,
  checkbox: 'Necesitamos tu permiso para poder responderte.',
};

function messageFor(el) {
  const v = el.validity;
  if (v.valid) return '';
  if (el.type === 'checkbox') return MESSAGES.checkbox;
  if (v.valueMissing) return MESSAGES.valueMissing;
  if (v.typeMismatch) return MESSAGES.typeMismatch;
  if (v.tooShort) return MESSAGES.tooShort(el);
  return el.validationMessage;
}

function validate(el) {
  const msg = messageFor(el);
  const slot = el.closest('.field, .check')?.querySelector('.field__error');
  el.setAttribute('aria-invalid', String(Boolean(msg)));
  if (slot) slot.textContent = msg;
  return !msg;
}

// Formulario con validación propia y estado de envío. Sin backend todavía:
// `send` simula la llamada; sustituir por el endpoint o CRM del cliente.
function enhance(form, { success, send = () => new Promise((r) => setTimeout(r, 700)) }) {
  const status = form.querySelector('[data-form-status]');
  const submit = form.querySelector('[type="submit"]');
  const controls = [...form.elements].filter((el) => el.willValidate);
  let tried = false;

  controls.forEach((el) => {
    el.addEventListener('blur', () => tried && validate(el));
    el.addEventListener('input', () => tried && el.getAttribute('aria-invalid') === 'true' && validate(el));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    tried = true;
    const invalid = controls.filter((el) => !validate(el));
    if (invalid.length) {
      invalid[0].focus();
      status.textContent = '';
      return;
    }

    submit.disabled = true;
    const label = submit.textContent;
    submit.textContent = 'Enviando…';
    try {
      await send(new FormData(form));
      form.reset();
      tried = false;
      controls.forEach((el) => el.removeAttribute('aria-invalid'));
      status.dataset.state = 'ok';
      status.textContent = success;
    } catch {
      status.dataset.state = 'error';
      status.textContent = 'No se ha podido enviar. Prueba otra vez o escríbenos a hola@pulso.example.';
    } finally {
      submit.disabled = false;
      submit.textContent = label;
    }
  });
}

export function initForms() {
  const collab = document.querySelector('[data-collab-form]');
  if (collab) {
    enhance(collab, { success: '¡Gracias! Lo hemos recibido y te contestamos en menos de 48 horas.' });

    const type = collab.querySelector('[data-collab-type]');
    const doors = [...document.querySelectorAll('[data-collab]')];
    const mark = (value) => doors.forEach((d) => d.toggleAttribute('data-selected', d.dataset.collab === value));

    doors.forEach((door) =>
      door.addEventListener('click', () => {
        type.value = door.dataset.collab;
        mark(type.value);
        const first = collab.querySelector('input[name="nombre"]');
        if (lenis) lenis.scrollTo(collab, { offset: -96, onComplete: () => first.focus({ preventScroll: true }) });
        else first.focus();
      }),
    );
    type.addEventListener('change', () => mark(type.value));
    collab.addEventListener('reset', () => mark(''));
  }

  const newsletter = document.querySelector('[data-newsletter]');
  if (newsletter) enhance(newsletter, { success: '¡Ya casi estás! Revisa tu correo para confirmar la suscripción.' });
}
