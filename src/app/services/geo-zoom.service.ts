import { Injectable } from '@angular/core';
import * as d3 from 'd3';
import { GeoProjection } from 'd3-geo';
import { Subject } from 'rxjs';
import { ZoomConfig, ZoomEvent } from '../models/map.types';

/**
 * GeoZoom Service
 * Ported from d3-geo-zoom but adapted for flat projections (equirectangular, etc.)
 * Handles zoom and pan interactions for geographic projections
 */
@Injectable({
  providedIn: 'root',
})
export class GeoZoomService {
  private zoomBehavior?: d3.ZoomBehavior<Element, unknown>;
  private projection?: GeoProjection;
  private initialScale = 1;
  private initialTranslate: [number, number] = [0, 0];

  // Observable for zoom/pan events
  public onZoomChange = new Subject<ZoomEvent>();

  /**
   * Initialize zoom behavior on a DOM element
   */
  init(
    element: Element,
    projection: GeoProjection,
    config: ZoomConfig = { scaleExtent: [0.5, 20] }
  ): void {
    this.projection = projection;

    // Store initial projection state
    this.initialScale = projection.scale();
    this.initialTranslate = projection.translate();

    // Create zoom behavior
    this.zoomBehavior = d3
      .zoom<Element, unknown>()
      .scaleExtent(config.scaleExtent)
      .on('zoom', (event: d3.D3ZoomEvent<Element, unknown>) => {
        this.handleZoom(event);
      });

    // Apply zoom behavior to element
    d3.select(element).call(this.zoomBehavior);

    // Prevent default double-click zoom behavior
    d3.select(element).on('dblclick.zoom', null);
  }

  /**
   * Handle zoom events
   */
  private handleZoom(event: d3.D3ZoomEvent<Element, unknown>): void {
    if (!this.projection) return;

    const { transform } = event;

    // For flat projections (equirectangular), we can directly apply scale and translate
    // Update projection scale
    const newScale = this.initialScale * transform.k;
    this.projection.scale(newScale);

    // Update projection translate
    const newTranslate: [number, number] = [
      this.initialTranslate[0] + transform.x,
      this.initialTranslate[1] + transform.y,
    ];
    this.projection.translate(newTranslate);

    // Get geographic center
    const center = this.projection.invert?.([
      this.initialTranslate[0],
      this.initialTranslate[1],
    ]) || [0, 0];

    // Emit zoom event
    this.onZoomChange.next({
      scale: transform.k,
      translate: [transform.x, transform.y],
      center: center as [number, number],
    });
  }

  /**
   * Programmatically zoom to a specific scale
   */
  zoomTo(
    element: Element,
    scale: number,
    duration: number = 750,
    callback?: () => void
  ): void {
    if (!this.zoomBehavior) return;

    const selection = d3.select(element);
    const transition = selection.transition().duration(duration);

    this.zoomBehavior.scaleTo(transition as any, scale);

    if (callback) {
      transition.on('end', callback);
    }
  }

  /**
   * Programmatically pan to a geographic location
   */
  panTo(
    element: Element,
    coordinates: [number, number],
    duration: number = 750,
    callback?: () => void
  ): void {
    if (!this.projection || !this.zoomBehavior) return;

    // Convert geographic coordinates to pixel coordinates
    const pixelCoords = this.projection(coordinates);
    if (!pixelCoords) return;

    const selection = d3.select(element);

    // Calculate the transform needed to center the point
    const [x, y] = pixelCoords;
    const [centerX, centerY] = this.initialTranslate;

    const dx = centerX - x;
    const dy = centerY - y;

    // Get current transform
    const currentTransform = d3.zoomTransform(element);

    // Create new transform
    const newTransform = d3.zoomIdentity
      .translate(currentTransform.x + dx, currentTransform.y + dy)
      .scale(currentTransform.k);

    // Apply transform with transition
    const transition = selection.transition().duration(duration);

    this.zoomBehavior.transform(transition as any, newTransform);

    if (callback) {
      transition.on('end', callback);
    }
  }

  /**
   * Zoom to a specific geographic extent (bounding box)
   */
  zoomToExtent(
    element: Element,
    bounds: [[number, number], [number, number]],
    width: number,
    height: number,
    duration: number = 750,
    callback?: () => void
  ): void {
    if (!this.projection || !this.zoomBehavior) return;

    const [[x0, y0], [x1, y1]] = bounds.map((d) => this.projection!(d)!);

    const selection = d3.select(element);

    // Calculate scale and translate to fit bounds
    const dx = x1 - x0;
    const dy = y1 - y0;
    const scale = Math.min(width / dx, height / dy) * 0.9;

    const translate: [number, number] = [
      width / 2 - (x0 + x1) / 2 * scale,
      height / 2 - (y0 + y1) / 2 * scale,
    ];

    const transform = d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale);

    const transition = selection.transition().duration(duration);

    this.zoomBehavior.transform(transition as any, transform);

    if (callback) {
      transition.on('end', callback);
    }
  }

  /**
   * Reset zoom to initial state
   */
  reset(element: Element, duration: number = 750): void {
    if (!this.zoomBehavior) return;

    const selection = d3.select(element);
    const transition = selection.transition().duration(duration);

    this.zoomBehavior.transform(transition as any, d3.zoomIdentity);
  }

  /**
   * Get current zoom transform
   */
  getCurrentTransform(element: Element): d3.ZoomTransform {
    return d3.zoomTransform(element);
  }

  /**
   * Destroy zoom behavior
   */
  destroy(element: Element): void {
    if (this.zoomBehavior) {
      d3.select(element).on('.zoom', null);
      this.zoomBehavior = undefined;
    }
    this.onZoomChange.complete();
  }
}
