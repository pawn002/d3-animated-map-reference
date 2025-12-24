# Projection Tweening Feasibility Study

> Addressing [Issue #20](https://github.com/pawn002/d3-animated-map-reference/issues/20): Is it feasible to tween between projections?

## Summary

**Yes, it is feasible to tween between different map projections in D3.js.** This technique has been demonstrated in several official D3 examples and is well-documented. The approach involves interpolating projected coordinates between source and target projections.

## How Projection Tweening Works

### Core Concept

The technique creates a **custom projection function** that blends two projections based on an interpolation parameter `t` (ranging from 0 to 1):

```javascript
function projectionTween(projection0, projection1) {
  return function(t) {
    // Create interpolated projection
    function project(λ, φ) {
      const p0 = projection0([λ, φ]);  // Source projection
      const p1 = projection1([λ, φ]);  // Target projection

      // Linear interpolation between projected points
      return [
        (1 - t) * p0[0] + t * p1[0],
        (1 - t) * p0[1] + t * p1[1]
      ];
    }

    return d3.geoProjection(project)
      .scale(1)
      .translate([width / 2, height / 2]);
  };
}
```

### Animation Loop

Using `requestAnimationFrame` (as this project already does for pan/zoom):

```javascript
function animateProjectionChange(fromProjection, toProjection, duration) {
  const startTime = performance.now();

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const t = Math.min(elapsed / duration, 1);
    const easedT = d3.easeCubicInOut(t);  // Apply easing

    // Create blended projection
    const blendedProjection = createBlendedProjection(
      fromProjection,
      toProjection,
      easedT
    );

    // Update path generator and re-render
    pathGenerator.projection(blendedProjection);
    render();

    if (t < 1) {
      requestAnimationFrame(animate);
    }
  }

  requestAnimationFrame(animate);
}
```

## Key Considerations

### 1. Viewport Compatibility

Projection tweening works best when **both projections are well-defined over the viewport**. Some considerations:

| Scenario | Difficulty | Notes |
|----------|------------|-------|
| Equirectangular ↔ Mercator | Easy | Both cover the full world similarly |
| Mercator ↔ Orthographic | Moderate | Orthographic shows only hemisphere |
| Any ↔ Interrupted projections | Complex | Discontinuities need special handling |

### 2. Antimeridian Cutting

Projections that handle the antimeridian (±180° longitude) differently may produce visual artifacts during transition. Both projections should ideally support consistent antimeridian cutting.

### 3. Performance

Each frame requires:
- Evaluating **both** projections for every point
- Interpolating coordinates
- Re-rendering all paths

For complex geometries, consider:
- Using simplified GeoJSON during transition
- Canvas rendering for better performance
- Throttling frame rate if needed

### 4. Projection Center Alignment

When tweening between projections with different centers or rotations, you may also need to interpolate:
- `projection.center()`
- `projection.rotate()`
- `projection.scale()`

## Integration with This Project

This project's RAF-based animation architecture is **well-suited** for projection tweening:

### Current Architecture (from `geo-zoom.service.ts`)

```
User Action → Update Target State → RAF Loop → Lerp → Render
```

### Proposed Extension for Projection Tweening

```
Projection Change Request →
  Store source & target projections →
  RAF Loop interpolates between projections →
  Create blended projection each frame →
  Render with blended projection
```

### Implementation Approach

1. **Extend `AnimationSequence`** to include optional projection changes:

```typescript
interface AnimationStep {
  extent: GeographicExtent;
  duration: number;
  label?: string;
  projection?: ProjectionType;  // NEW: optional projection change
}

type ProjectionType = 'equirectangular' | 'mercator' | 'orthographic' | 'albers';
```

2. **Add projection interpolation to `geo-zoom.service.ts`**:

```typescript
private interpolateProjection(
  source: GeoProjection,
  target: GeoProjection,
  t: number
): GeoProjection {
  // Create custom projection that blends source and target
}
```

3. **Update render pipeline** to use the blended projection during transitions.

## Official D3 Examples

- [Projection Transitions](https://observablehq.com/@d3/projection-transitions) - Observable notebook showing smooth transitions between 40+ projections
- [Mike Bostock's Projection Transitions Gist](https://gist.github.com/mbostock/3711652) - Original implementation using `attrTween`
- [D3 Map Projections Morphing](https://gist.github.com/mortenjohs/4742558) - Another morphing implementation

## Complexity Assessment

| Aspect | Complexity | Reason |
|--------|------------|--------|
| Basic implementation | Moderate | Coordinate interpolation is straightforward |
| Edge cases (poles, antimeridian) | High | Require special handling |
| Performance optimization | Moderate | May need Canvas rendering for complex data |
| Integration with current architecture | Low | RAF-based animation already in place |

## Recommendations

1. **Start with similar projections**: Begin with Equirectangular ↔ Mercator or similar cylindrical projections
2. **Use easing functions**: Apply easing (e.g., `d3.easeCubicInOut`) for smoother visual transitions
3. **Consider Canvas mode**: For complex GeoJSON, switch to Canvas rendering during projection transitions
4. **Test with simplified data**: Use low-resolution world outlines during development

## Conclusion

Projection tweening is **feasible and well-documented** in the D3 ecosystem. The main implementation work involves:

1. Creating a blended projection function
2. Integrating it into the existing RAF animation loop
3. Handling edge cases for specific projection pairs

The current project architecture with its RAF-based animation system provides a solid foundation for implementing this feature.

## References

- [D3 Projections Documentation](https://d3js.org/d3-geo/projection)
- [d3-geo GitHub Repository](https://github.com/d3/d3-geo)
- [d3-geo-projection Extended Projections](https://github.com/d3/d3-geo-projection)
