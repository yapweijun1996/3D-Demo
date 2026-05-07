// Tiny FPS / frame-time HUD. No external dependency.
// Usage: const stats = createStats(); stats.tick(dt); — call once per frame.
export function createStats() {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed', top: '8px', right: '8px', zIndex: 60,
    padding: '6px 10px', background: 'rgba(0,0,0,0.55)',
    color: '#9efacc', font: '12px ui-monospace,monospace',
    borderRadius: '6px', pointerEvents: 'none', minWidth: '92px',
    textAlign: 'right', textShadow: '0 1px 2px #000',
  });
  el.textContent = '— fps';
  document.body.appendChild(el);

  let acc = 0, frames = 0, lastFps = 0, lastMs = 0;
  return {
    tick(dt) {
      acc += dt; frames++;
      lastMs = dt * 1000;
      if (acc >= 0.5) {
        lastFps = Math.round(frames / acc);
        el.textContent = `${lastFps} fps · ${lastMs.toFixed(1)} ms`;
        acc = 0; frames = 0;
      }
    },
  };
}
