# Map Container Component

A standalone Angular component for rendering interactive, animated geospatial maps with support for both SVG and Canvas rendering modes.

## Dependencies

### Angular Core

- **@angular/core** (v17+)
  - `Component` - Component decorator
  - `ElementRef` - DOM element reference
  - `viewChild` - Template query for child elements
  - `input` - Input signal for component properties
  - `output` - Output signal for component events
  - `signal` - Reactive state management
  - `effect` - Reactive effect runner
  - `AfterViewInit` - Lifecycle hook for post-view initialization
  - `DestroyRef` - Lifecycle management for cleanup
  - `inject` - Dependency injection function
- **@angular/common**
  - `CommonModule` - Common Angular directives (ngIf, ngFor, etc.)

### D3.js

- **d3** (v7+)
  - Geo projections (`geoEquirectangular`)
  - Selection API for DOM manipulation
  - Zoom and pan behaviors
  - Easing functions for animations
- **d3-geo**
  - `GeoProjection` - Geographic projection type
  - `GeoPath` - Geographic path generator

### GeoJSON

- **geojson**
  - `FeatureCollection` - GeoJSON feature collection type
  - `GeoJsonObject` - General GeoJSON object type

### RxJS

- **rxjs** (v7+)
  - `Subject` - Observable subject for event streaming
  - Observables for reactive programming
- **@angular/core/rxjs-interop**
  - `takeUntilDestroyed` - Automatic subscription cleanup on component destruction

### Storybook (Development/Testing)

- **@storybook/angular** (for stories)
  - `Meta` - Story metadata type
  - `StoryObj` - Story object type
- **storybook/test**
  - `fn` - Test function utilities

## File Structure

```
map-container/
├── map-container.component.ts        # Main component (depends on services and models)
├── map-container.component.html      # Template (uses Angular directives)
├── map-container.component.scss      # Styles
├── map-container.stories.ts          # Storybook stories (for development)
├── models/
│   └── map.types.ts                  # TypeScript types (geojson, d3-geo)
├── services/
│   ├── map-renderer.service.ts       # Rendering logic (uses d3, d3-geo)
│   ├── geo-zoom.service.ts           # Zoom/pan handling (uses d3, rxjs)
│   └── animation-controller.service.ts # Animation logic (uses d3, rxjs)
└── sampleData/
    └── world.json                    # Sample GeoJSON data

```

## Dependency Summary by File

### `map-container.component.ts`

- @angular/core: `Component`, `ElementRef`, `viewChild`, `input`, `output`, `signal`, `effect`, `AfterViewInit`, `DestroyRef`, `inject`
- @angular/common: `CommonModule`
- @angular/core/rxjs-interop: `takeUntilDestroyed`
- d3: Projections, selections
- geojson: `FeatureCollection`
- Local: Services (MapRendererService, GeoZoomService, AnimationControllerService)
- Local: Types (RenderMode, ZoomEvent)
- Local: Sample data (world.json)

### `services/map-renderer.service.ts`

- @angular/core: `Injectable`
- d3: Selection, shape generators
- d3-geo: `GeoPath`, `GeoProjection`
- geojson: `FeatureCollection`
- Local: Types (RenderMode)

### `services/geo-zoom.service.ts`

- @angular/core: `Injectable`
- d3: Zoom behavior, easing functions
- d3-geo: `GeoProjection`
- rxjs: `Subject`
- Local: Types (ZoomConfig, ZoomEvent)

### `services/animation-controller.service.ts`

- @angular/core: `Injectable`
- d3: Easing functions
- rxjs: `Subject`
- Local: Types (AnimationConfig, MapExtent)
- Local: Service (GeoZoomService)

### `models/map.types.ts`

- d3-geo: `GeoProjection`
- geojson: `FeatureCollection`

### `map-container.stories.ts`

- @storybook/angular: `Meta`, `StoryObj`
- storybook/test: `fn`
- geojson: `GeoJsonObject`, `FeatureCollection`
- Local: Component (MapContainerComponent)
- Local: Sample data (world-110m.json)

## External Data Dependencies

- **GeoJSON data files** - Required for rendering maps
  - `sampleData/world.json` - Built-in sample data
  - Custom GeoJSON can be passed via the `geoData` input

## Version Requirements

- **Angular**: v17+ (for signal-based APIs)
- **RxJS**: v7+
- **D3**: v7+
- **TypeScript**: v5+

## Integration Guide

### Quick Start: Copy and Paste

1. **Copy the `map-container` folder** to your Angular project:

   ```bash
   cp -r src/app/components/map-container /path/to/your/project/src/app/components/
   ```

2. **Install dependencies** (if not already present):

   ```bash
   npm install d3 geojson rxjs
   npm install --save-dev @types/d3
   ```

3. **Update import paths** in your components:

   ```typescript
   import { MapContainerComponent } from './components/map-container/map-container.component';
   ```

4. **Use the component** in your template:

   ```html
   <app-map-container 
     [width]="960" 
     [height]="600"
     [geoData]="yourGeoJsonData"
     [renderMode]="'svg'"
     (fpsUpdate)="onFpsChange($event)">
   </app-map-container>
   ```

### Input Properties

- `width: number` (default: 960) - Map container width in pixels
- `height: number` (default: 600) - Map container height in pixels
- `geoData: FeatureCollection` (default: world.json) - GeoJSON data to render
- `renderMode: 'svg' | 'canvas'` (default: 'svg') - Rendering engine

### Output Events

- `fpsUpdate: EventEmitter<number>` - Emits current FPS during animations
- `zoomChange: EventEmitter<ZoomEvent>` - Emits when zoom/pan changes

### Public Methods

- `renderData(data: FeatureCollection)` - Render GeoJSON data
- `updateData(data: FeatureCollection)` - Update and re-render data
- `playAnimation(sequence: AnimationSequence)` - Play animation sequence
- `stopAnimation()` - Stop current animation
- `pauseAnimation()` - Pause current animation
- `resumeAnimation()` - Resume paused animation
- `resetZoom()` - Reset to initial zoom level
- `zoomTo(scale: number, duration?: number)` - Zoom to specific scale
- `panTo(coordinates: [number, number], duration?: number)` - Pan to coordinates
- `zoomToExtent(bounds: [[number, number], [number, number]], duration?: number)` - Fit bounds

### Optional: Remove Storybook Stories

If you don't use Storybook, you can safely delete `map-container.stories.ts`.

### TypeScript Configuration

Ensure your `tsconfig.json` includes proper module resolution:

```json
{
  "compilerOptions": {
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```
