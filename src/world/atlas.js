// Atlas — re-exports every cross-cutting world data table from a single
// import path. Purpose: future cross-subsystem code (planners, debug
// inspectors, save-state serializers) gets one stable surface instead of
// hunting through 6 modules. The actual SSOTs live where they belong; this
// file is *only* a re-export hub.
//
// Usage: import { TIERS, PALETTE, GLOW_TABLE, ... } from './atlas.js';

export { PALETTE } from '../config.js';
export { TIERS, TIER_Y, TIER_W, surfaceY } from './road-tiers.js';
export { DISTRICTS, TYPOLOGY, districtAt, districtAtWorld, getDistrict } from './districts.js';
export { LANDMARK_FOOTPRINTS } from './landmarks-sg.js';
export { GLOW_TABLE, applyLandmarkGlow } from './landmarks-glow.js';
