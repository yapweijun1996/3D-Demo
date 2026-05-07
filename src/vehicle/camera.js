import * as THREE from 'three';
import { CFG } from '../config.js';

// Third-person follow camera that smoothly trails the car from behind.
// Returns a tick(dt) function used by main's frame loop.
export function createFollowCam(camera, car) {
  const C = CFG.camera;
  const desired = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();

  // initial snap so first frame doesn't fly in from origin
  camera.position.set(0, C.followHeight, C.followDistance + 5);
  camera.lookAt(0, 1, 0);

  function tick(dt) {
    const p = car.group.position;
    const h = car.group.rotation.y;
    const fx = Math.sin(h), fz = Math.cos(h);
    // camera sits BEHIND the car along its -forward direction
    desired.set(p.x - fx * C.followDistance, p.y + C.followHeight, p.z - fz * C.followDistance);
    // lerp position with frame-rate-independent factor
    const a = 1 - Math.pow(1 - C.smoothing, dt * 60);
    camera.position.lerp(desired, a);
    // look at a point slightly AHEAD of the car for a more dynamic feel
    lookTarget.set(p.x + fx * C.lookAhead, p.y + 1.0, p.z + fz * C.lookAhead);
    camera.lookAt(lookTarget);
  }
  return tick;
}
