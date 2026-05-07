# Drive Singapore — v0.3 SSOT Plan

> **Status**: v0.3 phases A-G shipped; **Phase H (Apple HIG city replan + game feel) shipped 2026-05-07**.
> **Owner**: yapweijun1996.
> **Update rule**: every architectural decision lands here BEFORE code. Code without a matching section is technical debt.

> **Latest commits in scope** (newest first):
> - `b28bba3` boost game-feel: exhaust trail + camera shake + touch button
> - `898eec5` add Shift = nitrous boost + speedometer HUD
> - `1e64af7` city replan P1+P2: palette constitution + HDB slab/point typology
> - `f78c601` add postfx (Bloom+ACES) + day/night-driven HDB window glow
> - `93ec1fb` Production cleanup
> - `ff3c3a5` ROOT CAUSE FIX — roads invisible was BACKFACE CULLING

---

## 0. North Star

A driveable Singapore mini-tour, web-native, that approaches Bruno Simon-tier polish:
**真物理 + 真模型 + 真反射 + 真天气 + 真昼夜 + 移动可玩 + PWA 离线**.

Non-goals (v0.3):
- multiplayer
- account/auth
- analytics/CMS
- WebXR/VR mode

---

## 1. Tech Stack — frozen

| Concern | Choice | Reason |
|---|---|---|
| Renderer | three.js 0.170 via esm.sh + importmap | already shipped v0.2, no build step |
| Physics | `@dimforge/rapier3d-compat` 0.14 (WASM, single-thread) | native `DynamicRayCastVehicleController`, ~500kb |
| Asset format | glTF 2.0 (`.glb`) | industry standard, draco-optional |
| Asset CDN | self-host under `/assets/glb/` | offline cache via SW, no third-party rate limit |
| Asset license | CC0 only (Quaternius / Kenney) | commercial-safe, zero attribution risk |
| Water | `three/addons/objects/Reflector` | true planar reflection at half-RT |
| Postprocessing | `EffectComposer` + `UnrealBloomPass` (night only) | bloom is conditional, off-budget on day |
| PWA | hand-written `sw.js`, no Workbox | minimal, auditable, fits "no build" stance |
| Static server | `node .claude/serve.mjs` | macOS sandbox-safe, no python wrapper |

Rejected:
- Cannon-es — no native vehicle controller, would have to reimplement RaycastVehicle
- ammo.js — heavier WASM, less ergonomic
- Workbox — pulls build step
- DRACO compression v1 — extra decoder, defer to v1.1

---

## 2. Architecture (target)

```
3D-Demo/
├── index.html                   # shell + import map + splash
├── manifest.webmanifest         # PWA (Phase G)
├── sw.js                        # service worker (Phase G)
├── icons/                       # 192/512/maskable PNGs (Phase G)
├── assets/
│   ├── glb/                     # CC0 GLB models
│   └── CREDITS.md               # asset attribution (Phase B)
├── docs/
│   ├── PLAN_v0.3.md             # this file
│   ├── perf-report.md           # Phase E baseline + after
│   └── decisions/               # ADR-style notes
├── scripts/
│   └── fetch-assets.sh          # one-shot CC0 download (Phase B)
├── task.md                      # phase tracker / roadmap
├── CLAUDE.md                    # project rules (existing)
├── AGENTS.md                    # agent rules (existing)
└── src/
    ├── main.js                  # async boot, frame loop
    ├── config.js                # SSOT constants + tier table
    ├── input.js                 # keyboard + touch + N/T
    ├── colliders.js             # legacy fallback (kept until Phase A green)
    │
    ├── physics/                 # ⭐ Phase A
    │   ├── rapier-world.js
    │   ├── car-vehicle.js
    │   └── static-colliders.js
    │
    ├── loaders/                 # ⭐ Phase B
    │   ├── glb-cache.js
    │   └── instance-from-glb.js
    │
    ├── state/                   # ⭐ Phase C/D
    │   ├── time.js
    │   └── weather.js
    │
    ├── vehicle/
    │   ├── car.js               # GLB chassis (Phase B)
    │   ├── drive.js             # input → physics adapter (Phase A)
    │   └── camera.js
    │
    ├── world/
    │   ├── sky.js               # tNight uniform (Phase D)
    │   ├── lighting.js          # time + weather coupled (Phase C/D)
    │   ├── playground.js
    │   ├── roads.js             # wet variant (Phase C)
    │   ├── water-reflector.js   # ⭐ Phase C (replaces water.js)
    │   ├── landmarks.js         # MBS/Flyer/Merlion procedural (no CC0 equiv)
    │   ├── buildings.js         # GLB instanced (Phase B)
    │   ├── palms.js             # GLB instanced (Phase B)
    │   ├── cones.js             # GLB instanced (Phase B)
    │   ├── signs.js             # canvas labels (kept)
    │   ├── rain.js              # ⭐ Phase C
    │   └── clouds.js            # ⭐ Phase C
    │
    └── ui/
        ├── stats.js             # FPS HUD (existing)
        ├── minimap.js           # + weather/time icons (Phase D)
        ├── modal.js
        ├── hud-hints.js         # ⭐ Phase C ("N weather, T time")
        ├── splash.js            # ⭐ Phase B (loading bar)
        └── touch-controls.js    # ⭐ Phase F (virtual stick + pedals)
```

