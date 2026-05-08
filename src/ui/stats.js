import { injectTheme, TOKENS } from './theme.js';

// Performance HUD — hidden by default. Toggle with backtick (`).
// Pill-style minimal panel that doesn't break immersion.
export function createStats(renderer) {
  injectTheme();
  const el = document.createElement('div');
  el.className = 'sg-pill';
  Object.assign(el.style, {
    position: 'fixed', top: '120px', right: '14px', zIndex: '60',
    padding: '6px 12px', font: `600 11px ${TOKENS.mono}`,
    letterSpacing: '.04em', minWidth: '0',
    display: 'none',                                 // hidden by default
    pointerEvents: 'none',
  });
  el.textContent = '— fps';
  document.body.appendChild(el);

  // Toggle with backtick. Show small hint on first hide.
  let visible = false;
  addEventListener('keydown', (e) => {
    if (e.code === 'Backquote') {
      visible = !visible;
      el.style.display = visible ? 'block' : 'none';
    }
  });

  let acc = 0, frames = 0;
  let maxMs = 0, physMsMax = 0;
  let lastFps = 0;

  return {
    tick(dt, extra = {}) {
      const ms = dt * 1000;
      acc += dt; frames++;
      if (ms > maxMs) maxMs = ms;
      if (extra.physicsMs && extra.physicsMs > physMsMax) physMsMax = extra.physicsMs;
      if (acc < 0.5) return;

      lastFps = Math.round(frames / acc);
      const avgMs = (acc * 1000) / frames;
      const calls = renderer?.info?.render?.calls ?? '?';
      const tris = renderer?.info?.render?.triangles ?? 0;
      const trisStr = tris > 1000 ? (tris / 1000).toFixed(1) + 'k' : String(tris);
      const col = lastFps >= 55 ? '#9efacc' : lastFps >= 30 ? TOKENS.gold : '#ff7a7a';
      el.style.color = col;
      const dayState = window.__sgDayState?.();
      const dayStr = dayState
        ? `<span style="opacity:.3"> · </span>${dayState.mode} ${dayState.phase.toFixed(2)}`
        : '';
      el.innerHTML =
        `<span style="opacity:.5">FPS </span>${lastFps}` +
        `<span style="opacity:.3"> · </span>${avgMs.toFixed(1)}ms` +
        `<span style="opacity:.3"> · </span>peak ${maxMs.toFixed(1)}` +
        `<span style="opacity:.3"> · </span>${calls} calls` +
        `<span style="opacity:.3"> · </span>${trisStr}` +
        (physMsMax > 0 ? `<span style="opacity:.3"> · </span>phys ${physMsMax.toFixed(1)}` : '') +
        dayStr;
      acc = 0; frames = 0; maxMs = 0; physMsMax = 0;
    },
  };
}
