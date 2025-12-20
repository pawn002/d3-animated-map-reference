import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PerformanceService {
  private frames: number[] = [];
  private lastFrameTime = performance.now();

  // Expose FPS as a signal for reactive updates
  currentFps = signal(0);
  averageFps = signal(0);

  /**
   * Record a frame and update FPS signals
   * Call this method on each render cycle
   */
  recordFrame(): void {
    const now = performance.now();
    const delta = now - this.lastFrameTime;
    const fps = 1000 / delta;

    // Store frame data
    this.frames.push(fps);

    // Keep only last 60 frames for rolling average
    if (this.frames.length > 60) {
      this.frames.shift();
    }

    // Update signals
    this.currentFps.set(Math.round(fps));
    this.averageFps.set(Math.round(this.calculateAverage()));

    this.lastFrameTime = now;
  }

  /**
   * Calculate average FPS from stored frames
   */
  private calculateAverage(): number {
    if (this.frames.length === 0) return 0;
    const sum = this.frames.reduce((a, b) => a + b, 0);
    return sum / this.frames.length;
  }

  /**
   * Get the minimum FPS recorded
   */
  getMinFps(): number {
    if (this.frames.length === 0) return 0;
    return Math.round(Math.min(...this.frames));
  }

  /**
   * Get the maximum FPS recorded
   */
  getMaxFps(): number {
    if (this.frames.length === 0) return 0;
    return Math.round(Math.max(...this.frames));
  }

  /**
   * Reset FPS tracking
   */
  reset(): void {
    this.frames = [];
    this.lastFrameTime = performance.now();
    this.currentFps.set(0);
    this.averageFps.set(0);
  }

  /**
   * Check if FPS is above target threshold
   */
  isAboveThreshold(threshold: number = 23): boolean {
    return this.averageFps() >= threshold;
  }
}
