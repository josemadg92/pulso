// Tope de fotogramas para las escenas 3D decorativas.
// En pantallas de 120/144 Hz no hace falta dibujar el fondo más de unas 60 veces por segundo:
// el movimiento se ve igual y la tarjeta gráfica trabaja menos de la mitad.
const FRAME_MS = 1000 / 60;

// Margen del 20 %: en 144 Hz deja pasar uno de cada dos fotogramas (72 fps), no uno de cada tres
export const frameDue = (now, last) => now - last >= FRAME_MS * 0.8;
