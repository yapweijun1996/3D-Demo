// Rapier WASM bootstrap. Returns { RAPIER, world } once init resolves.
// We import the "compat" build (single-thread WASM, easier to load via esm.sh).
import RAPIER from 'https://esm.sh/@dimforge/rapier3d-compat@0.14.0';
import { CFG } from '../config.js';

let _state = null;

export async function initPhysics() {
  if (_state) return _state;
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: CFG.physics.gravity, z: 0 });
  world.timestep = 1 / 60;
  _state = { RAPIER, world };
  return _state;
}

// Step the world. Call once per frame AFTER vehicle.updateVehicle(dt).
export function stepPhysics() {
  if (_state) _state.world.step();
}
