import { Injectable } from '@angular/core';
import * as d3 from 'd3';
import { GeoProjection } from 'd3-geo';
import { Subject } from 'rxjs';
import { ProjectionType, ProjectionSelectorService } from './projection-selector.service';

/**
 * Transition state for tracking animation progress
 */
export interface TransitionState {
  isTransitioning: boolean;
  progress: number; // 0 to 1
  fromType: ProjectionType;
  toType: ProjectionType;
}

/**
 * Callback for each frame during transition
 */
export type TransitionFrameCallback = (
  interpolatedProjection: GeoProjection,
  progress: number
) => void;

/**
 * Projection Transition Service
 *
 * Handles smooth animated transitions between different map projections.
 * Uses D3's interpolation capabilities to create visually smooth transitions.
 */
@Injectable({
  providedIn: 'root',
})
export class ProjectionTransitionService {
  /** Emits transition state updates */
  public onTransitionUpdate = new Subject<TransitionState>();

  /** Emits when transition completes */
  public onTransitionComplete = new Subject<GeoProjection>();

  /** Current transition state */
  private transitionState: TransitionState = {
    isTransitioning: false,
    progress: 0,
    fromType: 'equirectangular',
    toType: 'equirectangular',
  };

  /** Animation frame ID for cancellation */
  private animationId?: number;

  /** Reference to projection selector for creating projections */
  private projectionSelector?: ProjectionSelectorService;

  constructor() {}

  /**
   * Set the projection selector service reference
   */
  setProjectionSelector(selector: ProjectionSelectorService): void {
    this.projectionSelector = selector;
  }

  /**
   * Get current transition state
   */
  getTransitionState(): TransitionState {
    return { ...this.transitionState };
  }

  /**
   * Check if currently transitioning
   */
  isTransitioning(): boolean {
    return this.transitionState.isTransitioning;
  }

