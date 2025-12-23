import { Injectable } from '@angular/core';
import * as d3 from 'd3';
import { GeoPath, GeoProjection } from 'd3-geo';
import { FeatureCollection } from 'geojson';
import { RenderMode } from '../models/map.types';

export interface RenderContext {
  svg?: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  canvas?: HTMLCanvasElement;
  context?: CanvasRenderingContext2D;
  mode: RenderMode;
  path: GeoPath;
}

@Injectable({
  providedIn: 'root',
})
export class MapRendererService {
  /**
   * Initialize SVG renderer
   */
  initSvgRenderer(
    container: HTMLElement,
    width: number,
    height: number,
    projection: GeoProjection
  ): RenderContext {
    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('class', 'map-svg');

    const path = d3.geoPath().projection(projection);

    return {
      svg,
      mode: 'svg',
      path,
    };
  }

  /**
   * Initialize Canvas renderer (for future implementation)
   */
  initCanvasRenderer(
    container: HTMLElement,
    width: number,
    height: number,
    projection: GeoProjection
  ): RenderContext {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.className = 'map-canvas';
    container.appendChild(canvas);

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get 2D context from canvas');
    }

    const path = d3.geoPath().projection(projection).context(context);

    return {
      canvas,
      context,
      mode: 'canvas',
      path,
    };
  }

  /**
   * Render GeoJSON data
   */
  renderGeoJson(
    renderContext: RenderContext,
    data: FeatureCollection,
    options?: {
      layer?: string;
      style?: { fill?: string; stroke?: string; strokeWidth?: number; fillOpacity?: number };
    }
  ): void {
    if (renderContext.mode === 'svg' && renderContext.svg) {
      this.renderSvg(renderContext, data, options);
    } else if (renderContext.mode === 'canvas' && renderContext.context) {
      this.renderCanvas(renderContext, data, options);
    }
  }

  /**
   * Render to SVG
   */
  private renderSvg(
    renderContext: RenderContext,
    data: FeatureCollection,
    options?: {
      layer?: string;
      style?: { fill?: string; stroke?: string; strokeWidth?: number; fillOpacity?: number };
    }
  ): void {
    if (!renderContext.svg) return;

    const layer = options?.layer || 'base';
    const defaults = { fill: '#ccc', stroke: '#333', strokeWidth: 0.5, fillOpacity: 1 };
    const style = Object.assign({}, defaults, options?.style || {});

    // Remove existing paths for this layer only
    renderContext.svg.selectAll(`path.layer-${layer}`).remove();

    // Add new paths for this layer - one path per feature
    const fillOpacity = style.fillOpacity ?? defaults.fillOpacity;
    renderContext.svg
      .selectAll(`path.layer-${layer}`)
      .data(data.features, (d: any, i: number) => i)
      .enter()
      .append('path')
      .attr('d', (d: any) => renderContext.path(d))
      .attr('class', `geo-feature layer-${layer}`)
      .attr('fill', style.fill ?? defaults.fill)
      .attr('fill-opacity', String(fillOpacity))
      .attr('stroke', style.stroke ?? defaults.stroke)
      .attr('stroke-width', String(style.strokeWidth ?? defaults.strokeWidth));
  }

  /**
   * Render to Canvas
   */
  private renderCanvas(
    renderContext: RenderContext,
    data: FeatureCollection,
    options?: {
      layer?: string;
      style?: { fill?: string; stroke?: string; strokeWidth?: number; fillOpacity?: number };
    }
  ): void {
    if (!renderContext.context || !renderContext.canvas) return;

    const ctx = renderContext.context;
    const canvas = renderContext.canvas;
    const layer = options?.layer || 'base';
    const defaults = { fill: '#ccc', stroke: '#333', strokeWidth: 0.5, fillOpacity: 1 };
    const style = Object.assign({}, defaults, options?.style || {});

    // Clear canvas only when drawing the base layer so overlays can be drawn on top
    if (layer === 'base') {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Draw each feature applying style
    ctx.save();

    // Set fill and stroke styles
    const hasFill = typeof style.fill === 'string' && style.fill.toLowerCase() !== 'none';
    const fillOpacity = typeof style.fillOpacity === 'number' ? style.fillOpacity : 1;

    if (hasFill) {
      ctx.fillStyle = style.fill || defaults.fill;
      ctx.globalAlpha = fillOpacity;
    }

    ctx.strokeStyle = style.stroke || defaults.stroke;
    ctx.lineWidth = style.strokeWidth ?? defaults.strokeWidth;

    for (const feature of data.features) {
      ctx.beginPath();
      renderContext.path(feature as any);

      // Fill if applicable
      if (hasFill) {
        ctx.fill();
      }

      // Stroke if not 'none'
      if (!(typeof style.stroke === 'string' && style.stroke.toLowerCase() === 'none')) {
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * Clear the rendering context
   */
  clear(renderContext: RenderContext): void {
    if (renderContext.mode === 'svg' && renderContext.svg) {
      renderContext.svg.selectAll('*').remove();
    } else if (renderContext.mode === 'canvas' && renderContext.context && renderContext.canvas) {
      renderContext.context.clearRect(
        0,
        0,
        renderContext.canvas.width,
        renderContext.canvas.height
      );
    }
  }

  /**
   * Clear a specific layer from the rendering context
   */
  clearLayer(renderContext: RenderContext, layer: string): void {
    if (renderContext.mode === 'svg' && renderContext.svg) {
      renderContext.svg.selectAll(`path.layer-${layer}`).remove();
    } else if (renderContext.mode === 'canvas') {
      // For canvas, we need to re-render all other layers
      // This is a limitation of canvas - can't selectively remove
      // For now, we'll just note this - full implementation would require layer tracking
      console.warn('Canvas layer clearing not fully implemented - consider re-rendering');
    }
  }

  /**
   * Update projection for render context
   */
  updateProjection(renderContext: RenderContext, projection: GeoProjection): void {
    renderContext.path = d3.geoPath().projection(projection);
    if (renderContext.mode === 'canvas' && renderContext.context) {
      renderContext.path.context(renderContext.context);
    }
  }
}
