import { CFG } from '../config.js';

// Build the chassis rigid body + DynamicRayCastVehicleController + 4 wheels.
// Returns { body, vehicle } — drive.js consumes both.
export function buildCarVehicle(RAPIER, world, spawn) {
  const P = CFG.physics;
  const [hx, hy, hz] = P.chassis.halfExtents;

  // Chassis dynamic body. Spawn slightly above ground so wheels settle.
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(spawn[0], spawn[1] + P.chassis.visualOffsetY + 0.3, spawn[2])
    .setLinearDamping(P.chassis.linearDamping)
    .setAngularDamping(P.chassis.angularDamping)
    .setCcdEnabled(true);                     // continuous collision (no tunneling at speed)
  const body = world.createRigidBody(bodyDesc);

  const chassisDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
    .setMass(P.chassis.mass)
    .setFriction(0.4);
  world.createCollider(chassisDesc, body);

  // Vehicle controller — wraps the chassis body; we register 4 wheels below.
  const vehicle = world.createVehicleController(body);

  const downAxis = { x: 0, y: -1, z: 0 };
  const axleAxis = { x: -1, y: 0, z: 0 };

  for (const [x, y, z] of P.wheel.anchors) {
    vehicle.addWheel({ x, y, z }, downAxis, axleAxis, P.wheel.suspensionRest, P.wheel.radius);
  }
  for (let i = 0; i < 4; i++) {
    vehicle.setWheelSuspensionStiffness(i, P.wheel.suspensionStiffness);
    vehicle.setWheelMaxSuspensionTravel(i, P.wheel.suspensionMaxTravel);
    vehicle.setWheelFrictionSlip(i, P.wheel.frictionSlip);
    vehicle.setWheelSideFrictionStiffness(i, P.wheel.sideFrictionStiffness);
  }

  return { body, vehicle };
}
