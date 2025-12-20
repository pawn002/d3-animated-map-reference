# D3 Animated Map Reference

A reference implementation for creating D3 maps that combine **proper cartographic projection with smooth animations**. Built with Angular and D3.js, this project demonstrates how to achieve >23fps performance while maintaining geographic accuracy.

## Problem Statement

Cartographers often struggle to create D3 maps featuring both proper projection and animations. This reference implementation shows how to build maps that do both effectively.

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

## Architecture

The project is organized into modular components and services:

```
src/app/
├── components/
│   └── map-container/          # Main map component
├── services/
│   ├── map-renderer.service.ts         # Rendering abstraction (SVG/Canvas)
│   ├── geo-zoom.service.ts             # Zoom/pan logic (ported from d3-geo-zoom)
│   └── animation-controller.service.ts # Programmatic animations
├── models/
│   └── map.types.ts            # TypeScript interfaces
└── data/
    ├── world-110m.json         # Simplified world map
    └── cities.json             # Sample city locations
```

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

## Performance

The implementation achieves **>23fps** during animations through:

- Efficient D3 projection updates
- Optimized SVG rendering (with Canvas fallback ready)
- RequestAnimationFrame-based animation loops
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

- [D3 Documentation](https://d3js.org/)
- [D3 Geo Projections](https://github.com/d3/d3-geo)
- [Angular Documentation](https://angular.dev/)
- [GeoJSON Specification](https://geojson.org/)
