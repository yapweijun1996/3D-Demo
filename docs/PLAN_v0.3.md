# Drive Singapore — v0.3 SSOT Plan

> **Status**: planning approved (2026-05-07). Authoritative source of intent for v0.3.
> **Owner**: yapweijun1996.
> **Update rule**: every architectural decision lands here BEFORE code. Code without a matching section is technical debt.

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

Future decisions append here, never delete.

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
