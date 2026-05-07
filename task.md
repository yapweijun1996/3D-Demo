# Drive Singapore — Roadmap

> Living checklist. Mirror of `docs/PLAN_v0.3.md` §3.
> **Update rule**: tick (`[x]`) only after acceptance criteria are verified with real tool output.
> **Last updated**: 2026-05-07

---

## Legend

- `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked
- ⭐ = current focus

---

## Cache strategy (cross-cutting, ADR-006)

- [x] Server `Cache-Control: no-cache, must-revalidate` + ETag (mtime+size)
- [x] HTML meta `http-equiv` triple-set (Cache-Control / Pragma / Expires)
- [x] Entry URL `?v=Date.now()` cache-bust
- [ ] **Phase G blocker**: replace `Date.now()` with commit hash before SW lands

## v0.2 — shipped (baseline)

- [x] Procedural Singapore-themed scene (MBS / Supertree / Flyer / Merlion / HDB / palms)
- [x] Curved-body sedan with 5-spoke alloys + license plate
- [x] Dusk sky gradient (vertex shader BackSide sphere)
- [x] Cross-shape asphalt road + roundabout planter
- [x] PMREM environment map (procedural source)
- [x] FPS HUD top-right
- [x] Mini-map top-left (signs + water + car triangle)
- [x] InstancedMesh — palms (28 → 2 calls)
- [x] InstancedMesh — HDB (18 → 2 calls)
- [x] InstancedMesh — Supertree grove (120 → 4 calls)
- [x] Sign trigger modal (5 SG landmarks)

**Status**: ~370 drawcall savings vs v0.1. Verified in MCP preview.

---

## v0.3 phase plan

### ⭐ Phase A — Physics swap (Rapier RaycastVehicle)
**Estimate**: 1.0–1.5 h · **Files**: +3 (physics/) · **LOC**: +300

- [x] A.1 Add `@dimforge/rapier3d-compat@0.14.0` import (esm.sh)
- [x] A.2 `physics/rapier-world.js` — `await RAPIER.init()`, `World({ gravity: 9.82 })`, fixed-step ticker
- [x] A.3 `physics/static-colliders.js` — register ground + cone cyl + sign box + landmark cyl
- [x] A.4 `physics/car-vehicle.js` — chassis rigid body + `DynamicRayCastVehicleController` + 4 wheels
- [x] A.5 `vehicle/drive.js` — adapt input → `vehicle.setEngineForce / setBrake / setSteering`
- [x] A.6 Sync wheel mesh transform from `vehicle.wheelChassisConnectionPoint(i)`
- [ ] A.7 Verify in real browser: cone hit shows impulse, body rolls in turn, step ≤ 4ms
- [x] A.8 Fallback flag `CFG.physics.enabled` — false routes back to v0.2 kinematic

### Phase B — Asset pipeline + GLB instances
**Estimate**: 1.0–1.5 h · **Files**: +2 (loaders/) + 5 GLB · **LOC**: +200

- [ ] B.1 `loaders/glb-cache.js` — Promise-cached `loadGLB(path)`
- [ ] B.2 `loaders/instance-from-glb.js` — `instanceFromGLB(path, matrices[])`
- [ ] B.3 `scripts/fetch-assets.sh` — curl + unzip CC0 packs
- [ ] B.4 `assets/glb/sedan.glb` (Kenney Vehicle Kit)
- [ ] B.5 `assets/glb/palm.glb` (Quaternius Tropical)
- [ ] B.6 `assets/glb/building_tower.glb` (Kenney City Kit)
- [ ] B.7 `assets/glb/cone.glb` (Kenney Construction)
- [ ] B.8 `assets/glb/lamppost.glb` (Kenney City Kit, for Phase D)
- [ ] B.9 `assets/CREDITS.md` — every URL + license line
- [ ] B.10 Replace `palms.js` builder with GLB instance call
- [ ] B.11 Replace `buildings.js` builder with GLB instance call
- [ ] B.12 Replace `cones.js` builder with GLB instance call
- [ ] B.13 Replace `vehicle/car.js` chassis with GLB sedan, align Rapier wheel anchors
- [ ] B.14 `ui/splash.js` — loading bar with byte progress
- [ ] B.15 Verify: bundle ≤ 5MB, drawcalls ≤ 30, all CC0 credited

### Phase C — Water + weather
**Estimate**: 0.8–1.2 h · **Files**: +3 (water-reflector, rain, clouds) + state/ · **LOC**: +250

- [ ] C.1 `world/water-reflector.js` — Reflector at half-RT, replace water.js
- [ ] C.2 `world/rain.js` — 1000-particle Points with shader Y-loop
- [ ] C.3 `world/clouds.js` — 8 alpha planes drift X
- [ ] C.4 `state/weather.js` — `{ mode, t }` state machine
- [ ] C.5 `world/lighting.js` couples to weather (sun/hemi/fog)
- [ ] C.6 `world/roads.js` wet variant (low roughness, high envIntensity)
- [ ] C.7 `input.js` N key → cycle mode
- [ ] C.8 `ui/hud-hints.js` "N: weather"
- [ ] C.9 `CFG.water.reflectionEnabled` flag (mobile-off)
- [ ] C.10 Verify: rain crossfades < 2s, fps within budget

### Phase D — Day/night cycle
**Estimate**: 0.4–0.7 h · **Files**: +1 (state/time.js) · **LOC**: +150

- [ ] D.1 `state/time.js` — `timeOfDay` + `tNight` derived
- [ ] D.2 `world/sky.js` — uniform `uTNight`, 3-palette lerp
- [ ] D.3 `world/lighting.js` reads time → sun/hemi
- [ ] D.4 `world/buildings.js` — emissiveIntensity = mix(0.1, 0.7, tNight)
- [ ] D.5 `world/landmarks.js` — Supertree pulse × (1 + tNight*1.5)
- [ ] D.6 Lampposts (lamppost.glb) + PointLight, intensity = tNight
- [ ] D.7 `input.js` T key step / Shift+T auto
- [ ] D.8 Verify: full cycle smooth, no banding, night reads cinematic

### Phase E — Perf + polish
**Estimate**: 0.5–1.0 h · **LOC**: +100

- [ ] E.1 `THREE.LOD` for buildings (>200m → simple box)
- [ ] E.2 Shadow LOD: only car + nearby signs castShadow
- [ ] E.3 `EffectComposer` + `UnrealBloomPass` (night-only)
- [ ] E.4 `chrome-devtools` Performance trace baseline
- [ ] E.5 Trace after — generate `docs/perf-report.md`
- [ ] E.6 Verify: 60fps M1 1080p, 144fps RTX 1440p

### Phase F — Mobile support
**Estimate**: 2.0–2.5 h · **LOC**: +250

- [ ] F.1 `CFG.tier` table — auto-detect mobile UA
- [ ] F.2 `ui/touch-controls.js` — virtual joystick + brake button
- [ ] F.3 `index.html` viewport meta — `viewport-fit=cover`, `100dvh`
- [ ] F.4 iOS Safari quirks — antialias off + FXAA, mediump fallback
- [ ] F.5 `?perf=low|high` URL override
- [ ] F.6 Landscape orientation prompt (CSS overlay)
- [ ] F.7 Verify on real iPhone — 30fps min @ 720p

### Phase G — PWA
**Estimate**: 1.0–1.5 h · **LOC**: +120

- [ ] G.1 `manifest.webmanifest` — name, icons, theme, display=fullscreen
- [ ] G.2 `icons/icon-192.png` `icon-512.png` `maskable-512.png`
- [ ] G.3 `sw.js` — Cache-First with versioned cache key
- [ ] G.4 Register SW in `main.js` (HTTPS guard)
- [ ] G.5 `beforeinstallprompt` → "📲 Install" button in HUD
- [ ] G.6 Online/offline indicator on minimap
- [ ] G.7 Verify: Lighthouse PWA ≥ 90, offline reload works

---

## Backlog (post v0.3)

- [ ] Multiplayer (WebRTC peer-to-peer follow mode)
- [ ] AI traffic + pedestrians
- [ ] Sound: engine pitch, rain ambience, modal sting
- [ ] DRACO compression on GLB (5× smaller)
- [ ] KTX2 / Basis texture compression
- [ ] Vite build step + tree-shaking
- [ ] WebXR mode (sit in driver seat)
- [ ] Replay / time-rewind toy
- [ ] Photo mode (free camera + screenshot button)
- [ ] More landmarks: Changi Jewel, Esplanade, Sentosa Cable Car
- [ ] Real Singapore street layout (OpenStreetMap import)

---

## Definition of Done (every phase)

A phase is done only when:

1. ✅ All checklist items verified
2. ✅ No console errors in MCP preview
3. ✅ FPS within budget for that phase's tier
4. ✅ Acceptance criteria from `docs/PLAN_v0.3.md` met
5. ✅ Commit message references phase ID
6. ✅ This file updated (boxes ticked, date stamped)
7. ✅ If an ADR was needed, logged in `docs/PLAN_v0.3.md` §7

---

## Quick links

- [SSOT plan](docs/PLAN_v0.3.md)
- [Project rules](CLAUDE.md)
- [Agent rules](AGENTS.md)
- [Credits (Phase B+)](assets/CREDITS.md) _(created in Phase B)_
- [Perf report (Phase E+)](docs/perf-report.md) _(created in Phase E)_
