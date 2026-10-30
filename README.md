# PULSO

Proyecto conceptual de **La Trama**: web para una productora creativa de Madrid que organiza noches de música electrónica en naves, terrazas y galerías.

**[Ver la web en vivo →](https://josemadg92.github.io/pulso/)**

## Qué incluye

- **Hero cinematográfico** con escena 3D en tiempo real que responde al cursor.
- **Manifiesto narrado con el scroll**: una figura que gira, se fragmenta y se transforma en un portal.
- **Eventos en slides horizontales**: cada noche cambia la paleta, el fondo y la tipografía de la pantalla.
- **Galería audiovisual** en mosaico irregular, con apertura a pantalla completa.
- **Recorrido de compra de entradas**, lista de espera y formularios de colaboración y comunidad.
- Adaptada a móvil, navegable con teclado y con versión para quien prefiere reducir el movimiento.

Las imágenes son ilustraciones de concepto y los formularios son de demostración: no envían datos.

## Tecnología

HTML, CSS y JavaScript sin framework, con [Vite](https://vite.dev), [Three.js](https://threejs.org) y shaders propios para el 3D, [GSAP](https://gsap.com) y [Lenis](https://lenis.darkroom.engineering) para el scroll.

## Desarrollo

```bash
npm install
npm run dev
```

`npm run build` genera la versión publicable en `dist/`. Cada cambio en `main` se publica solo en GitHub Pages.
