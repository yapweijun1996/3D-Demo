import * as THREE from 'three';
import { CFG } from '../config.js';
import { keys } from '../input.js';
import { resolve } from '../colliders.js';

// drive.js — input → vehicle motion.
// Returns { tick(dt), sync() } when physics path; sync() must be called AFTER
// world.step() so the visual reads post-integration body state (otherwise
// camera sees a 1-frame-stale car pose).
// Kinematic fallback returns sync as a no-op (everything happens in tick).

export function createDrive(carVisual, ctx) {
  if (CFG.physics.enabled && ctx?.carPhys) {
    return createPhysicsDrive(carVisual, ctx);
  }
  return createKinematicDrive(carVisual);
}

// ---------- Physics drive (Rapier) ----------
function createPhysicsDrive(carVisual, { carPhys }) {
  const D = CFG.physics.drive;
  const B = CFG.boost;
  const { vehicle, body } = carPhys;
  let steerCurrent = 0;
  let boostGauge = 1.0;          // 0..1 fuel remaining
  let refillCooldown = 0;        // seconds before refill can start
  const state = { speedKmh: 0, boost: 1.0, boosting: false };

  function tick(dt) {
    let throttle = 0;
    if (keys.up)   throttle += 1;
    if (keys.down) throttle -= 1;
    let steerInput = 0;
    if (keys.left)  steerInput += 1;
    if (keys.right) steerInput -= 1;

    // Boost gauge management — drain while held + throttling forward, refill otherwise
    const wantBoost = keys.boost && boostGauge > 0 && throttle > 0;
    if (wantBoost) {
      boostGauge = Math.max(0, boostGauge - dt / B.burnSeconds);
      refillCooldown = B.rechargeDelay;
    } else {
      if (refillCooldown > 0) refillCooldown = Math.max(0, refillCooldown - dt);
      else boostGauge = Math.min(1, boostGauge + dt * B.refillRate);
    }
    const boostMul = wantBoost ? B.multiplier : 1.0;

    // Smooth steering toward target
    const steerTarget = steerInput * D.maxSteer;
    const k = Math.min(1, dt * D.steerSpeed);
    steerCurrent += (steerTarget - steerCurrent) * k;

    // Engine + brake on rear wheels (RR=2, RL=3)
    const fwd = throttle > 0 ? 1 : (throttle < 0 ? -D.reverseFactor : 0);
    const force = fwd * D.engineForce * boostMul;
    let brake = 0;
    if (throttle === 0) brake = D.rollingBrake;
    // emergency brake when reversing intent against forward velocity
    const v = body.linvel();
    const speedAlongFwd = projectForwardSpeed(body, v);
    if (throttle < 0 && speedAlongFwd > 1) brake = D.brakeForce;

    vehicle.setWheelEngineForce(2, force);
    vehicle.setWheelEngineForce(3, force);
    vehicle.setWheelBrake(2, brake);
    vehicle.setWheelBrake(3, brake);

    // Steering on front wheels (FR=0, FL=1)
    vehicle.setWheelSteering(0, steerCurrent);
    vehicle.setWheelSteering(1, steerCurrent);

    // Update vehicle (applies suspension forces to chassis)
    vehicle.updateVehicle(dt);

    // Publish state for HUD (speed in km/h: linvel m/s × 3.6)
    state.speedKmh = Math.sqrt(v.x * v.x + v.z * v.z) * 3.6;
    state.boost = boostGauge;
    state.boosting = wantBoost;
    // sync() runs in main.js AFTER world.step() so visual reads post-step body pose
  }
  return { tick, sync: () => syncVisual(carVisual, carPhys), state };
}

const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
function projectForwardSpeed(body, linvel) {
  // forward direction in world = (0,0,1) rotated by body quaternion
  const r = body.rotation();
  _q.set(r.x, r.y, r.z, r.w);
  _v.set(0, 0, 1).applyQuaternion(_q);
  return linvel.x * _v.x + linvel.y * _v.y + linvel.z * _v.z;
}