---

## 3. Phase plan (single source of truth — `task.md` mirrors checklist)

### Phase A — Physics swap (Rapier RaycastVehicle)
**Goal**: same visuals, real physics. Suspension bounce, slip, impulse on collision.
**Out**: `physics/rapier-world.js`, `physics/car-vehicle.js`, `physics/static-colliders.js`. `drive.js` becomes adapter.
**Acceptance**:
- Car visibly tilts on hard turn (body roll)
- Hitting a cone produces impulse, not hard-clip
- World step ≤ 4ms on M1
- No regression vs v0.2 visuals
**Risk**: Rapier WASM CDN failure → fallback flag `CFG.physics.enabled = false` keeps v0.2 kinematic.

### Phase B — Asset pipeline + GLB instances
**Goal**: palms/buildings/cones/sedan replaced with real models.
**Out**: `loaders/`, `assets/glb/*.glb`, `scripts/fetch-assets.sh`, `assets/CREDITS.md`. Updated builders.
**Acceptance**:
- Total GLB bundle ≤ 5 MB
- Static drawcalls ≤ 30
- All assets CC0, credited
- GLB load failure falls back to procedural (no white screen)
**Risk**: asset license drift → review every GLB against Kenney/Quaternius source page, log URL in CREDITS.md.

### Phase C — Water + weather
**Goal**: real Marina Bay reflection, rain mode toggle.
**Out**: `water-reflector.js`, `rain.js`, `clouds.js`, `state/weather.js`, `hud-hints.js`. Updated lighting + roads.
**Acceptance**:
- N key cycles clear → overcast → rain → clear
- Crossfade ≤ 2s, no pop
- Rain at 1000 particles ≤ 2 drawcalls
- Reflector half-RT keeps fps ≥ desktop budget
**Risk**: Reflector tanks fps → `CFG.water.reflectionEnabled` flag, mobile tier auto-off.

### Phase D — Day/night cycle
**Goal**: T key (or auto) shifts time-of-day; emissive boost at night, sky/sun lerp.
**Out**: `state/time.js`. Updated sky/lighting/buildings/landmarks/roads.
**Acceptance**:
- Smooth lerp, no banding in sky
- Supertree pulse intensity ×2 at night
- HDB windows lit at night via emissiveIntensity
- T = step 0.05, Shift+T = auto-cycle 60s/day
**Risk**: emissive on InstancedMesh requires `instanceColor` for per-window variation — defer to v0.4 if scope creeps.

### Phase E — Performance + polish
**Goal**: hit FPS budget on all 3 device tiers; bloom on night only.
**Out**: `THREE.LOD` integration, shadow LOD pass, optional bloom pass, `docs/perf-report.md`.
**Acceptance**:
| Device | Resolution | Min FPS |
|---|---|---|
| M1 MacBook | 1920×1080 | 60 |
| RTX 4070 | 2560×1440 | 144 |
| iPhone 13 | 1170×2532 | 30 |
**Risk**: bloom on iOS Safari has historic glitches → wrap in feature detect, fall back to plain render.

