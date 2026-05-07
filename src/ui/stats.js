// Performance HUD — avg fps + worst-case frame time + drawcalls + triangles + physics ms.
// Why "worst-case ms" matters: average FPS hides single-frame stalls that the
// player feels as "lag." Spike to 50 ms once a second = 60fps avg but laggy feel.
//
// Usage:
//   const stats = createStats(renderer);
//   stats.tick(dt, { physicsMs });   // call once per frame after render
export function createStats(renderer) {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed', top: '8px', right: '8px', zIndex: 60,
    padding: '8px 12px', background: 'rgba(0,0,0,0.6)',
    color: '#9efacc', font: '11px ui-monospace,monospace',
    borderRadius: '6px', pointerEvents: 'none', minWidth: '160px',
    textAlign: 'right', textShadow: '0 1px 2px #000', lineHeight: '1.5',
  });
  el.textContent = '— fps';
  document.body.appendChild(el);

  let acc = 0, frames = 0;
  let maxMs = 0;                                  // worst frame in current window
  let physMsMax = 0;
  let lastFps = 0, lastAvgMs = 0, lastMaxMs = 0, lastPhysMs = 0;

  return {
    tick(dt, extra = {}) {
      const ms = dt * 1000;
      acc += dt; frames++;
      if (ms > maxMs) maxMs = ms;
      if (extra.physicsMs && extra.physicsMs > physMsMax) physMsMax = extra.physicsMs;

      if (acc >= 0.5) {
        lastFps = Math.round(frames / acc);
        lastAvgMs = (acc * 1000) / frames;
        lastMaxMs = maxMs;
        lastPhysMs = physMsMax;
        const calls = renderer?.info?.render?.calls ?? '?';
        const tris = renderer?.info?.render?.triangles ?? 0;
        const trisStr = tris > 1000 ? (tris / 1000).toFixed(1) + 'k' : String(tris);
        // Color FPS by health: 60+ green, 30-59 yellow, <30 red
        const color = lastFps >= 55 ? '#9efacc' : lastFps >= 30 ? '#fbe07a' : '#ff7676';
        el.style.color = color;
        const physLine = lastPhysMs > 0 ? `<br>phys ${lastPhysMs.toFixed(1)}ms peak` : '';
        el.innerHTML =
          `${lastFps} fps · ${lastAvgMs.toFixed(1)}ms<br>` +
          `peak ${lastMaxMs.toFixed(1)}ms<br>` +
          `${calls} calls · ${trisStr} tri` + physLine;
        acc = 0; frames = 0; maxMs = 0; physMsMax = 0;
      }
    },
  };
}
