import {
  Component,
  ElementRef,
  viewChild,
  input,
  output,
  signal,
  effect,
  AfterViewInit,
  DestroyRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as d3 from 'd3';
import { FeatureCollection } from 'geojson';
import { MapRendererService, RenderContext } from '../../services/map-renderer.service';
import { GeoZoomService } from '../../services/geo-zoom.service';
import {
  AnimationControllerService,
  AnimationSequence,
} from '../../services/animation-controller.service';
import { RenderMode, ZoomEvent } from '../../models/map.types';

@Component({
  selector: 'app-map-container',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-container.component.html',
  styleUrl: './map-container.component.scss',
})
export class MapContainerComponent implements AfterViewInit {
  readonly mapContainer = viewChild<ElementRef<HTMLDivElement>>('mapContainer');

  readonly width = input(960);
  readonly height = input(600);
  readonly renderMode = input<RenderMode>('svg');
  readonly geoData = input<FeatureCollection | undefined>(undefined);

  readonly zoomChange = output<ZoomEvent>();
  readonly fpsUpdate = output<number>();

  // Signals for reactive UI
  protected readonly currentFps = signal<number>(0);
  protected readonly isAnimating = signal<boolean>(false);
  protected readonly currentStep = signal<string>('');
  protected readonly geoDataSignal = signal<FeatureCollection | undefined>(undefined);

  private projection?: d3.GeoProjection;
  private renderContext?: RenderContext;

  private mapRenderer = inject(MapRendererService);
  private geoZoom = inject(GeoZoomService);
  private animationController = inject(AnimationControllerService);
  private destroyRef = inject(DestroyRef);

  constructor() {
    // Setup event listeners and re-render on data changes
    effect(() => {
      const data = this.geoData();
      if (data) {
        this.geoDataSignal.set(data);
      }
    });

    effect(() => {
      const data = this.geoDataSignal();
      if (data && this.renderContext && this.projection) {
        this.renderData(data);
      }
    });
  }

  ngAfterViewInit(): void {
    this.initializeMap();
    this.setupEventListeners();
  }

  /**
   * Initialize the map
   */
  private initializeMap(): void {
    const container = this.mapContainer();
    if (!container) return;

    // Create equirectangular projection
    this.projection = d3
      .geoEquirectangular()
      .scale(this.width() / (2 * Math.PI))
      .translate([this.width() / 2, this.height() / 2]);

    // Initialize renderer
    this.renderContext =
      this.renderMode() === 'svg'
        ? this.mapRenderer.initSvgRenderer(
            container.nativeElement,
            this.width(),
            this.height(),
            this.projection
          )
        : this.mapRenderer.initCanvasRenderer(
            container.nativeElement,
            this.width(),
            this.height(),
            this.projection
          );

    // Initialize zoom behavior
    this.geoZoom.init(container.nativeElement, this.projection, this.width(), this.height(), {
      scaleExtent: [0.5, 20],
    });

    // Render initial data if available
    const data = this.geoData();
    if (data) {
      this.renderData(data);
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen to projection changes
    this.geoZoom.onProjectionChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.handleProjectionChange();
    });

    // Listen to FPS updates
    this.animationController.onFpsUpdate
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((fps) => {
        this.currentFps.set(fps);
        this.fpsUpdate.emit(fps);
      });

    // Listen to animation events
    this.animationController.onAnimationStart
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.isAnimating.set(true);
      });

    this.animationController.onAnimationEnd
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.isAnimating.set(false);
      });

    this.animationController.onStepChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ step, total }) => {
        this.currentStep.set(`Step ${step} of ${total}`);
      });

    // Cleanup on destroy
    this.destroyRef.onDestroy(() => {
      const container = this.mapContainer();
      if (container && container.nativeElement) {
        this.geoZoom.destroy(container.nativeElement);
      }
    });
  }

  /**
   * Handle projection change events - re-render the map
   */
  private handleProjectionChange(): void {
    if (this.renderContext && this.projection) {
      const data = this.geoDataSignal();
      if (data) {
        // Update projection in render context
        this.mapRenderer.updateProjection(this.renderContext, this.projection);

        // Re-render data with updated projection
        this.renderData(data);
      }
    }
  }

  /**
   * Render GeoJSON data
   */
  renderData(data: FeatureCollection): void {
    if (this.renderContext) {
      this.mapRenderer.renderGeoJson(this.renderContext, data);
    }
  }

  /**
   * Update GeoJSON data
   */
  updateData(data: FeatureCollection): void {
    this.geoDataSignal.set(data);
    this.renderData(data);
  }

  /**
   * Play animation sequence
   */
  playAnimation(sequence: AnimationSequence): void {
    const container = this.mapContainer();
    if (container) {
      this.animationController.playSequence(container.nativeElement, sequence);
    }
  }

  /**
   * Stop animation
   */
  stopAnimation(): void {
    this.animationController.stop();
  }

  /**
   * Pause animation
   */
  pauseAnimation(): void {
    this.animationController.pause();
  }

  /**
   * Resume animation
   */
  resumeAnimation(): void {
    const container = this.mapContainer();
    if (container) {
      this.animationController.resume(container.nativeElement);
    }
  }

  /**
   * Reset zoom to initial state
   */
  resetZoom(): void {
    this.geoZoom.reset();
  }

  /**
   * Zoom to specific scale
   */
  zoomTo(scale: number, duration: number = 750): void {
    this.geoZoom.setScale(scale);
  }

  /**
   * Pan to specific coordinates
   */
  panTo(coordinates: [number, number], duration: number = 750): void {
    this.geoZoom.animateTo(coordinates, this.geoZoom.getCurrentState().scale, duration);
  }

  /**
   * Zoom to extent (center and scale to fit bounds)
   */
  zoomToExtent(bounds: [[number, number], [number, number]], duration: number = 750): void {
    // Calculate center of bounds
    const center: [number, number] = [
      (bounds[0][0] + bounds[1][0]) / 2,
      (bounds[0][1] + bounds[1][1]) / 2,
    ];

    // For now, use a fixed scale - can be improved to calculate optimal scale
    this.geoZoom.animateTo(center, 2, duration);
  }
}