### Phase F — Mobile support
**Goal**: phone users can drive.
**Out**: `ui/touch-controls.js`, `CFG.tier`, viewport meta, iOS Safari quirks fixed.
**Acceptance**:
- Touch joystick + brake button on `maxTouchPoints > 0`
- `?perf=low` URL override works
- iOS 100dvh, no address-bar bleed
- Landscape lock prompt
**Risk**: pointer events on iOS 14- inconsistent → add `touch` fallback path.

### Phase G — PWA
**Goal**: installable, offline-playable, instant cold start on 2nd visit.
**Out**: `manifest.webmanifest`, `sw.js`, `icons/`, install prompt button.
**Acceptance**:
- Lighthouse PWA score ≥ 90
- Cache-first SW, version key = commit hash
- Install prompt shows on Chrome/Edge desktop + Android
- Offline reload works after first visit
**Risk**: SW cache version drift traps user in old build → semver in `CACHE` const, auto-evict on new install.

### Phase H — Apple HIG city replan + game feel  *(shipped 2026-05-07)*
**Goal**: lift visual quality from "demo" to "polished" without new heavy assets, and make boost feel like a AAA nitrous button.
**Out**:
- `src/render/postfx.js` — `EffectComposer` pipeline (RenderPass → UnrealBloomPass → OutputPass). Bloom strength 0.45, threshold 0.82 — only HDR-bright pixels glow.
- Palette constitution in `src/config.js` — exported `PALETTE` (8 hues max). Every visible color sources from this single object. See ADR-008.
- HDB typology rewrite in `src/world/buildings.js` — 70/30 mix of slab (50–80m × 32–48m) + point (22×22 × 70–90m) blocks per cluster, each with recessed void deck + off-center rooftop water tank. Per-cluster `tone` (warm/cool) locks neighborhood identity.
- `src/world/daynight.js` exposes `phase` (0=day, 1=night, eased) → HDB window emissive intensity tracks phase each frame.
- Nitrous boost system (`Shift` key, mobile button): finite-fuel gauge (3s burn, 0.35/s refill, 0.4s cooldown). 5 parallel feedback channels — engine force ×2, +6° FOV punch, ±0.10 camera shake, twin emissive exhaust planes (`src/vehicle/exhaust.js`), HUD orange glow (`src/ui/speedometer.js`).
- Touch BOOST button added to `src/ui/touch-controls.js` (orange tint above BRAKE pad).

**Acceptance**:
- bloom visibly amplifies white road stripes + lit windows + boost flames
- HDB clusters readable as Singapore at >100m distance via slab/point silhouette
- 5-channel boost feedback fires within 1 frame of `keys.boost = true`
- Mobile touch boost works on devices with `maxTouchPoints > 0`
- No regression in `renderer.info.render.calls` budget — added 3 InstancedMesh batches but consolidated existing ones, net same drawcall count

**Risk**: postfx adds ~3ms/frame on low-end GPU → bloom strength tunable via `CFG.perf.bloomStrength` if needed (not yet wired, defer to perf regression).

---

## 4. Performance budget (hard limits — verified Phase E)

| Metric | Budget | Verify with |
|---|---|---|
| Static drawcalls | ≤ 30 | `renderer.info.render.calls` |
| Total GLB bundle | ≤ 5 MB | `du -sh assets/glb` |
| Rapier step time | ≤ 4 ms/frame | chrome-devtools trace |
| FPS desktop M1 | ≥ 60 @ 1080p | stats HUD + trace |
| FPS desktop RTX | ≥ 144 @ 1440p | stats HUD + trace |
| FPS mobile mid | ≥ 30 @ 720p | iPhone real device |
| Cold load (1st visit) | ≤ 4 s on 4G | Lighthouse |
| Warm load (2nd, PWA) | ≤ 0.5 s | Lighthouse |

---

## 5. SSOT enforcement rules

1. **Magic numbers** — every tunable lives in `src/config.js`. No literal floats in builders.
2. **Phase docs first** — never write a builder before the phase section in this file is filled.
3. **Decisions** — non-trivial trade-offs go in `docs/decisions/NNN-title.md`, linked here.
4. **Credits** — every GLB/asset URL recorded in `assets/CREDITS.md`.
5. **One claim per commit** — commit message must reference Phase ID (e.g., `[Phase A] Rapier integration`).
6. **No silent feature flags** — every `CFG.xxx.enabled` flag has a fallback path documented.

