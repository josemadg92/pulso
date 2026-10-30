import { defineConfig } from 'vite';

// GitHub Pages sirve el proyecto en /pulso/. En desarrollo se queda en la raíz.
// Si se publica en un dominio propio (p. ej. pulso.latrama.es), cambiar a '/'.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/pulso/' : '/',
}));
