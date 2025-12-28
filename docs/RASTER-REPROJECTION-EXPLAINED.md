# Understanding Raster Reprojection: A Guide for Junior Developers

*A conceptual guide to the most counterintuitive operation in web mapping*

---

## The Problem: Two Maps That Don't Agree

Imagine you have two different jigsaw puzzles of the same picture. One was made in Japan, one in Germany. Both show the same image, but the pieces are cut completely differently. You can't just swap pieces between them—they won't fit.

This is exactly the problem with map projections.

**Web Mercator** (what Google Maps, OpenStreetMap, and most tile servers use) and **Equirectangular** (what this project uses) are two different ways of "cutting up" the Earth's spherical surface to display it flat. A tile image designed for one projection looks *distorted and wrong* when displayed in the other.

Reprojection is the process of translating pixels from one projection's coordinate system to another.

---

## The Counterintuitive Core: Working Backwards

Here's where most developers get tripped up. The natural instinct is:

> "I have source pixels. Let me figure out where each one goes in the target."

**This is wrong.** Or rather, it creates gaps and overlaps.

### The Photo Mosaic Analogy

Imagine you're creating a photo mosaic on a wall. You have a bucket of tiny colored tiles (your source pixels), and a grid on the wall where each cell needs exactly one tile (your target pixels).

**The Wrong Way (Forward Mapping):**
You pick up each tile from the bucket and calculate where it should go on the wall. Problem: some wall cells get multiple tiles stacked on them. Other cells get no tiles at all—leaving holes.

**The Right Way (Inverse Mapping):**
You point at each cell on the wall and ask: "Which tile from my bucket belongs here?" Every cell gets exactly one answer. No gaps, no overlaps.

This is why reprojection works **backwards**—from target to source.

```
For each pixel (x, y) in TARGET image:
    1. What lon/lat does this pixel represent? (invert the target projection)
    2. What pixel in the SOURCE image has that lon/lat? (apply source projection)
    3. Copy that source pixel's color to target (x, y)
```

---

## The Algorithm, Step by Step

Let's trace through what happens for a single pixel.

### Setup

```typescript
// Target: Equirectangular projection (what we want)
const targetProjection = d3.geoEquirectangular()
  .scale(width / (2 * Math.PI))
  .translate([width / 2, height / 2]);

// Source: Web Mercator tiles (what we have)
// Tiles follow a standard formula: lon/lat → pixel coordinates
```

### For Each Target Pixel

```typescript
for (let y = 0; y < targetHeight; y++) {
  for (let x = 0; x < targetWidth; x++) {

    // STEP 1: Where on Earth is this target pixel?
    // "Invert" means: pixel coordinates → geographic coordinates
    const [lon, lat] = targetProjection.invert([x, y]);

    // STEP 2: Where is that location in the source image?
    // Web Mercator has a specific formula for this
    const sourceX = ((lon + 180) / 360) * sourceWidth;
    const sourceY = /* Mercator formula - see below */;

    // STEP 3: Copy the color
    targetPixel[x, y] = sourcePixel[sourceX, sourceY];
  }
}
```

### The Mercator Y Formula (The Weird One)

Mercator projection has a non-linear Y axis. Near the equator, degrees of latitude map to small pixel distances. Near the poles, the same degrees map to huge distances (which is why Greenland looks enormous on Google Maps).

```typescript
// Converting latitude to Mercator Y coordinate
const latRadians = (lat * Math.PI) / 180;
const mercatorY = Math.log(Math.tan(Math.PI / 4 + latRadians / 2));

// Normalized to image coordinates (0 to height)
const sourceY = (1 - mercatorY / Math.PI) / 2 * sourceHeight;
```

**Why the tangent and logarithm?** Mercator was designed for navigation—straight lines on the map are constant compass bearings. This requires a specific mathematical stretching that happens to involve these functions. You don't need to derive it; just know it's the standard formula.

---

## The Sampling Problem: Which Pixel Exactly?

When you calculate `sourceX = 156.7`, there's no pixel 156.7—pixels are integers. You must choose:

### Nearest Neighbor (Fast, Blocky)

```typescript
const srcX = Math.floor(sourceX);
const srcY = Math.floor(sourceY);
// Just grab that one pixel
```

Like choosing the closest tile in your mosaic. Fast, but you can see the "seams" when zoomed in.

### Bilinear Interpolation (Slow, Smooth)

```typescript
// Get the four surrounding pixels
const x0 = Math.floor(sourceX);
const x1 = x0 + 1;
const y0 = Math.floor(sourceY);
const y1 = y0 + 1;

// Blend them based on how close sourceX/Y is to each
const xWeight = sourceX - x0;  // 0.7 means "70% toward x1"
const yWeight = sourceY - y0;
// ... weighted average of all four pixels
```

Like mixing paint colors from four neighboring tiles. Smoother, but 4x more memory reads and math per pixel.

