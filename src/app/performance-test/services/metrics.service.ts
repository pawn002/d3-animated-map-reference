import { Injectable, signal, computed } from '@angular/core';

export interface FrameMetrics {
  frameTime: number; // ms per frame
  fps: number;
  reprojectionTime: number; // ms for reprojection only
  timestamp: number;
}

export interface BenchmarkResult {
  testName: string;
  viewportSize: { width: number; height: number };
  totalPixels: number;
  avgFps: number;
  minFps: number;
  maxFps: number;
  avgFrameTime: number;
  avgReprojectionTime: number;
  frameCount: number;
  duration: number;
  passesTarget: boolean; // >= 23fps
}

@Injectable({
  providedIn: 'root',
})
export class MetricsService {
  private frameHistory: FrameMetrics[] = [];
  private readonly maxHistorySize = 120; // 2 seconds at 60fps
  private lastFrameTime = 0;
  private benchmarkStartTime = 0;
  private isRunning = false;

  // Reactive signals for UI
  readonly currentFps = signal<number>(0);
  readonly currentFrameTime = signal<number>(0);
  readonly currentReprojectionTime = signal<number>(0);
  readonly frameCount = signal<number>(0);

  // Computed stats
  readonly avgFps = computed(() => {
    if (this.frameHistory.length === 0) return 0;
    const sum = this.frameHistory.reduce((acc, m) => acc + m.fps, 0);
    return Math.round(sum / this.frameHistory.length);
  });

  /**
   * Start a new benchmark session
   */
  startBenchmark(): void {
    this.frameHistory = [];
    this.lastFrameTime = performance.now();
    this.benchmarkStartTime = performance.now();
    this.isRunning = true;
    this.frameCount.set(0);
  }

  /**
   * Record a frame with timing data
   */
  recordFrame(reprojectionTime: number): void {
    if (!this.isRunning) return;

    const now = performance.now();
    const frameTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    const fps = frameTime > 0 ? 1000 / frameTime : 0;

    const metrics: FrameMetrics = {
      frameTime,
      fps,
      reprojectionTime,
      timestamp: now,
    };

    this.frameHistory.push(metrics);
    if (this.frameHistory.length > this.maxHistorySize) {
      this.frameHistory.shift();
    }

    // Update signals
    this.currentFps.set(Math.round(fps));
    this.currentFrameTime.set(Math.round(frameTime * 100) / 100);
    this.currentReprojectionTime.set(Math.round(reprojectionTime * 100) / 100);
    this.frameCount.update((c) => c + 1);
  }

  /**
   * Stop benchmark and return results
   */
  stopBenchmark(testName: string, width: number, height: number): BenchmarkResult {
    this.isRunning = false;
    const duration = performance.now() - this.benchmarkStartTime;

    if (this.frameHistory.length === 0) {
      return {
        testName,
        viewportSize: { width, height },
        totalPixels: width * height,
        avgFps: 0,
        minFps: 0,
        maxFps: 0,
        avgFrameTime: 0,
        avgReprojectionTime: 0,
        frameCount: 0,
        duration,
        passesTarget: false,
      };
    }

    const fpsValues = this.frameHistory.map((m) => m.fps);
    const frameTimeValues = this.frameHistory.map((m) => m.frameTime);
    const reprojTimeValues = this.frameHistory.map((m) => m.reprojectionTime);

    const avgFps = fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length;
    const minFps = Math.min(...fpsValues);
    const maxFps = Math.max(...fpsValues);
    const avgFrameTime = frameTimeValues.reduce((a, b) => a + b, 0) / frameTimeValues.length;
    const avgReprojectionTime = reprojTimeValues.reduce((a, b) => a + b, 0) / reprojTimeValues.length;

    return {
      testName,
      viewportSize: { width, height },
      totalPixels: width * height,
      avgFps: Math.round(avgFps * 10) / 10,
      minFps: Math.round(minFps * 10) / 10,
      maxFps: Math.round(maxFps * 10) / 10,
      avgFrameTime: Math.round(avgFrameTime * 100) / 100,
      avgReprojectionTime: Math.round(avgReprojectionTime * 100) / 100,
      frameCount: this.frameHistory.length,
      duration: Math.round(duration),
      passesTarget: avgFps >= 23,
    };
  }

  /**
   * Get current frame history for analysis
   */
  getFrameHistory(): FrameMetrics[] {
    return [...this.frameHistory];
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.frameHistory = [];
    this.isRunning = false;
    this.currentFps.set(0);
    this.currentFrameTime.set(0);
    this.currentReprojectionTime.set(0);
    this.frameCount.set(0);
  }
}