---

## 6. Glossary

- **Tier**: device performance class (`mobile`/`desktop`) → drives `CFG` sub-table.
- **tNight**: 0..1 uniform mapping time-of-day to night intensity.
- **Static collider**: Rapier non-moving collider, registered once at world build.
- **Drawcall**: GPU command submission. Budgeted because GPU command queue is per-frame bottleneck before fragment work.
- **CC0**: Creative Commons "no rights reserved", commercial OK, no attribution required (we credit anyway).

---

## 7. Decision log (ADR-lite)

| ID | Date | Decision | Status |
|---|---|---|---|
| 001 | 2026-05-07 | Use Rapier (compat) over Cannon-es | accepted |
| 002 | 2026-05-07 | CC0-only assets, self-host | accepted |
| 003 | 2026-05-07 | No build step (importmap only) — defer Vite to v0.4 | accepted |
| 004 | 2026-05-07 | MBS/Flyer/Merlion stay procedural — no CC0 equivalent | accepted |
| 005 | 2026-05-07 | Mobile after physics+assets, not parallel | accepted |
| 006 | 2026-05-07 | Three-layer cache-bust (server `no-cache`+ETag, HTML meta, entry `?v=`) | accepted |
| 007 | 2026-05-07 | Roads need `side: THREE.DoubleSide` — buildStripGeometry triangle winding produces front-face-down, FrontSide culls them at car-cam | accepted |
| 008 | 2026-05-07 | Palette constitution — single `PALETTE` export, 8 hues max, every mesh sources from it. Apple HIG: clarity from constraint | accepted |
| 009 | 2026-05-07 | HDB typology = slab + point + void deck + rooftop water tank, per-cluster tone (warm/cool). Silhouette-first, not detail-first | accepted |
| 010 | 2026-05-07 | Boost game-feel = 5-channel parallel feedback (force/FOV/shake/exhaust/HUD). State fan-out from `drive.state`, not callbacks | accepted |
| 011 | 2026-05-07 | Postprocessing via `EffectComposer` (RenderPass→Bloom→OutputPass). ACES tonemap moves from renderer to OutputPass when composer is in use | accepted |

Future decisions append here, never delete.

### ADR-008 — Palette constitution

**Context**: pre-Phase H, every world module picked colors freely (`0x4f7242` land, `0x9cc8ea` sky, etc). Result was visual incoherence — saturated grass under washed-out sky, hemi ground accidentally matching land color, killing depth perception. New modules had no rule for what colors to use.

**Decision**: a single `PALETTE` exported from `src/config.js`. 8 hues max:
`sky / skyNight / fog / fogNight / sea / land / road / accent / hdbWarm[2] / hdbCool[2] / voidDeck / rooftop`.
Every visible color in the world MUST source from this object. Per-cluster `tone: 'warm'|'cool'` selects which HDB pair to use.

**Why this works**: Apple HIG, Memoji, Alto's Odyssey — all derive coherence from constraint, not asset variety. Limiting the palette forces silhouette + composition to do the work.

**Files touched**: `src/config.js` (export), `src/world/daynight.js`, `src/world/land.js`, `src/world/water.js`, `src/world/buildings.js` (consumers).

**Maintenance rule**: any PR adding a new visible color without a `PALETTE.x` reference is rejected.

### ADR-009 — HDB typology (slab + point + void deck + water tank)

**Context**: pre-Phase H, all HDB blocks were a single 18×40×11 box per cluster. From the road they read as "generic apartment", not "Singapore HDB". Real HDB has two distinct typologies (long slab + tall point block) and two unmistakable silhouette features (open-column void deck at ground floor + rooftop water tank).

**Decision**:
- Per cluster, 70% slab (50–80m × 32–48m × 12m) + 30% point (22×22 × 70–90m).
- Every block emits 3 `InstancedMesh` slots: body, void deck (3m bottom, 4% inset, dark `PALETTE.voidDeck`), rooftop water tank (small box, off-center on slabs, centered on points, color `PALETTE.rooftop`).
- Per-cluster `tone` field locks neighborhood identity (warm = Toa Payoh / AMK / JE; cool = Bishan / Tampines / Woodlands).
- Block placement uses golden-angle distribution (2.39996 rad) for even spread without grid feel, axis-aligned rotation (0 or π/2) for clarity over noise.