---

## Why This Is Expensive: The Math

Let's count operations for a Full HD viewport (1920 × 1080 = 2,073,600 pixels):

**Per pixel (nearest neighbor):**
- 1 `invert()` call (involves trig functions)
- 2 coordinate transforms
- 4 array lookups
- 4 array writes

**Per frame at 60fps:**
- 2 million pixels × ~15 operations = **30 million operations**
- All in ~16 milliseconds
- Every. Single. Frame.

**Per frame at 23fps (our target):**
- Same 30 million operations
- But you have 43ms instead of 16ms
- Still extremely tight for JavaScript

This is why the feasibility study flagged reprojection as risky. It's O(width × height) per frame with no way to skip pixels.

---

## Visual: What Happens at the Edges

```
Target (Equirectangular)         Source (Mercator)
+------------------------+       +------------------------+
|                        |       |   Greenland (huge)     |
|   Greenland (normal)   |  ←    |                        |
|                        |       +------------------------+
|   Equator region       |  ←    |   Equator (compressed) |
|                        |       +------------------------+
|   Antarctica (normal)  |  ←    |                        |
|                        |       |   (cut off at ~85°)    |
+------------------------+       +------------------------+
```

Notice: Mercator can't represent poles. Any target pixel beyond ±85° latitude has **no source data**. The reprojection code must handle this:

```typescript
if (lat < -85 || lat > 85) {
  continue; // Skip this pixel, leave it transparent
}
```

---

## The "Aha" Moments

### 1. Projections are reversible functions

A projection is just a function: `(lon, lat) → (x, y)`

The **inverse** goes the other way: `(x, y) → (lon, lat)`

D3 provides both via `projection([lon, lat])` and `projection.invert([x, y])`.

### 2. The Earth is the common language

When converting between projections, you always go through geographic coordinates (lon/lat). It's the Rosetta Stone:

```
Source pixels → lon/lat → Target pixels
```

You never go directly from source pixels to target pixels.

### 3. "Resolution" is viewport-dependent

A 256×256 tile might be perfect for a small map. But if your viewport is 1920×1080 and you're zoomed in, you're stretching those 65,536 source pixels across 2 million target pixels. The reprojection will look blurry regardless of algorithm quality.

### 4. Caching doesn't help during animation

If the user is zooming/panning, the projection parameters change every frame. Yesterday's cached reprojection is useless today. This is fundamentally different from rendering static images.

---

## Performance Optimization Strategies

The benchmark demonstrates that naive JavaScript reprojection struggles at higher resolutions. Here are the strategies available, ranked roughly by performance gain:

### Tier 1: GPU-Based (Fastest)

#### WebGL Shaders

**Speedup: 10-50x over JavaScript**

GPUs are designed for exactly this kind of work—running the same operation on millions of pixels in parallel. A fragment shader can reproject an entire viewport in a single draw call.

```glsl
// Conceptual fragment shader (simplified)
varying vec2 vUv;
uniform sampler2D sourceTexture;

void main() {
  // Convert screen position to lon/lat (inverse projection)
  vec2 lonLat = equirectangularInvert(vUv);

  // Convert lon/lat to Mercator texture coordinates
  vec2 mercatorUv = mercatorProject(lonLat);

  // Sample the source texture
  gl_FragColor = texture2D(sourceTexture, mercatorUv);
}
```

**Pros:**
- Massively parallel—thousands of GPU cores vs 1 CPU core
- This is what Mapbox GL, Deck.gl, and other production libraries use
- Can easily hit 60fps at 4K

**Cons:**
- Requires learning WebGL or using a library like `regl`
- Shader debugging is harder than JavaScript
- Some devices have weak GPUs (older mobile)

---

### Tier 2: Near-Native Speed

#### WebAssembly (WASM)

**Speedup: 3-5x over JavaScript**

WebAssembly runs at near-native speed with predictable performance—no garbage collection pauses, no JIT warm-up variability.

| Aspect | JavaScript | WebAssembly |
|--------|------------|-------------|
| Execution | JIT-compiled, variable | Near-native, consistent |
| Memory | GC-managed, pauses | Linear memory, no GC |
| SIMD | Limited | Native 128-bit SIMD |
| Numeric types | Only float64 | i32, i64, f32, f64 |

**Estimated performance (Full HD viewport):**

| Implementation | Time per frame |
|----------------|----------------|
| JavaScript | ~120ms |
| WASM | ~30-40ms |
| WASM + SIMD | ~10-15ms |

**Architecture:**

```
┌─────────────────────────────────────┐
│  JavaScript (Angular)               │
│  - Tile loading, UI, orchestration  │
└──────────────┬──────────────────────┘
               │ ArrayBuffer (pixels)
               ▼
┌─────────────────────────────────────┐
│  WebAssembly Module                 │
│  - reprojectFrame(src, tgt, params) │
│  - All math inlined, SIMD batches   │
└──────────────┬──────────────────────┘
               │ Modified ArrayBuffer
               ▼
┌─────────────────────────────────────┐
│  Canvas: ctx.putImageData()         │
└─────────────────────────────────────┘
```

