/**
 * Example: Using Tissot's Indicatrix Overlay
 *
 * This example demonstrates different ways to use the Tissot's Indicatrix
 * overlay feature in the MapContainerComponent.
 */

import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapContainerComponent } from '../components/map-container/map-container.component';
import { TissotIndicatrixConfig } from '../components/map-container/services/tissot-indicatrix.service';
import worldData from '../components/map-container/sampleData/world.json';
import { FeatureCollection } from 'geojson';

@Component({
  selector: 'app-tissot-example',
  standalone: true,
  imports: [CommonModule, MapContainerComponent],
  template: `
    <div class="example-container">
      <h2>Tissot's Indicatrix Visualization</h2>

      <div class="controls">
        <label>
          <input type="checkbox" [checked]="showTissot()" (change)="toggleTissot()" />
          Show Tissot's Indicatrix
        </label>

        <label>
          Grid Spacing (degrees):
          <input
            type="range"
            min="5"
            max="30"
            [value]="gridSpacing()"
            (change)="updateGridSpacing($event)"
          />
          <span>{{ gridSpacing() }}°</span>
        </label>

        <label>
          Circle Radius (px):
          <input
            type="range"
            min="3"
            max="10"
            [value]="circleRadius()"
            (change)="updateCircleRadius($event)"
          />
          <span>{{ circleRadius() }}px</span>
        </label>

        <label>
          Opacity:
          <input
            type="range"
            min="0.1"
            max="0.9"
            step="0.1"
            [value]="fillOpacity()"
            (change)="updateFillOpacity($event)"
          />
          <span>{{ fillOpacity() * 100 | number : '1.0-0' }}%</span>
        </label>

        <button (click)="resetSettings()">Reset to Defaults</button>
      </div>

      <div class="map-wrapper">
        <app-map-container
          [width]="960"
          [height]="600"
          [geoData]="geoData"
          [renderMode]="'svg'"
          [showTissotIndicatrix]="showTissot()"
          [tissotConfig]="currentConfig()"
        >
        </app-map-container>
      </div>

      <div class="explanation">
        <h3>What You're Seeing</h3>
        <p>The red circles/ellipses represent Tissot's Indicatrix of distortion:</p>
        <ul>
          <li><strong>Circular shape:</strong> Minimal angular distortion (conformal)</li>
          <li><strong>Elliptical shape:</strong> Angular distortion present</li>
          <li><strong>Large circles:</strong> Areas where the projection magnifies distances</li>
          <li><strong>Small circles:</strong> Areas where the projection reduces distances</li>
          <li><strong>Rotation angle:</strong> Indicates directional distortion/shear</li>
        </ul>
        <p>
          Use the controls above to adjust the grid spacing and circle appearance to better
          visualize the projection's distortion characteristics.
        </p>
      </div>
    </div>
  `,
  styles: [
    `
      .example-container {
        padding: 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      h2 {
        margin-top: 0;
        color: #333;
      }

      .controls {
        margin: 20px 0;
        padding: 15px;
        background-color: #f5f5f5;
        border-radius: 4px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      label {
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
      }

      input[type='checkbox'] {
        width: 18px;
        height: 18px;
        cursor: pointer;
      }

      input[type='range'] {
        width: 200px;
        cursor: pointer;
      }

      span {
        min-width: 50px;
        font-weight: 500;
      }

      button {
        align-self: flex-start;
        padding: 8px 16px;
        background-color: #667eea;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
        transition: background-color 0.2s;
      }

      button:hover {
        background-color: #5568d3;
      }

      .map-wrapper {
        margin: 20px 0;
        border: 2px solid #ddd;
        border-radius: 4px;
        overflow: hidden;
        background-color: white;
      }

      .explanation {
        margin-top: 20px;
        padding: 15px;
        background-color: #e8f4f8;
        border-left: 4px solid #667eea;
        border-radius: 4px;
      }

      h3 {
        margin-top: 0;
        color: #333;
      }

      ul {
        margin: 10px 0;
        padding-left: 20px;
      }

      li {
        margin: 8px 0;
        color: #555;
      }

      p {
        color: #666;
        line-height: 1.6;
      }
    `,
  ],
})
export class TissotExampleComponent {
  geoData: FeatureCollection = worldData as FeatureCollection;

  // UI state
  showTissot = signal(true);
  gridSpacing = signal(10);
  circleRadius = signal(5);
  fillOpacity = signal(0.3);

  // Configuration derived from signals
  currentConfig = () =>
    ({
      gridSpacing: this.gridSpacing(),
      circleRadius: this.circleRadius(),
      fillOpacity: this.fillOpacity(),
      strokeWidth: 1,
    } as TissotIndicatrixConfig);

  // Control handlers
  toggleTissot(): void {
    this.showTissot.update((v) => !v);
  }

  updateGridSpacing(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    this.gridSpacing.set(value);
  }

  updateCircleRadius(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    this.circleRadius.set(value);
  }

  updateFillOpacity(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    this.fillOpacity.set(value);
  }

  resetSettings(): void {
    this.showTissot.set(true);
    this.gridSpacing.set(10);
    this.circleRadius.set(5);
    this.fillOpacity.set(0.3);
  }
}
