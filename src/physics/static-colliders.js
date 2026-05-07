import { colliders as legacyList } from '../colliders.js';

// Convert legacy collider list (cyl/box) into Rapier static colliders.
// Also adds a giant ground plane so the car has something to drive on.
export function buildStaticColliders(RAPIER, world) {
  // Ground — thin huge cuboid centered just below y=0.
  const ground = RAPIER.ColliderDesc.cuboid(400, 0.05, 400)
    .setTranslation(0, -0.05, 0)
    .setFriction(1.0);
  world.createCollider(ground);

  for (const c of legacyList) {
    if (c.type === 'cyl') {
      // Rapier cylinder: half-height + radius, axis along Y.
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
}
