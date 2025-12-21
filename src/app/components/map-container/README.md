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

```text
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
│   ├── animation-controller.service.ts # Animation logic (uses d3, rxjs)
│   └── tissot-indicatrix.service.ts  # Tissot's Indicatrix calculations
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
- `showTissotIndicatrix: boolean` (default: false) - Show Tissot's Indicatrix overlay
- `tissotConfig: TissotIndicatrixConfig` (optional) - Configure Tissot's Indicatrix appearance

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

## Tissot's Indicatrix Overlay

The map component includes an optional overlay that displays **Tissot's Indicatrix of distortion**. This visualization shows how a map projection distorts distances and angles across the globe.

### What is Tissot's Indicatrix?

Tissot's Indicatrix is a mathematical visualization technique that reveals projection distortion by displaying small circles or ellipses at regular intervals across the map. The shape and size of each circle indicates:

- **Circular shape**: No angular distortion (conformal projection)
- **Elliptical shape**: Angular distortion present
- **Larger size**: Local area magnification
- **Smaller size**: Local area reduction
- **Rotation**: Indicates shear/rotation in the projection

### Using the Overlay

Enable the overlay with a simple input binding:

```html
<app-map-container 
  [showTissotIndicatrix]="true">
</app-map-container>
```

### Configuration

Customize the appearance of Tissot's Indicatrix circles:

```html
<app-map-container 
  [showTissotIndicatrix]="true"
  [tissotConfig]="{
    gridSpacing: 15,        // degrees between sample points (default: 10)
    circleRadius: 6,        // radius in pixels (default: 5)
    fillOpacity: 0.2,       // opacity of circles (default: 0.3)
    strokeWidth: 2          // stroke width in pixels (default: 1)
  }">
</app-map-container>
```

### Implementation Details

The `TissotIndicatrixService` calculates distortion using the Jacobian matrix of the projection's transformation function:

1. **Sampling**: Creates a regular grid of points across the world
2. **Differentiation**: Computes the projection's partial derivatives at each point
3. **Metric Tensor**: Analyzes the Gram matrix to determine local scaling and distortion
4. **Rendering**: Displays ellipses whose size and shape represent the local distortion characteristics

The service supports both SVG and Canvas rendering modes. Currently, the overlay is fully implemented for SVG mode; Canvas support will be added in a future version.

### Example Usage in TypeScript

```typescript
import { Component } from '@angular/core';
import { MapContainerComponent } from './components/map-container/map-container.component';

@Component({
  selector: 'app-map-viewer',
  standalone: true,
  imports: [MapContainerComponent],
  template: `
    <app-map-container 
      [showTissotIndicatrix]="showDistortion"
      [tissotConfig]="tissotSettings">
    </app-map-container>
    <button (click)="toggleDistortion()">
      {{ showDistortion ? 'Hide' : 'Show' }} Distortion
    </button>
  `
})
export class MapViewerComponent {
  showDistortion = false;
  
  tissotSettings = {
    gridSpacing: 10,
    circleRadius: 5,
    fillOpacity: 0.3,
    strokeWidth: 1
  };

  toggleDistortion() {
    this.showDistortion = !this.showDistortion;
  }
}
```

### Visual Characteristics

- **Color**: Red circles with darker red outlines (configurable via the service)
- **Opacity**: Semi-transparent to show underlying map features
- **Pointer events**: Non-interactive (won't block mouse events on the map)
- **Rendering layer**: Rendered on top of geographic features

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
