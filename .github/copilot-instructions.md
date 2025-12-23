<!-- Copilot / AI agent instructions for pawn002/d3-animated-map-reference -->

# Copilot instructions — d3-animated-map-reference

Purpose: Help AI coding agents make focused, correct changes in this Angular + D3 reference map project.

- Quick start:

  - Install: `npm install`
  - Dev server: `npm start` (alias `ng serve`) — opens at http://localhost:4200/
  - Storybook: `npm run storybook`
  - Tests: `npm test`

- Big picture (what to read first):

  - The interactive map lives in [src/app/components/map-container](src/app/components/map-container)
  - Data files are under [src/app/data](src/app/data) and the component also ships sample GeoJSON in [src/app/components/map-container/sampleData](src/app/components/map-container/sampleData)
  - Rendering and behavior are separated into services under [src/app/components/map-container/services](src/app/components/map-container/services)
    - Key service files: `map-renderer.service.ts`, `geo-zoom.service.ts`, `animation-controller.service.ts`
  - Types/interfaces are in [src/app/components/map-container/models/map.types.ts](src/app/components/map-container/models/map.types.ts)

- Architecture notes (concrete, repo-specific):

  - The project is an Angular shell that delegates map work to a single `MapContainer` component. That component wires:
    - a D3 projection instance (set in the component)
    - rendering abstraction in `map-renderer.service.ts` (supports SVG now; Canvas planned)
    - zoom/pan logic in `geo-zoom.service.ts` (inspired/ported from d3-geo-zoom)
    - programmatic animations via `animation-controller.service.ts` and the `AnimationSequence` type
  - Data flow: GeoJSON -> component state -> projection -> renderer service -> DOM (SVG paths or Canvas)

- Project conventions and patterns to follow:

  - Keep projection configuration inside `map-container.component.ts` — projection changes should not be spread across services.
  - Programmatic animations use the `AnimationSequence` interface; call `mapComponent.playAnimation(sequence)` to trigger.
  - Prefer supplying GeoJSON (FeatureCollection) to the component rather than procedural geometry where possible — many bugs have come from programmatically generated circles.
  - Use the `renderMode` input on `<app-map-container>` to switch between `'svg'` and `'canvas'` when testing render differences.

- Integration points and important files:

  - [src/app/components/map-container/map-container.component.ts](src/app/components/map-container/map-container.component.ts) — entry point for map behaviors
  - [src/app/components/map-container/services/map-renderer.service.ts](src/app/components/map-container/services/map-renderer.service.ts) — implement changes to rendering logic here
  - [src/app/components/map-container/services/geo-zoom.service.ts](src/app/components/map-container/services/geo-zoom.service.ts) — zoom/pan math; inspect for projection-specific bugs
  - [src/app/components/map-container/services/animation-controller.service.ts](src/app/components/map-container/services/animation-controller.service.ts) — controls animation sequences
  - [src/app/components/map-container/sampleData/world.json](src/app/components/map-container/sampleData/world.json) — canonical sample GeoJSON

- How to implement a Tissot Indicatrix overlay (practical tip based on current issues):

  - Do NOT generate circles in screen (pixel) space. Instead, produce a GeoJSON FeatureCollection of geographic circles that all have the same ground distance radius before projecting.
  - Place generated circles in `src/app/components/map-container/sampleData/` for reproducible testing (see `world.json` for structure).
  - Render the overlay through the existing renderer pipeline (add a layer in `map-renderer.service.ts`) so projection and zoom behave consistently.

- Build/test/debug tips:

  - Use `npm start` then open devtools to inspect SVG shapes and projection transforms.
  - For unit-style checks, run `npm test`. For interactive UI and visual checks, use Storybook (`npm run storybook`).
  - If shapes appear warped or duplicated, confirm the GeoJSON features are geographic (lon/lat) and not already projected.

- Branching/PR conventions:

  - Feature branches follow `task-<num>-short-desc` (e.g., `task-13-tissot-overlay`).
  - Keep changes small and focused to a single component or service when possible.

- When you encounter ambiguity:

  - Prefer reading `map-container.component.ts` and the three services listed above before changing projection math.
  - If a visual regression occurs, add a minimal reproducible GeoJSON under `sampleData/` and a Storybook story demonstrating the issue.

- Contact / feedback:
  - If anything here is unclear or you want more examples (for example, a minimal GeoJSON generator for equal-ground-distance circles), tell me which section to expand.