**Why InstancedMesh**: 39 buildings × 3 sub-meshes = 117 logical meshes, but only 3 drawcalls thanks to instancing. Same perf budget as the old 1-batch version.

**Files touched**: `src/world/buildings.js` (rewrite), `src/config.js` (cluster.tone, dropped minHeight/maxHeight).

### ADR-010 — Boost game feel = 5-channel parallel feedback

**Context**: shipping nitrous boost as just a force multiplier is invisible — players cannot feel a 2× change in chassis force without confirmation in other senses.

**Decision**: when `keys.boost` is true and gauge has fuel, fire 5 parallel feedback channels in the same frame:
1. Physics — engine force ×2 (rear wheels in Rapier path)
2. Camera — extra +6° FOV target (on top of speed-driven FOV) + ±0.10 X jitter, ±0.07 Y jitter
3. Visual — twin emissive exhaust planes opacity-lerp from 0 → 0.95 at 35%/frame, scale-flicker each frame for fire feel, additive blend so bloom amplifies them
4. HUD — speedometer digits + gauge + border switch to orange `PALETTE.accent` with glow box-shadow
5. Touch UI — BOOST button background lightens, glow box-shadow on

**Architecture**: `drive.tick()` writes `drive.state = { speedKmh, boost, boosting }` once per tick. Five independent consumers read it. No callbacks, no event bus — fan-out from a single source. Adding a 6th channel (audio, particles, drift trail) is a new consumer module, zero changes to existing code.

**Files touched**: `src/input.js`, `src/config.js` (CFG.boost), `src/vehicle/drive.js`, `src/vehicle/camera.js`, `src/vehicle/exhaust.js` (new), `src/ui/speedometer.js` (new), `src/ui/touch-controls.js`.

### ADR-006 — Three-layer cache-bust strategy

**Context**: end users (especially behind corporate proxies, Cloudflare, or stale service workers) frequently see a stale `main.js` after we ship a new build. "Hard refresh" instructions are unacceptable UX.

**Decision**: defense in depth, three independent layers:

1. **Server** (`.claude/serve.mjs`): `Cache-Control: no-cache, must-revalidate` + `Pragma: no-cache` + `Expires: 0` + ETag from mtime+size. Browser revalidates every fetch; 304 fast-path saves bandwidth.
2. **HTML meta** (`index.html`): `<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">` + `Pragma` + `Expires`. Fallback when reverse proxies strip headers.
3. **Entry URL versioning**: inline script appends `?v=${Date.now().toString(36)}` to the `main.js` import URL. Defeats any cache layer that ignores headers, by making the URL itself unique per page load.

**Why heterogeneous**: each layer protects a different threat:
- header attack: proxy ignores `Cache-Control` → meta or `?v=` saves us
- meta attack: proxy strips meta → header or `?v=` saves us
- URL attack: cache cannot collide because `?v=A` ≠ `?v=B`

**Why `no-cache` not `no-store`**: `no-cache` allows disk-caching with mandatory revalidation. This keeps Phase G service worker offline mode viable. `no-store` would forbid disk persistence and break offline.

**Phase G upgrade path** (REQUIRED before SW lands):
- Replace `Date.now()` in entry `?v=` with build/commit hash → cache key stable per deploy
- Service worker cache key MUST embed the same hash → SW evicts old build on activate
- Without this, SW will treat every Date.now()-versioned URL as new and bloat the cache forever

**Files touched**: `.claude/serve.mjs` (headers + ETag + 304), `index.html` (meta tags + inline cache-bust loader).

**Verification**: `curl -I` confirmed headers; `If-None-Match` returned 304; DOM scripts list shows `main.js?v=moux3i0o`.

---

## 8. Out of scope (v0.3 explicit non-doing)

- Multiplayer / WebRTC / WebSocket
- Backend, accounts, leaderboards
- AI traffic / pedestrians (defer v0.4)
- Sound design (defer v0.4)
- WebXR / VR / AR
- DRACO compression
- KTX2 textures
- Vite/Webpack build step
- Server-side rendering

If scope creep — STOP, log in section 7, reassess phase budget.
