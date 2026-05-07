import { keys } from '../input.js';

// Virtual joystick (left) + brake button (right) for touch devices.
// Writes directly into the shared `keys` object so existing drive.js works
// unchanged. Auto-hides on devices without touch. Pointer Events handle
// mouse + touch + pen uniformly.
//
// Layout: bottom-left circle base (120px) with a draggable stick (52px).
//         bottom-right round button (96px) for hand-brake / hard brake.

const DEAD_ZONE = 0.2;

export function maybeBindTouchControls() {
  if (!('ontouchstart' in window) && !(navigator.maxTouchPoints > 0)) return null;
  return bindTouchControls();
}

function bindTouchControls() {
  const root = document.createElement('div');
  Object.assign(root.style, {
    position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '40',
  });

  // ---- joystick base ----
  const base = document.createElement('div');
  Object.assign(base.style, {
    position: 'absolute', left: 'max(20px, env(safe-area-inset-left))',
    bottom: 'max(20px, env(safe-area-inset-bottom))',
    width: '140px', height: '140px', borderRadius: '50%',
    background: 'rgba(20,28,42,0.45)', border: '2px solid rgba(255,255,255,0.25)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.35)', pointerEvents: 'auto',
    touchAction: 'none',
  });
  const stick = document.createElement('div');
  Object.assign(stick.style, {
    position: 'absolute', left: '50%', top: '50%',
    width: '56px', height: '56px', marginLeft: '-28px', marginTop: '-28px',
    borderRadius: '50%', background: 'rgba(211,51,64,0.85)',
    border: '2px solid rgba(255,255,255,0.85)',
    boxShadow: '0 2px 6px rgba(0,0,0,0.45)',
    transition: 'transform 0.08s ease-out',
  });
  base.appendChild(stick);
  root.appendChild(base);

  // ---- brake button ----
  const brake = document.createElement('div');
  Object.assign(brake.style, {
    position: 'absolute', right: 'max(20px, env(safe-area-inset-right))',
    bottom: 'max(20px, env(safe-area-inset-bottom))',
    width: '110px', height: '110px', borderRadius: '50%',
    background: 'rgba(80,20,28,0.7)', border: '2px solid rgba(255,255,255,0.4)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.35)', pointerEvents: 'auto',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'rgba(255,235,200,0.95)', fontSize: '13px', fontWeight: '700',
    letterSpacing: '0.08em', textShadow: '0 1px 2px #000',
    touchAction: 'none', userSelect: 'none',
  });
  brake.textContent = 'BRAKE';
  root.appendChild(brake);

  document.body.appendChild(root);

  // ---- joystick logic ----
  let activeId = null;
  const RADIUS = 60;                       // max stick travel from center

  function applyStick(nx, ny) {
    // y inverted: pushing up should accelerate (forward)
    keys.up    = ny < -DEAD_ZONE;
    keys.down  = ny >  DEAD_ZONE;
    keys.left  = nx < -DEAD_ZONE;
    keys.right = nx >  DEAD_ZONE;
  }
  function resetStick() {
    keys.up = keys.down = keys.left = keys.right = false;
    stick.style.transform = 'translate(0,0)';
  }

  base.addEventListener('pointerdown', (e) => {
    activeId = e.pointerId;
    base.setPointerCapture(activeId);
    onMove(e);
  });
  base.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activeId) return;
    onMove(e);
  });
  function endStick(e) {
    if (e.pointerId !== activeId) return;
    activeId = null;
    resetStick();
  }
  base.addEventListener('pointerup', endStick);
  base.addEventListener('pointercancel', endStick);
  base.addEventListener('pointerleave', endStick);

  function onMove(e) {
    const r = base.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) { dx = dx / d * RADIUS; dy = dy / d * RADIUS; }
    stick.style.transform = `translate(${dx}px, ${dy}px)`;
    applyStick(dx / RADIUS, dy / RADIUS);
  }

  // ---- brake button logic ----
  let brakeActive = null;
  brake.addEventListener('pointerdown', (e) => {
    brakeActive = e.pointerId;
    brake.setPointerCapture(brakeActive);
    keys.down = true;
    brake.style.background = 'rgba(180,40,55,0.9)';
  });
  function endBrake(e) {
    if (e.pointerId !== brakeActive) return;
    brakeActive = null;
    keys.down = false;
    brake.style.background = 'rgba(80,20,28,0.7)';
  }
  brake.addEventListener('pointerup', endBrake);
  brake.addEventListener('pointercancel', endBrake);
  brake.addEventListener('pointerleave', endBrake);

  return { root };
}
