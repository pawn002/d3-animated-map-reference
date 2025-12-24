import { Injectable } from '@angular/core';
import * as d3 from 'd3';
import { GeoProjection } from 'd3-geo';
import { Subject } from 'rxjs';

/**
 * Projection types supported by the selector
 */
export type ProjectionType =
  | 'equirectangular'
  | 'mercator'
  | 'orthographic'
  | 'naturalEarth1'
  | 'albers'
  | 'albersUsa'
  | 'azimuthalEqualArea'
  | 'conicEqualArea'
  | 'stereographic';

/**
 * Configuration for a projection type
 */
export interface ProjectionConfig {
  type: ProjectionType;
  name: string;
  /** Optimal for global views (scale < 2) */
  globalView: boolean;
  /** Optimal for regional views (scale 2-8) */
  regionalView: boolean;
  /** Optimal for local views (scale > 8) */
  localView: boolean;
  /** Preserves area (equal-area projection) */
  equalArea: boolean;
  /** Preserves angles/shapes (conformal projection) */
  conformal: boolean;
  /** Requires clip angle (e.g., globe projections) */
  clipAngle?: number;
  /** Special latitude ranges where this projection excels */
  optimalLatRange?: [number, number];
}

/**
 * Viewport state for projection selection
 */
export interface ViewportState {
  center: [number, number]; // [longitude, latitude]
  scale: number; // Relative scale (1 = world fit)
  width: number;
  height: number;
}

/**
 * Result of projection selection
 */
export interface ProjectionSelectionResult {
  projectionType: ProjectionType;
  projection: GeoProjection;
  reason: string;
}

/**
 * Projection Selector Service
 *
 * Dynamically selects the optimal map projection based on:
 * - Viewport dimensions
 * - Visible geographic content (center/rotation)
 * - Zoom scale level
 *
 * Goals:
 * - Minimize conformal or area distortion based on use case
 * - Provide smooth transitions between projections
 * - Support global (Orthographic/Natural Earth) to local (Mercator) views
 */
@Injectable({
  providedIn: 'root',
})
export class ProjectionSelectorService {
  /** Emits when a projection change is recommended */
  public onProjectionRecommendation = new Subject<ProjectionSelectionResult>();

  /** Emits when projection actually changes */
  public onProjectionChange = new Subject<ProjectionSelectionResult>();

  /** Available projection configurations */
  private readonly projectionConfigs: Map<ProjectionType, ProjectionConfig> = new Map([
    [
      'orthographic',
      {
        type: 'orthographic',
        name: 'Orthographic (Globe)',
        globalView: true,
        regionalView: false,
        localView: false,
        equalArea: false,
        conformal: false,
        clipAngle: 90,
      },
    ],
    [
      'naturalEarth1',
      {
        type: 'naturalEarth1',
        name: 'Natural Earth',
        globalView: true,
        regionalView: true,
        localView: false,
        equalArea: false,
        conformal: false,
      },
    ],
    [
      'equirectangular',
      {
        type: 'equirectangular',
        name: 'Equirectangular',
        globalView: true,
        regionalView: true,
        localView: true,
        equalArea: false,
        conformal: false,
      },
    ],
    [
      'mercator',
      {
        type: 'mercator',
        name: 'Mercator',
        globalView: false,
        regionalView: true,
        localView: true,
        equalArea: false,
        conformal: true,
      },
    ],
    [
      'azimuthalEqualArea',
      {
        type: 'azimuthalEqualArea',
        name: 'Azimuthal Equal Area',
        globalView: false,
        regionalView: true,
        localView: false,
        equalArea: true,
        conformal: false,
        optimalLatRange: [60, 90], // Good for polar regions
      },
    ],
    [
      'conicEqualArea',
      {
        type: 'conicEqualArea',
        name: 'Conic Equal Area',
        globalView: false,
        regionalView: true,
        localView: true,
        equalArea: true,
        conformal: false,
        optimalLatRange: [20, 60], // Good for mid-latitudes
      },
    ],
    [
      'albers',
      {
        type: 'albers',
        name: 'Albers Equal Area',
        globalView: false,
        regionalView: true,
        localView: true,
        equalArea: true,
        conformal: false,
        optimalLatRange: [20, 60],
      },
    ],
    [
      'albersUsa',
      {
        type: 'albersUsa',
        name: 'Albers USA',
        globalView: false,
        regionalView: true,
        localView: true,
        equalArea: true,
        conformal: false,
      },
    ],
    [
      'stereographic',
      {
        type: 'stereographic',
        name: 'Stereographic',
        globalView: false,
        regionalView: true,
        localView: true,
        equalArea: false,
        conformal: true,
        clipAngle: 90,
      },
    ],
  ]);

