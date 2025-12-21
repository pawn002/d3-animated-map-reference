import { Injectable } from '@angular/core';
import * as d3 from 'd3';
import { GeoProjection } from 'd3-geo';
import { Feature, Point } from 'geojson';

export interface TissotIndicatrixConfig {
  gridSpacing: number; // degrees between sample points (default 10)
  circleRadius: number; // radius in meters on the Earth's surface (default 50000 m)
  fillOpacity: number; // opacity of circles (default 0.3)
  strokeWidth: number; // stroke width in pixels (default 1)
}

interface TissotCircle {
  longitude: number;
  latitude: number;
  majorAxis: number;
  minorAxis: number;
  angle: number;
}

/**
 * Service to generate and render Tissot's Indicatrix of distortion
 *
 * Tissot's Indicatrix shows how a map projection distorts distances and angles
 * by displaying small circles/ellipses at regular intervals across the map.
 * The shape and size of each circle reveals the local distortion characteristics.
 */
@Injectable({
  providedIn: 'root',
})
export class TissotIndicatrixService {
  private readonly EPSILON = 1e-6; // Small value for numerical differentiation
  private readonly EARTH_RADIUS = 6371008.8; // meters (mean Earth radius)
  private readonly RAD2DEG = 180 / Math.PI;

  /**
   * Generate Tissot's Indicatrix circles for a given projection
   */
  generateTissotCircles(
    projection: GeoProjection,
    config: Partial<TissotIndicatrixConfig> = {}
  ): TissotCircle[] {
    const settings: TissotIndicatrixConfig = {
      gridSpacing: 10,
      circleRadius: 50000,
      fillOpacity: 0.3,
      strokeWidth: 1,
      ...config,
    };

    const circles: TissotCircle[] = [];

    // Generate a grid of points across the world
    for (let lat = -90 + settings.gridSpacing; lat < 90; lat += settings.gridSpacing) {
      for (let lon = -180; lon < 180; lon += settings.gridSpacing) {
        const circle = this.calculateTissotIndicatrix(projection, lon, lat, settings.circleRadius);
        if (circle) {
          circles.push(circle);
        }
      }
    }

    return circles;
  }

  /**
   * Calculate Tissot's Indicatrix ellipse at a specific point
   */
  private calculateTissotIndicatrix(
    projection: GeoProjection,
    lon: number,
    lat: number,
    radiusMeters: number
  ): TissotCircle | null {
    // Project the center point
    const centerPoint = projection([lon, lat]);
    if (!centerPoint || centerPoint.some(isNaN)) {
      return null;
    }

    // Project nearby points to calculate the derivative
    // These represent the tangent vectors in the x and y directions on the sphere
    const eastPoint = projection([lon + this.EPSILON, lat]);
    const northPoint = projection([lon, lat + this.EPSILON]);

    if (!eastPoint || eastPoint.some(isNaN) || !northPoint || northPoint.some(isNaN)) {
      return null;
    }

    // Calculate the Jacobian matrix components
    // These represent how the projection transforms distances
    const dx_dlon = (eastPoint[0] - centerPoint[0]) / this.EPSILON;
    const dy_dlon = (eastPoint[1] - centerPoint[1]) / this.EPSILON;
    const dx_dlat = (northPoint[0] - centerPoint[0]) / this.EPSILON;
    const dy_dlat = (northPoint[1] - centerPoint[1]) / this.EPSILON;

    // Calculate the metric tensor (Gram matrix)
    // This tells us about local scaling and distortion
    const a = dx_dlon * dx_dlon + dy_dlon * dy_dlon; // scaling in longitude direction
    const c = dx_dlat * dx_dlat + dy_dlat * dy_dlat; // scaling in latitude direction
    const b = dx_dlon * dx_dlat + dy_dlon * dy_dlat; // shear/rotation

    // Calculate eigenvalues to get the major and minor axes
    const trace = a + c;
    const determinant = a * c - b * b;

    if (determinant <= 0 || trace < 0) {
      return null; // Invalid distortion values
    }

    // Eigenvalues of the metric tensor
    const discriminant = (trace * trace) / 4 - determinant;
    if (discriminant < 0) {
      return null;
    }

    const lambda1 = trace / 2 + Math.sqrt(discriminant);
    const lambda2 = trace / 2 - Math.sqrt(discriminant);

    // Convert requested radius (meters) to angular degrees on the sphere
    const angularDeg = (radiusMeters / this.EARTH_RADIUS) * this.RAD2DEG;

    // The semi-major and semi-minor axes in screen pixels
    const majorAxis = Math.sqrt(lambda1) * angularDeg;
    const minorAxis = Math.sqrt(lambda2) * angularDeg;

    // Calculate the rotation angle of the ellipse
    let angle = 0;
    if (Math.abs(b) > 1e-10) {
      angle = Math.atan2(b, (a - c) / 2) / 2;
    }

    return {
      longitude: lon,
      latitude: lat,
      majorAxis,
      minorAxis,
      angle,
    };
  }

