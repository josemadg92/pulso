// Muelle físico mínimo (masa 1). Conserva la velocidad si el objetivo cambia a mitad,
// por eso el seguimiento del ratón se siente vivo en vez de pegado al cursor.
export function createSpring(value = 0, { stiffness = 100, damping = 14 } = {}) {
  return {
    value,
    velocity: 0,
    target: value,
    step(dt) {
      const force = (this.target - this.value) * stiffness - this.velocity * damping;
      this.velocity += force * dt;
      this.value += this.velocity * dt;
      return this.value;
    },
    get resting() {
      return Math.abs(this.target - this.value) < 1e-4 && Math.abs(this.velocity) < 1e-4;
    },
  };
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;
