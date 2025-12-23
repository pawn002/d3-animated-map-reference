# Architecture Overview

This document describes the architectural design of the D3 Animated Map reference implementation. It covers the component hierarchy, service responsibilities, data flow, and key design patterns.

## Table of Contents

- [High-Level Architecture](#high-level-architecture)
- [Component Structure](#component-structure)
- [Service Layer](#service-layer)
- [Data Flow](#data-flow)
- [Type Definitions](#type-definitions)
- [Rendering Pipeline](#rendering-pipeline)
- [Extending the Architecture](#extending-the-architecture)

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Angular Application                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────┐     ┌──────────────────────────────────────────┐ │
│  │     App Component    │     │          MapContainerComponent           │ │
│  │                      │────►│                                          │ │
│  │  - GeoJSON data      │     │  - Initializes projection                │ │
│  │  - Render mode       │     │  - Manages dimensions                    │ │
│  │  - Animation control │     │  - Coordinates services                  │ │
│  └──────────────────────┘     │  - Handles lifecycle                     │ │
│                               └──────────────────────────────────────────┘ │
│                                              │                              │
│                    ┌─────────────────────────┼─────────────────────────┐    │
│                    │                         │                         │    │
│                    ▼                         ▼                         ▼    │
│  ┌─────────────────────────┐ ┌─────────────────────────┐ ┌─────────────────┐│
│  │    GeoZoomService      │ │AnimationControllerService│ │MapRendererService│
│  │                         │ │                         │ │                 ││
│  │ - Projection state      │ │ - Sequence playback     │ │ - SVG rendering ││
│  │ - Pan/zoom handling     │ │ - Step management       │ │ - Canvas ready  ││
│  │ - RAF animation loop    │ │ - FPS monitoring        │ │ - Path generation│
│  │ - Event listeners       │ │ - Observables           │ │ - Layer support ││
│  └─────────────────────────┘ └─────────────────────────┘ └─────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Structure

### App Component (`app.ts`)

The root component that provides:
- **Data management**: Holds GeoJSON data as Angular signals
- **Configuration**: Sets render mode, dimensions, overlays
- **Animation triggers**: Exposes methods to start predefined sequences
- **UI controls**: Buttons, FPS display, Tissot toggle

```typescript
// Key inputs passed to MapContainerComponent
<app-map-container
  [geoData]="geoData()"
  [tissotData]="tissotData()"
  [renderMode]="renderMode()"
  [showTissotOverlay]="showTissotOverlay()"
  (fpsUpdate)="onFpsUpdate($event)"
/>
```

### MapContainerComponent (`map-container.component.ts`)

The core map component responsible for:

| Responsibility | Implementation |
|---------------|----------------|
| **Projection setup** | Creates D3 geoEquirectangular projection |
| **Dimension management** | Handles resize, aspect ratio |
| **Service coordination** | Initializes and connects services |
| **Lifecycle management** | AfterViewInit, OnDestroy hooks |
| **Event subscriptions** | Listens to projection changes |

```typescript
// Lifecycle flow
ngAfterViewInit() {
  this.initializeProjection();
  this.initializeRenderer();
  this.initializeZoom();
  this.subscribeToEvents();
  this.renderInitial();
}
```

---

## Service Layer

### GeoZoomService

**Purpose**: Manages all zoom/pan interactions and projection state animation.

**File**: `services/geo-zoom.service.ts`

```
┌─────────────────────────────────────────────────────────────────┐
│                        GeoZoomService                           │
├─────────────────────────────────────────────────────────────────┤
│ State                                                           │
│ ├── currentScale, targetScale                                   │
│ ├── currentRotation, targetRotation                             │
│ ├── scaleVelocity (physics)                                     │
│ └── initialScale, initialRotation (for reset)                   │
├─────────────────────────────────────────────────────────────────┤
│ Configuration                                                   │
│ ├── scaleExtent [min, max]                                      │
│ ├── smoothingBase (lerp factor)                                 │
│ └── panScaleAlpha (zoom-dependent pan reduction)                │
├─────────────────────────────────────────────────────────────────┤
│ Methods                                                         │
│ ├── init(element, projection, width, height, config)            │
│ ├── setCenter(center, triggerRender)                            │
│ ├── setScale(scale, triggerRender)                              │
│ ├── animateTo(center, scale, duration, callback)                │
│ ├── reset(duration, callback)                                   │
│ ├── getCurrentState()                                           │
│ └── destroy(element)                                            │
├─────────────────────────────────────────────────────────────────┤
│ Events                                                          │
│ └── onProjectionChange: Subject<void>                           │
└─────────────────────────────────────────────────────────────────┘
```

**Key Patterns**:
- **Target/Current separation**: User input updates targets; RAF loop lerps current toward target
- **Single RAF loop**: Handles both pan and zoom in one loop
- **Observable notifications**: Components subscribe to `onProjectionChange`

### AnimationControllerService

**Purpose**: Orchestrates programmatic animation sequences.

**File**: `services/animation-controller.service.ts`

```
┌─────────────────────────────────────────────────────────────────┐
│                  AnimationControllerService                     │
├─────────────────────────────────────────────────────────────────┤
│ State                                                           │
│ ├── currentSequence: AnimationSequence                          │
│ ├── currentStepIndex: number                                    │
│ ├── isPlaying: boolean                                          │
│ └── fps, frameCount, lastFrameTime (FPS tracking)               │
├─────────────────────────────────────────────────────────────────┤
│ Methods                                                         │
│ ├── playSequence(element, sequence)                             │
│ ├── animateToExtent(element, extent, duration, callback)        │
│ ├── animateBetweenExtents(element, from, to, config, callback)  │
│ ├── stop()                                                      │
│ ├── pause()                                                     │
│ ├── resume(element)                                             │
│ └── getCurrentFps()                                             │
├─────────────────────────────────────────────────────────────────┤
│ Events                                                          │
│ ├── onAnimationStart: Subject<void>                             │
│ ├── onAnimationEnd: Subject<void>                               │
│ ├── onStepChange: Subject<{step, total}>                        │
│ └── onFpsUpdate: Subject<number>                                │
└─────────────────────────────────────────────────────────────────┘
```

**Key Patterns**:
- **Step-based execution**: Sequences are arrays of steps executed serially
- **Delegation**: Actual animation delegated to GeoZoomService
- **FPS monitoring**: Separate RAF loop for frame counting

### MapRendererService

**Purpose**: Abstracts rendering to SVG or Canvas.

**File**: `services/map-renderer.service.ts`

```
┌─────────────────────────────────────────────────────────────────┐
│                     MapRendererService                          │
├─────────────────────────────────────────────────────────────────┤
│ Methods                                                         │
│ ├── initSvg(element, width, height) → SVGSelection              │
│ ├── initCanvas(element, width, height) → CanvasContext          │
│ ├── renderGeoJson(context, data, options)                       │
│ │   ├── renderSvg(context, data, options)                       │
│ │   └── renderCanvas(context, data, options)                    │
│ ├── createPathGenerator(projection, context?) → GeoPath         │
│ └── clear(context)                                              │
└─────────────────────────────────────────────────────────────────┘
```

**Key Patterns**:
- **Mode abstraction**: Same API for SVG and Canvas
- **Stateless rendering**: No internal state; receives everything needed
- **Layer support**: Can render multiple data layers with options

---

## Data Flow

### User Interaction Flow

```
User drags mouse
       │
       ▼
┌──────────────────────┐
│  handleMouseMove()   │  GeoZoomService
│  - Calculate dx, dy  │
│  - Update target     │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ startAnimationLoop() │  GeoZoomService
│  - If not running,   │
│    start RAF loop    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   animate() [RAF]    │  GeoZoomService
│  - Lerp rotation     │
│  - Update projection │
│  - Emit change event │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  onProjectionChange  │  RxJS Subject
│    .subscribe()      │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│handleProjectionChange│  MapContainerComponent
│  - Call renderer     │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   renderGeoJson()    │  MapRendererService
│  - Update SVG paths  │
└──────────────────────┘
```

### Programmatic Animation Flow

```
User clicks "Continent Tour"
           │
           ▼
┌──────────────────────┐
│ playContinentTour()  │  App Component
│  - Create sequence   │
│  - Call playAnimation│
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  playSequence()      │  AnimationControllerService
│  - Set sequence      │
│  - Start step 0      │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   executeStep()      │  AnimationControllerService
│  - Get step extent   │
│  - Start FPS monitor │
│  - Call animateToExtent
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   animateTo()        │  GeoZoomService
│  - Time-based interp │
│  - D3 easing         │
│  - RAF loop          │
└──────────┬───────────┘
           │
           ▼ (on each frame)
┌──────────────────────┐
│  onProjectionChange  │  → Component → Renderer
└──────────┬───────────┘
           │
           ▼ (when done)
┌──────────────────────┐
│   callback()         │  AnimationControllerService
│  - Increment step    │
│  - Execute next step │
└──────────────────────┘
```

---

## Type Definitions

Located in `models/map.types.ts`:

```typescript
// Rendering configuration
type RenderMode = 'svg' | 'canvas';

interface MapConfig {
  projection: GeoProjection;
  width: number;
  height: number;
  renderMode: RenderMode;
}

// Geographic bounds
interface GeoBounds {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

// Animation target (center + zoom)
interface MapExtent {
  center: [number, number];  // [longitude, latitude]
  scale: number;             // Multiplier from initial scale
}

// Animation timing configuration
interface AnimationConfig {
  duration: number;
  easing?: (t: number) => number;
}

// Zoom behavior configuration
interface ZoomConfig {
  scaleExtent: [number, number];  // [minZoom, maxZoom]
  translateExtent?: [[number, number], [number, number]];
}

// Data source abstraction
interface MapData {
  type: 'geojson' | 'vector-tile' | 'raster-tile';
  data: FeatureCollection;
}

// Zoom event payload
interface ZoomEvent {
  scale: number;
  translate: [number, number];
  center: [number, number];
}
```

### Animation Types (in AnimationControllerService)

```typescript
interface AnimationStep {
  extent: MapExtent;
  duration: number;
  label?: string;
}

interface AnimationSequence {
  steps: AnimationStep[];
  loop?: boolean;
}
```

---

## Rendering Pipeline

### SVG Rendering

```
┌─────────────────────────────────────────────────────────────────┐
│                     SVG Rendering Pipeline                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Projection Update                                           │
│     projection.rotate([lon, lat, 0])                            │
│     projection.scale(scale)                                     │
│                                                                 │
│  2. Path Generator Creation                                     │
│     const path = d3.geoPath().projection(projection)            │
│                                                                 │
│  3. SVG Selection                                               │
│     svg.selectAll('path.feature')                               │
│        .data(geojson.features)                                  │
│                                                                 │
│  4. Path Update                                                 │
│     .join('path')                                               │
│     .attr('d', path)  ← D3 computes path string from projection │
│     .attr('class', 'feature')                                   │
│     .attr('fill', ...)                                          │
│     .attr('stroke', ...)                                        │
│                                                                 │
│  5. Browser Renders SVG                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Canvas Rendering (Ready, Not Default)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Canvas Rendering Pipeline                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Clear Canvas                                                │
│     context.clearRect(0, 0, width, height)                      │
│                                                                 │
│  2. Path Generator with Context                                 │
│     const path = d3.geoPath()                                   │
│                    .projection(projection)                      │
│                    .context(context)  ← Draws to canvas!        │
│                                                                 │
│  3. Iterate Features                                            │
│     for (const feature of geojson.features) {                   │
│       context.beginPath()                                       │
│       path(feature)  ← Draws path commands to canvas context    │
│       context.fill()                                            │
│       context.stroke()                                          │
│     }                                                           │
│                                                                 │
│  4. Browser Composites Canvas                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Extending the Architecture

### Adding a New Projection

1. **Modify MapContainerComponent initialization**:

```typescript
// In initializeProjection()
this.projection = d3.geoOrthographic()  // Or geoMercator, geoAlbers, etc.
  .scale(this.width / 4)
  .translate([this.width / 2, this.height / 2])
  .clipAngle(90);  // For globe projections
```

2. **Adjust GeoZoomService if needed**:
   - Some projections use `.center()` instead of `.rotate()`
   - Globe projections may need different smoothing factors

### Adding a New Data Layer

1. **Pass additional data to component**:

```typescript
// In App component
<app-map-container
  [geoData]="baseMap()"
  [overlayData]="myNewLayer()"
/>
```

2. **Render in component**:

```typescript
// In MapContainerComponent
private renderOverlay(): void {
  if (this.overlayData) {
    this.mapRenderer.renderGeoJson(
      this.renderContext,
      this.overlayData,
      { fill: 'rgba(255, 0, 0, 0.3)', stroke: '#ff0000' }
    );
  }
}
```

### Adding Custom Animation Sequences

```typescript
// In App component
playMyCustomTour(): void {
  const sequence: AnimationSequence = {
    steps: [
      { extent: { center: [-122.4, 37.8], scale: 8 }, duration: 2000, label: 'San Francisco' },
      { extent: { center: [-73.9, 40.7], scale: 8 }, duration: 2000, label: 'New York' },
      { extent: { center: [-0.1, 51.5], scale: 8 }, duration: 2000, label: 'London' },
    ],
    loop: true,
  };

  this.mapComponent?.playAnimation(sequence);
}
```

### Adding Touch Gestures

The GeoZoomService already includes basic touch support:
- Single-finger drag for panning
- (Pinch-to-zoom could be added by tracking two touch points)

```typescript
// Example: Adding pinch-to-zoom
private handleTouchMove(event: TouchEvent): void {
  if (event.touches.length === 2) {
    // Calculate pinch distance
    const touch1 = event.touches[0];
    const touch2 = event.touches[1];
    const distance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );

    if (this.lastPinchDistance) {
      const scale = distance / this.lastPinchDistance;
      this.targetScale *= scale;
      this.startAnimationLoop();
    }

    this.lastPinchDistance = distance;
  }
}
```

---

## Directory Reference

```
src/app/
├── components/
│   └── map-container/
│       ├── map-container.component.ts    # Main component (320 lines)
│       ├── map-container.component.html  # Template
│       ├── map-container.component.scss  # Styles
│       ├── services/
│       │   ├── animation-controller.service.ts  # Sequence orchestration
│       │   ├── geo-zoom.service.ts              # Core animation engine
│       │   └── map-renderer.service.ts          # SVG/Canvas rendering
│       ├── models/
│       │   └── map.types.ts              # TypeScript interfaces
│       └── sampleData/
│           ├── world.json                # World boundaries
│           └── tissot_*.json             # Tissot indicatrix data
├── data/
│   ├── world-110m.json                   # Simplified world map
│   └── cities.json                       # City locations
├── app.ts                                # Root component
├── app.html                              # Root template
├── app.scss                              # Global styles
├── app.config.ts                         # Angular configuration
└── app.routes.ts                         # Routing (minimal)
```

---

## Summary

The architecture follows these principles:

1. **Separation of concerns**: Components handle lifecycle, services handle logic
2. **Observable-driven updates**: Services emit events, components react
3. **Stateless rendering**: Renderer receives all context, maintains no state
4. **Target/Current pattern**: User input updates targets, animation converges
5. **Extensibility**: Clear patterns for adding projections, layers, sequences

See [ANIMATION.md](./ANIMATION.md) for detailed animation system documentation.
