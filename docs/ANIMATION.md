# Animation System Deep Dive

This document explains the animation architecture used in this D3 Animated Map reference implementation, with a focus on **why we use `requestAnimationFrame` instead of D3's native transitions/tweens**, and how this approach enables smooth geographic animations.

## Table of Contents

- [The Problem with D3 Transitions for Maps](#the-problem-with-d3-transitions-for-maps)
- [Understanding requestAnimationFrame](#understanding-requestanimationframe)
- [Our Animation Architecture](#our-animation-architecture)
- [The Animation Loop Explained](#the-animation-loop-explained)
- [Lerp-Based Smoothing](#lerp-based-smoothing)
- [Physics-Based Motion](#physics-based-motion)
- [Programmatic Animations](#programmatic-animations)
- [Performance Considerations](#performance-considerations)
- [Code Examples](#code-examples)

---

## The Problem with D3 Transitions for Maps

D3's transition system is powerful and elegant for animating SVG attributes like positions, colors, and transforms. However, **it's designed for DOM attribute interpolation, not geographic projection state**.

### How D3 Transitions Work

```javascript
// Typical D3 transition - animates SVG attributes
d3.select('circle')
  .transition()
  .duration(1000)
  .attr('cx', 200)
  .attr('cy', 150);
```

D3 handles:
1. Starting the animation timer
2. Interpolating values between start and end states
3. Applying easing functions
4. Updating DOM attributes on each frame

### Why This Doesn't Work for Map Projections

Geographic map animations require updating the **projection object itself**, not individual DOM elements:

```javascript
// What we need to animate
projection.rotate([newLongitude, newLatitude, 0]);
projection.scale(newScale);

// Then re-render ALL paths using the updated projection
pathGenerator = d3.geoPath().projection(projection);
svg.selectAll('path').attr('d', pathGenerator);
```

The challenges:

| Challenge | D3 Transition Approach | Problem |
|-----------|----------------------|---------|
| Projection state | Doesn't support projection objects | Can't interpolate projection.rotate() |
| Multiple paths | Would need separate transitions per path | Performance nightmare |
| Geographic accuracy | No understanding of geographic interpolation | Naive interpolation distorts features |
| User interaction | Designed for one-shot animations | No support for continuous pan/zoom |
| Inertia/momentum | Not built-in | Maps feel stiff without momentum |

---

## Understanding requestAnimationFrame

`requestAnimationFrame` (RAF) is a browser API that tells the browser you want to perform an animation and requests the browser call a function to update an animation before the next repaint.

### The Basics

```javascript
function animate() {
  // Update animation state
  x += velocity;

  // Apply visual updates
  element.style.transform = `translateX(${x}px)`;

  // Request next frame
  requestAnimationFrame(animate);
}

// Start the loop
requestAnimationFrame(animate);
```

### Why RAF is Better Than setTimeout/setInterval

| Aspect | setTimeout/setInterval | requestAnimationFrame |
|--------|----------------------|----------------------|
| **Timing** | Fixed interval (e.g., 16ms) | Synced to display refresh |
| **Background tabs** | Continues running, wastes CPU | Paused, saves resources |
| **Frame rate** | May not align with display | Automatic 60fps (or display rate) |
| **Browser optimization** | None | Browser can batch repaints |
| **Precision** | Subject to timer drift | High-precision timestamp provided |

### RAF Signature

```javascript
const animationId = requestAnimationFrame(callback);

// callback receives a high-resolution timestamp
function callback(timestamp) {
  // timestamp = performance.now() at frame start
  // Use for time-based animations
}

// Cancel if needed
cancelAnimationFrame(animationId);
```

---

## Our Animation Architecture

This project implements a **custom RAF-based animation system** with three key components:

```
┌─────────────────────────────────────────────────────────────────┐
│                     User Interaction                            │
│              (mouse drag, wheel scroll, touch)                  │
└────────────────────────┬────────────────────────────────────────┘
                         │ Updates target values
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   GeoZoomService                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Target State          │  Current State                 │   │
│  │  - targetRotation      │  - currentRotation             │   │
│  │  - targetScale         │  - currentScale                │   │
│  │                        │  - scaleVelocity (physics)     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                         │                                       │
│            RAF Loop: Lerp current → target                      │
│                         │                                       │
│            projection.rotate(currentRotation)                   │
│            projection.scale(currentScale)                       │
│                         │                                       │
│            onProjectionChange.next() ──────────────────────────►│
└─────────────────────────────────────────────────────────────────┘
                                                           │
                         ┌─────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                 MapContainerComponent                           │
│                                                                 │
│  Subscribes to onProjectionChange                               │
│  Calls MapRendererService.render()                              │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  MapRendererService                             │
│                                                                 │
│  Updates all SVG paths using new projection state               │
│  pathGenerator = d3.geoPath().projection(projection)            │
│  svg.selectAll('path').attr('d', pathGenerator)                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Separation of target and current state**: User input updates targets; the animation loop smoothly interpolates current values toward targets
2. **Single RAF loop**: All animation (pan, zoom, programmatic) shares one loop
3. **Observable-based rendering**: Projection changes emit events; components subscribe and re-render
4. **Auto-stop**: Loop exits when animation settles, saving CPU

---

## The Animation Loop Explained

The core animation loop in `geo-zoom.service.ts` (lines 261-334):

```typescript
private startAnimationLoop(): void {
  // Guard: don't start duplicate loops
  if (this.animationId) return;

  const animate = () => {
    // Guard: exit if projection destroyed
    if (!this.projection) {
      this.animationId = undefined;
      return;
    }

    // === ROTATION SMOOTHING ===
    // Calculate smoothing factor based on zoom level
    // Higher zoom = more smoothing to prevent jitter
    const relScale = this.currentScale / this.initialScale || 1;
    const smoothing = this.smoothingBase * Math.min(relScale, 4);

    // Track if values changed (to know when to stop)
    let changed = false;
    const next: [number, number, number] = [...this.currentRotation];

    // Lerp each rotation component toward target
    for (let i = 0; i < 3; i++) {
      const v = this.currentRotation[i] +
        (this.targetRotation[i] - this.currentRotation[i]) * smoothing;

      // Only flag as changed if movement is perceptible
      if (Math.abs(v - this.currentRotation[i]) > 1e-4) changed = true;
      next[i] = v;
    }
    this.currentRotation = next;

    // === SCALE SMOOTHING WITH PHYSICS ===
    let scaleChanged = false;
    const targetDiff = this.targetScale - this.currentScale;

    if (Math.abs(this.scaleVelocity) > 1e-4 || Math.abs(targetDiff) > 1e-4) {
      const scaleSmoothing = Math.min(
        this.scaleSmoothingBase * Math.max(relScale, 0.5),
        0.5
      );

      // Apply velocity (creates momentum)
      this.currentScale += this.scaleVelocity;

      // Pull toward target (prevents overshoot)
      this.currentScale += targetDiff * scaleSmoothing * 0.3;

      // Decay velocity (friction)
      this.scaleVelocity *= 0.75;

      // Extra damping near target (prevents oscillation)
      if (Math.abs(targetDiff) < this.initialScale * 0.1) {
        this.scaleVelocity *= 0.8;
      }

      scaleChanged = true;
    }

    // Clamp scale within bounds
    this.currentScale = Math.max(
      this.scaleExtent[0] * this.initialScale,
      Math.min(this.scaleExtent[1] * this.initialScale, this.currentScale)
    );

    // === APPLY TO PROJECTION ===
    this.projection.rotate(this.currentRotation);
    this.projection.scale(this.currentScale);

    // Notify subscribers to re-render
    this.onProjectionChange.next();

    // === CONTINUE OR STOP ===
    if (changed || scaleChanged) {
      // More animation needed
      this.animationId = requestAnimationFrame(animate);
    } else {
      // Animation settled, stop loop to save CPU
      this.animationId = undefined;
    }
  };

  // Kick off the loop
  this.animationId = requestAnimationFrame(animate);
}
```

---

## Lerp-Based Smoothing

**Lerp** (Linear Interpolation) is the foundation of our smoothing system:

```
newValue = currentValue + (targetValue - currentValue) * factor
```

Where `factor` (0 to 1) controls how quickly we approach the target:
- `factor = 1.0`: Instant snap to target (no smoothing)
- `factor = 0.1`: Slow, smooth approach
- `factor = 0.0`: Never moves (stuck)

### Visual Representation

```
factor = 0.15 (our default)

Frame 1:  current: 0    target: 100   → new: 15
Frame 2:  current: 15   target: 100   → new: 27.75
Frame 3:  current: 27.75 target: 100  → new: 38.59
...
Frame 20: current: 96.1  target: 100  → new: 96.7
```

This creates an **ease-out** effect: fast initial movement that slows as it approaches the target.

### Why Lerp Works Well for Maps

1. **Responsive feel**: Immediately starts moving toward target
2. **Natural deceleration**: Slows down as it approaches (no abrupt stop)
3. **Continuous updates**: Works perfectly with continuous input (dragging)
4. **Self-correcting**: Always converging toward latest target

### Scale-Dependent Smoothing

At high zoom levels, small movements become visually larger. We increase smoothing to compensate:

```typescript
// Higher zoom = more smoothing
const relScale = this.currentScale / this.initialScale || 1;
const smoothing = this.smoothingBase * Math.min(relScale, 4);
```

---

## Physics-Based Motion

For zoom, we add **velocity and damping** to create inertia:

### The Physics Model

```typescript
// User scrolls wheel → adds velocity
this.scaleVelocity = this.scaleVelocity * 0.5 + velocityDelta;

// Each frame:
// 1. Apply velocity
this.currentScale += this.scaleVelocity;

// 2. Pull toward target (spring)
this.currentScale += targetDiff * scaleSmoothing * 0.3;

// 3. Apply friction (damping)
this.scaleVelocity *= 0.75;
```

### Damped Spring Behavior

This creates a **critically damped spring**:
- Fast response to input
- Smooth deceleration
- Minimal overshoot
- No oscillation

```
Velocity over time (wheel scroll at frame 0):

   │
 V │ ****
 e │     ***
 l │        **
 o │          **
 c │            *
 i │             **
 t │               **
 y │                 ****
   │                      ******
   └────────────────────────────────► Time
     0    5    10    15    20 frames
```

---

## Programmatic Animations

For predefined sequences (continent tour, city tour), we use a different approach in `animateTo()`:

```typescript
animateTo(
  center: [number, number],
  scale: number,
  duration: number = 750,
  callback?: () => void
): void {
  const startCenter = [...this.currentCenter];
  const startScale = this.currentScale / this.initialScale;
  const startTime = Date.now();

  const animate = () => {
    const elapsed = Date.now() - startTime;
    const t = Math.min(elapsed / duration, 1);  // Progress 0→1

    // Apply easing for professional feel
    const eased = d3.easeCubicInOut(t);

    // Interpolate center (geographic coordinates)
    const interpCenter: [number, number] = [
      startCenter[0] + (center[0] - startCenter[0]) * eased,
      startCenter[1] + (center[1] - startCenter[1]) * eased,
    ];

    // Interpolate scale
    const interpScale = startScale + (scale - startScale) * eased;

    // Update projection
    this.setCenter(interpCenter, false);
    this.setScale(interpScale, false);
    this.onProjectionChange.next();

    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      // Sync targets at end
      this.targetRotation = [...this.currentRotation];
      this.targetScale = this.currentScale;
      callback?.();
    }
  };

  requestAnimationFrame(animate);
}
```

### Key Differences from Interaction Animation

| Aspect | User Interaction | Programmatic Animation |
|--------|-----------------|----------------------|
| Duration | Continuous (until settled) | Fixed duration |
| Easing | Lerp (ease-out) | d3.easeCubicInOut |
| Progress | Distance-based | Time-based |
| End condition | Values converge | Time elapsed |

---

## Performance Considerations

### Why >23fps Matters

- **Film standard**: 24fps is cinema standard
- **Perceptual threshold**: Below ~20fps, motion appears choppy
- **Our target**: >23fps ensures smooth perception

### FPS Monitoring

The `AnimationControllerService` tracks frame rate:

```typescript
private monitorFps(): void {
  if (!this.isPlaying) return;

  const currentTime = performance.now();
  this.frameCount++;

  // Calculate every 500ms for stability
  if (currentTime - this.lastFrameTime >= 500) {
    this.fps = Math.round(
      (this.frameCount * 1000) / (currentTime - this.lastFrameTime)
    );
    this.onFpsUpdate.next(this.fps);

    this.frameCount = 0;
    this.lastFrameTime = currentTime;
  }

  requestAnimationFrame(() => this.monitorFps());
}
```

### Optimizations in This Implementation

1. **Single RAF loop**: All animation shares one loop
2. **Auto-stop**: Loop exits when settled
3. **SVG path caching**: D3 efficiently updates only changed paths
4. **Scale-dependent smoothing**: Prevents jitter at high zoom
5. **Threshold checks**: Avoids sub-pixel updates

---

## Code Examples

### Adding Custom Smoothing Behavior

```typescript
// In your component or service
private customSmoothingFactor = 0.1;

private animateWithCustomSmoothing(target: number): void {
  let current = this.getCurrentValue();

  const animate = () => {
    current = current + (target - current) * this.customSmoothingFactor;

    this.applyValue(current);

    if (Math.abs(target - current) > 0.001) {
      requestAnimationFrame(animate);
    }
  };

  requestAnimationFrame(animate);
}
```

### Creating a Bounce Effect

```typescript
private animateWithBounce(target: number): void {
  const startTime = performance.now();
  const duration = 1000;
  const start = this.getCurrentValue();

  const animate = (timestamp: number) => {
    const elapsed = timestamp - startTime;
    const t = Math.min(elapsed / duration, 1);

    // Elastic easing for bounce
    const eased = t === 1
      ? 1
      : -Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;

    const current = start + (target - start) * eased;
    this.applyValue(current);

    if (t < 1) {
      requestAnimationFrame(animate);
    }
  };

  requestAnimationFrame(animate);
}
```

### Chaining Animations

```typescript
async animateSequence(locations: [number, number][]): Promise<void> {
  for (const location of locations) {
    await this.animateToLocation(location);
    await this.delay(500);  // Pause between locations
  }
}

private animateToLocation(center: [number, number]): Promise<void> {
  return new Promise(resolve => {
    this.geoZoomService.animateTo(center, 2, 1000, resolve);
  });
}

private delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## Summary

This animation system provides:

- **Smooth interactions** via lerp-based smoothing
- **Natural physics** via velocity and damping
- **Professional sequences** via time-based easing
- **Performance** via single RAF loop and auto-stop
- **Flexibility** via observable-based architecture

The key insight is that **D3 transitions are designed for DOM attributes, not projection state**. By implementing our own RAF-based system, we get full control over how geographic projections animate while maintaining the smooth, professional feel users expect.

---

## Further Reading

- [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame)
- [D3 Transitions Documentation](https://d3js.org/d3-transition)
- [D3 Geo Projections](https://d3js.org/d3-geo/projection)
- [Lerp and Game Development](https://www.gamedev.net/tutorials/programming/general-and-gameplay-programming/a-brief-introduction-to-lerp-r4954/)