**Pros:**
- Significant speedup with less complexity than WebGL
- Skills transfer to other compute-intensive tasks
- Good browser support

**Cons:**
- Data transfer overhead (copy pixels in and out)
- Requires Rust/C++ toolchain and separate build step
- Must reimplement projection math (can't call D3 from WASM)

---

### Tier 3: Architectural Optimizations

#### Web Workers (Off-Main-Thread)

**Speedup: 0x (same total time, but UI stays responsive)**

Doesn't make reprojection faster, but moves it off the main thread so the UI doesn't freeze.

```typescript
// Main thread
const worker = new Worker('reprojection.worker.js');
worker.postMessage({ sourcePixels, width, height, params });
worker.onmessage = (e) => ctx.putImageData(e.data, 0, 0);
```

**Best combined with:** WASM inside the worker for actual speedup.

---

#### Tile Caching / Pre-computation

**Speedup: ∞ for cache hits, 0 for misses**

For discrete zoom levels, pre-compute reprojected tiles and cache them. Trade memory for CPU.

```typescript
const cache = new Map<string, ImageData>();

function getReprojectedTile(z: number, x: number, y: number): ImageData {
  const key = `${z}/${x}/${y}`;
  if (cache.has(key)) return cache.get(key)!;  // Instant

  const reprojected = reprojectTile(z, x, y);  // Expensive
  cache.set(key, reprojected);
  return reprojected;
}
```

**Limitation:** Doesn't help during continuous zoom animation (every frame is a new projection).

---

#### Adaptive Quality During Animation

**Speedup: Variable (trade quality for speed)**

During active pan/zoom, use a low-resolution reprojection. When the user stops, render full quality.

```typescript
let isAnimating = false;

function reproject() {
  const scale = isAnimating ? 0.25 : 1.0;  // 1/4 resolution during animation
  const targetWidth = viewport.width * scale;
  const targetHeight = viewport.height * scale;
  // ... reproject at lower resolution, then scale up for display
}
```

**Pros:** Always maintains interactivity
**Cons:** Visible quality degradation during movement

---

### Tier 4: Avoiding the Problem

#### Accept Web Mercator Projection

**Speedup: ∞ (no reprojection needed)**

If raster tiles are essential and cartographic accuracy is flexible, switch to `geoMercator()` projection. Tiles render directly without any reprojection.

This is "Approach 1" from the [RASTER-TILES-FEASIBILITY.md](./RASTER-TILES-FEASIBILITY.md) study.

**Pros:** Zero CPU cost, standard tile sources work perfectly
**Cons:** Loses the project's core value proposition (projection flexibility)

---

### Decision Matrix

| Strategy | Speedup | Complexity | When to Use |
|----------|---------|------------|-------------|
| WebGL | 10-50x | High | Production apps needing 60fps |
| WASM + SIMD | 3-5x | Medium | When WebGL is overkill |
| WASM | 2-4x | Medium | Moderate performance needs |
| Web Workers | 0x* | Low | Keep UI responsive |
| Tile caching | ∞/0 | Low | Discrete zoom levels only |
| Adaptive quality | Variable | Low | Acceptable quality tradeoff |
| Accept Mercator | ∞ | None | When projection doesn't matter |

*Web Workers don't speed up the math, but prevent UI freezing.

---

### Recommendation for This Project

For a reference implementation, we recommend:

1. **Keep JavaScript reprojection** for educational clarity
2. **Document the performance characteristics** (this document + benchmark)
3. **Point users to WebGL solutions** (Mapbox GL, Deck.gl) for production needs
4. **Consider WASM as a future enhancement** if there's demand for faster pure-JS solution

The benchmark at `/benchmark` lets developers see the problem firsthand, which is more valuable than hiding it behind optimizations.

---

## Try It Yourself

Run the benchmark at `/benchmark` and observe:

1. How FPS drops as viewport size increases
2. The difference between Nearest Neighbor and Bilinear
3. How "Baseline" (no reprojection) is dramatically faster

This hands-on experience will cement the concepts better than any documentation.

---

## Summary

| Concept | Key Insight |
|---------|-------------|
| Reprojection | Converting pixels between coordinate systems |
| Inverse mapping | Work backwards: target → source (not source → target) |
| The bottleneck | O(width × height) per frame, no shortcuts |
| Mercator limits | Can't show poles (±85° latitude) |
| Common ground | All projections speak lon/lat as an intermediate |

Understanding reprojection deeply will make you appreciate why most web maps just use Mercator—and why projects like this one, which insist on cartographic accuracy, face genuine technical tradeoffs.

---

*Document created for the d3-animated-map-reference project, December 2025*
