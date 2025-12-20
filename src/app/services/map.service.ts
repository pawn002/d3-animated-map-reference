import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as d3 from 'd3';
import { GeoProjection, geoMercator, geoPath, geoBounds } from 'd3-geo';
import { zoom, zoomIdentity, ZoomBehavior, D3ZoomEvent } from 'd3-zoom';
import { select } from 'd3-selection';
import { scaleOrdinal } from 'd3-scale';
import { schemeCategory10 } from 'd3-scale-chromatic';
import { interpolate } from 'd3-interpolate';
import { GeoFeatureCollection, PresetLocation, ProjectionParameters } from '../models/geo.types';
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
  private geoData: GeoFeatureCollection | null = null;
  private colorScale = scaleOrdinal(schemeCategory10);

  // Baseline projection values for zoom behavior
  private baselineScale!: number;
  private baselineTranslate!: [number, number];

  private width = 960;
  private height = 600;

  // Preset locations with geographic bounds for proper projection animation
  private presetLocations: Record<string, PresetLocation> = {
    'world': {
      name: 'World',
      bounds: [[-180, -60], [180, 85]]
    },
    'north-america': {
      name: 'North America',
      bounds: [[-170, 15], [-50, 75]]
    },
    'europe': {
      name: 'Europe',
      bounds: [[-10, 35], [40, 70]]
    },
    'asia': {
      name: 'Asia',
      bounds: [[40, 0], [150, 60]]
    },
    'africa': {
      name: 'Africa',
      bounds: [[-20, -35], [55, 40]]
    },
    'south-america': {
      name: 'South America',
      bounds: [[-85, -56], [-30, 13]]
    },
    'oceania': {
      name: 'Oceania',
      bounds: [[110, -50], [180, 0]]
    }
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

    // Setup D3 Mercator projection with initial world view
    this.projection = geoMercator()
      .scale((this.width - 3) / (2 * Math.PI))
      .translate([this.width / 2, this.height / 2]);

    // Setup path generator with canvas context
    this.path = geoPath()
      .projection(this.projection)
      .context(this.context);

    // Setup zoom behavior for interactive pan/zoom
    this.setupZoom();
  }

  /**
   * Setup D3 zoom behavior - applies to projection parameters
   */
  private setupZoom(): void {
    // Initialize baseline from current projection
    this.baselineScale = this.projection.scale();
    this.baselineTranslate = this.projection.translate();

    this.zoomBehavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.5, 10])
      .on('zoom', (event: D3ZoomEvent<HTMLCanvasElement, unknown>) => {
        const { transform } = event;

        // Apply zoom transform relative to CURRENT baseline
        this.projection.scale(this.baselineScale * transform.k);
        this.projection.translate([
          this.baselineTranslate[0] + transform.x,
          this.baselineTranslate[1] + transform.y
        ]);

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
   * Render the map to canvas using current projection parameters
   */
  render(): void {
    if (!this.context || !this.geoData) {
      return;
    }

    // Clear canvas
    this.context.clearRect(0, 0, this.width, this.height);

    // Draw each feature with current projection
    this.geoData.features.forEach((feature, index) => {
      this.context.beginPath();
      this.path(feature);

      // Fill with color
      this.context.fillStyle = this.colorScale(index.toString());
      this.context.fill();

      // Stroke outline
      this.context.strokeStyle = '#333';
      this.context.lineWidth = 0.5;
      this.context.stroke();
    });

    // Record frame for FPS tracking
    this.performanceService.recordFrame();
  }

  /**
   * Calculate projection parameters to fit geographic bounds in viewport
   */
  private fitBounds(bounds: [[number, number], [number, number]]): ProjectionParameters {
    // Create GeoJSON box from bounds for fitExtent
    const geoBox = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [bounds[0][0], bounds[0][1]],  // SW corner
          [bounds[1][0], bounds[0][1]],  // SE corner
          [bounds[1][0], bounds[1][1]],  // NE corner
          [bounds[0][0], bounds[1][1]],  // NW corner
          [bounds[0][0], bounds[0][1]]   // Close polygon
        ]]
      }
    };

    // Create temp projection and use D3's fitExtent to calculate correct parameters
    const tempProjection = geoMercator();
    const padding = 50;  // pixels

    tempProjection.fitExtent(
      [[padding, padding], [this.width - padding, this.height - padding]],
      geoBox as any
    );

    // Extract the calculated parameters
    return {
      scale: tempProjection.scale(),
      translate: tempProjection.translate() as [number, number]
    };
  }

  /**
   * Animate to a preset location by interpolating projection parameters
   */
  animateToLocation(locationKey: string): void {
    const location = this.presetLocations[locationKey];
    if (!location) {
      console.warn(`Location "${locationKey}" not found`);
      return;
    }

    // Get current projection parameters
    const startScale = this.projection.scale();
    const startTranslate = this.projection.translate();

    // Calculate target projection parameters to fit bounds
    const targetParams = this.fitBounds(location.bounds);

    // Create interpolators for scale and translate
    const scaleInterpolator = interpolate(startScale, targetParams.scale);
    const translateInterpolator = interpolate(startTranslate, targetParams.translate);

    // Animate the projection parameters
    select(this.canvas)
      .transition()
      .duration(750)
      .tween('projection', () => {
        return (t: number) => {
          // Interpolate projection parameters
          this.projection.scale(scaleInterpolator(t));
          this.projection.translate(translateInterpolator(t) as [number, number]);

          // Re-render with updated projection
          this.render();
        };
      })
      .on('end', () => {
        // Update baseline values after animation completes
        this.baselineScale = this.projection.scale();
        this.baselineTranslate = this.projection.translate();

        // Reset zoom transform to identity without triggering events
        this.zoomBehavior.transform(select(this.canvas) as any, zoomIdentity);
      });
  }

  /**
   * Get available preset locations
   */
  getPresetLocations(): PresetLocation[] {
    return Object.values(this.presetLocations);
  }

  /**
   * Reset to world view
   */
  resetZoom(): void {
    this.animateToLocation('world');
  }

  /**
   * Get current zoom level
   */
  getCurrentZoom(): number {
    const initialScale = (this.width - 3) / (2 * Math.PI);
    return this.projection.scale() / initialScale;
  }
}
