# Vector Tiles and D3: Analysis for This Project

> This document addresses [Issue #6](https://github.com/pawn002/d3-animated-map-reference/issues/6): "Unclear how to use vector map tiles with current implementation"

## Executive Summary

**Yes, using vector tiles with D3 is technically possible, but it conflicts with this project's core architecture.** Vector tiles are built for Web Mercator projection, while this reference implementation uses custom projections (Equirectangular) with smooth RAF-based animations. The trade-off is not worth it for this use case.

**Recommendation:** Keep the current GeoJSON + D3 projection approach. Consider vector tiles only if adding a Mercator-based slippy map base layer is needed.

---

## Why Vector Tiles Are Problematic Here

### 1. Projection Lock-in

Vector tiles use the OSM "XYZ" tiling scheme, which is only defined for Web Mercator (EPSG:3857). This project uses an Equirectangular projection with custom rotation and scale manipulation for smooth animations.

From [d3-plugins issue #37](https://github.com/d3/d3-plugins/issues/37):
> "Virtually all tiled sources use the OSM 'XYZ' tiling scheme, which is only defined for Spherical Mercator and, for each other projection, is a big question mark."

### 2. Pre-simplified Geometry

For efficiency, vector tiles are simplified *to the Mercator projection*, not the underlying geometry. This means:

- Reprojecting tile geometry to non-Mercator projections causes visual artifacts
- Line segments that were straight in Mercator become curved in other projections
- Adding interpolation points impacts rendering performance
- Too few points = jagged lines; too many = slow rendering

### 3. Animation Conflicts

This project uses `requestAnimationFrame` for smooth projection animations (see `geo-zoom.service.ts`). Tile-based maps introduce:

- Network latency during zoom/pan
- Tile loading delays that interrupt smooth animations
- Complex tile management for visibility during transitions

---

## If You Still Want Vector Tiles

Three approaches exist:

### Approach 1: Pure D3 + `d3-tile` (Mercator only)

```
Tiles → Parse with @mapbox/vector-tile-js → Convert to GeoJSON → Render with D3
```

**Libraries needed:**
- [`d3-tile`](https://github.com/d3/d3-tile) - Computes which tiles to fetch for current viewport
- [`@mapbox/vector-tile-js`](https://github.com/mapbox/vector-tile-js) - Parses MVT protobuf format
- Tile source (CARTO, Mapbox, Mapzen/Nextzen)

**Example resources:**
- [nextzen/d3-vector-tiles](https://github.com/nextzen/d3-vector-tiles) - Adapting d3.geo.tile to show vector tiles
- [Observable: Mapbox Vector Tiles / D3](https://observablehq.com/@d3/mapbox-vector-tiles)

**Trade-off:** Locks you to Web Mercator projection. The current Equirectangular projection and custom zoom/pan animations would need a complete redesign.

### Approach 2: Hybrid (Mapbox GL + D3 overlay)

Use Mapbox GL JS for efficient tile rendering, D3 for data visualization overlays:

```typescript
// D3 SVG layer synced to Mapbox camera
const container = map.getCanvasContainer();
const svg = d3.select(container).append('svg');

function update() {
  svg.selectAll('path')
    .attr('d', d => {
      const projected = d.geometry.coordinates.map(coord =>
        map.project(coord)
      );
      return pathGenerator(projected);
    });
}

map.on('move', update);
map.on('viewreset', update);
```

**Trade-off:** Loses projection flexibility; adds Mapbox dependency and licensing considerations.

### Approach 3: Keep Current Architecture (Recommended)

Optimize the existing GeoJSON approach instead:

| Optimization | Implementation |
|--------------|----------------|
| **TopoJSON** | Smaller files, topology preservation. Convert with `topojson-client` |
| **Viewport culling** | Only render features visible in current extent |
| **Canvas rendering** | Switch from SVG to Canvas for many features (already stubbed in `map-renderer.service.ts`) |
| **Pre-simplified geometry** | Create multiple resolution versions for different zoom levels |
| **WebWorker processing** | Offload GeoJSON parsing to background thread |

---

## Comparison Table

| Feature | Current (GeoJSON) | Vector Tiles |
|---------|-------------------|--------------|
| Custom projections | ✅ Full support | ❌ Mercator only |
| Smooth animations | ✅ Works great | ⚠️ Tile loading delays |
| Offline support | ✅ Bundle data | ❌ Requires network |
| High zoom detail | ⚠️ Fixed resolution | ✅ Level-of-detail |
| Data control | ✅ Full | ⚠️ Provider-dependent |
| Implementation complexity | ✅ Simple | ⚠️ Tile management overhead |

---

## Conclusion

The current architecture is the **correct choice** for this reference implementation. Vector tiles solve a different problem:

- **Vector tiles excel at:** Efficient slippy maps with many features at high zoom levels
- **D3 + GeoJSON excels at:** Animated, projection-flexible geographic visualizations

This project demonstrates D3's geographic animation capabilities, which require projection flexibility that vector tiles cannot provide.

---

## References

- [nextzen/d3-vector-tiles](https://github.com/nextzen/d3-vector-tiles) - D3 + vector tile example
- [d3-tile](https://github.com/d3/d3-tile) - Tile coordinate calculations
- [@mapbox/vector-tile-js](https://github.com/mapbox/vector-tile-js) - MVT parser
- [d3-plugins issue #37](https://github.com/d3/d3-plugins/issues/37) - Discussion on geo.tile and projection decoupling
- [No More Mercator Tiles](http://www.vis4.net/blog/no-more-mercator-tiles/) - Projection challenges explained
- [Mapbox: Reimagining Projections](https://www.mapbox.com/blog/adaptive-projections) - Modern reprojection approaches
