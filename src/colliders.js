import { CFG } from './config.js';

// Flat shared registry of static world colliders for the car.
// Car has its own radius; we treat it like a moving cylinder for collision.
//   { type:'cyl', x, z, r }
//   { type:'box', x, z, hw, hd }
export const colliders = [];
export function addCyl(x, z, r) { colliders.push({ type: 'cyl', x, z, r }); }
export function addBox(x, z, hw, hd) { colliders.push({ type: 'box', x, z, hw, hd }); }

// Mutate position vector so it doesn't overlap any collider.
// `radius` = the moving body's radius (car has different radius than player).
export function resolve(p, radius) {
  for (const c of colliders) {
    if (c.type === 'cyl') {
      const dx = p.x - c.x, dz = p.z - c.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      const minD = c.r + radius;
      if (d < minD && d > 1e-4) {
        const push = (minD - d);
        p.x += (dx / d) * push;
        p.z += (dz / d) * push;
      }
    } else if (c.type === 'box') {
      const dx = p.x - c.x, dz = p.z - c.z;
      if (Math.abs(dx) < c.hw + radius && Math.abs(dz) < c.hd + radius) {
        const ox = (c.hw + radius) - Math.abs(dx);
        const oz = (c.hd + radius) - Math.abs(dz);
        if (ox < oz) p.x += Math.sign(dx || 1) * ox;
        else         p.z += Math.sign(dz || 1) * oz;
      }
    }
  }
}
