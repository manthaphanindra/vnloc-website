# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Server

No build step. Serve directly with Python:
```
/opt/homebrew/bin/python3 -m http.server 3000
```
Then open `http://localhost:3000`. Use `?v=N` on the script tag in `index.html` to bust browser cache after changes to `js/scene.js`.

**Note:** `/usr/local/bin/python3` does not exist on this machine — always use `/opt/homebrew/bin/python3`.

## Architecture

Single-page static site deployed on GitHub Pages (root of `main` branch).

| File | Role |
|------|------|
| `index.html` | All HTML sections + importmap for Three.js CDN |
| `css/styles.css` | Dark theme, glassmorphism cards, loader, responsive |
| `js/scene.js` | Three.js ES module — entire 3D mining scene |
| `js/main.js` | Vanilla JS — nav scroll, mobile menu, card reveal, form |

### Three.js Scene (`js/scene.js`)

- **Three.js r160** loaded via CDN importmap (no npm, no bundler)
- **Canvas** `#c` is `position:fixed; z-index:0` — always behind scrollable content
- **Post-processing**: `EffectComposer` + `UnrealBloomPass` on desktop only (skipped at `max-width:768px`)
- **Scroll camera**: 9 `STORY` beats (progress 0–1), camera interpolated with `smoothstep` on `window.scrollY`
- **`scrollProgress`** smoothly lerps toward `scrollTarget` each frame (0.045 factor)

### Scene Structure

The 3D scene is built entirely from `THREE.BoxGeometry` and `THREE.CylinderGeometry` primitives — no external models.

Key build functions called from `init()`:
- `buildLighting()` — sun (directional + shadows), fill, rim lights
- `buildSky()` — vertex-coloured sphere + sun disc + halo
- `buildTerrain()` — 4-bench open pit using `buildRockyWall()` + `buildBenchFloor()` + blast holes/ore veins/rubble
- `buildHaulRoad()` — `CatmullRomCurve3` path, quaternion-aligned road segments
- `buildExcavator()` — grouped hierarchy: platform → boom → arm → bucket
- `buildTruck(position, rotY, type)` — returns a Group; types: `'loading'`, `'hauling'`, `'hauling2'`, `'empty'`, `'dumping'`
- `buildProcessingPlant()` — crusher, main building with red gabled roof, smokestacks, internal conveyor
- `buildOverlandConveyor(sx,sy,sz, ex,ey,ez, chunksArr, nChunks)` — quaternion-aligned belt, legs, idlers; pushes ore chunks into `chunksArr`; returns `CatmullRomCurve3` path
- `buildConveyorMaterial()` — sets up 3 conveyor paths: internal plant belt, Belt A (plant→stockpile), Belt B (plant→silos)
- `buildSilos()`, `buildWheelLoader()`, `buildStockpiles()`, `buildSurface()`, `buildDust()`

### Animation (`animateEquipment(t)`)

Called each frame with `clock.getElapsedTime()`:
- Excavator dig cycle keyed off `t`
- Truck 2/4/5 drive `haulCurve` via progress variables + direction flags
- Truck 3 (dump) cycles its bed via `truck3DumpPhase`
- Conveyor ore chunks advance along their `CatmullRomCurve3` paths via `animateConveyorMaterial()`
- Dust particles animated via `animateDust(geo)`

### Colour Palette

All colours centralised in `const C = { ... }` at top of `scene.js`. Key values:
- Equipment: `yellow: 0xFFCC00`, `yellowDk: 0xE0A800`, `chassis: 0x1A1A1E`
- Terrain: `ground: 0x787880` → `oreFloor: 0x282830` (deepens with pit depth)
- Plant: `plantGrey/plantDk`, `roofRed: 0xCC2020`
- Conveyors: `convOrange: 0xCC4400`

### CSS Layout

- Story overlay sections are `position:relative; z-index:10; pointer-events:none`
- `.card` elements are `pointer-events:auto` (glassmorphism: `backdrop-filter:blur(24px)`)
- CSS variables in `:root` — gold `#F5C300`, red `#D01012`, blue `#006DB7`, green `#00A650`
- Fonts: Space Grotesk (headings) + Inter (body) via Google Fonts

## Deployment

```
git remote add origin <github-repo-url>
git push -u origin main
# Then enable Pages in repo Settings → Pages → Source: main branch / root
```
