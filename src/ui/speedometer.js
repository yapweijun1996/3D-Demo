// Bottom-right speedometer + boost gauge.
// Apple HIG: minimal, deferred — small footprint, no chrome, no labels
// when not needed. Glows orange when boost is active.
//
// Usage:
//   const speedo = createSpeedometer();
//   speedo.tick(drive.state);   // each frame
//
// `state` shape: { speedKmh: number, boost: number 0..1, boosting: bool }

export function createSpeedometer() {
  const root = document.createElement('div');
  Object.assign(root.style, {
    position: 'fixed', right: '14px', bottom: '14px', zIndex: 50,
    width: '124px', padding: '12px 14px',
    background: 'rgba(8, 12, 20, 0.55)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    color: '#fff',
    font: '500 11px -apple-system,BlinkMacSystemFont,system-ui,sans-serif',
    pointerEvents: 'none',
    boxShadow: '0 10px 28px rgba(0,0,0,0.35)',
    transition: 'box-shadow .18s ease, border-color .18s ease',
  });

  const num = document.createElement('div');
  Object.assign(num.style, {
    font: '600 30px ui-monospace,SFMono-Regular,Menlo,monospace',
    letterSpacing: '-0.02em',
    lineHeight: '1',
    textAlign: 'right',
    color: '#fff',
    transition: 'color .15s ease',
  });
  num.textContent = '0';

  const unit = document.createElement('div');
  Object.assign(unit.style, {
    fontSize: '10px', opacity: '0.55', textAlign: 'right',
    marginTop: '2px', letterSpacing: '0.08em',
  });
  unit.textContent = 'KM/H';

  const gaugeWrap = document.createElement('div');
  Object.assign(gaugeWrap.style, {
    marginTop: '10px', height: '4px', background: 'rgba(255,255,255,0.10)',
    borderRadius: '999px', overflow: 'hidden',
  });
  const gaugeFill = document.createElement('div');
  Object.assign(gaugeFill.style, {
    height: '100%', width: '100%',
    background: 'linear-gradient(90deg, #5fb6ff, #9defff)',
    borderRadius: 'inherit',
    transition: 'width .08s linear, background .15s ease',
  });
  gaugeWrap.appendChild(gaugeFill);

  const hint = document.createElement('div');
  Object.assign(hint.style, {
    marginTop: '4px', fontSize: '10px', opacity: '0.45',
    textAlign: 'right', letterSpacing: '0.04em',
  });
  hint.textContent = 'SHIFT · BOOST';

  root.appendChild(num);
  root.appendChild(unit);
  root.appendChild(gaugeWrap);
  root.appendChild(hint);
  document.body.appendChild(root);

  let lastBoosting = false;
  return {
    tick(state) {
      if (!state) return;
      const kmh = Math.max(0, state.speedKmh | 0);
      num.textContent = String(kmh);

      const pct = Math.max(0, Math.min(1, state.boost)) * 100;
      gaugeFill.style.width = pct.toFixed(1) + '%';

      if (state.boosting !== lastBoosting) {
        lastBoosting = state.boosting;
        if (state.boosting) {
          root.style.borderColor = 'rgba(255, 184, 92, 0.55)';
          root.style.boxShadow = '0 0 28px rgba(255,184,92,0.45), 0 10px 28px rgba(0,0,0,0.35)';
          num.style.color = '#ffb85c';
          gaugeFill.style.background = 'linear-gradient(90deg, #ffb85c, #ffe4b0)';
        } else {
          root.style.borderColor = 'rgba(255,255,255,0.08)';
          root.style.boxShadow = '0 10px 28px rgba(0,0,0,0.35)';
          num.style.color = '#fff';
          gaugeFill.style.background = 'linear-gradient(90deg, #5fb6ff, #9defff)';
        }
      }
    },
  };
}
