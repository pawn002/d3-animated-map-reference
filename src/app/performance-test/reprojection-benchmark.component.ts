import {
  Component,
  ElementRef,
  viewChild,
  signal,
  inject,
  OnDestroy,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MetricsService, BenchmarkResult } from './services/metrics.service';
import { ReprojectionService } from './services/reprojection.service';

interface ViewportConfig {
  name: string;
  width: number;
  height: number;
}

type BenchmarkType = 'baseline' | 'nearest' | 'bilinear';

@Component({
  selector: 'app-reprojection-benchmark',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reprojection-benchmark.component.html',
  styleUrl: './reprojection-benchmark.component.scss',
})
export class ReprojectionBenchmarkComponent implements AfterViewInit, OnDestroy {
  readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('benchmarkCanvas');

  private metricsService = inject(MetricsService);
  private reprojectionService = inject(ReprojectionService);

  // Test configurations
  readonly viewportConfigs: ViewportConfig[] = [
    { name: 'Small (800x600)', width: 800, height: 600 },
    { name: 'HD (1280x720)', width: 1280, height: 720 },
    { name: 'Full HD (1920x1080)', width: 1920, height: 1080 },
    { name: '2K (2560x1440)', width: 2560, height: 1440 },
  ];

  readonly benchmarkTypes: { type: BenchmarkType; name: string }[] = [
    { type: 'baseline', name: 'Baseline (no reprojection)' },
    { type: 'nearest', name: 'Nearest Neighbor' },
    { type: 'bilinear', name: 'Bilinear Interpolation' },
  ];

  // State signals
  readonly selectedViewport = signal<ViewportConfig>(this.viewportConfigs[0]);
  readonly selectedBenchmark = signal<BenchmarkType>('nearest');
  readonly isRunning = signal<boolean>(false);
  readonly isAnimating = signal<boolean>(false);
  readonly results = signal<BenchmarkResult[]>([]);
  readonly currentResult = signal<BenchmarkResult | null>(null);

  // Live metrics from service
  readonly currentFps = this.metricsService.currentFps;
  readonly currentFrameTime = this.metricsService.currentFrameTime;
  readonly currentReprojectionTime = this.metricsService.currentReprojectionTime;
  readonly frameCount = this.metricsService.frameCount;

  private animationFrameId?: number;
  private sourceImageData?: ImageData;
  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D;

  // Animation state for continuous benchmark
  private animationScale = 1;
  private animationDirection = 1;

  ngAfterViewInit(): void {
    this.initCanvas();
  }

  ngOnDestroy(): void {
    this.stopBenchmark();
  }

  private initCanvas(): void {
    const canvasEl = this.canvasRef();
    if (!canvasEl) return;

    this.canvas = canvasEl.nativeElement;
    this.ctx = this.canvas.getContext('2d')!;

    // Set initial size
    const viewport = this.selectedViewport();
    this.resizeCanvas(viewport.width, viewport.height);
  }

  private resizeCanvas(width: number, height: number): void {
    if (!this.canvas || !this.ctx) return;

    this.canvas.width = width;
    this.canvas.height = height;

    // Create new source image for this size
    this.sourceImageData = this.reprojectionService.createSampleTileImage(width, height);
  }

  selectViewport(config: ViewportConfig): void {
    if (this.isRunning()) return;
    this.selectedViewport.set(config);
    this.resizeCanvas(config.width, config.height);
  }

  selectBenchmarkType(type: BenchmarkType): void {
    if (this.isRunning()) return;
    this.selectedBenchmark.set(type);
  }

  /**
   * Run a single benchmark frame
   */
  private runBenchmarkFrame(): void {
    if (!this.canvas || !this.ctx || !this.sourceImageData) return;

    const viewport = this.selectedViewport();
    const benchmarkType = this.selectedBenchmark();

    let result;

    switch (benchmarkType) {
      case 'baseline':
        result = this.reprojectionService.baselineCopy(
          this.sourceImageData,
          viewport.width,
          viewport.height
        );
        break;
      case 'nearest':
        result = this.reprojectionService.reprojectMercatorToEquirectangular(
          this.sourceImageData,
          viewport.width,
          viewport.height,
          this.animationScale,
          0,
          0
        );
        break;
      case 'bilinear':
        result = this.reprojectionService.reprojectWithBilinear(
          this.sourceImageData,
          viewport.width,
          viewport.height,
          this.animationScale,
          0,
          0
        );
        break;
    }

    // Draw result to canvas
    this.ctx.putImageData(result.imageData, 0, 0);

    // Record metrics
    this.metricsService.recordFrame(result.reprojectionTimeMs);
  }

