// Keyboard state for car control.
// `boost` = Shift (nitrous). Held to drain boost gauge for a top-speed kick.
export const keys = { up: false, down: false, left: false, right: false, esc: false, boost: false };

export function bindInput() {
  addEventListener('keydown', (e) => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    keys.up = true;    break;
      case 'KeyS': case 'ArrowDown':  keys.down = true;  break;
      case 'KeyA': case 'ArrowLeft':  keys.left = true;  break;
      case 'KeyD': case 'ArrowRight': keys.right = true; break;
      case 'ShiftLeft': case 'ShiftRight': keys.boost = true; break;
      case 'Escape': keys.esc = true; break;
    }
  });
  addEventListener('keyup', (e) => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    keys.up = false;    break;
      case 'KeyS': case 'ArrowDown':  keys.down = false;  break;
      case 'KeyA': case 'ArrowLeft':  keys.left = false;  break;
      case 'KeyD': case 'ArrowRight': keys.right = false; break;
      case 'ShiftLeft': case 'ShiftRight': keys.boost = false; break;
      case 'Escape': keys.esc = false; break;
    }
  });
}
