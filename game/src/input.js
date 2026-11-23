// input.js — keyboard and mouse state for the game: held keys, one-frame
// "pressed" edges, and a movement axis from WASD or the arrow keys.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressedEdges = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.enabled = true;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressedEdges.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    });
    canvas.addEventListener('mousedown', (e) => {
      this.mouse.down = true;
      this.mouse.clicked = true;
      this.mouse.x = e.offsetX;
      this.mouse.y = e.offsetY;
    });
    window.addEventListener('mouseup', () => {
      this.mouse.down = false;
    });
  }

  isDown(code) {
    return this.enabled && this.keys.has(code);
  }

  /** True only on the frame the key went down; consumed by endFrame(). */
  wasPressed(code) {
    return this.enabled && this.pressedEdges.has(code);
  }

  /** Movement axis, each component -1, 0 or 1 (screen space: y down). */
  axis() {
    const x = (this.isDown('KeyD') || this.isDown('ArrowRight') ? 1 : 0)
      - (this.isDown('KeyA') || this.isDown('ArrowLeft') ? 1 : 0);
    const y = (this.isDown('KeyS') || this.isDown('ArrowDown') ? 1 : 0)
      - (this.isDown('KeyW') || this.isDown('ArrowUp') ? 1 : 0);
    return { x, y };
  }

  /** Car input: throttle -1..1 (brake/reverse..accelerate) and steer -1..1. */
  carAxis() {
    const throttle = (this.isDown('KeyW') || this.isDown('ArrowUp') ? 1 : 0)
      - (this.isDown('KeyS') || this.isDown('ArrowDown') ? 0.8 : 0);
    const steer = (this.isDown('KeyD') || this.isDown('ArrowRight') ? 1 : 0)
      - (this.isDown('KeyA') || this.isDown('ArrowLeft') ? 1 : 0);
    return { throttle, steer };
  }

  endFrame() {
    this.pressedEdges.clear();
    this.mouse.clicked = false;
  }
}
