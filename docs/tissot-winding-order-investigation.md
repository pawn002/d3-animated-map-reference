# Tissot Circle Fill Rendering Investigation

**Date**: 2025-12-22
**Issue**: Opaque rectangle appears when rendering Tissot indicatrix circles with SVG fills
**Status**: RESOLVED

## Problem Description

When rendering Tissot indicatrix circles with fill styling (e.g., `fill: 'coral', fillOpacity: 0.25`), an opaque coral-colored rectangle appeared that covered the entire map, obscuring all country data. Toggling the tissot overlay off would reveal the map again, but an opaque rectangle remained behind the countries.

## Investigation Process

### Test 1: fill-rule Attribute
**Hypothesis**: SVG fill-rule issue causing incorrect fill regions
**Action**: Added `fill-rule="evenodd"` to all SVG paths
**Result**: ❌ Rectangle still appeared
**Conclusion**: Not a fill-rule issue

### Test 2: Single Circle at Origin
**Hypothesis**: Cumulative opacity from overlapping circles
**Action**: Created test with single circle at [0, 0]
**Result**: ✅ Rectangle gone, single circle rendered correctly
**Conclusion**: Issue related to multiple circles or specific circle locations

### Test 3: Dateline-Crossing Circles
**Hypothesis**: Circles crossing ±180° longitude cause fill artifacts
**Action**: Identified and filtered out 21 dateline-crossing circles (141 remaining)
**Result**: ❌ Rectangle reappeared with 141 circles
**Conclusion**: Not caused by dateline-crossing, but by cumulative effect

### Test 4: Reduced Opacity
**Hypothesis**: Lower opacity would reveal if it's visual overlap
**Action**: Reduced fillOpacity from 0.25 to 0.02
**Result**: ⚠️ Rectangle more transparent but still visible, countries now visible
**Conclusion**: Rectangle is an actual rendered shape, not just cumulative opacity

### Test 5: First 10 Circles at -80° Latitude
**Hypothesis**: Specific latitude circles cause the issue
**Action**: Tested with 10 circles at latitude -80°
**Result**: ❌ Rectangle appeared
**Conclusion**: High-latitude circles are problematic

### Test 6: Single Circle at High Latitude (BREAKTHROUGH)
**Hypothesis**: Even single high-latitude circle creates rectangle
**Action**: Rendered single circle at [-100, -80] with increased opacity and stroke
**Result**: 🎯 **Circle appeared as CUTOUT of coral rectangle**
**Conclusion**: **WINDING ORDER ISSUE - circles fill the EXTERIOR instead of interior**

## Root Cause

**Polygon winding order inversion**

The Tissot circle GeoJSON polygons had **clockwise winding order** when SVG requires **counter-clockwise winding order** for interior fills.

### How Winding Order Works in SVG

- **Counter-clockwise (CCW)**: Fills the interior of the polygon ✅ CORRECT
  - Path appears as a filled circle
- **Clockwise (CW)**: Fills the exterior of the polygon ❌ WRONG
  - Path fills the entire viewport EXCEPT the circle (inverted)
  - Appears as a rectangular fill with circular cutout

### Why This Created an Opaque Rectangle

With 141 circles all having inverted winding:
1. Each circle fills the entire map **except** its circular area
2. 141 overlapping "inverted rectangles" compound the opacity
3. Even at low opacity (0.25), 4-10 overlapping inverted fills create 68-94% opacity
4. Result: Solid opaque rectangle covering the entire map

## Solution

**Reverse the coordinate arrays to flip winding order:**

```javascript
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

### Files Created

1. **tissot_1000km_20deg_fixed.json** - 141 circles with corrected winding order
2. **tissot_1000km_20deg_filtered.json** - 141 circles (dateline circles removed, but wrong winding)
3. **tissot_test_single.json** - Single test circle at [0, 0]
4. **tissot_test_10.json** - 10 circles at -80° for testing
5. **tissot_test_first.json** - First problematic circle for diagnosis

## Documentation Added

1. **src/app/components/map-container/sampleData/README.md**
   Comprehensive guide on winding order and how to detect/fix the issue

2. **src/app/components/map-container/map-container.component.ts**
   Comments at lines 83-86 and 210 warning about winding order requirement

3. **scripts/generate-tissot.js**
   - Header documentation explaining the issue
   - `fixWindingOrder()` helper function
   - Instructions on when to use it

4. **src/app/components/map-container/services/map-renderer.service.ts**
   Comments at lines 113-116 explaining winding order effects on SVG fill

5. **docs/tissot-winding-order-investigation.md** (this file)
   Complete investigation summary

## Key Learnings

1. **Turf.js generates clockwise circles**: The @turf/circle function produces CW winding by default
2. **SVG fill-rule doesn't fix winding**: The `fill-rule="evenodd"` attribute doesn't reverse winding direction
3. **Stroke rendering unaffected**: Stroke-only rendering works regardless of winding order
4. **Single circle test is diagnostic**: Testing with one circle reveals if fills are inverted
5. **High-latitude circles most obvious**: Circles near poles show the issue more clearly due to projection distortion

## Verification Steps

To verify Tissot circles have correct winding:

1. Render a single circle with fill: `{ fill: 'coral', fillOpacity: 0.5 }`
2. Expected: Filled circle on transparent map background
3. If wrong: Coral rectangle with circular hole (inverted)

## Final Configuration

**File**: `tissot_1000km_20deg_fixed.json`
**Circles**: 141 (excludes 21 dateline-crossing circles)
**Winding**: Counter-clockwise (corrected)
**Style**: `{ fill: 'coral', stroke: 'none', fillOpacity: 0.25 }`
**Result**: Properly filled circles showing projection distortion ✅

## References

- [SVG fill-rule specification](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/fill-rule)
- [GeoJSON Right-hand Rule (RFC 7946)](https://datatracker.ietf.org/doc/html/rfc7946#section-3.1.6)
- [Tissot's Indicatrix](https://en.wikipedia.org/wiki/Tissot%27s_indicatrix)
- [D3 geoPath documentation](https://github.com/d3/d3-geo#geoPath)
