# Sample GeoJSON Data

This directory contains sample GeoJSON data used for map visualization and testing.

## Files

### world.json
Standard world country boundaries GeoJSON data.

### Tissot Indicatrix Data Files

Tissot indicatrix circles are used to visualize map projection distortion. These files contain circles of equal radius placed on a regular grid across the globe.

#### tissot_1000km_20deg.json
- **Description**: 162 circles with 1000km radius, spaced 20° apart
- **Grid**: 18 longitude points × 9 latitude points (-80° to +80°)
- **Issue**: Contains 21 circles that cross the international dateline, which can cause rendering artifacts

#### tissot_1000km_20deg_filtered.json
- **Description**: 141 circles with dateline-crossing circles removed
- **Grid**: Same as above, but excludes circles at ±180° longitude and extreme latitudes
- **Issue**: Still has incorrect winding order (see below)

#### tissot_1000km_20deg_fixed.json ⭐ **USE THIS ONE**
- **Description**: 141 circles with correct winding order for SVG fill rendering
- **Grid**: Same as filtered version
- **Status**: Ready for use with fill rendering

## CRITICAL: Polygon Winding Order for SVG Fills

### The Problem

When rendering GeoJSON polygons as SVG paths with **fill** (not just stroke), the **coordinate winding order** determines what gets filled:

- **Counter-clockwise** (CCW): Fills the interior of the polygon ✅ CORRECT
- **Clockwise** (CW): Fills the EXTERIOR of the polygon ❌ WRONG

If the winding order is reversed, SVG will fill the entire viewport EXCEPT the circle, creating a rectangular fill with a circular cutout.

### Why This Matters for Tissot Circles

With 141+ overlapping circles all having inverted fills:
- Each circle fills the entire map except its area
- 141 overlapping "inverted rectangles" create an opaque solid fill
- The underlying map becomes completely obscured

### How to Fix Winding Order

If you generate new Tissot circle data and encounter the "opaque rectangle" issue:

```javascript
// Reverse the coordinate array to flip winding order
const fixedFeatures = features.map(feature => ({
  ...feature,
  geometry: {
    ...feature.geometry,
    coordinates: feature.geometry.coordinates.map(ring => {
      return [...ring].reverse();
    })
  }
}));
```

### How to Detect the Issue

1. Render a single circle with fill (e.g., `fill: 'coral', fillOpacity: 0.5`)
2. If you see the **map area filled EXCEPT the circle**, winding order is inverted
3. If you see the **circle filled normally**, winding order is correct

### Stroke-Only Rendering

Note: This issue does NOT affect stroke-only rendering (`fill: 'none', stroke: 'coral'`). Strokes render correctly regardless of winding order.

## Dateline Crossing Issues

Circles centered near ±180° longitude can cross the international dateline. When rendered:
- Coordinates may jump from -180° to +178° (or vice versa)
- D3's geoPath can create unexpected fill regions
- Recommendation: Filter out circles at extreme longitudes (±160° to ±180°)

## References

- [SVG fill-rule specification](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/fill-rule)
- [GeoJSON Right-hand Rule (RFC 7946)](https://datatracker.ietf.org/doc/html/rfc7946#section-3.1.6)
- [Tissot's Indicatrix](https://en.wikipedia.org/wiki/Tissot%27s_indicatrix)