  /**
   * Render Tissot's Indicatrix circles on an SVG selection
   */
  renderTissotSvg(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    circles: TissotCircle[],
    projection: d3.GeoProjection,
    config: Partial<TissotIndicatrixConfig> = {}
  ): void {
    const settings: TissotIndicatrixConfig = {
      gridSpacing: 10,
      circleRadius: 5,
      fillOpacity: 0.3,
      strokeWidth: 1,
      ...config,
    };

    // Create or select the tissot group
    let tissotGroup = svg.select('g.tissot-indicatrix') as d3.Selection<
      SVGGElement,
      unknown,
      null,
      undefined
    >;
    if (tissotGroup.empty()) {
      tissotGroup = svg.append('g').attr('class', 'tissot-indicatrix') as d3.Selection<
        SVGGElement,
        unknown,
        null,
        undefined
      >;
    }

    // Bind data and render ellipses
    const ellipses = tissotGroup
      .selectAll<SVGEllipseElement, TissotCircle>('ellipse')
      .data(circles, (d, i) => `${d.longitude}-${d.latitude}`);

    // Remove old ellipses
    ellipses.exit().remove();

    // Add new ellipses
    // Position ellipses via a translate() transform so they share
    // the same projected coordinate space as the map paths. Calculate
    // ellipse axes and rotation at render time using the current projection
    // so they remain synchronized during animation.
    ellipses
      .enter()
      .append('ellipse')
      .merge(ellipses)
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('fill', '#e74c3c')
      .attr('fill-opacity', settings.fillOpacity)
      .attr('stroke', '#c0392b')
      .attr('stroke-width', settings.strokeWidth)
      .attr('transform', (d) => {
        const projected = projection([d.longitude, d.latitude]);
        if (!projected) return '';
        // Compute ellipse parameters using current projection
        const params = this.calculateTissotIndicatrix(
          projection,
          d.longitude,
          d.latitude,
          settings.circleRadius
        );
        const rx = params ? params.majorAxis : 0;
        const ry = params ? params.minorAxis : 0;
        const angleDeg = params ? (params.angle * 180) / Math.PI : 0;
        // Store rx/ry as attributes and translate+rotate to position
        // Note: set rx/ry here as well because we compute them dynamically
        // by selecting the element after the transform string is applied.
        return `translate(${projected[0]},${projected[1]}) rotate(${angleDeg})`;
      })
      .attr('rx', (d) => {
        const params = this.calculateTissotIndicatrix(
          projection,
          d.longitude,
          d.latitude,
          settings.circleRadius
        );
        return params ? params.majorAxis : 0;
      })
      .attr('ry', (d) => {
        const params = this.calculateTissotIndicatrix(
          projection,
          d.longitude,
          d.latitude,
          settings.circleRadius
        );
        return params ? params.minorAxis : 0;
      });
  }

  /**
   * Render Tissot's Indicatrix circles on a Canvas context
   */
  renderTissotCanvas(
    context: CanvasRenderingContext2D,
    circles: TissotCircle[],
    projection: d3.GeoProjection,
    config: Partial<TissotIndicatrixConfig> = {}
  ): void {
    const settings: TissotIndicatrixConfig = {
      gridSpacing: 10,
      circleRadius: 5,
      fillOpacity: 0.3,
      strokeWidth: 1,
      ...config,
    };

    context.save();
    context.fillStyle = `rgba(231, 76, 60, ${settings.fillOpacity})`;
    context.strokeStyle = 'rgb(192, 57, 43)';
    context.lineWidth = settings.strokeWidth;

    circles.forEach((circle) => {
      const projected = projection([circle.longitude, circle.latitude]);
      if (!projected) return;
      context.save();
      context.translate(projected[0], projected[1]);
      context.rotate((circle.angle * Math.PI) / 180);
      context.beginPath();
      context.ellipse(0, 0, circle.majorAxis, circle.minorAxis, 0, 0, 2 * Math.PI);
      context.fill();
      context.stroke();
      context.restore();
    });

    context.restore();
  }

  /**
   * Clear Tissot's Indicatrix rendering from SVG
   */
  clearTissotSvg(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>): void {
    svg.selectAll('g.tissot-indicatrix').remove();
  }
}
