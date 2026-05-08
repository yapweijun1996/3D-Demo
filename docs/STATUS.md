# Drive Singapore — Project Status

> **Last updated**: 2026-05-08 (T50 shipped, T51-T53 pending)
> **Older context**: see [PLAN_v0.3.md](PLAN_v0.3.md) for v0.3 phase A-H history.
> **Roadmap**: [task.jsonl](../task.jsonl) is SSOT for every shipped + pending task (T01-T50).

---

## 1. North Star

A driveable Singapore mini-tour, web-native, recognisably-SG silhouette: MBS / Helix /
Esplanade / Supertrees / Flyer / Merlion. PWA-shippable on GitHub Pages, < 15 MB total,
60 fps M-Mac. **Currently fails the "looks real" bar** — see §6.

---

## 2. Shipped (T01-T50)

### Core systems
- **OSM-driven roads + landmarks** at real Singapore lat/lng (T03, T04, T11)
- **Rapier physics** vehicle (T initial)
- **Day/Night HDRI cycle** with smooth lerp (T35 + T35a fix)
- **Touch + keyboard controls**, splash screen, modal info cards
- **6 iconic landmarks** procedural geometry: MBS / Helix / Esplanade / Supertrees / Flyer / Merlion (T16, T27, T30, T34)
- **40 NPC cars** on OSM arterials with lane offset + path-handover (T18, T23, T46)
- **District typology** dispatcher (CBD towers / shophouses / colonial / mall / park) (T08-T10)
- **Iconic emissive features** night-driven: CBD windows, Flyer capsules, Supertree LEDs, MBS infinity pool, Helix tubes (T31, T33, T34, T36)

### UI overhaul (T20)
- SSOT design tokens (SG red/gold/teal on dark glass) — `src/ui/theme.js`
- 180° SVG arc speedometer with animated needle + boost segments
- Round minimap with N/E/S/W compass + pulsing landmark dots + NPC dots (T47)
- Splash with cinematic SG title + tri-color progress
- Time + Landmark counter info-bar (right-top)
- District entry banner (bottom-center, animates on bbox crossing)
- Stats pill toggle (backtick), shows fps + dayPhase (T44)

### Harness / dev tooling
- **Inspector / control APIs** via `window.__sg*`:
  - `__sgTeleport(lat, lng)` — drop car anywhere
  - `__sgTopDown(on, alt)` — debug overhead camera
  - `__sgDayNight('night'|'day')` — programmatic time toggle
  - `__sgDayState()` — read mode/phase/lerping/lerpT/tickerCount
  - `__sgDrive({keys, seconds})` — scripted key injection
- **Diag log** — `logPlacement(builder, scope, counts)` (T45, T48)
  - Uniform format: `[diag:builder] scope k1=v1 k2=v2`
  - All 5 builders covered: shophouse / palms / traffic / landmarks-sg / buildings

---

## 3. Architecture — SSOT layout

```
src/
├── config.js             PALETTE + CFG (camera, physics, perf)
├── world/
│   ├── atlas.js          [SSOT hub] re-exports below
│   ├── road-tiers.js     TIERS + TIER_Y + TIER_W + surfaceY()  ← roads-osm + traffic
│   ├── districts.js      DISTRICTS + TYPOLOGY + districtAtWorld()
│   ├── road-emitter.js   emitParallelStrip + walkAtSpacing (snap-to-grid)
│   ├── landmarks-sg.js   LANDMARK_FOOTPRINTS export ← buildings anti-overlap
│   ├── landmarks-glow.js GLOW_TABLE + applyLandmarkGlow()       ← main.js loop
│   ├── diag.js           logPlacement()                          ← every builder
│   └── …
└── ui/
    ├── theme.js          design tokens
    └── …
```

**Pattern**: every cross-cutting data table lives in its owner module and re-exports through `atlas.js`. Adding a new emissive landmark = 3 lines (expose mat → register → append GLOW_TABLE entry). No central God-file, no scattered constants.

---