  /** Current projection type */
  private currentProjectionType: ProjectionType = 'equirectangular';

  /** Current projection instance */
  private currentProjection?: GeoProjection;

  /** Scale thresholds for view classification */
  private readonly scaleThresholds = {
    global: 1.5, // scale < 1.5 = global view
    regional: 6, // scale 1.5-6 = regional view, scale > 6 = local view
  };

  /** Hysteresis factor to prevent rapid switching */
  private readonly hysteresis = 0.3;

  /** Last scale when projection was changed */
  private lastChangeScale = 1;

  constructor() {}

  /**
   * Get the current projection type
   */
  getCurrentProjectionType(): ProjectionType {
    return this.currentProjectionType;
  }

  /**
   * Get configuration for a projection type
   */
  getProjectionConfig(type: ProjectionType): ProjectionConfig | undefined {
    return this.projectionConfigs.get(type);
  }

  /**
   * Get all available projection configs
   */
  getAllProjectionConfigs(): ProjectionConfig[] {
    return Array.from(this.projectionConfigs.values());
  }

  /**
   * Create a projection instance for the given type
   */
  createProjection(
    type: ProjectionType,
    width: number,
    height: number,
    center?: [number, number]
  ): GeoProjection {
    let projection: GeoProjection;

    switch (type) {
      case 'orthographic':
        projection = d3.geoOrthographic();
        break;
      case 'naturalEarth1':
        projection = d3.geoNaturalEarth1();
        break;
      case 'mercator':
        projection = d3.geoMercator();
        break;
      case 'azimuthalEqualArea':
        projection = d3.geoAzimuthalEqualArea();
        break;
      case 'conicEqualArea':
        projection = d3.geoConicEqualArea();
        break;
      case 'albers':
        projection = d3.geoAlbers();
        break;
      case 'albersUsa':
        projection = d3.geoAlbersUsa();
        break;
      case 'stereographic':
        projection = d3.geoStereographic();
        break;
      case 'equirectangular':
      default:
        projection = d3.geoEquirectangular();
        break;
    }

    // Configure base projection
    const config = this.projectionConfigs.get(type);

    // Set default scale to fit the viewport
    const baseScale = this.calculateBaseScale(type, width, height);
    projection.scale(baseScale).translate([width / 2, height / 2]);

    // Apply clip angle if needed
    if (config?.clipAngle && projection.clipAngle) {
      projection.clipAngle(config.clipAngle);
    }

    // Apply center/rotation if provided
    if (center) {
      if (projection.rotate) {
        projection.rotate([-center[0], -center[1], 0]);
      }
    }

    return projection;
  }

  /**
   * Calculate base scale for a projection type to fit the viewport
   */
  private calculateBaseScale(type: ProjectionType, width: number, height: number): number {
    const minDim = Math.min(width, height);

    switch (type) {
      case 'orthographic':
        return minDim / 2.2; // Globe fills ~90% of smaller dimension
      case 'naturalEarth1':
        return width / 5.5; // Natural Earth has specific proportions
      case 'mercator':
        return width / (2 * Math.PI);
      case 'azimuthalEqualArea':
      case 'stereographic':
        return minDim / 3;
      case 'conicEqualArea':
      case 'albers':
        return width / 4;
      case 'albersUsa':
        return width / 1.2; // AlbersUSA has built-in scaling
      case 'equirectangular':
      default:
        return width / (2 * Math.PI);
    }
  }

