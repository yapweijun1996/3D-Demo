import * as THREE from 'three';
import { CFG } from '../config.js';

// Third-person follow camera with critical-damped spring (no jelly bounce).
// Pitch locked horizontal so car body roll doesn't make camera see-saw.
// Dynamic FOV expands at high speed for sense-of-speed.
export function createFollowCam(camera, car, getSpeed) {
  const C = CFG.camera;
  const stiffness = 8;                                   // critical damped: damping = 2*sqrt(k)
  const damping = 2 * Math.sqrt(stiffness);
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
    // F = -k*(pos - target) - damping*vel ; pos += vel * dt ; vel += F * dt
    const dx = camera.position.x - desired.x;
    const dy = camera.position.y - desired.y;
    const dz = camera.position.z - desired.z;
    vel.x += (-stiffness * dx - damping * vel.x) * dt;
    vel.y += (-stiffness * dy - damping * vel.y) * dt;
    vel.z += (-stiffness * dz - damping * vel.z) * dt;
    camera.position.x += vel.x * dt;
    camera.position.y += vel.y * dt;
    camera.position.z += vel.z * dt;

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
