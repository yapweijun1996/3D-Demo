// Placement diagnostics — single helper for "how many things did this
// builder actually place?" counters. Exists because eyeballs lie about 3D
// scene density (viewport zoom, occlusion, perspective compression all
// distort perceived counts). When in doubt, log first, judge second.
//
// Usage:
//   import { logPlacement } from './diag.js';
//   logPlacement('shophouse', 'chinatown', { ways: 96, samples: 75, placed: 16, kFiltered: 56 });

const ENABLED = true;     // flip false to silence all builder counts

export function logPlacement(builder, scope, counts) {
  if (!ENABLED) return;
  const parts = [];
  for (const k of Object.keys(counts)) parts.push(`${k}=${counts[k]}`);
  console.log(`[diag:${builder}] ${scope} ${parts.join(' ')}`);
}
