import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as d3 from 'd3';
import { GeoProjection, geoMercator, geoPath } from 'd3-geo';
import { zoom, zoomIdentity, ZoomBehavior, D3ZoomEvent } from 'd3-zoom';
import { select } from 'd3-selection';
import { scaleOrdinal } from 'd3-scale';
import { schemeCategory10 } from 'd3-scale-chromatic';
import { GeoFeatureCollection, PresetLocation } from '../models/geo.types';
import { PerformanceService } from './performance.service';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private http = inject(HttpClient);
  private performanceService = inject(PerformanceService);

  private projection!: GeoProjection;
  private path!: d3.GeoPath<any, d3.GeoPermissibleObjects>;
  private context!: CanvasRenderingContext2D;
  private canvas!: HTMLCanvasElement;
  private zoomBehavior!: ZoomBehavior<HTMLCanvasElement, unknown>;
  private currentTransform = zoomIdentity;
  private geoData: GeoFeatureCollection | null = null;
  private colorScale = scaleOrdinal(schemeCategory10);

  private width = 960;
  private height = 600;

  // Preset locations for animation
  private presetLocations: Record<string, PresetLocation> = {
    'world': { name: 'World', center: [0, 20], scale: 1 },
    'north-america': { name: 'North America', center: [-100, 45], scale: 3 },
    'europe': { name: 'Europe', center: [15, 50], scale: 4 },
    'asia': { name: 'Asia', center: [100, 35], scale: 3 },
    'africa': { name: 'Africa', center: [20, 0], scale: 3 },
    'south-america': { name: 'South America', center: [-60, -15], scale: 3 },
    'oceania': { name: 'Oceania', center: [135, -25], scale: 3 }
  };

  /**
   * Initialize the map service with canvas element
   */
  initialize(canvas: HTMLCanvasElement, width: number, height: number): void {
    this.canvas = canvas;
    this.width = width;
    this.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.context = ctx;

    // Setup D3 Mercator projection
    this.projection = geoMercator()
      .scale((this.width - 3) / (2 * Math.PI))
      .translate([this.width / 2, this.height / 2]);

    // Setup path generator with canvas context
    this.path = geoPath()
      .projection(this.projection)
      .context(this.context);

    // Setup zoom behavior
    this.setupZoom();
  }

  /**
   * Setup D3 zoom behavior for interactive pan/zoom
   */
  private setupZoom(): void {
    this.zoomBehavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([1, 8])
      .on('zoom', (event: D3ZoomEvent<HTMLCanvasElement, unknown>) => {
        this.currentTransform = event.transform;
        this.render();
      });

    select(this.canvas).call(this.zoomBehavior);
  }

  /**
   * Load GeoJSON data from URL
   */
  async loadGeoJSON(url: string): Promise<void> {
    try {
      this.geoData = await this.http.get<GeoFeatureCollection>(url).toPromise() as GeoFeatureCollection;
      this.render();
    } catch (error) {
      console.error('Error loading GeoJSON:', error);
      throw error;
    }
  }

  /**
   * Render the map to canvas
   */
  render(): void {
    if (!this.context || !this.geoData) {
      return;
    }

    // Clear canvas
    this.context.clearRect(0, 0, this.width, this.height);

    // Save context state
    this.context.save();

    // Apply zoom transform
    this.context.translate(this.currentTransform.x, this.currentTransform.y);
    this.context.scale(this.currentTransform.k, this.currentTransform.k);

    // Draw each feature
    this.geoData.features.forEach((feature, index) => {
      this.context.beginPath();
      this.path(feature);

      // Fill with color
      this.context.fillStyle = this.colorScale(index.toString());
      this.context.fill();

      // Stroke outline
      this.context.strokeStyle = '#333';
      this.context.lineWidth = 0.5 / this.currentTransform.k;
      this.context.stroke();
    });

    // Restore context state
    this.context.restore();

    // Record frame for FPS tracking
    this.performanceService.recordFrame();
  }

  /**
   * Animate to a preset location
   */
  animateToLocation(locationKey: string): void {
    const location = this.presetLocations[locationKey];
    if (!location) {
      console.warn(`Location "${locationKey}" not found`);
      return;
    }

    // Project the geographic center to pixel coordinates
    const point = this.projection(location.center);
    if (!point) {
      console.warn('Unable to project location coordinates');
      return;
    }

    // Calculate the transform needed to center this point
    const scale = location.scale;
    const translate: [number, number] = [
      this.width / 2 - point[0] * scale,
      this.height / 2 - point[1] * scale
    ];

    // Create the target transform
    const targetTransform = zoomIdentity
      .translate(translate[0], translate[1])
      .scale(scale);

    // Animate to the target transform
    select(this.canvas)
      .transition()
      .duration(750)
      .call(this.zoomBehavior.transform, targetTransform);
  }

  /**
   * Get available preset locations
   */
  getPresetLocations(): PresetLocation[] {
    return Object.values(this.presetLocations);
  }

  /**
   * Reset zoom to initial state
   */
  resetZoom(): void {
    select(this.canvas)
      .transition()
      .duration(750)
      .call(this.zoomBehavior.transform, zoomIdentity);
  }

  /**
   * Get current zoom level
   */
  getCurrentZoom(): number {
    return this.currentTransform.k;
  }
}
