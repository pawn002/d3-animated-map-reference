# MVP Architecture: D3 Animated Map with Proper Projection

*Simplified architecture focused on proving the concept*

## MVP Goal
Create an animated map that maintains one projection while smoothly animating to different geographical extents at >23fps using GeoJSON data.

## Architecture Overview

```
[Angular App Component]
    │
    ├── [Map Container Component]
    │   ├── Canvas/SVG element
    │   └── FPS Counter (dev mode)
    │
    └── [Map Service] (Angular Injectable)
        ├── D3 Projection Setup
        ├── D3 Path Generator
        ├── Animation Controller
        └── GeoJSON Data Handler
```

## Core Components

### 1. Map Container Component
**File:** `src/app/components/map-container/map-container.component.ts`

**Responsibilities:**
- Host the rendering surface (Canvas or SVG)
- Provide viewport dimensions
- Expose user interaction handlers
- Display FPS counter during development

**Key Implementation:**
```typescript
@Component({
  selector: 'app-map-container',
  template: `
    <div class="map-wrapper">
      <canvas #mapCanvas [width]="width" [height]="height"></canvas>
      <div class="fps-counter" *ngIf="showFps">{{ currentFps }} fps</div>
    </div>
  `
})
export class MapContainerComponent implements OnInit, AfterViewInit {
  @ViewChild('mapCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  width = 960;
  height = 600;
  currentFps = 0;
  showFps = true;
}
```

### 2. Map Service
**File:** `src/app/services/map.service.ts`

**Responsibilities:**
- Initialize D3 projection (single, static projection)
- Generate path from GeoJSON
- Handle animation between geographic extents
- Monitor and maintain >23fps
- Manage render loop

**Key Methods:**
```typescript
@Injectable({ providedIn: 'root' })
export class MapService {

  // Setup projection (call once)
  initializeProjection(projectionType: string): void {
    // d3.geoMercator(), d3.geoAlbersUsa(), etc.
  }

  // Load and render GeoJSON
  loadGeoJSON(data: GeoJSON): void {
    // Use d3.geoPath() to generate paths
  }

  // Animate to new extent
  animateToExtent(bounds: [[number, number], [number, number]], duration: number): void {
    // Use d3.transition() to smoothly interpolate
    // OR use d3.zoom() for pan/zoom behavior
  }

  // Render current state
  render(): void {
    // Draw to canvas using d3.geoPath().context()
  }
}
```

### 3. Animation Controller (within Map Service)

**Two Animation Approaches:**

#### Option A: d3.zoom() (Recommended for MVP)
```typescript
private setupZoomBehavior(canvas: HTMLCanvasElement): void {
  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on('zoom', (event) => {
      this.currentTransform = event.transform;
      this.render(); // Rerender on each zoom event
    });

  d3.select(canvas).call(zoom);
}
```

**Pros:** Built-in, smooth, handles user interaction
**Cons:** Limited to zoom/pan metaphor

#### Option B: d3.transition() for Custom Animations
```typescript
animateToLocation(target: [number, number], duration = 1000): void {
  const projection = this.projection as any;

  d3.transition()
    .duration(duration)
    .tween('projection', () => {
      const centerInterpolate = d3.geoInterpolate(
        projection.center(),
        target
      );

      return (t: number) => {
        projection.center(centerInterpolate(t));
        this.render();
      };
    });
}
```

**Pros:** Full control over animation
**Cons:** More complex, need to handle interpolation

### 4. Performance Monitor

**File:** `src/app/services/performance.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class PerformanceService {
  private frames: number[] = [];
  private lastFrameTime = performance.now();

  recordFrame(): number {
    const now = performance.now();
    const delta = now - this.lastFrameTime;
    const fps = 1000 / delta;

    this.frames.push(fps);
    if (this.frames.length > 60) this.frames.shift();

    this.lastFrameTime = now;
    return Math.round(fps);
  }

  getAverageFps(): number {
    return this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
  }
}
```

## Data Flow

```
1. User loads component
   ↓
2. MapService initializes projection
   ↓
3. GeoJSON data loads
   ↓
4. Initial render to canvas
   ↓
5. User triggers animation (button click, etc.)
   ↓
6. Animation controller interpolates between states
   ↓
7. Render method called on each frame
   ↓
8. Performance service tracks FPS
```

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Rendering** | Canvas (not SVG) | Better performance for frequent redraws |
| **Projection** | Start with d3.geoMercator() | Most common, well-tested |
| **Animation** | d3.zoom() for MVP | Simpler, built-in smooth transitions |
| **Data Loading** | Static GeoJSON file | Avoid complexity of dynamic loading |

## File Structure

```
src/
├── app/
│   ├── components/
│   │   └── map-container/
│   │       ├── map-container.component.ts
│   │       ├── map-container.component.scss
│   │       └── map-container.component.html
│   │
│   ├── services/
│   │   ├── map.service.ts
│   │   └── performance.service.ts
│   │
│   └── models/
│       └── geo.types.ts  (TypeScript interfaces for GeoJSON)
│
└── assets/
    └── data/
        └── sample.geojson  (Test data)
```

## Implementation Steps

1. **Setup** (Day 1)
   - Create MapContainerComponent
   - Create MapService skeleton
   - Setup canvas element

2. **Basic Rendering** (Day 1-2)
   - Initialize D3 projection
   - Load GeoJSON file
   - Render static map to canvas

3. **Add Animation** (Day 2-3)
   - Implement d3.zoom() behavior
   - Test smooth pan/zoom
   - Verify visual smoothness

4. **Performance Validation** (Day 3-4)
   - Add PerformanceService
   - Display FPS counter
   - Test with various GeoJSON sizes
   - Optimize if <23fps

5. **Polish** (Day 4-5)
   - Add animation presets (zoom to specific regions)
   - Add UI controls
   - Add color.js for map styling

## Success Criteria

- [ ] Map renders with proper projection
- [ ] Smooth animation when changing extents
- [ ] Maintains >23fps during animation
- [ ] Works with GeoJSON data
- [ ] Code is simple enough for cartographers to understand

## What We're NOT Building (Yet)

- ❌ Vector tile support
- ❌ Raster tile support
- ❌ Multiple projections
- ❌ WebGL acceleration
- ❌ Complex caching
- ❌ Data loading optimization

These come AFTER we prove the MVP works.

## Next Steps After MVP

Once the MVP is validated:
1. Test vector tile projection feasibility
2. Add multiple projection support
3. Optimize performance further if needed
4. Add more animation patterns
5. Create documentation/examples
