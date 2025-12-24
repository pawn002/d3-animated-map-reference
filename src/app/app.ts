import { Component, signal, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { MapContainerComponent } from './components/map-container/map-container.component';
import { ControlsPanelComponent } from './components/controls-panel/controls-panel.component';
import {
  MetricsPanelComponent,
  PerformanceMetrics,
  ViewInfo,
  AnimationStatus,
} from './components/metrics-panel/metrics-panel.component';
import { AnimationSequence } from './components/map-container/services/animation-controller.service';
import { ZoomEvent } from './components/map-container/models/map.types';
import { DatasetManagerService } from './services/dataset-manager.service';
import { KeyboardShortcutService } from './services/keyboard-shortcut.service';
import { FeatureCollection } from 'geojson';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    CommonModule,
    MapContainerComponent,
    ControlsPanelComponent,
    MetricsPanelComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  @ViewChild(MapContainerComponent) mapComponent?: MapContainerComponent;

  protected readonly title = signal('D3 Animated Map Demo');
  protected readonly subtitle = signal('Modern interactive geospatial visualization');

  // Map state
  protected readonly geoData = signal<FeatureCollection | null>(null);
  protected readonly renderMode = signal<'svg' | 'canvas'>('svg');
  protected readonly showTissot = signal<boolean>(false);
  protected readonly mapWidth = signal<number>(960);
  protected readonly mapHeight = signal<number>(600);

  // Performance tracking
  private fpsHistory: number[] = [];
  private readonly MAX_FPS_HISTORY = 60;
  protected readonly currentFps = signal<number>(0);

  protected readonly performanceMetrics = signal<PerformanceMetrics>({
    currentFps: 0,
    averageFps: 0,
    minFps: 0,
    maxFps: 0,
    frameTime: 0,
  });

  protected readonly viewInfo = signal<ViewInfo>({
    center: [0, 0],
    scale: 1,
  });

  protected readonly animationStatus = signal<AnimationStatus>({
    isPlaying: false,
  });

  constructor(
    private datasetManager: DatasetManagerService,
    private keyboardShortcuts: KeyboardShortcutService
  ) {}

  ngOnInit(): void {
    this.initializeData();
    this.setupKeyboardShortcuts();
  }

  private initializeData(): void {
    const activeDataset = this.datasetManager.getActiveDataset();
    if (activeDataset) {
      this.geoData.set(activeDataset.data);
    }
  }

  private setupKeyboardShortcuts(): void {
    this.keyboardShortcuts.register('reset', {
      key: 'r',
      description: 'Reset map view',
      action: () => this.handleResetView(),
    });

    this.keyboardShortcuts.register('stop', {
      key: 'Escape',
      description: 'Stop animation',
      action: () => this.handleStopAnimation(),
    });

    this.keyboardShortcuts.register('zoom-in', {
      key: '+',
      description: 'Zoom in',
      action: () => this.handleZoomIn(),
    });

    this.keyboardShortcuts.register('zoom-out', {
      key: '-',
      description: 'Zoom out',
      action: () => this.handleZoomOut(),
    });
  }

  // Map controls
  handleJumpToLocation(event: { coordinates: [number, number]; scale: number }): void {
    this.mapComponent?.panTo(event.coordinates, 750);
    setTimeout(() => {
      this.mapComponent?.zoomTo(event.scale, 500);
    }, 400);
  }

  handlePlayAnimation(sequence: AnimationSequence): void {
    this.animationStatus.set({
      isPlaying: true,
      name: sequence.steps[0]?.label || 'Custom Animation',
      currentStep: 1,
      totalSteps: sequence.steps.length,
    });
    this.mapComponent?.playAnimation(sequence);
  }

  handleStopAnimation(): void {
    this.animationStatus.set({ isPlaying: false });
    this.mapComponent?.stopAnimation();
  }

  handleResetView(): void {
    this.mapComponent?.resetZoom();
  }

  handleZoomIn(): void {
    const currentScale = this.viewInfo().scale;
    this.mapComponent?.zoomTo(Math.min(currentScale * 1.5, 20), 300);
  }

  handleZoomOut(): void {
    const currentScale = this.viewInfo().scale;
    this.mapComponent?.zoomTo(Math.max(currentScale / 1.5, 0.5), 300);
  }

  // Data management
  handleUploadDataset(event: { name: string; data: FeatureCollection }): void {
    this.datasetManager.addCustomDataset(event.name, event.data);
    this.geoData.set(event.data);
  }

  handleSwitchDataset(datasetId: string): void {
    this.datasetManager.switchDataset(datasetId);
    const activeDataset = this.datasetManager.getActiveDataset();
    if (activeDataset) {
      this.geoData.set(activeDataset.data);
    }
  }

  handleToggleTissot(show: boolean): void {
    this.showTissot.set(show);
  }

  handleChangeRenderMode(mode: 'svg' | 'canvas'): void {
    this.renderMode.set(mode);
  }

  // Performance tracking
  handleFpsUpdate(fps: number): void {
    this.currentFps.set(fps);
    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > this.MAX_FPS_HISTORY) {
      this.fpsHistory.shift();
    }

    this.calculatePerformanceMetrics();
  }

  handleZoomChange(event: ZoomEvent): void {
    this.viewInfo.set({
      center: event.center,
      scale: event.scale,
    });
  }

  private calculatePerformanceMetrics(): void {
    if (this.fpsHistory.length === 0) return;

    const currentFps = this.fpsHistory[this.fpsHistory.length - 1];
    const averageFps = Math.round(
      this.fpsHistory.reduce((sum, fps) => sum + fps, 0) / this.fpsHistory.length
    );
    const minFps = Math.min(...this.fpsHistory);
    const maxFps = Math.max(...this.fpsHistory);
    const frameTime = currentFps > 0 ? Math.round(1000 / currentFps) : 0;

    this.performanceMetrics.set({
      currentFps,
      averageFps,
      minFps,
      maxFps,
      frameTime,
    });
  }

  get featureCount(): number {
    return this.geoData()?.features.length || 0;
  }
}