## 4. Verification posture

- **Live test** via Claude Preview MCP — every shipped task has a screenshot or console log evidence in [task.jsonl](../task.jsonl)
- **Diag-driven discovery** — T46 (traffic candidates 2 → 32) found by reading `[diag:traffic]` not by debugging
- **Top-down camera** for layout audits at altitudes 60-700m
- **Foreground caveat** — preview tab `requestAnimationFrame` is throttled; some end-to-end tests require foreground browser (T39, T50)

---

## 5. Known limitations / open items

| ID  | Title                                  | Status   | Severity |
|-----|----------------------------------------|----------|----------|
| —   | **Road network looks like asphalt blobs** (8218 short OSM ways each rendered as separate strip → overlapping mess) | **OPEN** | **HIGH** |
| —   | **Hard shadows on grass** — VSM softening insufficient at low sun angle | OPEN     | MED      |
| T28 | Demo gif from chinatown→marina         | done as deferred | LOW |
| T39 | DayNight at high-alt topDown           | env-bound (rAF throttle), not code | RESOLVED |
| T50 | __sgDrive end-to-end                   | env-bound (same)                    | RESOLVED |
| T51 | diag.ENABLED → URL `?diag=1` flag      | pending  | LOW      |
| T52 | NPC dots colour by vehicle type        | pending  | LOW      |
| T53 | Spawn-on-road for teleport             | pending  | LOW      |

### Visual quality bar — current vs target
Current rendering shows:
- Roads: fragmented strip overlap (HIGH visible defect)
- Buildings: flat, no facade variation beyond per-instance HSL
- Lighting: harsh shadows
- Distance buildings: blocky, no LOD
- Traffic: spread but low density

Path forward (proposed, not committed): rewrite **only** `world/roads-osm.js` + `world/road-emitter.js` to stitch OSM ways into continuous polylines before strip emission. Keeps all harness / SSOT / dev tooling investment intact.

---

## 6. How to extend (recipes)

### Add a new emissive landmark feature
1. Inside `createXxx()` in `landmarks-sg.js`: `g.userData.fooMat = fooMat;`
2. In `buildSGLandmarks` loop: `if (p.name === 'xxx') scene.userData.fooMat = g.userData.fooMat;`
3. Append to `GLOW_TABLE` in `landmarks-glow.js`: `{ key: 'fooMat', base: 0.1, scale: 1.5 }`

### Add a new builder with diag
1. `import { logPlacement } from './diag.js';`
2. After placement loop: `logPlacement('myBuilder', scope, { ways, samples, placed });`

### Run a regression sweep
1. `__sgTeleport(lat, lng)` to spawn point
2. `__sgDrive({keys: ['up'], seconds: 5})` to advance
3. Screenshot via preview tool

---

## 7. Performance budget

| Resource             | Current | Target |
|----------------------|---------|--------|
| First contentful     | ~2 s    | < 3 s  |
| Total transfer       | ~12 MB  | < 15 MB |
| Steady fps (M-Mac)   | 58-60   | ≥ 55   |
| Drawcalls            | ~120    | < 200  |
| Triangles            | ~2.5 M  | < 5 M  |

(Numbers from preview stats panel — toggle with backtick)

---

## 8. Commit hashes — most recent (newest first)
- `9f826fc` T47/T48/T49 — minimap NPC dots + diag full coverage + drive sim API
- `568da9d` T46 — traffic candidate threshold 120m → 30m (16× density)
- `43da157` T45 — diag.js placement counters
- `c62ccec` T42-T44 — instrument shophouse, atlas consumer, dayState in stats
- `aef0b46` T39-T41 — dayNight investigation, atlas SSOT hub, chinatown bug bash
- `ecd8c63` T35-T37 + info-bar threshold — dayNight API + Helix night glow + GLOW_TABLE SSOT
- `2d11846` T32-T34 — demo capture, Supertree LEDs, MBS infinity pool
- `3592974` T29-T31 — followCam Y reset + Helix pylons + Flyer night glow