  /**
   * Transition between two projections with animation
   *
   * @param fromProjection - Starting projection
   * @param toProjection - Target projection
   * @param toType - Type of target projection
   * @param duration - Animation duration in milliseconds
   * @param onFrame - Callback for each animation frame
   * @param easing - D3 easing function
   */
  transition(
    fromProjection: GeoProjection,
    toProjection: GeoProjection,
    fromType: ProjectionType,
    toType: ProjectionType,
    duration: number = 750,
    onFrame?: TransitionFrameCallback,
    easing: (t: number) => number = d3.easeCubicInOut
  ): Promise<GeoProjection> {
    return new Promise((resolve) => {
      // Cancel any existing transition
      this.cancelTransition();

      // Update state
      this.transitionState = {
        isTransitioning: true,
        progress: 0,
        fromType,
        toType,
      };
      this.onTransitionUpdate.next(this.transitionState);

      // Get projection parameters to interpolate
      const fromRotation = fromProjection.rotate?.() || [0, 0, 0];
      const toRotation = toProjection.rotate?.() || [0, 0, 0];
      const fromScale = fromProjection.scale();
      const toScale = toProjection.scale();
      const fromTranslate = fromProjection.translate?.() || [0, 0];
      const toTranslate = toProjection.translate?.() || [0, 0];

      // For clip angle projections
      const fromClipAngle = fromProjection.clipAngle?.() ?? 180;
      const toClipAngle = toProjection.clipAngle?.() ?? 180;

      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const rawProgress = Math.min(elapsed / duration, 1);
        const progress = easing(rawProgress);

        // Update transition state
        this.transitionState.progress = progress;
        this.onTransitionUpdate.next(this.transitionState);

        // Create interpolated projection
        // We use the target projection as the base and interpolate its parameters
        const interpolatedProjection = this.createInterpolatedProjection(
          toProjection,
          fromRotation,
          toRotation,
          fromScale,
          toScale,
          fromTranslate,
          toTranslate,
          fromClipAngle,
          toClipAngle,
          progress
        );

        // Call frame callback
        if (onFrame) {
          onFrame(interpolatedProjection, progress);
        }

        if (rawProgress < 1) {
          this.animationId = requestAnimationFrame(animate);
        } else {
          // Transition complete
          this.transitionState.isTransitioning = false;
          this.transitionState.progress = 1;
          this.onTransitionUpdate.next(this.transitionState);
          this.onTransitionComplete.next(toProjection);
          resolve(toProjection);
        }
      };

      this.animationId = requestAnimationFrame(animate);
    });
  }

  /**
   * Create an interpolated projection between two states
   */
  private createInterpolatedProjection(
    baseProjection: GeoProjection,
    fromRotation: number[],
    toRotation: number[],
    fromScale: number,
    toScale: number,
    fromTranslate: number[],
    toTranslate: number[],
    fromClipAngle: number,
    toClipAngle: number,
    t: number
  ): GeoProjection {
    // Interpolate rotation
    const rotation: [number, number, number] = [
      this.interpolateAngle(fromRotation[0], toRotation[0], t),
      this.interpolateValue(fromRotation[1], toRotation[1], t),
      this.interpolateValue(fromRotation[2] || 0, toRotation[2] || 0, t),
    ];

    // Interpolate scale
    const scale = this.interpolateValue(fromScale, toScale, t);

    // Interpolate translate
    const translate: [number, number] = [
      this.interpolateValue(fromTranslate[0], toTranslate[0], t),
      this.interpolateValue(fromTranslate[1], toTranslate[1], t),
    ];

    // Interpolate clip angle
    const clipAngle = this.interpolateValue(fromClipAngle, toClipAngle, t);

    // Apply to projection
    if (baseProjection.rotate) {
      baseProjection.rotate(rotation);
    }
    baseProjection.scale(scale);
    if (baseProjection.translate) {
      baseProjection.translate(translate);
    }
    if (baseProjection.clipAngle && clipAngle < 180) {
      baseProjection.clipAngle(clipAngle);
    }

    return baseProjection;
  }

  /**
   * Interpolate a value linearly
   */
  private interpolateValue(from: number, to: number, t: number): number {
    return from + (to - from) * t;
  }

  /**
   * Interpolate an angle, handling wrap-around at 180/-180
   */
  private interpolateAngle(from: number, to: number, t: number): number {
    // Normalize angles to -180 to 180 range
    from = this.normalizeAngle(from);
    to = this.normalizeAngle(to);

    // Find shortest path
    let diff = to - from;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    return from + diff * t;
  }

  /**
   * Normalize angle to -180 to 180 range
   */
  private normalizeAngle(angle: number): number {
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
  }

  /**
   * Perform a cross-fade transition between projections
   * This is useful when projections are very different and interpolation looks bad
   *
   * @param fromProjection - Starting projection
   * @param toProjection - Target projection
   * @param duration - Animation duration in milliseconds
   * @param onFrame - Callback with opacity values for both projections
   */
  crossFade(
    fromProjection: GeoProjection,
    toProjection: GeoProjection,
    fromType: ProjectionType,
    toType: ProjectionType,
    duration: number = 500,
    onFrame?: (fromOpacity: number, toOpacity: number, progress: number) => void,
    easing: (t: number) => number = d3.easeCubicInOut
  ): Promise<GeoProjection> {
    return new Promise((resolve) => {
      this.cancelTransition();

      this.transitionState = {
        isTransitioning: true,
        progress: 0,
        fromType,
        toType,
      };
      this.onTransitionUpdate.next(this.transitionState);

      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const rawProgress = Math.min(elapsed / duration, 1);
        const progress = easing(rawProgress);

        this.transitionState.progress = progress;
        this.onTransitionUpdate.next(this.transitionState);

        // Calculate opacities for cross-fade
        const fromOpacity = 1 - progress;
        const toOpacity = progress;

        if (onFrame) {
          onFrame(fromOpacity, toOpacity, progress);
        }

        if (rawProgress < 1) {
          this.animationId = requestAnimationFrame(animate);
        } else {
          this.transitionState.isTransitioning = false;
          this.transitionState.progress = 1;
          this.onTransitionUpdate.next(this.transitionState);
          this.onTransitionComplete.next(toProjection);
          resolve(toProjection);
        }
      };

      this.animationId = requestAnimationFrame(animate);
    });
  }

  /**
   * Cancel any ongoing transition
   */
  cancelTransition(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = undefined;
    }

    if (this.transitionState.isTransitioning) {
      this.transitionState.isTransitioning = false;
      this.onTransitionUpdate.next(this.transitionState);
    }
  }

  /**
   * Quick snap transition (no animation)
   */
  snap(toProjection: GeoProjection, toType: ProjectionType): void {
    this.cancelTransition();

    this.transitionState = {
      isTransitioning: false,
      progress: 1,
      fromType: this.transitionState.toType,
      toType,
    };
    this.onTransitionUpdate.next(this.transitionState);
    this.onTransitionComplete.next(toProjection);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.cancelTransition();
    this.onTransitionUpdate.complete();
    this.onTransitionComplete.complete();
  }
}
