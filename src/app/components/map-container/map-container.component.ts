import {
  Component,
  ElementRef,
  OnInit,
  afterNextRender,
  signal,
  viewChild,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapService } from '../../services/map.service';
import { PerformanceService } from '../../services/performance.service';

@Component({
  selector: 'app-map-container',
  imports: [CommonModule],
  templateUrl: './map-container.component.html',
  styleUrl: './map-container.component.scss'
})
export class MapContainerComponent implements OnInit {
  // Modern Angular 21: Use inject() for dependency injection
  protected readonly mapService = inject(MapService);
  protected readonly performanceService = inject(PerformanceService);

  // Modern Angular 21: Use viewChild() instead of @ViewChild
  readonly mapCanvas = viewChild<ElementRef<HTMLCanvasElement>>('mapCanvas');

  // Signals for reactive state
  readonly width = signal(960);
  readonly height = signal(600);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    // Use afterNextRender for DOM manipulation (modern Angular 21)
    afterNextRender(() => {
      this.initializeMap();
    });
  }

  ngOnInit(): void {
    // Update canvas size based on window size
    this.updateCanvasSize();
    window.addEventListener('resize', () => this.updateCanvasSize());
  }

  private updateCanvasSize(): void {
    const width = Math.min(window.innerWidth - 40, 1400);
    const height = Math.min(window.innerHeight - 180, 800);
    this.width.set(width);
    this.height.set(height);
  }

  private async initializeMap(): Promise<void> {
    const canvasRef = this.mapCanvas();
    if (!canvasRef) {
      this.error.set('Canvas element not found');
      return;
    }

    try {
      this.isLoading.set(true);

      // Initialize map service with canvas
      this.mapService.initialize(
        canvasRef.nativeElement,
        this.width(),
        this.height()
      );

      // Load GeoJSON data
      await this.mapService.loadGeoJSON('data/world-110m.geojson');

      this.isLoading.set(false);
    } catch (err) {
      this.error.set(`Failed to initialize map: ${err}`);
      this.isLoading.set(false);
    }
  }

  /**
   * Handle preset location button clicks
   */
  zoomToLocation(locationKey: string): void {
    this.mapService.animateToLocation(locationKey);
  }

  /**
   * Reset zoom to initial view
   */
  resetView(): void {
    this.mapService.resetZoom();
  }

  /**
   * Get preset locations for button generation
   */
  getLocations() {
    return this.mapService.getPresetLocations();
  }

  /**
   * Check if FPS is above target threshold
   */
  isFpsHealthy(): boolean {
    return this.performanceService.isAboveThreshold(23);
  }
}
