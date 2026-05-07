import * as THREE from 'three';
import { CFG } from '../config.js';
import { keys } from '../input.js';
import { resolve } from '../colliders.js';

// Simple arcade kinematic drive — no physics engine.
// State: heading angle (radians, 0 = +Z), speed (m/s, signed).
// Each frame: apply throttle/brake/steering, integrate, resolve collision, sync to mesh.
export function createDrive(car) {
  const C = CFG.car;
  let heading = 0;       // car group rotates around Y by this
  let speed   = 0;       // signed scalar along forward
  let steerAngle = 0;    // for front wheels visual + actual turning

  const tmp = new THREE.Vector3();

  function tick(dt) {
    // ---- input → throttle, brake, steer ----
    let throttle = 0;
    if (keys.up)   throttle += 1;
    if (keys.down) throttle -= 1;
    let steer = 0;
    if (keys.left)  steer += 1;
    if (keys.right) steer -= 1;

    // ---- speed update ----
    if (throttle > 0) {
      speed += C.accel * dt;
    } else if (throttle < 0) {
      // brake if moving forward, else accelerate in reverse
      if (speed > 0.5) speed -= C.brake * dt;
      else             speed -= C.reverseAccel * dt;
    } else {
      // rolling friction toward 0
      const sign = Math.sign(speed);
      const rf = C.rollingFriction * dt;
      if (Math.abs(speed) <= rf) speed = 0;
      else                       speed -= sign * rf;
    }
    // air drag
    speed *= Math.pow(C.drag, dt * 60);
    // clamp
    speed = Math.max(C.maxReverse, Math.min(C.maxSpeed, speed));

    // ---- steering ----
    // turn rate scales DOWN as speed grows (arcade feel — cars turn tighter when slow)
    const speedRatio = Math.min(1, Math.abs(speed) / C.maxSpeed);
    const dynamicTurn = C.turnRate * (1 - (1 - C.turnFalloff) * speedRatio);
    const targetSteer = steer * 0.5;             // visual lock for front wheels
    steerAngle += (targetSteer - steerAngle) * Math.min(1, dt * 8);
    // only turn the chassis when actually moving (so steering at standstill doesn't pivot)
    heading += dynamicTurn * steer * (speed >= 0 ? 1 : -1) * (Math.abs(speed) > 0.2 ? 1 : 0) * dt;

    // ---- integrate position ----
    const fx = Math.sin(heading), fz = Math.cos(heading);
    const p = car.group.position;
    p.x += fx * speed * dt;
    p.z += fz * speed * dt;
    car.group.rotation.y = heading;

    // ---- resolve collisions (treat car as 1.1m radius cylinder) ----
    resolve(p, 1.1);

    // ---- world bounds ----
    const lim = CFG.world.bounds;
    if (Math.abs(p.x) > lim) { p.x = Math.sign(p.x) * lim; speed *= 0.4; }
    if (Math.abs(p.z) > lim) { p.z = Math.sign(p.z) * lim; speed *= 0.4; }

    // ---- spin wheels + steer front wheels ----
    const wheelCircumference = 2 * Math.PI * 0.4;
    const spin = (speed * dt) / wheelCircumference * (Math.PI * 2);
    for (const w of car.wheels) {
      // tire is the inner mesh; spin around its local Z (since geo was rotated)
      w.tire.rotation.x -= spin;
      // front wheels show steering angle on Y of the wheel group
      if (w.isFront) w.group.rotation.y = steerAngle;
    }
  }

  function getState() { return { heading, speed }; }
  return { tick, getState };
}
