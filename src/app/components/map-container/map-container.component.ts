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
import { MapRendererService, RenderContext } from './services/map-renderer.service';
import { GeoZoomService } from './services/geo-zoom.service';
import {
  AnimationControllerService,
  AnimationSequence,
} from './services/animation-controller.service';
import {
  ProjectionSelectorService,
  ProjectionType,
  ProjectionSelectionResult,
} from './services/projection-selector.service';
import { ProjectionTransitionService } from './services/projection-transition.service';
import { RenderMode, ZoomEvent } from './models/map.types';
import sampleGeoData from './sampleData/world.json';
import sampleTissot1000 from './sampleData/tissot_1000km_20deg.json';
import sampleTissotFiltered from './sampleData/tissot_1000km_20deg_filtered.json';
import sampleTissotFixed from './sampleData/tissot_1000km_20deg_fixed.json';
import sampleTissotTest from './sampleData/tissot_test_single.json';
import sampleTissotTest10 from './sampleData/tissot_test_10.json';
import sampleTissotTestFirst from './sampleData/tissot_test_first.json';

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
  readonly geoData = input<FeatureCollection>(sampleGeoData as FeatureCollection);
  readonly showTissot = input(false);
  readonly tissotGeoJson = input<FeatureCollection | undefined>(undefined);

  /** Enable dynamic projection selection based on viewport */
  readonly dynamicProjection = input(false);

  /** Initial projection type (default: equirectangular) */
  readonly initialProjectionType = input<ProjectionType>('equirectangular');

  /** Auto-apply projection recommendations (if false, only emits events) */
  readonly autoApplyProjection = input(true);

  readonly zoomChange = output<ZoomEvent>();
  readonly fpsUpdate = output<number>();

  /** Emitted when a projection change is recommended */
  readonly projectionRecommendation = output<ProjectionSelectionResult>();

  /** Emitted when the projection type actually changes */
  readonly projectionTypeChange = output<ProjectionSelectionResult>();

  // Signals for reactive UI
  protected readonly currentFps = signal<number>(0);
  protected readonly isAnimating = signal<boolean>(false);
  protected readonly currentStep = signal<string>('');
  protected readonly geoDataSignal = signal<FeatureCollection | undefined>(undefined);
  protected readonly currentProjectionType = signal<ProjectionType>('equirectangular');
  protected readonly projectionInfo = signal<string>('');

  private projection?: d3.GeoProjection;
  private renderContext?: RenderContext;

  private mapRenderer = inject(MapRendererService);
  private geoZoom = inject(GeoZoomService);
  private animationController = inject(AnimationControllerService);
  private projectionSelector = inject(ProjectionSelectorService);
  private projectionTransition = inject(ProjectionTransitionService);
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
      const show = this.showTissot(); // Add explicit dependency on showTissot
      if (data && this.renderContext && this.projection) {
        this.renderData(data);

        // Render tissot overlay when enabled, clear it when disabled
        // IMPORTANT: Tissot circle polygons MUST have counter-clockwise winding order
        // for SVG fills to render correctly. Clockwise winding causes SVG to fill
        // the EXTERIOR (entire map except circles), creating opaque rectangles.
        // See: src/app/components/map-container/sampleData/README.md
        if (show && this.renderContext) {
          const tgeo = this.tissotGeoJson() || (sampleTissotFixed as FeatureCollection);
          if (tgeo) {
            this.mapRenderer.renderGeoJson(this.renderContext, tgeo, {
              layer: 'tissot',
              style: { fill: 'coral', stroke: 'none', fillOpacity: 0.25 },
            });
          }
        } else if (this.renderContext) {
          // Clear tissot layer when disabled
          this.mapRenderer.clearLayer(this.renderContext, 'tissot');
        }
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

    // Create initial projection based on input type
    const initialType = this.initialProjectionType();
    this.projection = this.projectionSelector.createProjection(
      initialType,
      this.width(),
      this.height()
    );
    this.currentProjectionType.set(initialType);
    this.geoZoom.setCurrentProjectionType(initialType);

    // Update projection info
    const config = this.projectionSelector.getProjectionConfig(initialType);
    this.projectionInfo.set(config?.name || initialType);

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

    // Enable dynamic projection selection if requested
    if (this.dynamicProjection()) {
      this.geoZoom.enableDynamicProjection(this.projectionSelector, this.projectionTransition);
    }

    // Render initial data if available
    const data = this.geoData();
    if (data) {
      this.renderData(data);

      // Render tissot overlay if enabled
      if (this.showTissot()) {
        const tgeo = this.tissotGeoJson() || (sampleTissotFixed as FeatureCollection);
        if (tgeo) {
          this.mapRenderer.renderGeoJson(this.renderContext!, tgeo, {
            layer: 'tissot',
            style: { fill: 'coral', stroke: 'none', fillOpacity: 0.25 },
          });
        }
      }
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

    // Listen to projection type change recommendations
    this.geoZoom.onProjectionTypeChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((recommendation) => {
        this.handleProjectionTypeRecommendation(recommendation);
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

        // Re-render tissot overlay if enabled, clear it when disabled
        // IMPORTANT: See note above about winding order requirement for Tissot circles
        if (this.showTissot() && this.renderContext) {
          const tgeo = this.tissotGeoJson() || (sampleTissotFixed as FeatureCollection);
          if (tgeo) {
            this.mapRenderer.renderGeoJson(this.renderContext, tgeo, {
              layer: 'tissot',
              style: { fill: 'coral', stroke: 'none', fillOpacity: 0.25 },
            });
          }
        } else if (this.renderContext) {
          // Clear tissot layer when disabled
          this.mapRenderer.clearLayer(this.renderContext, 'tissot');
        }
      }
    }
  }

  /**
   * Handle projection type change recommendations from the zoom service
   */
  private async handleProjectionTypeRecommendation(
    recommendation: ProjectionSelectionResult
  ): Promise<void> {
    // Emit the recommendation
    this.projectionRecommendation.emit(recommendation);

    // Auto-apply if enabled
    if (this.autoApplyProjection() && this.dynamicProjection()) {
      await this.applyProjectionChange(recommendation);
    }
  }

  /**
   * Apply a projection change with transition
   */
  private async applyProjectionChange(result: ProjectionSelectionResult): Promise<void> {
    if (!this.projection) return;

    // Update internal state
    this.currentProjectionType.set(result.projectionType);

    // Update projection info
    const config = this.projectionSelector.getProjectionConfig(result.projectionType);
    this.projectionInfo.set(config?.name || result.projectionType);

    // Apply the change through geo zoom service (handles transition)
    await this.geoZoom.applyProjectionChange(result.projection, result.projectionType, 500);

    // Update our projection reference
    this.projection = this.geoZoom.getProjection();

    // Update render context
    if (this.renderContext && this.projection) {
      this.mapRenderer.updateProjection(this.renderContext, this.projection);
    }

    // Emit the change
    this.projectionTypeChange.emit(result);
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
   * Get the current projection type
   */
  getProjectionType(): ProjectionType {
    return this.currentProjectionType();
  }

  /**
   * Manually set the projection type
   */
  async setProjectionType(type: ProjectionType, animated: boolean = true): Promise<void> {
    if (!this.projection) return;

    const result = this.projectionSelector.setProjectionType(
      type,
      this.width(),
      this.height(),
      this.geoZoom.getViewportState().center,
      this.geoZoom.getViewportState().scale
    );

    if (animated) {
      await this.applyProjectionChange(result);
    } else {
      this.geoZoom.replaceProjection(result.projection, type);
      this.projection = result.projection;
      this.currentProjectionType.set(type);

      const config = this.projectionSelector.getProjectionConfig(type);
      this.projectionInfo.set(config?.name || type);

      if (this.renderContext) {
        this.mapRenderer.updateProjection(this.renderContext, result.projection);
        const data = this.geoDataSignal();
        if (data) {
          this.renderData(data);
        }
      }

      this.projectionTypeChange.emit(result);
    }
  }

  /**
   * Get all available projection types
   */
  getAvailableProjections(): ProjectionType[] {
    return this.projectionSelector.getAllProjectionConfigs().map((c) => c.type);
  }

  /**
   * Enable or disable dynamic projection selection
   */
  setDynamicProjectionEnabled(enabled: boolean): void {
    if (enabled) {
      this.geoZoom.enableDynamicProjection(this.projectionSelector, this.projectionTransition);
    } else {
      this.geoZoom.disableDynamicProjection();
    }
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
