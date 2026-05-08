// SSOT for OSM road tier visuals. Width is WORLD units (1 unit ≈ 22m given
// the current OSM bbox scale). Y is the stack height — different tiers sit
// at different Y so motorway renders ON TOP of secondary at intersections
// without z-fight. Anyone placing geometry that follows roads (sidewalks,
// stripes, traffic, parked cars, awnings…) reads from this single table so
// the values can never drift between subsystems.

export const TIERS = Object.freeze([
  { t: 'motorway',  w: 5.0, color: 0x222226, y: 0.20 },
  { t: 'trunk',     w: 4.0, color: 0x282830, y: 0.16 },
  { t: 'primary',   w: 3.0, color: 0x2e2e36, y: 0.12 },
  { t: 'secondary', w: 2.2, color: 0x34343a, y: 0.08 },
  { t: 'tertiary',  w: 1.5, color: 0x3a3a40, y: 0.04 },
]);

// Lookup map t→y. Defaults to primary if an unknown tag slips through.
export const TIER_Y = Object.freeze(
  TIERS.reduce((acc, t) => (acc[t.t] = t.y, acc), {})
);
export const TIER_W = Object.freeze(
  TIERS.reduce((acc, t) => (acc[t.t] = t.w, acc), {})
);
export const surfaceY = (tier) => TIER_Y[tier] ?? TIER_Y.primary;
