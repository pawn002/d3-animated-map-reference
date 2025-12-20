import { Injectable } from '@angular/core';
import * as d3 from 'd3';
import { Subject } from 'rxjs';
import { AnimationConfig, MapExtent } from '../models/map.types';
import { GeoZoomService } from './geo-zoom.service';

export interface AnimationStep {
  extent: MapExtent;
  duration: number;
  label?: string;
}

export interface AnimationSequence {
  steps: AnimationStep[];
  loop?: boolean;
}

/**
 * Animation Controller Service
 * Handles programmatic animations between map extents
 */
@Injectable({
  providedIn: 'root',
})
export class AnimationControllerService {
  private currentSequence?: AnimationSequence;
  private currentStepIndex = 0;
  private isPlaying = false;
  private frameCount = 0;
  private lastFrameTime = 0;
  private fps = 0;

  // Observables
  public onAnimationStart = new Subject<void>();
  public onAnimationEnd = new Subject<void>();
  public onStepChange = new Subject<{ step: number; total: number }>();
  public onFpsUpdate = new Subject<number>();

  constructor(private geoZoomService: GeoZoomService) {}

  /**
   * Play an animation sequence
   */
  playSequence(element: Element, sequence: AnimationSequence): void {
    this.currentSequence = sequence;
    this.currentStepIndex = 0;
    this.isPlaying = true;

    this.onAnimationStart.next();
    this.executeStep(element);
  }

  /**
   * Execute a single animation step
   */
  private executeStep(element: Element): void {
    if (!this.currentSequence || !this.isPlaying) return;

    const step = this.currentSequence.steps[this.currentStepIndex];
    if (!step) {
      this.handleSequenceEnd(element);
      return;
    }

    this.onStepChange.next({
      step: this.currentStepIndex + 1,
      total: this.currentSequence.steps.length,
    });

    // Start FPS monitoring
    this.startFpsMonitoring();

    // Animate to the extent
    this.animateToExtent(element, step.extent, step.duration, () => {
      // Stop FPS monitoring
      this.stopFpsMonitoring();

      // Move to next step
      this.currentStepIndex++;
      setTimeout(() => this.executeStep(element), 500); // Brief pause between steps
    });
  }

  /**
   * Animate to a specific map extent
   */
  animateToExtent(
    element: Element,
    extent: MapExtent,
    duration: number,
    callback?: () => void
  ): void {
    const { center, scale } = extent;

    // First zoom to scale, then pan to center
    this.geoZoomService.zoomTo(element, scale, duration / 2, () => {
      this.geoZoomService.panTo(element, center, duration / 2, callback);
    });
  }

  /**
   * Animate between two extents with custom easing
   */
  animateBetweenExtents(
    element: Element,
    from: MapExtent,
    to: MapExtent,
    config: AnimationConfig,
    callback?: () => void
  ): void {
    const easing = config.easing || d3.easeCubicInOut;
    const startTime = Date.now();

    const interpolateScale = d3.interpolateNumber(from.scale, to.scale);
    const interpolateCenter = d3.interpolate(from.center, to.center);

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / config.duration, 1);
      const easedT = easing(t);

      const currentScale = interpolateScale(easedT);
      const currentCenter = interpolateCenter(easedT) as [number, number];

      this.animateToExtent(element, { scale: currentScale, center: currentCenter }, 0);

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        callback?.();
      }
    };

    requestAnimationFrame(tick);
  }

  /**
   * Handle sequence end
   */
  private handleSequenceEnd(element: Element): void {
    if (this.currentSequence?.loop) {
      this.currentStepIndex = 0;
      setTimeout(() => this.executeStep(element), 1000);
    } else {
      this.stop();
      this.onAnimationEnd.next();
    }
  }

  /**
   * Stop the current animation
   */
  stop(): void {
    this.isPlaying = false;
    this.currentStepIndex = 0;
    this.stopFpsMonitoring();
  }

  /**
   * Pause the current animation
   */
  pause(): void {
    this.isPlaying = false;
  }

  /**
   * Resume the paused animation
   */
  resume(element: Element): void {
    if (this.currentSequence && !this.isPlaying) {
      this.isPlaying = true;
      this.executeStep(element);
    }
  }

  /**
   * Start monitoring FPS
   */
  private startFpsMonitoring(): void {
    this.frameCount = 0;
    this.lastFrameTime = performance.now();
    this.monitorFps();
  }

  /**
   * Monitor FPS during animation
   */
  private monitorFps(): void {
    if (!this.isPlaying) return;

    const currentTime = performance.now();
    this.frameCount++;

    // Calculate FPS every 500ms
    if (currentTime - this.lastFrameTime >= 500) {
      this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFrameTime));
      this.onFpsUpdate.next(this.fps);

      this.frameCount = 0;
      this.lastFrameTime = currentTime;
    }

    requestAnimationFrame(() => this.monitorFps());
  }

  /**
   * Stop monitoring FPS
   */
  private stopFpsMonitoring(): void {
    this.fps = 0;
    this.frameCount = 0;
  }

  /**
   * Get current FPS
   */
  getCurrentFps(): number {
    return this.fps;
  }

  /**
   * Check if animation is playing
   */
  isAnimationPlaying(): boolean {
    return this.isPlaying;
  }
}