  /**
   * Select the optimal projection based on viewport state
   */
  selectOptimalProjection(viewport: ViewportState): ProjectionSelectionResult {
    const { center, scale, width, height } = viewport;
    const [lon, lat] = center;
    const absLat = Math.abs(lat);

    // Determine view type based on scale with hysteresis
    const effectiveScale = this.applyHysteresis(scale);
    const isGlobalView = effectiveScale < this.scaleThresholds.global;
    const isLocalView = effectiveScale > this.scaleThresholds.regional;

    let recommendedType: ProjectionType;
    let reason: string;

    if (isGlobalView) {
      // Global view: prefer Natural Earth or Orthographic
      if (effectiveScale < 0.8) {
        recommendedType = 'orthographic';
        reason = 'Globe view for very zoomed out perspective';
      } else {
        recommendedType = 'naturalEarth1';
        reason = 'Natural Earth for balanced global view with less distortion than Mercator';
      }
    } else if (isLocalView) {
      // Local view: prefer conformal projections for accurate shapes
      if (absLat > 70) {
        // Near poles, use stereographic
        recommendedType = 'stereographic';
        reason = 'Stereographic for polar regions to minimize shape distortion';
      } else {
        // Normal local view: Mercator for navigation-friendly conformal map
        recommendedType = 'mercator';
        reason = 'Mercator for local view with preserved angles and shapes';
      }
    } else {
      // Regional view: choose based on latitude and area preservation needs
      if (absLat > 60) {
        // High latitudes: azimuthal equal area
        recommendedType = 'azimuthalEqualArea';
        reason = 'Azimuthal Equal Area for high latitude regions with accurate areas';
      } else if (absLat > 20 && absLat <= 60) {
        // Mid-latitudes: conic equal area
        recommendedType = 'conicEqualArea';
        reason = 'Conic Equal Area for mid-latitude regions with balanced distortion';
      } else {
        // Equatorial regions: Natural Earth or Equirectangular
        recommendedType = 'naturalEarth1';
        reason = 'Natural Earth for equatorial regions with good visual balance';
      }
    }

    // Check if this is actually a change from current
    const isChange = recommendedType !== this.currentProjectionType;

    // Create the projection
    const projection = this.createProjection(recommendedType, width, height, center);

    // Apply the current scale
    const baseScale = this.calculateBaseScale(recommendedType, width, height);
    projection.scale(baseScale * scale);

    const result: ProjectionSelectionResult = {
      projectionType: recommendedType,
      projection,
      reason,
    };

    if (isChange) {
      this.onProjectionRecommendation.next(result);
    }

    return result;
  }

  /**
   * Apply hysteresis to prevent rapid projection switching
   */
  private applyHysteresis(scale: number): number {
    // If scale is moving away from last change point, use it directly
    // If moving back toward the threshold, require extra movement
    const diff = Math.abs(scale - this.lastChangeScale);
    if (diff < this.hysteresis) {
      return this.lastChangeScale; // Stay with current classification
    }
    return scale;
  }

  /**
   * Confirm a projection change (updates internal state)
   */
  confirmProjectionChange(result: ProjectionSelectionResult): void {
    this.currentProjectionType = result.projectionType;
    this.currentProjection = result.projection;
    this.lastChangeScale = this.currentProjection.scale() / this.calculateBaseScale(
      result.projectionType,
      800, // approximate width
      600  // approximate height
    );
    this.onProjectionChange.next(result);
  }