function syncVisual(carVisual, carPhys) {
  const { body, vehicle } = carPhys;
  const t = body.translation();
  const r = body.rotation();
  carVisual.group.position.set(t.x, t.y - CFG.physics.chassis.visualOffsetY, t.z);
  carVisual.group.quaternion.set(r.x, r.y, r.z, r.w);

  // Sync visible wheels (skipped if car has none — e.g. GLB car with baked wheels)
  for (let i = 0; i < carVisual.wheels.length; i++) {
    const w = carVisual.wheels[i];
    if (!w?.group) continue;
    const wcp = vehicle.wheelChassisConnectionPointCs(i);
    const susp = vehicle.wheelSuspensionLength(i);
    w.group.position.set(wcp.x, wcp.y - susp + CFG.physics.chassis.visualOffsetY, wcp.z);
    const steerY = vehicle.wheelSteering(i);
    const rot = vehicle.wheelRotation(i);
    w.group.rotation.set(0, steerY, 0);
    w.tire.rotation.x = -rot;
  }
}

// ---------- Kinematic drive (v0.2 fallback, no physics) ----------
function createKinematicDrive(car) {
  const C = CFG.car;
  const B = CFG.boost;
  let heading = 0, speed = 0, steerAngle = 0;
  let boostGauge = 1.0, refillCooldown = 0;
  const state = { speedKmh: 0, boost: 1.0, boosting: false };

  function tick(dt) {
    let throttle = 0;
    if (keys.up)   throttle += 1;
    if (keys.down) throttle -= 1;
    let steer = 0;
    if (keys.left)  steer += 1;
    if (keys.right) steer -= 1;

    const wantBoost = keys.boost && boostGauge > 0 && throttle > 0;
    if (wantBoost) {
      boostGauge = Math.max(0, boostGauge - dt / B.burnSeconds);
      refillCooldown = B.rechargeDelay;
    } else {
      if (refillCooldown > 0) refillCooldown = Math.max(0, refillCooldown - dt);
      else boostGauge = Math.min(1, boostGauge + dt * B.refillRate);
    }
    const boostMul = wantBoost ? B.multiplier : 1.0;

    if (throttle > 0) speed += C.accel * boostMul * dt;
    else if (throttle < 0) {
      if (speed > 0.5) speed -= C.brake * dt;
      else             speed -= C.reverseAccel * dt;
    } else {
      const sign = Math.sign(speed);
      const rf = C.rollingFriction * dt;
      if (Math.abs(speed) <= rf) speed = 0;
      else                       speed -= sign * rf;
    }
    speed *= Math.pow(C.drag, dt * 60);
    const topSpeed = C.maxSpeed * (wantBoost ? B.maxSpeedMul : 1.0);
    speed = Math.max(C.maxReverse, Math.min(topSpeed, speed));

    const speedRatio = Math.min(1, Math.abs(speed) / C.maxSpeed);
    const dynamicTurn = C.turnRate * (1 - (1 - C.turnFalloff) * speedRatio);
    const targetSteer = steer * 0.5;
    steerAngle += (targetSteer - steerAngle) * Math.min(1, dt * 8);
    heading += dynamicTurn * steer * (speed >= 0 ? 1 : -1) * (Math.abs(speed) > 0.2 ? 1 : 0) * dt;

    const fx = Math.sin(heading), fz = Math.cos(heading);
    const p = car.group.position;
    p.x += fx * speed * dt;
    p.z += fz * speed * dt;
    car.group.rotation.y = heading;
    resolve(p, 1.1);

    const lim = CFG.world.bounds;
    if (Math.abs(p.x) > lim) { p.x = Math.sign(p.x) * lim; speed *= 0.4; }
    if (Math.abs(p.z) > lim) { p.z = Math.sign(p.z) * lim; speed *= 0.4; }

    const wheelCircumference = 2 * Math.PI * 0.4;
    const spin = (speed * dt) / wheelCircumference * (Math.PI * 2);
    for (const w of car.wheels) {
      w.tire.rotation.x -= spin;
      if (w.isFront) w.group.rotation.y = steerAngle;
    }

    state.speedKmh = Math.abs(speed) * 3.6;
    state.boost = boostGauge;
    state.boosting = wantBoost;
  }
  return { tick, sync: () => {}, state };
}
