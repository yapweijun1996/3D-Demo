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
  const MAX_DRIFT = 14;
  const desired = new THREE.Vector3();
  const vel = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const fwd = new THREE.Vector3();                       // car world-forward (pulled fresh each frame)
  const baseFov = C.fov;
  const fovMax = baseFov + 12;

  camera.position.set(0, C.followHeight, C.followDistance + 5);
  camera.lookAt(0, 1, 0);

  function tick(dt) {
    const p = car.group.position;
    // Extract car's world-forward by transforming (0,0,1) through full quaternion.
    // This is correct even if car has body roll/pitch (Euler-Y extraction would be wrong).
    fwd.set(0, 0, 1).applyQuaternion(car.group.quaternion);
    const fx = fwd.x, fz = fwd.z;
    const fLen = Math.hypot(fx, fz) || 1;                // re-normalize XZ projection (drop Y component)
    const nfx = fx / fLen, nfz = fz / fLen;
    desired.set(p.x - nfx * C.followDistance, p.y + C.followHeight, p.z - nfz * C.followDistance);

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

    // Snap-to-behind guard with normalized forward.
    // dot(camToCar_along_forward) > -3 means camera not behind enough → snap.
    const cx = camera.position.x - p.x;
    const cz = camera.position.z - p.z;
    const dot = cx * nfx + cz * nfz;
    if (dot > -3) {                                      // require camera at least 3m behind (along forward axis)
      camera.position.x = p.x - nfx * C.followDistance;
      camera.position.z = p.z - nfz * C.followDistance;
      vel.x = 0; vel.z = 0;
    } else {
      dx = camera.position.x - desired.x;
      dz = camera.position.z - desired.z;
      const drift = Math.hypot(dx, dz);
      if (drift > MAX_DRIFT) {
        const k = MAX_DRIFT / drift;
        camera.position.x = desired.x + dx * k;
        camera.position.z = desired.z + dz * k;
        vel.x *= 0.5; vel.z *= 0.5;
      }
    }

    // look ahead of the car along its forward direction
    lookTarget.set(p.x + nfx * C.lookAhead, p.y + 1.0, p.z + nfz * C.lookAhead);
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
