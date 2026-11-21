// Keyboard and mouse input. Movement keys are polled as a held set; one-shot actions
// (interact, pause, confirm, punch) are queued as bit flags and consumed once by the loop,
// so a press between frames is never lost. The mouse position is tracked in page pixels
// and converted to world coordinates by the game, which owns the camera.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SAVE = 16;

const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const HELD = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'KeyA', 'KeyD', 'KeyW', 'KeyS', 'ShiftLeft', 'ShiftRight', 'Space']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false };

  window.addEventListener('keydown', (event) => {
    if (HELD.has(event.code)) { held.add(event.code); event.preventDefault(); }
    if (event.repeat) return;
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (event.code === 'KeyE') actions |= ACTION_INTERACT;
    else if (event.code === 'KeyF') actions |= ACTION_PUNCH;
    else if (event.code === 'KeyK') actions |= ACTION_SAVE;
  });
  window.addEventListener('keyup', (event) => { held.delete(event.code); });
  window.addEventListener('blur', () => { held.clear(); mouse.down = false; });
  canvas.addEventListener('pointermove', (event) => { mouse.x = event.clientX; mouse.y = event.clientY; });
  canvas.addEventListener('pointerdown', (event) => { mouse.down = true; mouse.x = event.clientX; mouse.y = event.clientY; });
  window.addEventListener('pointerup', () => { mouse.down = false; });

  return {
    held,
    mouse,
    axis() {
      const x = (held.has('ArrowRight') || held.has('KeyD') ? 1 : 0) - (held.has('ArrowLeft') || held.has('KeyA') ? 1 : 0);
      const y = (held.has('ArrowDown') || held.has('KeyS') ? 1 : 0) - (held.has('ArrowUp') || held.has('KeyW') ? 1 : 0);
      return { x, y };
    },
    sprint() { return held.has('ShiftLeft') || held.has('ShiftRight'); },
    handbrake() { return held.has('Space'); },
    takeActions() { const taken = actions; actions = 0; return taken; },
    pressConfirm() { actions |= ACTION_CONFIRM; },
  };
}