  /**
   * Force a specific projection type
   */
  setProjectionType(
    type: ProjectionType,
    width: number,
    height: number,
    center?: [number, number],
    scale: number = 1
  ): ProjectionSelectionResult {
    const projection = this.createProjection(type, width, height, center);

    // Apply scale
    const baseScale = this.calculateBaseScale(type, width, height);
    projection.scale(baseScale * scale);

    const config = this.projectionConfigs.get(type);

    const result: ProjectionSelectionResult = {
      projectionType: type,
      projection,
      reason: `Manually set to ${config?.name || type}`,
    };

    this.confirmProjectionChange(result);
    return result;
  }

  /**
   * Get the base scale for the current projection type
   */
  getBaseScale(type: ProjectionType, width: number, height: number): number {
    return this.calculateBaseScale(type, width, height);
  }

  /**
   * Transfer state from one projection to another
   * Returns a new projection with equivalent view state
   */
  transferProjectionState(
    fromProjection: GeoProjection,
    toType: ProjectionType,
    width: number,
    height: number
  ): GeoProjection {
    // Get current rotation/center from source projection
    const rotation = fromProjection.rotate?.() || [0, 0, 0];
    const center: [number, number] = [-rotation[0], -rotation[1]];

    // Calculate relative scale
    const fromType = this.currentProjectionType;
    const fromBaseScale = this.calculateBaseScale(fromType, width, height);
    const currentScale = fromProjection.scale();
    const relativeScale = currentScale / fromBaseScale;

    // Create new projection with transferred state
    const newProjection = this.createProjection(toType, width, height, center);

    // Apply equivalent scale
    const toBaseScale = this.calculateBaseScale(toType, width, height);
    newProjection.scale(toBaseScale * relativeScale);

    return newProjection;
  }

  /**
   * Check if a projection type is suitable for the given viewport
   */
  isProjectionSuitable(type: ProjectionType, viewport: ViewportState): boolean {
    const config = this.projectionConfigs.get(type);
    if (!config) return false;

    const { scale, center } = viewport;
    const absLat = Math.abs(center[1]);

    // Check scale suitability
    const isGlobal = scale < this.scaleThresholds.global;
    const isLocal = scale > this.scaleThresholds.regional;
    const isRegional = !isGlobal && !isLocal;

    if (isGlobal && !config.globalView) return false;
    if (isRegional && !config.regionalView) return false;
    if (isLocal && !config.localView) return false;

    // Check latitude range if specified
    if (config.optimalLatRange) {
      const [minLat, maxLat] = config.optimalLatRange;
      if (absLat < minLat || absLat > maxLat) {
        // Not optimal, but may still be suitable
        return config.regionalView || config.localView;
      }
    }

    return true;
  }

  /**
   * Get distortion info for a projection at a given location
   * Returns approximate distortion factors for area and angles
   */
  getDistortionInfo(
    type: ProjectionType,
    lat: number
  ): { areaDistortion: number; angularDistortion: number } {
    const absLat = Math.abs(lat);
    const config = this.projectionConfigs.get(type);

    if (!config) {
      return { areaDistortion: 1, angularDistortion: 0 };
    }

    // Approximate distortion based on projection properties
    if (config.equalArea) {
      // Equal area projections have no area distortion
      // but angular distortion increases with latitude for some
      return {
        areaDistortion: 1,
        angularDistortion: type === 'azimuthalEqualArea' ? absLat / 90 * 0.3 : absLat / 90 * 0.5,
      };
    }

    if (config.conformal) {
      // Conformal projections preserve angles but distort area
      // Mercator area distortion: sec^2(lat)
      if (type === 'mercator') {
        const secLat = 1 / Math.cos((absLat * Math.PI) / 180);
        return {
          areaDistortion: secLat * secLat,
          angularDistortion: 0,
        };
      }
      return {
        areaDistortion: 1 + absLat / 90,
        angularDistortion: 0,
      };
    }

    // Compromise projections (like Natural Earth, Equirectangular)
    return {
      areaDistortion: 1 + (absLat / 90) * 0.5,
      angularDistortion: absLat / 90 * 0.3,
    };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.onProjectionRecommendation.complete();
    this.onProjectionChange.complete();
  }
}