  /**
   * Run static benchmark (single reprojection, measure time)
   */
  runStaticBenchmark(): void {
    if (this.isRunning()) return;

    const viewport = this.selectedViewport();
    const benchmarkType = this.selectedBenchmark();

    this.isRunning.set(true);
    this.metricsService.startBenchmark();

    // Run for ~2 seconds (120 frames target)
    const targetFrames = 120;
    let frameCount = 0;

    const runFrame = () => {
      this.runBenchmarkFrame();
      frameCount++;

      if (frameCount < targetFrames) {
        this.animationFrameId = requestAnimationFrame(runFrame);
      } else {
        this.finishBenchmark(`Static ${benchmarkType}`);
      }
    };

    this.animationFrameId = requestAnimationFrame(runFrame);
  }

  /**
   * Run animated benchmark (continuous zoom simulation)
   */
  runAnimatedBenchmark(): void {
    if (this.isRunning()) return;

    const benchmarkType = this.selectedBenchmark();

    this.isRunning.set(true);
    this.isAnimating.set(true);
    this.metricsService.startBenchmark();

    this.animationScale = 1;
    this.animationDirection = 1;

    const duration = 5000; // 5 second test
    const startTime = performance.now();

    const animate = () => {
      const elapsed = performance.now() - startTime;

      // Oscillate scale between 0.5 and 2.0 to simulate zoom
      this.animationScale = 1 + Math.sin(elapsed / 500) * 0.5;

      this.runBenchmarkFrame();

      if (elapsed < duration) {
        this.animationFrameId = requestAnimationFrame(animate);
      } else {
        this.isAnimating.set(false);
        this.finishBenchmark(`Animated ${benchmarkType}`);
      }
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  /**
   * Run all benchmarks for current viewport
   */
  async runAllBenchmarks(): Promise<void> {
    if (this.isRunning()) return;

    const viewport = this.selectedViewport();

    for (const benchType of this.benchmarkTypes) {
      this.selectedBenchmark.set(benchType.type);
      await this.runBenchmarkAsync(`All - ${benchType.name}`, 120);
    }
  }

  private runBenchmarkAsync(name: string, targetFrames: number): Promise<void> {
    return new Promise((resolve) => {
      this.isRunning.set(true);
      this.metricsService.startBenchmark();

      let frameCount = 0;

      const runFrame = () => {
        this.runBenchmarkFrame();
        frameCount++;

        if (frameCount < targetFrames) {
          this.animationFrameId = requestAnimationFrame(runFrame);
        } else {
          this.finishBenchmark(name);
          resolve();
        }
      };

      this.animationFrameId = requestAnimationFrame(runFrame);
    });
  }

  private finishBenchmark(testName: string): void {
    const viewport = this.selectedViewport();
    const result = this.metricsService.stopBenchmark(testName, viewport.width, viewport.height);

    this.currentResult.set(result);
    this.results.update((r) => [...r, result]);
    this.isRunning.set(false);
  }

  stopBenchmark(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }
    this.isRunning.set(false);
    this.isAnimating.set(false);
    this.metricsService.reset();
  }

  clearResults(): void {
    this.results.set([]);
    this.currentResult.set(null);
  }

  /**
   * Format pixels for display (e.g., "2.07M")
   */
  formatPixels(pixels: number): string {
    if (pixels >= 1000000) {
      return `${(pixels / 1000000).toFixed(2)}M`;
    }
    if (pixels >= 1000) {
      return `${(pixels / 1000).toFixed(1)}K`;
    }
    return String(pixels);
  }

  /**
   * Get CSS class for FPS result
   */
  getFpsClass(fps: number): string {
    if (fps >= 30) return 'fps-excellent';
    if (fps >= 23) return 'fps-good';
    if (fps >= 15) return 'fps-warning';
    return 'fps-poor';
  }
}
