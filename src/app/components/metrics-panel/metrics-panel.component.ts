import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent } from '../ui/card/card.component';
import { ButtonComponent } from '../ui/button/button.component';

export interface PerformanceMetrics {
  currentFps: number;
  averageFps: number;
  minFps: number;
  maxFps: number;
  frameTime: number;
}

export interface ViewInfo {
  center: [number, number];
  scale: number;
}

export interface AnimationStatus {
  isPlaying: boolean;
  name?: string;
  currentStep?: number;
  totalSteps?: number;
}

@Component({
  selector: 'app-metrics-panel',
  imports: [CommonModule, CardComponent, ButtonComponent],
  templateUrl: './metrics-panel.component.html',
  styleUrl: './metrics-panel.component.scss',
})
export class MetricsPanelComponent {
  metrics = input.required<PerformanceMetrics>();
  viewInfo = input.required<ViewInfo>();
  animationStatus = input.required<AnimationStatus>();
  renderMode = input.required<'svg' | 'canvas'>();
  featureCount = input<number>(0);

  resetView = output<void>();
  zoomIn = output<void>();
  zoomOut = output<void>();

  protected fpsStatusClass = computed(() => {
    const fps = this.metrics().currentFps;
    if (fps >= 55) return 'fps-excellent';
    if (fps >= 30) return 'fps-good';
    if (fps >= 23) return 'fps-acceptable';
    return 'fps-poor';
  });

  protected fpsStatusText = computed(() => {
    const fps = this.metrics().currentFps;
    if (fps >= 55) return 'Excellent';
    if (fps >= 30) return 'Good';
    if (fps >= 23) return 'Acceptable';
    return 'Poor';
  });

  protected formatCoordinates(coords: [number, number]): string {
    return `${coords[1].toFixed(2)}°, ${coords[0].toFixed(2)}°`;
  }

  protected animationProgress = computed(() => {
    const status = this.animationStatus();
    if (!status.isPlaying || !status.currentStep || !status.totalSteps) {
      return 0;
    }
    return (status.currentStep / status.totalSteps) * 100;
  });
}
