import { CFG } from '../config.js';

// Top-down 2D canvas overlay. Shows playable area, signs, water, car position+heading.
// Updated every frame from main.js.
export function createMinimap(car, signs) {
  const SIZE = 180;
  const cnv = document.createElement('canvas');
  cnv.width = cnv.height = SIZE * devicePixelRatio;
  Object.assign(cnv.style, {
    position: 'fixed', top: '8px', left: '8px', zIndex: 60,
    width: SIZE + 'px', height: SIZE + 'px',
    borderRadius: '50%',
    boxShadow: '0 4px 14px rgba(0,0,0,0.45), inset 0 0 0 2px rgba(255,255,255,0.15)',
    pointerEvents: 'none',
  });
  document.body.appendChild(cnv);
  const ctx = cnv.getContext('2d');
  ctx.scale(devicePixelRatio, devicePixelRatio);

  const half = SIZE / 2;
  const worldExtent = 320;                      // world units mapped to half radius
  const k = half / worldExtent;
  const w2m = (x, z) => [half + x * k, half + z * k];

  function tick() {
    ctx.clearRect(0, 0, SIZE, SIZE);
    // background
    ctx.fillStyle = '#1c2632';
    ctx.beginPath(); ctx.arc(half, half, half, 0, Math.PI * 2); ctx.fill();

    // water disk
    if (CFG.water) {
      const [wx, wz] = CFG.water.center;
      const [mx, my] = w2m(wx, wz);
      ctx.fillStyle = '#2a6a8a';
      ctx.beginPath(); ctx.arc(mx, my, CFG.water.radius * k, 0, Math.PI * 2); ctx.fill();
    }

    // road cross
    ctx.strokeStyle = '#4a4a52';
    ctx.lineWidth = 12 * k;
    ctx.beginPath(); ctx.moveTo(half, 0); ctx.lineTo(half, SIZE); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, half); ctx.lineTo(SIZE, half); ctx.stroke();

    // signs — visited = dimmed grey, unvisited = bright color
    for (const s of signs) {
      const [mx, my] = w2m(s.position.x, s.position.z);
      ctx.fillStyle = s.visited ? '#5a5e6a' : '#' + s.color.toString(16).padStart(6, '0');
      ctx.beginPath(); ctx.arc(mx, my, s.visited ? 3 : 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1; ctx.stroke();
    }

    // car (triangle pointing along heading)
    const cp = car.group.position;
    const [cx, cy] = w2m(cp.x, cp.z);
    const h = car.group.rotation.y;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-h);                              // canvas y = world z, sign of rotation matches
    ctx.fillStyle = '#ff5050';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(-5, 5); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();

    // border ring
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(half, half, half - 1, 0, Math.PI * 2); ctx.stroke();
  }
  return { tick };
}
