import { Component, signal, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { MapContainerComponent } from './components/map-container/map-container.component';
import { AnimationSequence } from './components/map-container/services/animation-controller.service';
import { FeatureCollection } from 'geojson';
// import worldData from './data/world-110m.json';
import worldData from './data/world.json';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, MapContainerComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  @ViewChild(MapContainerComponent) mapComponent?: MapContainerComponent;

  protected readonly title = signal('D3 Animated Map Reference');
  protected readonly subtitle = signal('Demonstrating proper projection with smooth animations');
  protected readonly geoData = signal<FeatureCollection>(worldData as FeatureCollection);
  protected readonly currentFps = signal<number>(0);

  ngOnInit(): void {
    // Data will be loaded on component initialization
  }

  /**
   * Demo animation sequence: Tour of major cities
   */
  playWorldTour(): void {
    const sequence: AnimationSequence = {
      steps: [
        {
          extent: { center: [-74.006, 40.7128], scale: 4 },
          duration: 1500,
          label: 'New York',
        },
        {
          extent: { center: [-0.1276, 51.5074], scale: 4 },
          duration: 1500,
          label: 'London',
        },
        {
          extent: { center: [139.6917, 35.6895], scale: 4 },
          duration: 1500,
          label: 'Tokyo',
        },
        {
          extent: { center: [151.2093, -33.8688], scale: 4 },
          duration: 1500,
          label: 'Sydney',
        },
        {
          extent: { center: [0, 0], scale: 1 },
          duration: 1500,
          label: 'World View',
        },
      ],
      loop: false,
    };

    this.mapComponent?.playAnimation(sequence);
  }

  /**
   * Demo animation: Zoom to different continents
   */
  playContinentTour(): void {
    const sequence: AnimationSequence = {
      steps: [
        {
          extent: { center: [-95, 37], scale: 2.5 },
          duration: 1200,
          label: 'North America',
        },
        {
          extent: { center: [-60, -15], scale: 2.5 },
          duration: 1200,
          label: 'South America',
        },
        {
          extent: { center: [15, 50], scale: 3 },
          duration: 1200,
          label: 'Europe',
        },
        {
          extent: { center: [20, 0], scale: 2.5 },
          duration: 1200,
          label: 'Africa',
        },
        {
          extent: { center: [90, 35], scale: 2 },
          duration: 1200,
          label: 'Asia',
        },
        {
          extent: { center: [135, -25], scale: 3.5 },
          duration: 1200,
          label: 'Australia',
        },
        {
          extent: { center: [0, 20], scale: 1 },
          duration: 1500,
          label: 'World View',
        },
      ],
      loop: false,
    };

    this.mapComponent?.playAnimation(sequence);
  }

  stopAnimation(): void {
    this.mapComponent?.stopAnimation();
  }

  resetMap(): void {
    this.mapComponent?.resetZoom();
  }

  handleFpsUpdate(fps: number): void {
    this.currentFps.set(fps);
  }
}
