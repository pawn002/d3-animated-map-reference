# Issue #13: Tissot's Indicatrix Overlay Implementation

## Overview

This implementation adds an optional overlay showing Tissot's Indicatrix of distortion to the map component. This mathematical visualization reveals how a map projection distorts distances and angles across the globe.

## Changes Made

### 1. New Service: `tissot-indicatrix.service.ts`

A comprehensive service that:

- **Calculates Tissot's Indicatrix**: Uses numerical differentiation to compute the Jacobian matrix of the projection
- **Analyzes distortion**: Calculates eigenvalues of the metric tensor to determine ellipse dimensions
- **Renders overlays**: Provides SVG and Canvas rendering methods
- **Supports configuration**: Allows customization of grid spacing, circle radius, opacity, and stroke width

Key methods:

- `generateTissotCircles()`: Creates circles based on projection distortion
- `renderTissotSvg()`: Renders to SVG
- `renderTissotCanvas()`: Renders to Canvas (for future use)
- `clearTissotSvg()`: Removes overlay

### 2. Component Enhancement: `map-container.component.ts`

Added:

- **Input properties**:
  - `showTissotIndicatrix: boolean` - Toggle overlay visibility
  - `tissotConfig: Partial<TissotIndicatrixConfig>` - Configuration options
- **Service injection**: Injected `TissotIndicatrixService`
- **Reactive effect**: Monitors `showTissotIndicatrix` and `tissotConfig` inputs
- **Update method**: `updateTissotIndicatrix()` handles rendering/clearing
- **Projection change handling**: Updates overlay when projection changes (zoom/pan)

### 3. Type Definitions: `map.types.ts`

Added `TissotIndicatrixConfig` interface:

```typescript
interface TissotIndicatrixConfig {
  gridSpacing: number;      // degrees between sample points (default: 10)
  circleRadius: number;     // radius in pixels (default: 5)
  fillOpacity: number;      // opacity of circles (default: 0.3)
  strokeWidth: number;      // stroke width in pixels (default: 1)
}
```

### 4. Component Styling: `map-container.component.scss`

Added styles for the Tissot group:

- Non-interactive overlay (`pointer-events: none`)
- Subtle shadow effect for visual depth
- Classes: `.tissot-indicatrix`

### 5. Story Examples: `map-container.stories.ts`

Added two new Storybook stories:

- `WithTissotIndicatrix`: Basic example with default config
- `TissotIndicatrixWithCustomConfig`: Example with custom settings

### 6. Documentation: `README.md`

- Added Tissot's Indicatrix section explaining the concept
- Configuration examples
- Usage patterns
- Implementation details
- Visual characteristics

## How It Works

### Mathematical Foundation

The service uses the Jacobian matrix to analyze local distortion:

1. **Sampling**: Creates a regular grid of points (e.g., every 10 degrees)
2. **Differentiation**: Computes partial derivatives using numerical differentiation
3. **Metric Tensor**: Calculates the Gram matrix from the Jacobian:
   - `a = (∂x/∂λ)² + (∂y/∂λ)²` (east-west scaling)
   - `c = (∂x/∂φ)² + (∂y/∂φ)²` (north-south scaling)
   - `b = (∂x/∂λ)(∂x/∂φ) + (∂y/∂λ)(∂y/∂φ)` (shear)
4. **Eigenvalues**: Solves the metric tensor to get major/minor axes
5. **Rendering**: Draws ellipses whose size and shape show distortion

### Distortion Indicators

- **Circular**: Conformal projection (angle preserved, area not)
- **Elliptical**: Angular distortion and/or area distortion
- **Large circles**: Areas of magnification
- **Small circles**: Areas of reduction
- **Rotated ellipses**: Indicate directional distortion

## Usage Examples

### Basic Usage

```html
<app-map-container [showTissotIndicatrix]="true">
</app-map-container>
```

### With Configuration

```html
<app-map-container 
  [showTissotIndicatrix]="true"
  [tissotConfig]="{
    gridSpacing: 15,
    circleRadius: 6,
    fillOpacity: 0.2,
    strokeWidth: 2
  }">
</app-map-container>
```

### TypeScript Usage

```typescript
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

## Features

✅ **Configurable**: Grid spacing, circle size, opacity, and stroke width  
✅ **Reactive**: Updates when overlay toggle or config changes  
✅ **Projection-aware**: Updates when map is zoomed/panned  
✅ **Non-intrusive**: Doesn't block map interaction  
✅ **Well-documented**: Comprehensive JSDoc comments and README  
✅ **Type-safe**: Full TypeScript support  
✅ **SVG support**: Works with SVG rendering mode  
✅ **Story examples**: Storybook stories for development/testing  

## Future Enhancements

- Canvas rendering implementation
- Customizable circle colors and opacity
- Different distortion visualization modes
- Performance optimization for large grids
- Animation of distortion across projections

## File Summary

| File | Purpose |
| --- | --- |
| `services/tissot-indicatrix.service.ts` | Service for calculating and rendering Tissot's Indicatrix |
| `map-container.component.ts` | Updated component with overlay integration |
| `map.types.ts` | New `TissotIndicatrixConfig` type |
| `map-container.component.scss` | Styles for the overlay |
| `map-container.stories.ts` | Story examples |
| `README.md` | Documentation |

## Testing

The implementation can be tested using the Storybook stories:

- Run `npm run storybook`
- Navigate to "Map/MapContainer"
- Select "WithTissotIndicatrix" or "TissotIndicatrixWithCustomConfig" stories
- Interact with the map to see the overlay update with zoom/pan

## Performance Notes

- Grid points are generated on-demand when overlay is toggled
- Uses efficient SVG data binding with D3
- Minimal re-rendering when not visible
- No impact on map performance when disabled
