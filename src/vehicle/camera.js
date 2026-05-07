import * as THREE from 'three';
import { CFG } from '../config.js';

// Third-person follow camera with critical-damped spring (no jelly bounce).
// Pitch locked horizontal so car body roll doesn't make camera see-saw.
// Dynamic FOV expands at high speed for sense-of-speed.
export function createFollowCam(camera, car, getSpeed) {
  const C = CFG.camera;
  // Stiff critical-damped spring (k=30 → fast follow, no overshoot, no lag at speed)
  const stiffness = 30;
  const damping = 2 * Math.sqrt(stiffness);
  const MAX_DRIFT = 14;                                  // hard tether: never let camera fall further than this from desired
  const desired = new THREE.Vector3();
  const vel = new THREE.Vector3();                       // camera velocity for spring
  const lookTarget = new THREE.Vector3();
  const baseFov = C.fov;
  const fovMax = baseFov + 12;                            // +12° at top speed

  // initial snap
  camera.position.set(0, C.followHeight, C.followDistance + 5);
  camera.lookAt(0, 1, 0);

  function tick(dt) {
    const p = car.group.position;
    const h = car.group.rotation.y;                      // yaw only — ignore pitch/roll on purpose
    const fx = Math.sin(h), fz = Math.cos(h);
    desired.set(p.x - fx * C.followDistance, p.y + C.followHeight, p.z - fz * C.followDistance);

    // critical-damped spring — frame-rate independent, no bounce
    let dx = camera.position.x - desired.x;
    let dy = camera.position.y - desired.y;
    let dz = camera.position.z - desired.z;
    vel.x += (-stiffness * dx - damping * vel.x) * dt;
    vel.y += (-stiffness * dy - damping * vel.y) * dt;
    vel.z += (-stiffness * dz - damping * vel.z) * dt;
    camera.position.x += vel.x * dt;
    camera.position.y += vel.y * dt;
    camera.position.z += vel.z * dt;

    // Hard tether: if camera ever drifts > MAX_DRIFT from desired, snap inward.
    // Prevents the spring from leaving the car behind on hard accel / phys spike.
    dx = camera.position.x - desired.x;
    dz = camera.position.z - desired.z;
    const drift = Math.hypot(dx, dz);
    if (drift > MAX_DRIFT) {
      const k = MAX_DRIFT / drift;
      camera.position.x = desired.x + dx * k;
      camera.position.z = desired.z + dz * k;
      vel.x *= 0.5; vel.z *= 0.5;                        // bleed velocity to settle
    }

    // look ahead of the car along its forward direction
    lookTarget.set(p.x + fx * C.lookAhead, p.y + 1.0, p.z + fz * C.lookAhead);
    camera.lookAt(lookTarget);

    // dynamic FOV based on speed — sense-of-speed without doing anything physical
    if (getSpeed) {
      const speed = Math.abs(getSpeed());
      const sr = Math.min(1, speed / 28);
      const targetFov = baseFov + (fovMax - baseFov) * sr;
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4);
      camera.updateProjectionMatrix();
    }
  }
  return tick;
}
