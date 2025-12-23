# Raster Tiles Feasibility Study

*Research conducted: December 2025*
*Related issue: [#5 - Unclear how to use raster map tiles with current implementation](https://github.com/pawn002/d3-animated-map-reference/issues/5)*

---

## Executive Summary

**Question:** Can raster map tiles be used with the current D3 animated map implementation?

**Answer:** Yes, but with important trade-offs.

Raster tiles (e.g., OpenStreetMap, Mapbox) are designed for Web Mercator projection. The current implementation uses Equirectangular projection for cartographic accuracy. Integrating raster tiles requires choosing between:

1. **Switch to Web Mercator** - Simple integration, but loses projection flexibility
2. **Reproject tiles on-the-fly** - Maintains projection, but CPU-intensive (may break 23fps target)
3. **Hybrid approach** - Optional Mercator mode alongside current GeoJSON rendering

**Recommendation:** Implement Web Mercator as an optional alternate rendering mode, allowing users to choose between projection-correct GeoJSON maps or standard slippy map tiles.

**Estimated effort:** 3-5 days for basic implementation

---

## Table of Contents

- [Background](#background)
- [Current Architecture](#current-architecture)
- [Technical Approaches](#technical-approaches)
- [Recommendation](#recommendation)
- [Implementation Outline](#implementation-outline)
- [References](#references)

---

## Background

### What Are Raster Tiles?

Raster tiles are pre-rendered image files (typically 256x256 pixels) organized in a pyramid structure by zoom level. They follow the "slippy map" convention used by OpenStreetMap, Google Maps, and similar services.

Tile URL format: `https://tile.example.com/{z}/{x}/{y}.png`

- `z` = zoom level (0-20+)
- `x` = horizontal tile index
- `y` = vertical tile index

### The Projection Problem

Standard web map tiles use **Web Mercator** (EPSG:3857) projection. This project uses **Equirectangular** projection for its cartographic properties. These are fundamentally different:

| Aspect | Equirectangular | Web Mercator |
|--------|-----------------|--------------|
| Poles | Fully represented | Cut off at ~85° |
| Distortion | Uniform latitude stretching | Extreme polar distortion |
| Use case | Thematic maps, data viz | Navigation, slippy maps |
| Tile availability | Rare | Ubiquitous |

This mismatch is why the project brief flagged raster tiles as a risk/unknown.

---

## Current Architecture

The codebase is well-prepared for extensibility:

### Already Implemented

| Component | Status | Location |
|-----------|--------|----------|
| `MapData` type with `'raster-tile'` | Defined | `models/map.types.ts:35-38` |
| Canvas rendering | Working | `map-renderer.service.ts` |
| Layer system | Working | SVG classes, Canvas layering |
| Single RAF animation loop | Working | `geo-zoom.service.ts` |

### Current Type Definition

```typescript
// From models/map.types.ts
export interface MapData {
  type: 'geojson' | 'vector-tile' | 'raster-tile';
  data: FeatureCollection;
}
```

The `'raster-tile'` type exists but is not yet implemented.

### Projection Setup

```typescript
// Current projection in map-container.component.ts
this.projection = d3
  .geoEquirectangular()
  .scale(this.width() / (2 * Math.PI))
  .translate([this.width() / 2, this.height() / 2]);
```

---

## Technical Approaches

### Approach 1: Web Mercator Mode

**Complexity:** Low | **Performance:** High | **Effort:** 2-3 days

Replace the projection with `geoMercator` and use the `d3-tile` library to load standard tiles.

#### How It Works

1. Install `d3-tile` package
2. Configure tile layout based on viewport and zoom
3. Compute visible tiles on each projection change
4. Load tile images asynchronously
5. Render tiles to Canvas before vector overlays

#### Code Example

```typescript
import * as d3 from 'd3';
import { tile as d3Tile } from 'd3-tile';

// Configure tile generator
const tile = d3Tile()
  .size([width, height])
  .scale(projection.scale() * 2 * Math.PI)
  .translate(projection.translate());

// Get visible tiles
const tiles = tile();

// Render each tile
for (const [x, y, z] of tiles) {
  const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  // Load and draw image...
}
```

#### Pros

- Well-documented approach with Observable examples
- Standard tile sources (OSM, Mapbox, Stamen, etc.)
- Hardware-accelerated Canvas rendering
- Works seamlessly with `d3-zoom`

#### Cons

- **Requires `geoMercator` projection** - incompatible with current setup
- No polar coverage (±85° latitude limit)
- Loses cartographic projection flexibility
- Changes the project's core value proposition

---

### Approach 2: Raster Reprojection

**Complexity:** High | **Performance:** Low-Medium | **Effort:** 5-10 days

Load Web Mercator tiles and reproject them pixel-by-pixel to Equirectangular (or any projection).

#### How It Works

1. Load tile images into an off-screen Canvas
2. For each pixel in the target viewport:
   - Use `projection.invert([x, y])` to get lon/lat
   - Convert lon/lat to source tile pixel coordinates
   - Copy pixel color from source to target
3. Repeat on every frame during animation

#### Code Pattern

```typescript
const sourceData = sourceCtx.getImageData(0, 0, srcWidth, srcHeight);
const targetData = targetCtx.createImageData(width, height);

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const [lon, lat] = projection.invert([x, y]);
    if (lon == null) continue; // Outside projection bounds

    // Map to source pixel
    const srcX = ((lon + 180) / 360) * srcWidth;
    const srcY = ((90 - lat) / 180) * srcHeight;

    // Copy pixel data
    const srcIdx = (Math.floor(srcY) * srcWidth + Math.floor(srcX)) * 4;
    const tgtIdx = (y * width + x) * 4;

    targetData.data[tgtIdx] = sourceData.data[srcIdx];
    targetData.data[tgtIdx + 1] = sourceData.data[srcIdx + 1];
    targetData.data[tgtIdx + 2] = sourceData.data[srcIdx + 2];
    targetData.data[tgtIdx + 3] = sourceData.data[srcIdx + 3];
  }
}

targetCtx.putImageData(targetData, 0, 0);
```

#### Pros

- Maintains current Equirectangular projection
- Works with any invertible D3 projection
- True cartographic flexibility

#### Cons

- **CPU-intensive**: O(width × height) operations per frame
- Likely to drop below 23fps target during animation
- Complex tile management (multiple source tiles per view)
- May require WebGL for acceptable performance
- Significant implementation complexity

#### Performance Mitigation Options

- Use WebGL shaders for parallel pixel processing
- Cache reprojected tiles at common zoom levels
- Reduce reprojection during active animation, update on idle
- Use Web Workers for off-main-thread processing

---

### Approach 3: Hybrid Mode

**Complexity:** Medium | **Performance:** Good | **Effort:** 3-4 days

Offer two distinct rendering modes that users can switch between.

#### Configuration

```typescript
interface MapContainerInputs {
  // Existing
  geoData: FeatureCollection;
  renderMode: 'svg' | 'canvas';

  // New
  baseLayer: 'geojson' | 'raster-tiles';
  projection: 'equirectangular' | 'mercator';
}
```

#### How It Works

- **GeoJSON mode**: Current implementation (Equirectangular, vector rendering)
- **Raster mode**: Web Mercator tiles with optional vector overlay

Users choose based on their use case:
- Thematic/analytical maps → GeoJSON mode
- Reference/basemap needs → Raster mode

#### Pros

- Preserves existing functionality
- Clear user choice
- No performance compromise
- Progressive enhancement

#### Cons

- Two code paths to maintain
- Projection mismatch if overlaying vectors on raster in Mercator mode
- More complex component API

---

## Recommendation

Based on the project goals (proper projection, >23fps animation, reference implementation), we recommend:

### Primary: Implement Hybrid Mode (Approach 3)

1. **Keep Equirectangular + GeoJSON as default** - maintains project philosophy
2. **Add optional Mercator + raster tiles mode** - addresses user requests
3. **Document the trade-offs clearly** - educates users on the choice

### Implementation Priority

| Phase | Deliverable | Effort |
|-------|-------------|--------|
| 1 | Document options in README | 0.5 days |
| 2 | Add `d3-tile` integration for Mercator mode | 2 days |
| 3 | Add projection mode switching | 1 day |
| 4 | Update Storybook with tile examples | 0.5 days |

### Success Criteria

- Raster tiles load and display correctly in Mercator mode
- Smooth pan/zoom with tiles (>30fps)
- Clear documentation of when to use each mode
- No regression in existing GeoJSON/Equirectangular functionality

---

## Implementation Outline

### Phase 1: Dependencies

```bash
npm install d3-tile
npm install --save-dev @types/d3-tile
```

### Phase 2: New Service

Create `services/tile.service.ts`:

```typescript
@Injectable({ providedIn: 'root' })
export class TileService {
  private tileGenerator = d3Tile();
  private tileCache = new Map<string, HTMLImageElement>();

  configure(width: number, height: number, projection: GeoProjection): void;
  getVisibleTiles(): Tile[];
  loadTile(tile: Tile): Promise<HTMLImageElement>;
  renderTiles(ctx: CanvasRenderingContext2D, tiles: Tile[]): void;
}
```

### Phase 3: Extend RenderContext

```typescript
export interface RenderContext {
  // Existing
  svg?: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  canvas?: HTMLCanvasElement;
  context?: CanvasRenderingContext2D;
  mode: RenderMode;
  path: GeoPath;

  // New
  tileCanvas?: HTMLCanvasElement;
  tileContext?: CanvasRenderingContext2D;
}
```

### Phase 4: Component Updates

Add inputs to `MapContainerComponent`:

```typescript
readonly baseLayer = input<'geojson' | 'raster-tiles'>('geojson');
readonly projectionType = input<'equirectangular' | 'mercator'>('equirectangular');
readonly tileUrl = input<string>('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
```

### Phase 5: Integration with Animation Loop

Modify projection change handler to update tiles:

```typescript
this.geoZoomService.onProjectionChange
  .pipe(takeUntilDestroyed())
  .subscribe(() => {
    if (this.baseLayer() === 'raster-tiles') {
      this.tileService.updateVisibleTiles();
    }
    this.render();
  });
```

---

## References

### D3 Libraries

- [d3-tile](https://github.com/d3/d3-tile) - Tile coordinate computation
- [d3-geo](https://github.com/d3/d3-geo) - Geographic projections

### Examples & Tutorials

- [D3 Raster Tiles (Observable)](https://observablehq.com/@d3/raster-tiles)
- [Raster Tiles Canvas (Observable)](https://observablehq.com/@d3/raster-tiles-canvas)
- [Raster Reprojection Example](https://gist.github.com/HarryStevens/676a9e3d5681365045197238cdc1ba8b)
- [D3 Raster Reprojection Plugin](https://gist.github.com/rasmuse/75fae4fee3354ec41a49d10fb37af551)

### Background Reading

- [D3js Raster Tools - Projections](https://geoexamples.com/d3-raster-tools-docs/intr/projections.html)
- [No More Mercator Tiles (vis4.net)](http://www.vis4.net/blog/no-more-mercator-tiles/)

### Tile Providers

- [OpenStreetMap](https://wiki.openstreetmap.org/wiki/Tile_servers)
- [Stamen Maps](http://maps.stamen.com/)
- [Mapbox](https://docs.mapbox.com/api/maps/raster-tiles/)

---

## Conclusion

Raster tile support is feasible and should be implemented as an optional feature. The recommended approach (Hybrid Mode) balances user needs with the project's core value of cartographic accuracy. By offering a clear choice between projection-correct GeoJSON rendering and standard slippy map tiles, users can select the appropriate tool for their specific use case.
