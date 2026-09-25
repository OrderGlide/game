// Floating virtual joystick (touch/mouse) + keyboard fallback for desktop.

export interface Joystick { active: boolean; ox: number; oy: number; kx: number; ky: number; }

export const JOY_RADIUS = 56;

export class Input {
  joy: Joystick = { active: false, ox: 0, oy: 0, kx: 0, ky: 0 };
  private pointerId: number | null = null;
  private keys = new Set<string>();
  /** Taps consumed by UI (e.g. buttons) before they become a joystick. */
  onTap: ((x: number, y: number) => boolean) | null = null;
  onFirstInteraction: (() => void) | null = null;

  constructor(el: HTMLElement) {
    el.addEventListener('pointerdown', (e) => {
      this.onFirstInteraction?.();
      if (this.onTap?.(e.clientX, e.clientY)) return;
      if (this.pointerId !== null) return;
      this.pointerId = e.pointerId;
      el.setPointerCapture?.(e.pointerId);
      this.joy = { active: true, ox: e.clientX, oy: e.clientY, kx: e.clientX, ky: e.clientY };
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.pointerId) return;
      this.joy.kx = e.clientX;
      this.joy.ky = e.clientY;
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.joy.active = false;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    window.addEventListener('keydown', (e) => { this.onFirstInteraction?.(); this.keys.add(e.key.toLowerCase()); });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => { this.keys.clear(); this.joy.active = false; this.pointerId = null; });
  }

  /** Movement vector with length 0..1. */
  direction(): { x: number; y: number } {
    let x = 0, y = 0;
    if (this.joy.active) {
      const dx = this.joy.kx - this.joy.ox, dy = this.joy.ky - this.joy.oy;
      const d = Math.hypot(dx, dy);
      if (d > 6) {
        const m = Math.min(1, d / JOY_RADIUS);
        return { x: (dx / d) * m, y: (dy / d) * m };
      }
      return { x: 0, y: 0 };
    }
    const k = this.keys;
    if (k.has('a') || k.has('arrowleft')) x -= 1;
    if (k.has('d') || k.has('arrowright')) x += 1;
    if (k.has('w') || k.has('arrowup')) y -= 1;
    if (k.has('s') || k.has('arrowdown')) y += 1;
    const d = Math.hypot(x, y);
    return d > 0 ? { x: x / d, y: y / d } : { x: 0, y: 0 };
  }
}
