import {
  Component,
  ElementRef,
  OnInit,
  OnDestroy,
  ViewChild,
  Input,
  Output,
  EventEmitter,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
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
export class MapContainerComponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  @Input() width = 960;
  @Input() height = 600;
  @Input() renderMode: RenderMode = 'svg';
  @Input() geoData?: FeatureCollection;

  @Output() zoomChange = new EventEmitter<ZoomEvent>();
  @Output() fpsUpdate = new EventEmitter<number>();

  // Signals for reactive UI
  protected readonly currentFps = signal<number>(0);
  protected readonly isAnimating = signal<boolean>(false);
  protected readonly currentStep = signal<string>('');

  private projection?: d3.GeoProjection;
  private renderContext?: RenderContext;

  constructor(
    private mapRenderer: MapRendererService,
    private geoZoom: GeoZoomService,
    private animationController: AnimationControllerService
  ) {}

  ngOnInit(): void {
    this.initializeMap();
    this.setupEventListeners();
  }

  ngOnDestroy(): void {
    if (this.mapContainer && this.mapContainer.nativeElement) {
      this.geoZoom.destroy(this.mapContainer.nativeElement);
    }
  }

  /**
   * Initialize the map
   */
  private initializeMap(): void {
    // Create equirectangular projection
    this.projection = d3
      .geoEquirectangular()
      .scale((this.width / (2 * Math.PI)))
      .translate([this.width / 2, this.height / 2]);

    // Initialize renderer
    this.renderContext =
      this.renderMode === 'svg'
        ? this.mapRenderer.initSvgRenderer(
            this.mapContainer.nativeElement,
            this.width,
            this.height,
            this.projection
          )
        : this.mapRenderer.initCanvasRenderer(
            this.mapContainer.nativeElement,
            this.width,
            this.height,
            this.projection
          );

    // Initialize zoom behavior
    this.geoZoom.init(this.mapContainer.nativeElement, this.projection, {
      scaleExtent: [0.5, 20],
    });

    // Render initial data if available
    if (this.geoData) {
      this.renderData(this.geoData);
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen to zoom changes
    this.geoZoom.onZoomChange.subscribe((event) => {
      this.handleZoomChange(event);
      this.zoomChange.emit(event);
    });

    // Listen to FPS updates
    this.animationController.onFpsUpdate.subscribe((fps) => {
      this.currentFps.set(fps);
      this.fpsUpdate.emit(fps);
    });

    // Listen to animation events
    this.animationController.onAnimationStart.subscribe(() => {
      this.isAnimating.set(true);
    });

    this.animationController.onAnimationEnd.subscribe(() => {
      this.isAnimating.set(false);
    });

    this.animationController.onStepChange.subscribe(({ step, total }) => {
      this.currentStep.set(`Step ${step} of ${total}`);
    });
  }

  /**
   * Handle zoom change events
   */
  private handleZoomChange(event: ZoomEvent): void {
    if (this.renderContext && this.projection && this.geoData) {
      // Update projection in render context
      this.mapRenderer.updateProjection(this.renderContext, this.projection);

      // Re-render data
      this.renderData(this.geoData);
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
    this.geoData = data;
    this.renderData(data);
  }

  /**
   * Play animation sequence
   */
  playAnimation(sequence: AnimationSequence): void {
    if (this.mapContainer) {
      this.animationController.playSequence(this.mapContainer.nativeElement, sequence);
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
    if (this.mapContainer) {
      this.animationController.resume(this.mapContainer.nativeElement);
    }
  }

  /**
   * Reset zoom to initial state
   */
  resetZoom(): void {
    if (this.mapContainer) {
      this.geoZoom.reset(this.mapContainer.nativeElement);
    }
  }

  /**
   * Zoom to specific scale
   */
  zoomTo(scale: number, duration: number = 750): void {
    if (this.mapContainer) {
      this.geoZoom.zoomTo(this.mapContainer.nativeElement, scale, duration);
    }
  }

  /**
   * Pan to specific coordinates
   */
  panTo(coordinates: [number, number], duration: number = 750): void {
    if (this.mapContainer) {
      this.geoZoom.panTo(this.mapContainer.nativeElement, coordinates, duration);
    }
  }

  /**
   * Zoom to extent
   */
  zoomToExtent(
    bounds: [[number, number], [number, number]],
    duration: number = 750
  ): void {
    if (this.mapContainer) {
      this.geoZoom.zoomToExtent(
        this.mapContainer.nativeElement,
        bounds,
        this.width,
        this.height,
        duration
      );
    }
  }
}
