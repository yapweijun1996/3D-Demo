import * as THREE from 'three';

// Twin emissive flame planes attached to car rear. Opacity lerps with
// boost.boosting; scale flickers for fire-feel. Additive blend so they
// glow under bloom postfx.
//
// Apple HIG: instant feedback — when player presses Shift, fire ignites
// the same frame. No fade-in delay.
export function createExhaust(car) {
  const geo = new THREE.PlaneGeometry(0.55, 1.4);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffae44,
    transparent: true, opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });

  // Two planes — left + right rear of car. Car group local space:
  // Kenney sedan @ scale 1.8 → ~2.6w × 4.6l, rear is -Z, sides ±X.
  const left = new THREE.Mesh(geo, mat);
  left.position.set(-0.55, 0.55, -2.45);
  const right = new THREE.Mesh(geo, mat);
  right.position.set(0.55, 0.55, -2.45);

  car.group.add(left);
  car.group.add(right);

  return {
    tick(state) {
      if (!state) return;
      const target = state.boosting ? 0.95 : 0.0;
      // Single-pole lerp ~ 35% per frame for snappy ignite/extinguish
      mat.opacity += (target - mat.opacity) * 0.35;

      if (state.boosting) {
        const fx = 0.85 + Math.random() * 0.3;
        const fy = 1.0 + Math.random() * 0.5;
        left.scale.set(fx, fy, 1);
        right.scale.set(fx, fy, 1);
      }
    },
  };
}
