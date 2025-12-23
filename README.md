# D3 Animated Map Reference

A reference implementation for creating D3 maps that combine **proper cartographic projection with smooth animations**. Built with Angular and D3.js, this project demonstrates how to achieve >23fps performance while maintaining geographic accuracy.

> **New to D3 animation?** Start with our [Animation System Deep Dive](docs/ANIMATION.md) to understand how this project uses `requestAnimationFrame` instead of D3 transitions for geographic animations.

## Problem Statement

Cartographers often struggle to create D3 maps featuring both proper projection and animations. This reference implementation shows how to build maps that do both effectively.

**Why is this hard?** D3's transition system is designed for animating DOM attributes (positions, colors, transforms), not geographic projection state. This project solves that problem with a custom animation architecture.

## Features

- ✅ **Equirectangular projection** (flat map, easily extensible to other projections)
- ✅ **Smooth animations** with >23fps performance
- ✅ **User interactions**: drag to pan, scroll to zoom
- ✅ **Programmatic animations**: pre-defined sequences between geographic extents
- ✅ **GeoJSON support** with sample data
- ✅ **Modular architecture**: structured for future Canvas rendering
- ✅ **Real-time FPS monitoring**

## Technology Stack

- **Angular 21** - Application framework
- **D3.js** - Geographic visualization and projections
- **TypeScript** - Type-safe development
- **RxJS** - Reactive event handling
- **colorjs.io** - Color management (ready for future use)

## Documentation

| Document | Description |
|----------|-------------|
| [Animation Deep Dive](docs/ANIMATION.md) | How `requestAnimationFrame` works and why we use it instead of D3 transitions |
| [Architecture Overview](docs/ARCHITECTURE.md) | Service layer, data flow, and component hierarchy |
| [Contributing Guide](docs/CONTRIBUTING.md) | Development setup, code style, and PR process |
| [Tissot Investigation](docs/tissot-winding-order-investigation.md) | SVG polygon winding order debugging |

## Architecture

The project is organized into modular components and services:

```
src/app/
├── components/
│   └── map-container/          # Main map component
│       └── services/
│           ├── geo-zoom.service.ts             # RAF animation loop, projection state
│           ├── animation-controller.service.ts # Sequence playback, FPS monitoring
│           └── map-renderer.service.ts         # SVG/Canvas rendering abstraction
├── models/
│   └── map.types.ts            # TypeScript interfaces
└── data/
    ├── world-110m.json         # Simplified world map
    └── cities.json             # Sample city locations
```

See [Architecture Overview](docs/ARCHITECTURE.md) for detailed documentation.

## Quick Start

### Installation

```bash
npm install
```

### Development Server

```bash
npm start
# or
ng serve
```

Navigate to `http://localhost:4200/` to see the application.

### Build

```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

## Usage Examples

### User Interactions

- **Pan**: Click and drag the map
- **Zoom**: Scroll wheel to zoom in/out
- **Reset**: Click "Reset View" to return to initial state

### Programmatic Animations

The reference includes two demo animation sequences:

#### Continent Tour
```typescript
playContinentTour(): void {
  const sequence: AnimationSequence = {
    steps: [
      { extent: { center: [-95, 37], scale: 2.5 }, duration: 1200, label: 'North America' },
      { extent: { center: [-60, -15], scale: 2.5 }, duration: 1200, label: 'South America' },
      // ... more steps
    ],
    loop: false,
  };
  this.mapComponent?.playAnimation(sequence);
}
```

#### World Cities Tour
Animates between major world cities with smooth transitions.

### Creating Custom Animations

```typescript
import { AnimationSequence } from './services/animation-controller.service';

const customSequence: AnimationSequence = {
  steps: [
    {
      extent: { center: [longitude, latitude], scale: zoomLevel },
      duration: milliseconds,
      label: 'Location Name'
    },
    // Add more steps...
  ],
  loop: false // or true for continuous loop
};

mapComponent.playAnimation(customSequence);
```

## How Animation Works

This project uses a **custom `requestAnimationFrame` loop** instead of D3's built-in transitions. Here's why:

### The Problem with D3 Transitions for Maps

```javascript
// D3 transitions animate DOM attributes
d3.select('circle')
  .transition()
  .duration(1000)
  .attr('cx', 200);  // ✅ Works great for this

// But geographic maps need projection state changes
projection.rotate([newLon, newLat, 0]);  // ❌ D3 can't transition this
projection.scale(newScale);
```

### Our Solution: RAF-Based Animation

```javascript
// User drags → update target
targetRotation[0] += dx;

// RAF loop → lerp current toward target
const animate = () => {
  currentRotation[0] += (targetRotation[0] - currentRotation[0]) * 0.15;
  projection.rotate(currentRotation);
  render();  // Re-draw all paths

  if (needsMoreAnimation) {
    requestAnimationFrame(animate);
  }
};
```

**Benefits:**
- **Smooth interactions**: Lerp-based smoothing creates natural motion
- **Physics-based feel**: Velocity and damping for zoom inertia
- **Performance**: Single RAF loop, auto-stops when settled
- **Control**: Full control over projection state interpolation

See [Animation Deep Dive](docs/ANIMATION.md) for complete documentation.

## Performance

The implementation achieves **>23fps** during animations through:

- Custom RAF animation loop (not D3 transitions)
- Lerp-based smoothing with auto-stop
- Efficient D3 projection updates
- Optimized SVG rendering (with Canvas fallback ready)
- Real-time FPS monitoring

## Extending the Project

### Adding New Projections

Edit `map-container.component.ts`:

```typescript
// Replace d3.geoEquirectangular() with another projection
this.projection = d3.geoMercator()  // or geoAlbers, geoOrthographic, etc.
  .scale((this.width / (2 * Math.PI)))
  .translate([this.width / 2, this.height / 2]);
```

### Switching to Canvas Rendering

Change the render mode in `app.ts`:

```typescript
<app-map-container
  [renderMode]="'canvas'"  // Changed from 'svg'
  ...
/>
```

### Adding Your Own GeoJSON Data

1. Place your `.json` file in `src/app/data/`
2. Import and use it in `app.ts`:

```typescript
import myData from './data/my-geojson.json';

protected readonly geoData = signal<FeatureCollection>(
  myData as FeatureCollection
);
```

## Inspiration

This project is inspired by [d3-geo-zoom](https://github.com/vasturiano/d3-geo-zoom) by Vasco Asturiano, adapting its zoom/pan patterns for flat projections and Angular integration.

## Future Roadmap

- [ ] Vector tile support
- [ ] Raster tile support
- [ ] Additional projection examples
- [ ] Performance optimizations for large datasets
- [ ] WebGL rendering option
- [ ] Touch gesture support

## Target Users

- **Cartographers new to code**: Clear examples of D3 map creation
- **Developers new to cartography**: Proper projection handling and geographic concepts

## Success Criteria

- ✅ Reduced production time for animated maps
- ✅ >23fps animation performance
- ✅ Support for proper projections
- ✅ Extensible architecture for various data formats

## License

This project is a reference implementation for educational and development purposes.

## Additional Resources

### Project Documentation
- [Animation Deep Dive](docs/ANIMATION.md) - Understanding RAF-based animation
- [Architecture Overview](docs/ARCHITECTURE.md) - Service layer and data flow
- [Contributing Guide](docs/CONTRIBUTING.md) - Development guidelines

### External Resources
- [D3 Documentation](https://d3js.org/)
- [D3 Geo Projections](https://github.com/d3/d3-geo)
- [Angular Documentation](https://angular.dev/)
- [GeoJSON Specification](https://geojson.org/)
- [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame)
