# Contributing Guide

This document provides guidelines for contributing to the D3 Animated Map reference implementation.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Animation Guidelines](#animation-guidelines)
- [Pull Request Process](#pull-request-process)

---

## Development Setup

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd d3-animated-map-reference

# Install dependencies
npm install
```

### Development Server

```bash
npm start
# or
ng serve
```

Navigate to `http://localhost:4200/`. The application will auto-reload on file changes.

### Storybook

```bash
npm run storybook
```

Launches the component documentation at `http://localhost:6006/`.

### Building

```bash
npm run build
```

Production artifacts are written to `dist/`.

---

## Project Structure

```
src/app/
├── components/
│   └── map-container/           # Main map component
│       ├── services/            # Animation, rendering, zoom services
│       ├── models/              # TypeScript interfaces
│       └── sampleData/          # Test GeoJSON files
├── data/                        # Production GeoJSON data
├── app.ts                       # Root component
└── stories/                     # Storybook stories

docs/                            # Documentation
├── ANIMATION.md                 # Animation system deep-dive
├── ARCHITECTURE.md              # Architecture overview
└── CONTRIBUTING.md              # This file
```

---

## Development Workflow

### Adding a New Feature

1. **Understand the architecture**: Read [ARCHITECTURE.md](./ARCHITECTURE.md)
2. **Plan your changes**: Identify which services/components need modification
3. **Write the code**: Follow existing patterns
4. **Test manually**: Verify in browser and Storybook
5. **Run tests**: `npm test`
6. **Submit PR**: Follow the PR process below

### Modifying Animation Behavior

1. **Read the animation docs**: [ANIMATION.md](./ANIMATION.md)
2. **Locate the right service**:
   - User interaction smoothing → `GeoZoomService`
   - Programmatic sequences → `AnimationControllerService`
   - Render performance → `MapRendererService`
3. **Maintain the RAF pattern**: Always use requestAnimationFrame
4. **Preserve observable contracts**: Services emit events, components subscribe

---

## Code Style

### TypeScript

- Use strict TypeScript (`strict: true` in tsconfig)
- Prefer interfaces over type aliases for object shapes
- Use explicit return types on public methods
- Document complex logic with comments

```typescript
// Good
interface MapExtent {
  center: [number, number];
  scale: number;
}

public animateTo(
  center: [number, number],
  scale: number,
  duration: number
): void {
  // Implementation
}

// Avoid
type Extent = { center: any; scale: any };

animateTo(center, scale, duration) {
  // No types, no visibility
}
```

### Angular Patterns

- Use standalone components (Angular 21 style)
- Use signals for reactive state in components
- Use RxJS Subjects for service-to-component communication
- Use `takeUntilDestroyed` for subscription cleanup

```typescript
// Component with signals
protected readonly fps = signal(0);
protected readonly isPlaying = signal(false);

// Service subscription with cleanup
this.geoZoom.onProjectionChange
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe(() => this.render());
```

### D3 Patterns

- Use D3 for projections and path generation only
- Avoid D3 transitions for animation (use RAF instead)
- Use D3 selections for SVG manipulation
- Let D3 handle geographic calculations

```typescript
// Good: D3 for geo, custom RAF for animation
const path = d3.geoPath().projection(this.projection);
svg.selectAll('path').attr('d', path);

// Avoid: D3 transitions for map animation
svg.selectAll('path')
  .transition()
  .duration(1000)  // Don't do this for projection changes
  .attr('d', path);
```

---

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Test Guidelines

- Write unit tests for services
- Test animation math (lerp, physics) in isolation
- Mock `requestAnimationFrame` for deterministic tests
- Test component rendering with Storybook stories

```typescript
// Example: Testing lerp function
describe('lerp', () => {
  it('should interpolate values correctly', () => {
    const lerp = (current: number, target: number, factor: number) =>
      current + (target - current) * factor;

    expect(lerp(0, 100, 0.5)).toBe(50);
    expect(lerp(0, 100, 0.1)).toBe(10);
    expect(lerp(50, 100, 0.5)).toBe(75);
  });
});
```

---

## Animation Guidelines

### Performance Targets

- **Minimum**: 23 fps during animations
- **Target**: 60 fps on modern hardware
- **Measurement**: Use built-in FPS monitor

### RAF Best Practices

1. **Single loop**: Share one RAF loop for related animations
2. **Auto-stop**: Exit loop when animation settles
3. **Threshold checks**: Avoid sub-pixel updates
4. **Cleanup**: Cancel RAF on component destroy

```typescript
// Good: Auto-stopping loop
const animate = () => {
  // ... update logic ...

  if (needsMoreAnimation) {
    this.animationId = requestAnimationFrame(animate);
  } else {
    this.animationId = undefined;  // Allow garbage collection
  }
};

// Good: Cleanup on destroy
destroy(): void {
  if (this.animationId) {
    cancelAnimationFrame(this.animationId);
  }
}
```

### Smoothing Values

Default smoothing factors are tuned for balance between responsiveness and smoothness:

| Factor | Value | Purpose |
|--------|-------|---------|
| `smoothingBase` | 0.15 | Rotation lerp factor |
| `scaleSmoothingBase` | 0.18 | Scale lerp factor |
| `scaleVelocity decay` | 0.75 | Friction for zoom inertia |
| `panScaleAlpha` | 1 | Zoom-dependent pan reduction |

When modifying:
- Higher values = snappier, less smooth
- Lower values = smoother, more lag
- Test at various zoom levels

---

## Pull Request Process

### Before Submitting

1. **Run linting**: `npm run lint`
2. **Run tests**: `npm test`
3. **Test manually**: Check all animation paths
4. **Update docs**: If changing behavior

### PR Description

Include:
- **What**: Brief description of changes
- **Why**: Motivation or issue being fixed
- **How**: Technical approach taken
- **Testing**: How you verified the changes

### Review Criteria

PRs are evaluated on:
- Code quality and consistency
- Animation performance (>23 fps maintained)
- Compatibility with existing features
- Documentation updates

---

## Common Tasks

### Adding a New Projection

```typescript
// In map-container.component.ts
private initializeProjection(): void {
  this.projection = d3.geoOrthographic()  // Change projection type
    .scale(this.width / 4)
    .translate([this.width / 2, this.height / 2])
    .clipAngle(90);  // May need for globe projections
}
```

### Adding a New Animation Sequence

```typescript
// In app.ts
playMySequence(): void {
  const sequence: AnimationSequence = {
    steps: [
      { extent: { center: [lng, lat], scale: zoom }, duration: ms, label: 'Name' },
      // ... more steps
    ],
    loop: false,
  };
  this.mapComponent?.playAnimation(sequence);
}
```

### Adjusting Animation Feel

```typescript
// In geo-zoom.service.ts
// Make panning snappier
private smoothingBase = 0.25;  // Was 0.15

// Make zooming feel heavier
private scaleSmoothingBase = 0.12;  // Was 0.18
this.scaleVelocity *= 0.6;  // Was 0.75 (more friction)
```

### Adding a Data Layer

```typescript
// In app.ts - add new signal
protected readonly overlayData = signal<FeatureCollection>(myGeoJson);

// In template - pass to component
<app-map-container [overlayData]="overlayData()" />

// In component - render in subscription
this.geoZoom.onProjectionChange.subscribe(() => {
  this.renderBaseMap();
  this.renderOverlay();  // New layer
});
```

---

## Resources

- [D3 Documentation](https://d3js.org/)
- [D3 Geo Projections](https://d3js.org/d3-geo)
- [Angular Documentation](https://angular.dev/)
- [GeoJSON Specification](https://geojson.org/)
- [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame)

---

## Questions?

If you have questions about contributing:
1. Check existing documentation
2. Look at similar code in the project
3. Open an issue for discussion
