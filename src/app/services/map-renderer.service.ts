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
  renderGeoJson(renderContext: RenderContext, data: FeatureCollection): void {
    if (renderContext.mode === 'svg' && renderContext.svg) {
      this.renderSvg(renderContext, data);
    } else if (renderContext.mode === 'canvas' && renderContext.context) {
      this.renderCanvas(renderContext, data);
    }
  }

  /**
   * Render to SVG
   */
  private renderSvg(renderContext: RenderContext, data: FeatureCollection): void {
    if (!renderContext.svg) return;

    // Remove existing paths
    renderContext.svg.selectAll('path').remove();

    // Add new paths
    renderContext.svg
      .selectAll('path')
      .data(data.features)
      .join('path')
      .attr('d', renderContext.path)
      .attr('class', 'geo-feature')
      .attr('fill', '#ccc')
      .attr('stroke', '#333')
      .attr('stroke-width', 0.5);
  }

  /**
   * Render to Canvas
   */
  private renderCanvas(renderContext: RenderContext, data: FeatureCollection): void {
    if (!renderContext.context || !renderContext.canvas) return;

    const ctx = renderContext.context;

    // Clear canvas
    ctx.clearRect(0, 0, renderContext.canvas.width, renderContext.canvas.height);

    // Draw features
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    ctx.fillStyle = '#ccc';

    ctx.beginPath();
    renderContext.path(data);
    ctx.fill();
    ctx.stroke();
  }

  /**
   * Clear the rendering context
   */
  clear(renderContext: RenderContext): void {
    if (renderContext.mode === 'svg' && renderContext.svg) {
      renderContext.svg.selectAll('*').remove();
    } else if (renderContext.mode === 'canvas' && renderContext.context && renderContext.canvas) {
      renderContext.context.clearRect(0, 0, renderContext.canvas.width, renderContext.canvas.height);
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
