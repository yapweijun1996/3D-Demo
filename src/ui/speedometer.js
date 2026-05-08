import { injectTheme, TOKENS } from './theme.js';

// Driving game speedometer — 180° SVG arc gauge with animated needle,
// large digital readout, and segmented boost meter. Glows gold on boost.
//
// Usage:
//   const speedo = createSpeedometer();
//   speedo.tick(drive.state);   // each frame
// state shape: { speedKmh: number, boost: number 0..1, boosting: bool, gear?: 'D'|'R'|'N' }

const MAX_KMH = 180;     // gauge ceiling — needle pegs above this
const ARC_DEG = 200;     // total arc sweep (-100° → +100° from straight up)

export function createSpeedometer() {
  injectTheme();
  const root = document.createElement('div');
  root.className = 'sg-card sg-fade-in';
  Object.assign(root.style, {
    position: 'fixed', right: '18px', bottom: '18px', zIndex: '50',
    width: '218px', padding: '14px 16px 12px',
    pointerEvents: 'none',
    transition: 'box-shadow .25s ease, border-color .25s ease, transform .25s ease',
  });

  // ---- arc gauge (SVG) ----
  const W = 186, H = 104, CX = W / 2, CY = 92, R = 78;
  const startA = (-ARC_DEG / 2) - 90;     // left tip in svg degrees
  const endA   =  (ARC_DEG / 2) - 90;
  const arcPath = (a0, a1) => {
    const p0 = polar(CX, CY, R, a0);
    const p1 = polar(CX, CY, R, a1);
    const large = (a1 - a0) > 180 ? 1 : 0;
    return `M ${p0.x} ${p0.y} A ${R} ${R} 0 ${large} 1 ${p1.x} ${p1.y}`;
  };
  const tickMarks = [];
  for (let i = 0; i <= 10; i++) {
    const a = startA + (endA - startA) * (i / 10);
    const inner = polar(CX, CY, R - (i % 5 === 0 ? 11 : 6), a);
    const outer = polar(CX, CY, R, a);
    tickMarks.push(
      `<line x1="${inner.x}" y1="${inner.y}" x2="${outer.x}" y2="${outer.y}" stroke="${i % 5 === 0 ? '#fff' : 'rgba(255,255,255,.35)'}" stroke-width="${i % 5 === 0 ? 1.6 : 1}" stroke-linecap="round"/>`
    );
  }
  // Numeric labels at 0, 60, 120, 180
  const labels = [0, 60, 120, 180].map(v => {
    const a = startA + (endA - startA) * (v / MAX_KMH);
    const p = polar(CX, CY, R - 22, a);
    return `<text x="${p.x}" y="${p.y + 3}" fill="rgba(255,255,255,.65)" font-size="8" font-family="${TOKENS.mono}" font-weight="600" text-anchor="middle">${v}</text>`;
  }).join('');
  root.innerHTML = `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;margin:0 auto -6px;overflow:visible">
      <defs>
        <linearGradient id="sg-arc-bg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="rgba(255,255,255,.10)"/>
          <stop offset="1" stop-color="rgba(255,255,255,.10)"/>
        </linearGradient>
        <linearGradient id="sg-arc-fill" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="${TOKENS.teal}"/>
          <stop offset="0.55" stop-color="${TOKENS.gold}"/>
          <stop offset="1" stop-color="${TOKENS.red}"/>
        </linearGradient>
      </defs>
      <path d="${arcPath(startA, endA)}" stroke="url(#sg-arc-bg)" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path id="sg-arc-progress" d="${arcPath(startA, startA + 0.001)}" stroke="url(#sg-arc-fill)" stroke-width="6" fill="none" stroke-linecap="round" style="filter:drop-shadow(0 0 6px rgba(245,179,68,.45))"/>
      ${tickMarks.join('')}
      ${labels}
      <circle cx="${CX}" cy="${CY}" r="6" fill="${TOKENS.text}" stroke="rgba(0,0,0,.6)" stroke-width="1.5"/>
      <line id="sg-needle" x1="${CX}" y1="${CY}" x2="${CX}" y2="${CY - R + 8}" stroke="${TOKENS.red}" stroke-width="2.5" stroke-linecap="round" style="transform-origin:${CX}px ${CY}px;transition:transform .12s cubic-bezier(.22,1,.36,1);filter:drop-shadow(0 0 4px rgba(237,41,57,.7))" transform="rotate(-100)"/>
    </svg>
    <div style="display:flex;align-items:baseline;justify-content:space-between;margin-top:2px">
      <div id="sg-gear" style="font:700 14px var(--sg-mono);letter-spacing:.04em;color:${TOKENS.gold};opacity:.85">D</div>
      <div style="display:flex;align-items:baseline;gap:4px">
        <div id="sg-speed-num" style="font:700 32px var(--sg-mono);letter-spacing:-.02em;line-height:1;color:${TOKENS.text}">0</div>
        <div style="font:600 9px var(--sg-font);letter-spacing:.14em;opacity:.55;color:${TOKENS.text}">KM/H</div>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;margin-top:10px">
      <div style="font:600 9px var(--sg-font);letter-spacing:.14em;opacity:.55;color:${TOKENS.text}">BOOST</div>
      <div id="sg-boost-track" style="flex:1;display:flex;gap:3px">
        ${Array.from({ length: 10 }, (_, i) =>
          `<div data-i="${i}" style="flex:1;height:6px;background:rgba(255,255,255,.08);border-radius:2px;transition:background .12s"></div>`
        ).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(root);

  const arcProg = root.querySelector('#sg-arc-progress');
  const needle  = root.querySelector('#sg-needle');
  const numEl   = root.querySelector('#sg-speed-num');
  const gearEl  = root.querySelector('#sg-gear');
  const boostSegs = root.querySelectorAll('#sg-boost-track div');

  let lastBoosting = false;
  return {
    tick(state) {
      if (!state) return;
      const kmh = Math.max(0, state.speedKmh | 0);
      numEl.textContent = String(kmh);

      const t = Math.min(1, kmh / MAX_KMH);
      const angDeg = -100 + ARC_DEG * t;
      needle.setAttribute('transform', `rotate(${angDeg.toFixed(2)} ${CX} ${CY})`);
      // arc fill grows with speed
      arcProg.setAttribute('d', arcPath(startA, startA + (endA - startA) * t));

      const bf = Math.max(0, Math.min(1, state.boost ?? 0));
      const litCount = Math.round(bf * 10);
      for (let i = 0; i < boostSegs.length; i++) {
        boostSegs[i].style.background = i < litCount
          ? (state.boosting ? 'linear-gradient(180deg,#ffe4b0,#F5B344)' : TOKENS.gold)
          : 'rgba(255,255,255,.08)';
      }

      if (state.gear) gearEl.textContent = state.gear;

      if (state.boosting !== lastBoosting) {
        lastBoosting = state.boosting;
        if (state.boosting) {
          root.style.borderColor = 'rgba(245,179,68,.55)';
          root.style.boxShadow = '0 0 32px rgba(245,179,68,.45), ' + TOKENS.shadow;
          root.style.transform = 'scale(1.02)';
          numEl.style.color = TOKENS.gold;
        } else {
          root.style.borderColor = 'var(--sg-border)';
          root.style.boxShadow = TOKENS.shadow;
          root.style.transform = 'scale(1)';
          numEl.style.color = TOKENS.text;
        }
      }
    },
  };
}

function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
}
