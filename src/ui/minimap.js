import { CFG } from '../config.js';
import { injectTheme, TOKENS } from './theme.js';

// Top-down 2D minimap. Now with:
//   - card-style frame matching theme tokens
//   - compass rose with rotating N indicator (always points world-north)
//   - water + roads + signs + iconic landmarks colored by district
//   - bigger heading triangle for the player
export function createMinimap(car, signs, roadSegs = null) {
  injectTheme();
  const SIZE = 184;
  const wrap = document.createElement('div');
  wrap.className = 'sg-card sg-fade-in';
  Object.assign(wrap.style, {
    position: 'fixed', top: '14px', left: '14px', zIndex: '60',
    width: SIZE + 'px', height: SIZE + 'px',
    padding: '6px', borderRadius: '50%',
    pointerEvents: 'none',
  });
  const inner = SIZE - 12;
  const cnv = document.createElement('canvas');
  cnv.width = cnv.height = inner * devicePixelRatio;
  Object.assign(cnv.style, {
    width: inner + 'px', height: inner + 'px',
    borderRadius: '50%', display: 'block',
    background: 'radial-gradient(circle at 50% 35%, #0f1c30 0%, #050a14 100%)',
  });
  wrap.appendChild(cnv);

  // Compass markers — N E S W around the rim (CSS, doesn't redraw per frame)
  const dirs = [
    { d: 'N', top: '-4px',  left: '50%', tx: '-50%', col: TOKENS.red },
    { d: 'E', top: '50%',   left: 'calc(100% - 2px)', tx: '-100%', ty: '-50%', col: TOKENS.muted },
    { d: 'S', top: 'calc(100% - 14px)', left: '50%', tx: '-50%', col: TOKENS.muted },
    { d: 'W', top: '50%',   left: '2px', ty: '-50%', col: TOKENS.muted },
  ];
  for (const o of dirs) {
    const t = document.createElement('div');
    t.textContent = o.d;
    Object.assign(t.style, {
      position: 'absolute', top: o.top, left: o.left,
      transform: `translate(${o.tx || '0'}, ${o.ty || '0'})`,
      font: `700 10px ${TOKENS.font}`, letterSpacing: '.10em',
      color: o.col, textShadow: '0 1px 2px rgba(0,0,0,.7)',
      pointerEvents: 'none',
    });
    wrap.appendChild(t);
  }
  document.body.appendChild(wrap);

  const ctx = cnv.getContext('2d');
  ctx.scale(devicePixelRatio, devicePixelRatio);

  const half = inner / 2;
  const worldExtent = 320;
  const k = half / worldExtent;
  const w2m = (x, z) => [half + x * k, half + z * k];

  function tick() {
    ctx.clearRect(0, 0, inner, inner);

    // ground tint
    ctx.fillStyle = '#1a2a3e';
    ctx.beginPath(); ctx.arc(half, half, half, 0, Math.PI * 2); ctx.fill();

    // water
    if (CFG.water) {
      const [wx, wz] = CFG.water.center;
      const [mx, my] = w2m(wx, wz);
      const grad = ctx.createRadialGradient(mx, my, 0, mx, my, CFG.water.radius * k);
      grad.addColorStop(0, '#3a8aaa');
      grad.addColorStop(1, '#1a4660');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(mx, my, CFG.water.radius * k, 0, Math.PI * 2); ctx.fill();
    }

    // roads
    if (roadSegs) {
      ctx.strokeStyle = 'rgba(200,210,225,.55)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (let i = 0; i < roadSegs.length; i += 4) {
        const [m1x, m1y] = w2m(roadSegs[i], roadSegs[i + 1]);
        const [m2x, m2y] = w2m(roadSegs[i + 2], roadSegs[i + 3]);
        ctx.moveTo(m1x, m1y); ctx.lineTo(m2x, m2y);
      }
      ctx.stroke();
    }

    // signs / landmarks
    for (const s of signs) {
      const [mx, my] = w2m(s.position.x, s.position.z);
      const col = '#' + s.color.toString(16).padStart(6, '0');
      if (s.visited) {
        ctx.fillStyle = 'rgba(120,130,150,.7)';
        ctx.beginPath(); ctx.arc(mx, my, 3, 0, Math.PI * 2); ctx.fill();
      } else {
        // pulsing glow ring
        const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.004);
        ctx.fillStyle = col + Math.round(pulse * 80 + 50).toString(16).padStart(2, '0');
        ctx.beginPath(); ctx.arc(mx, my, 8 * pulse + 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(mx, my, 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
      }
    }

    // car (triangle)
    const cp = car.group.position;
    const [cx, cy] = w2m(cp.x, cp.z);
    const h = car.group.rotation.y;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-h);
    // outer ring (bright accent)
    ctx.fillStyle = TOKENS.red;
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(6.5, 6); ctx.lineTo(0, 3); ctx.lineTo(-6.5, 6); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();

    // inner ring border
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(half, half, half - 1, 0, Math.PI * 2); ctx.stroke();
  }
  return { tick };
}
