import { Injectable } from '@angular/core';
import * as d3 from 'd3';
import { GeoProjection } from 'd3-geo';

export interface ReprojectionConfig {
  sourceProjection: 'mercator' | 'equirectangular';
  targetProjection: 'mercator' | 'equirectangular';
  width: number;
  height: number;
}

export interface ReprojectionResult {
  imageData: ImageData;
  reprojectionTimeMs: number;
}

@Injectable({
  providedIn: 'root',
})
export class ReprojectionService {
  private sourceCanvas?: HTMLCanvasElement;
  private sourceCtx?: CanvasRenderingContext2D;

  /**
   * Create a sample raster tile image (checkerboard pattern simulating a tile)
   * In real implementation, this would load actual map tiles
   */
  createSampleTileImage(width: number, height: number): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Create a checkerboard pattern to simulate map tile content
    const tileSize = 32;
    for (let y = 0; y < height; y += tileSize) {
      for (let x = 0; x < width; x += tileSize) {
        const isEven = ((x / tileSize) + (y / tileSize)) % 2 === 0;
        ctx.fillStyle = isEven ? '#e0e0e0' : '#a0c0e0';
        ctx.fillRect(x, y, tileSize, tileSize);
      }
    }

    // Add some "geographic" features - simulate coastlines
    ctx.strokeStyle = '#4a7c59';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const startX = Math.random() * width;
      const startY = Math.random() * height;
      ctx.moveTo(startX, startY);
      for (let j = 0; j < 10; j++) {
        ctx.lineTo(
          startX + (Math.random() - 0.5) * 200,
          startY + j * (height / 10) + (Math.random() - 0.5) * 50
        );
      }
    }
    ctx.stroke();

    return ctx.getImageData(0, 0, width, height);
  }

  /**
   * Reproject raster data from Web Mercator to Equirectangular
   * This is the CPU-intensive operation we're benchmarking
   */
  reprojectMercatorToEquirectangular(
    sourceData: ImageData,
    targetWidth: number,
    targetHeight: number,
    scale: number = 1,
    centerLon: number = 0,
    centerLat: number = 0
  ): ReprojectionResult {
    const startTime = performance.now();

    // Source is in Web Mercator (what tiles use)
    // Target is Equirectangular (what this project uses)
    const targetProjection = d3
      .geoEquirectangular()
      .scale(targetWidth / (2 * Math.PI) * scale)
      .translate([targetWidth / 2, targetHeight / 2])
      .center([centerLon, centerLat]);

    // Create target image data
    const targetData = new ImageData(targetWidth, targetHeight);

    const srcWidth = sourceData.width;
    const srcHeight = sourceData.height;
    const srcData = sourceData.data;
    const tgtData = targetData.data;

    // For each pixel in target (Equirectangular) viewport
    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        // Get lon/lat for this target pixel
        const lonLat = targetProjection.invert!([x, y]);
        if (!lonLat) continue;

        const [lon, lat] = lonLat;

        // Skip if outside valid range
        if (lat < -85 || lat > 85) continue; // Mercator limit
        if (lon < -180 || lon > 180) continue;

        // Convert lon/lat to source (Mercator) pixel coordinates
        // Web Mercator formula: x = lon, y = ln(tan(π/4 + lat/2))
        const mercX = ((lon + 180) / 360) * srcWidth;

        // Mercator Y projection
        const latRad = (lat * Math.PI) / 180;
        const mercY = (1 - Math.log(Math.tan(Math.PI / 4 + latRad / 2)) / Math.PI) / 2 * srcHeight;

        // Bounds check
        if (mercX < 0 || mercX >= srcWidth || mercY < 0 || mercY >= srcHeight) continue;

        // Nearest neighbor sampling (faster than bilinear)
        const srcX = Math.floor(mercX);
        const srcY = Math.floor(mercY);
        const srcIdx = (srcY * srcWidth + srcX) * 4;
        const tgtIdx = (y * targetWidth + x) * 4;

        // Copy RGBA values
        tgtData[tgtIdx] = srcData[srcIdx];
        tgtData[tgtIdx + 1] = srcData[srcIdx + 1];
        tgtData[tgtIdx + 2] = srcData[srcIdx + 2];
        tgtData[tgtIdx + 3] = srcData[srcIdx + 3];
      }
    }

    const reprojectionTimeMs = performance.now() - startTime;

    return {
      imageData: targetData,
      reprojectionTimeMs,
    };
  }

  /**
   * Reproject with bilinear interpolation (higher quality, slower)
   */
  reprojectWithBilinear(
    sourceData: ImageData,
    targetWidth: number,
    targetHeight: number,
    scale: number = 1,
    centerLon: number = 0,
    centerLat: number = 0
  ): ReprojectionResult {
    const startTime = performance.now();

    const targetProjection = d3
      .geoEquirectangular()
      .scale(targetWidth / (2 * Math.PI) * scale)
      .translate([targetWidth / 2, targetHeight / 2])
      .center([centerLon, centerLat]);

    const targetData = new ImageData(targetWidth, targetHeight);

    const srcWidth = sourceData.width;
    const srcHeight = sourceData.height;
    const srcData = sourceData.data;
    const tgtData = targetData.data;

    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const lonLat = targetProjection.invert!([x, y]);
        if (!lonLat) continue;

        const [lon, lat] = lonLat;
        if (lat < -85 || lat > 85 || lon < -180 || lon > 180) continue;

        const mercX = ((lon + 180) / 360) * srcWidth;
        const latRad = (lat * Math.PI) / 180;
        const mercY = (1 - Math.log(Math.tan(Math.PI / 4 + latRad / 2)) / Math.PI) / 2 * srcHeight;

        if (mercX < 0 || mercX >= srcWidth - 1 || mercY < 0 || mercY >= srcHeight - 1) continue;

        // Bilinear interpolation
        const x0 = Math.floor(mercX);
        const y0 = Math.floor(mercY);
        const x1 = x0 + 1;
        const y1 = y0 + 1;
        const xFrac = mercX - x0;
        const yFrac = mercY - y0;

        const idx00 = (y0 * srcWidth + x0) * 4;
        const idx10 = (y0 * srcWidth + x1) * 4;
        const idx01 = (y1 * srcWidth + x0) * 4;
        const idx11 = (y1 * srcWidth + x1) * 4;
        const tgtIdx = (y * targetWidth + x) * 4;

        // Interpolate each channel
        for (let c = 0; c < 4; c++) {
          const v00 = srcData[idx00 + c];
          const v10 = srcData[idx10 + c];
          const v01 = srcData[idx01 + c];
          const v11 = srcData[idx11 + c];

          const v0 = v00 + (v10 - v00) * xFrac;
          const v1 = v01 + (v11 - v01) * xFrac;
          tgtData[tgtIdx + c] = Math.round(v0 + (v1 - v0) * yFrac);
        }
      }
    }

    const reprojectionTimeMs = performance.now() - startTime;

    return {
      imageData: targetData,
      reprojectionTimeMs,
    };
  }

  /**
   * No-op baseline: just copy pixels (for comparison)
   */
  baselineCopy(
    sourceData: ImageData,
    targetWidth: number,
    targetHeight: number
  ): ReprojectionResult {
    const startTime = performance.now();

    const targetData = new ImageData(targetWidth, targetHeight);
    const srcData = sourceData.data;
    const tgtData = targetData.data;

    // Simple copy (simulates rendering without reprojection)
    const len = Math.min(srcData.length, tgtData.length);
    for (let i = 0; i < len; i++) {
      tgtData[i] = srcData[i];
    }

    const reprojectionTimeMs = performance.now() - startTime;

    return {
      imageData: targetData,
      reprojectionTimeMs,
    };
  }
}
