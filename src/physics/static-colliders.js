import { colliders as legacyList } from '../colliders.js';
import { CFG } from '../config.js';

// Convert legacy collider list (cyl/box) into Rapier static colliders.
// Also adds: ground plane, water perimeter wall (so car can't drive into Marina Bay).
export function buildStaticColliders(RAPIER, world) {
  // Ground — thin huge cuboid centered just below y=0.
  const ground = RAPIER.ColliderDesc.cuboid(400, 0.05, 400)
    .setTranslation(0, -0.05, 0)
    .setFriction(1.0);
  world.createCollider(ground);

  for (const c of legacyList) {
    if (c.type === 'cyl') {
      const desc = RAPIER.ColliderDesc.cylinder(2.0, c.r)
        .setTranslation(c.x, 2.0, c.z)
        .setFriction(0.7);
      world.createCollider(desc);
    } else if (c.type === 'box') {
      const desc = RAPIER.ColliderDesc.cuboid(c.hw, 1.5, c.hd)
        .setTranslation(c.x, 0.75, c.z)
        .setFriction(0.7);
      world.createCollider(desc);
    }
  }

  // Water perimeter — invisible ring of cuboid colliders surrounding the water disk.
  // 24 segments approximating a circle. Acts like a kerb the car bumps against.
  if (CFG.water) {
    const [wx, wz] = CFG.water.center;
    const r = CFG.water.radius + 1.2;            // slight outset so visual sand still walkable
    const segs = 24;
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      const x0 = Math.cos(a0) * r, z0 = Math.sin(a0) * r;
      const x1 = Math.cos(a1) * r, z1 = Math.sin(a1) * r;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const dx = x1 - x0, dz = z1 - z0;
      const segLen = Math.sqrt(dx * dx + dz * dz);
      const angle = Math.atan2(dx, dz);
      const desc = RAPIER.ColliderDesc.cuboid(segLen / 2 + 0.1, 1.5, 0.4)
        .setTranslation(wx + cx, 0.75, wz + cz)
        .setRotation({ x: 0, y: angle, z: 0, w: 1 })
        .setFriction(0.5);
      // Rapier rotation needs quaternion — use axis-angle helper if needed; here simplified setRotation expects quat
      // For Y-axis rotation: q = (0, sin(a/2), 0, cos(a/2))
      const qy = Math.sin(angle / 2);
      const qw = Math.cos(angle / 2);
      desc.setRotation({ x: 0, y: qy, z: 0, w: qw });
      world.createCollider(desc);
    }
  }
}
