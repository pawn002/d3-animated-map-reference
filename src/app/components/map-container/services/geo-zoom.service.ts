import { Injectable } from '@angular/core';
import * as d3 from 'd3';
import { GeoProjection } from 'd3-geo';
import { Subject } from 'rxjs';
import { ZoomConfig, ZoomEvent } from '../models/map.types';
import {
  ProjectionSelectorService,
  ProjectionSelectionResult,
  ViewportState,
  ProjectionType,
} from './projection-selector.service';
import { ProjectionTransitionService } from './projection-transition.service';

/**
 * GeoZoom Service
 * Handles zoom and pan interactions by updating the projection directly
 * This causes the map to re-render with proper geographic transformations
 */
@Injectable({
  providedIn: 'root',
})
export class GeoZoomService {
  private projection?: GeoProjection;
  private element?: Element;
  private width = 0;
  private height = 0;

  // Projection state
  private currentScale = 1;
  private currentRotation: [number, number, number] = [0, 0, 0];
  // Target rotation used for smoothing (displayed rotation lerps toward this)
  private targetRotation: [number, number, number] = [0, 0, 0];
  private currentCenter: [number, number] = [0, 0];

  // Initial state
  private initialScale = 1;
  private initialRotation: [number, number, number] = [0, 0, 0];
  private initialCenter: [number, number] = [0, 0];

  // Config
  private scaleExtent: [number, number] = [0.5, 20];
  // Pan tuning: higher alpha -> stronger reduction of pan at high zoom
  private panScaleAlpha = 1;
  // Smoothing configuration for lerp
  private smoothingBase = 0.15;
  private animationId?: number;
  // Scale smoothing / inertia
  private targetScale = 1;
  private scaleVelocity = 0;
  private scaleSmoothingBase = 0.18;

  // Mouse state
  private isDragging = false;
  private lastMousePos: [number, number] = [0, 0];

  // Bound event handlers (store references for cleanup)
  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseUp: () => void;
  private boundWheel: (e: WheelEvent) => void;
  private boundTouchStart: (e: TouchEvent) => void;
  private boundTouchMove: (e: TouchEvent) => void;
  private boundTouchEnd: () => void;

  // Observable for projection changes
  public onProjectionChange = new Subject<void>();

  // Observable for projection type changes (when switching between projection types)
  public onProjectionTypeChange = new Subject<ProjectionSelectionResult>();

  // Dynamic projection selection
  private projectionSelector?: ProjectionSelectorService;
  private projectionTransition?: ProjectionTransitionService;
  private dynamicProjectionEnabled = false;
  private currentProjectionType: ProjectionType = 'equirectangular';
  private pendingProjectionChange?: ProjectionSelectionResult;
  private isTransitioning = false;

  constructor() {
    // Bind event handlers once
    this.boundMouseDown = this.handleMouseDown.bind(this);
    this.boundMouseMove = this.handleMouseMove.bind(this);
    this.boundMouseUp = this.handleMouseUp.bind(this);
    this.boundWheel = this.handleWheel.bind(this);
    this.boundTouchStart = this.handleTouchStart.bind(this);
    this.boundTouchMove = this.handleTouchMove.bind(this);
    this.boundTouchEnd = this.handleTouchEnd.bind(this);
    this.targetRotation = [...this.currentRotation];
  }

  /**
   * Initialize interaction handlers on a DOM element
   */
  init(
    element: Element,
    projection: GeoProjection,
    width: number,
    height: number,
    config: ZoomConfig = { scaleExtent: [0.5, 20] }
  ): void {
    this.projection = projection;
    this.element = element;
    this.width = width;
    this.height = height;
    this.scaleExtent = config.scaleExtent;

    // Store initial projection state
    this.initialScale = projection.scale();
    this.currentScale = this.initialScale;
    this.targetScale = this.initialScale;

    const center = projection.center?.();
    if (center) {
      this.initialCenter = center as [number, number];
      this.currentCenter = [...this.initialCenter];
    }

    const rotate = projection.rotate?.();
    if (rotate) {
      this.initialRotation = rotate as [number, number, number];
      this.currentRotation = [...this.initialRotation];
      this.targetRotation = [...this.initialRotation];
    }

    // Add event listeners
    this.setupEventListeners(element);
  }

  /**
   * Setup mouse and wheel event listeners
   */
  private setupEventListeners(element: Element): void {
    const el = element as HTMLElement;

    // Make element focusable for wheel events
    if (!el.hasAttribute('tabindex')) {
      el.setAttribute('tabindex', '0');
    }

    // Mouse drag for panning - mousedown on element
    el.addEventListener('mousedown', this.boundMouseDown);

    // mousemove and mouseup on document for better drag handling
    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup', this.boundMouseUp);

    // Wheel for zooming
    el.addEventListener('wheel', this.boundWheel, { passive: false });

    // Touch support
    el.addEventListener('touchstart', this.boundTouchStart, { passive: false });
    el.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    el.addEventListener('touchend', this.boundTouchEnd);
  }

  /**
   * Handle mouse down - start dragging
   */
  private handleMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.isDragging = true;
    this.lastMousePos = [event.clientX, event.clientY];
    (this.element as HTMLElement).style.cursor = 'grabbing';
  }

  /**
   * Handle mouse move - update projection during drag
   */
  private handleMouseMove(event: MouseEvent): void {
    if (!this.isDragging || !this.projection) return;

    const dx = event.clientX - this.lastMousePos[0];
    const dy = event.clientY - this.lastMousePos[1];
    this.lastMousePos = [event.clientX, event.clientY];

    // Calculate rotation change based on mouse movement
    const sensitivity = 0.5; // base sensitivity

    // Reduce pan effect as scale increases to avoid twitchiness at high zoom
    const relScale = this.currentScale / this.initialScale || 1;
    const scaleFactor = Math.pow(relScale, -this.panScaleAlpha);

    const rotationX = -dy * sensitivity * scaleFactor;
    const rotationY = dx * sensitivity * scaleFactor;

    // Update target rotation (we lerp the displayed rotation toward this target)
    this.targetRotation = [
      this.targetRotation[0] + rotationY,
      this.targetRotation[1] + rotationX,
      this.targetRotation[2],
    ];

    this.startAnimationLoop();
  }

  /**
   * Handle mouse up - stop dragging
   */
  private handleMouseUp(): void {
    this.isDragging = false;
    if (this.element) {
      (this.element as HTMLElement).style.cursor = 'grab';
    }
  }

  /**
   * Handle wheel - zoom in/out
   */
  private handleWheel(event: WheelEvent): void {
    event.preventDefault();
    if (!this.projection) return;

    // Calculate new scale
    const delta = -event.deltaY;
    const scaleFactor = delta > 0 ? 1.1 : 0.9;
    // Update target scale and give a bit of velocity for inertia
    let newTarget = this.targetScale * scaleFactor;
    newTarget = Math.max(
      this.scaleExtent[0] * this.initialScale,
      Math.min(this.scaleExtent[1] * this.initialScale, newTarget)
    );

    // Blend velocity instead of pure accumulation for smoother zoom
    const velocityDelta = (newTarget - this.currentScale) * 0.2;
    this.scaleVelocity = this.scaleVelocity * 0.5 + velocityDelta;
    this.targetScale = newTarget;

    this.startAnimationLoop();
  }

  /**
   * Touch support - start
   */
  private touchStartPos: [number, number] = [0, 0];
  private handleTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      event.preventDefault();
      this.isDragging = true;
      const touch = event.touches[0];
      this.lastMousePos = [touch.clientX, touch.clientY];
      this.touchStartPos = [touch.clientX, touch.clientY];
    }
  }

  /**
   * Touch support - move
   */
  private handleTouchMove(event: TouchEvent): void {
    if (event.touches.length === 1 && this.isDragging) {
      event.preventDefault();
      const touch = event.touches[0];

      const dx = touch.clientX - this.lastMousePos[0];
      const dy = touch.clientY - this.lastMousePos[1];
      this.lastMousePos = [touch.clientX, touch.clientY];

      if (!this.projection) return;

      const sensitivity = 0.5;
      // Reduce pan effect as scale increases
      const relScale = this.currentScale / this.initialScale || 1;
      const scaleFactor = Math.pow(relScale, -this.panScaleAlpha);

      const rotationX = -dy * sensitivity * scaleFactor;
      const rotationY = dx * sensitivity * scaleFactor;

      // Update target rotation; animation loop will lerp displayed rotation
      this.targetRotation = [
        this.targetRotation[0] + rotationY,
        this.targetRotation[1] + rotationX,
        this.targetRotation[2],
      ];

      this.startAnimationLoop();
    }
  }

  /** Start the animation loop that lerps currentRotation toward targetRotation */
  private startAnimationLoop(): void {
    if (this.animationId) return; // already running
    const animate = () => {
      if (!this.projection) {
        this.animationId = undefined;
        return;
      }

      const relScale = this.currentScale / this.initialScale || 1;
      const smoothing = this.smoothingBase * Math.min(relScale, 4);

      let changed = false;
      const next: [number, number, number] = [...this.currentRotation];
      for (let i = 0; i < 3; i++) {
        const v =
          this.currentRotation[i] + (this.targetRotation[i] - this.currentRotation[i]) * smoothing;
        if (Math.abs(v - this.currentRotation[i]) > 1e-4) changed = true;
        next[i] = v;
      }

      this.currentRotation = next;

      // Scale smoothing with unified damped spring approach
      let scaleChanged = false;

      // Calculate target difference
      const targetDiff = this.targetScale - this.currentScale;

      // Apply velocity with damping and target-seeking to prevent overshoot
      if (Math.abs(this.scaleVelocity) > 1e-4 || Math.abs(targetDiff) > 1e-4) {
        const scaleSmoothing = Math.min(this.scaleSmoothingBase * Math.max(relScale, 0.5), 0.5);

        // Apply velocity
        this.currentScale += this.scaleVelocity;

        // Also pull toward target to prevent overshoot
        this.currentScale += targetDiff * scaleSmoothing * 0.3;

        // Decay velocity more aggressively
        this.scaleVelocity *= 0.75;

        // Additional damping when close to target to prevent oscillation
        if (Math.abs(targetDiff) < this.initialScale * 0.1) {
          this.scaleVelocity *= 0.8;
        }

        scaleChanged = true;
      }

      // Clamp scale
      this.currentScale = Math.max(
        this.scaleExtent[0] * this.initialScale,
        Math.min(this.scaleExtent[1] * this.initialScale, this.currentScale)
      );

      if (this.projection.rotate) {
        this.projection.rotate(this.currentRotation);
      }

      if (this.projection.scale) {
        this.projection.scale(this.currentScale);
      }

      this.onProjectionChange.next();

      if (changed || scaleChanged) {
        this.animationId = requestAnimationFrame(animate);
      } else {
        this.animationId = undefined;

        // When animation settles, check if projection should change
        if (this.dynamicProjectionEnabled) {
          this.scheduleProjectionCheck();
        }
      }
    };

    this.animationId = requestAnimationFrame(animate);
  }

  /** Timeout ID for debounced projection check */
  private projectionCheckTimeout?: ReturnType<typeof setTimeout>;

  /**
   * Schedule a debounced projection check after interaction settles
   */
  private scheduleProjectionCheck(): void {
    // Clear any pending check
    if (this.projectionCheckTimeout) {
      clearTimeout(this.projectionCheckTimeout);
    }

    // Wait a short time after animation settles before checking
    this.projectionCheckTimeout = setTimeout(() => {
      const recommendation = this.checkProjectionChange();
      if (recommendation) {
        // Emit recommendation - component can decide whether to apply it
        this.onProjectionTypeChange.next(recommendation);
      }
    }, 200);
  }

  /**
   * Touch support - end
   */
  private handleTouchEnd(): void {
    this.isDragging = false;
  }

  /**
   * Programmatically set projection center (via rotation for equirectangular)
   */
  setCenter(center: [number, number], triggerRender = true): void {
    if (!this.projection) return;

    // For equirectangular and similar projections, use rotation
    this.currentRotation = [-center[0], -center[1], 0];
    this.targetRotation = [...this.currentRotation];

    if (this.projection.rotate) {
      this.projection.rotate(this.currentRotation);
    }

    if (triggerRender) {
      this.onProjectionChange.next();
    }
  }

  /**
   * Programmatically set projection scale
   */
  setScale(scale: number, triggerRender = true): void {
    if (!this.projection) return;

    const absolute = this.initialScale * scale;
    if (triggerRender) {
      // smooth toward the requested scale
      this.targetScale = absolute;
      this.startAnimationLoop();
    } else {
      // immediate update (used by animateTo)
      this.currentScale = absolute;
      this.targetScale = absolute;
      this.scaleVelocity = 0;
      this.projection.scale(this.currentScale);
      this.onProjectionChange.next();
    }
  }

  /**
   * Animate to a specific center and scale
   */
  animateTo(
    center: [number, number],
    scale: number,
    duration: number = 750,
    callback?: () => void
  ): void {
    if (!this.projection) return;

    const startCenter = [...this.currentCenter];
    const startScale = this.currentScale / this.initialScale;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);

      // Easing function
      const eased = d3.easeCubicInOut(t);

      // Interpolate center
      const interpCenter: [number, number] = [
        startCenter[0] + (center[0] - startCenter[0]) * eased,
        startCenter[1] + (center[1] - startCenter[1]) * eased,
      ];

      // Interpolate scale
      const interpScale = startScale + (scale - startScale) * eased;

      // Update projection
      this.setCenter(interpCenter, false);
      this.setScale(interpScale, false);

      // Trigger render
      this.onProjectionChange.next();

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        // Ensure targets are synchronized at end of animation
        this.targetRotation = [...this.currentRotation];
        this.targetScale = this.currentScale;
        this.scaleVelocity = 0;
        callback?.();
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Reset projection to initial state
   */
  reset(duration: number = 750, callback?: () => void): void {
    this.animateTo(this.initialCenter, 1, duration, callback);
  }

  /**
   * Get current projection state
   */
  getCurrentState() {
    return {
      center: [...this.currentCenter] as [number, number],
      scale: this.currentScale / this.initialScale,
      rotation: [...this.currentRotation] as [number, number, number],
    };
  }

  /**
   * Enable dynamic projection selection
   */
  enableDynamicProjection(
    selector: ProjectionSelectorService,
    transition: ProjectionTransitionService
  ): void {
    this.projectionSelector = selector;
    this.projectionTransition = transition;
    this.dynamicProjectionEnabled = true;
    this.projectionTransition.setProjectionSelector(selector);
  }

  /**
   * Disable dynamic projection selection
   */
  disableDynamicProjection(): void {
    this.dynamicProjectionEnabled = false;
  }

  /**
   * Check if dynamic projection is enabled
   */
  isDynamicProjectionEnabled(): boolean {
    return this.dynamicProjectionEnabled;
  }

  /**
   * Get current projection type
   */
  getCurrentProjectionType(): ProjectionType {
    return this.currentProjectionType;
  }

  /**
   * Set current projection type (used when projection is changed externally)
   */
  setCurrentProjectionType(type: ProjectionType): void {
    this.currentProjectionType = type;
  }

  /**
   * Get current viewport state for projection selection
   */
  getViewportState(): ViewportState {
    return {
      center: [-this.currentRotation[0], -this.currentRotation[1]],
      scale: this.currentScale / this.initialScale,
      width: this.width,
      height: this.height,
    };
  }

  /**
   * Check and potentially trigger a projection change based on current viewport
   * Called after zoom/pan interactions settle
   */
  checkProjectionChange(): ProjectionSelectionResult | null {
    if (!this.dynamicProjectionEnabled || !this.projectionSelector || this.isTransitioning) {
      return null;
    }

    const viewport = this.getViewportState();
    const recommendation = this.projectionSelector.selectOptimalProjection(viewport);

    if (recommendation.projectionType !== this.currentProjectionType) {
      this.pendingProjectionChange = recommendation;
      return recommendation;
    }

    return null;
  }

  /**
   * Apply a pending projection change with transition
   */
  async applyProjectionChange(
    newProjection: GeoProjection,
    newType: ProjectionType,
    duration: number = 500
  ): Promise<void> {
    if (!this.projection || !this.projectionTransition || this.isTransitioning) {
      return;
    }

    this.isTransitioning = true;

    try {
      await this.projectionTransition.transition(
        this.projection,
        newProjection,
        this.currentProjectionType,
        newType,
        duration,
        (interpolatedProjection, progress) => {
          // The projection is being animated - trigger renders
          this.onProjectionChange.next();
        }
      );

      // Update to new projection
      this.projection = newProjection;
      this.currentProjectionType = newType;

      // Update internal state to match new projection
      const rotate = newProjection.rotate?.();
      if (rotate) {
        this.currentRotation = rotate as [number, number, number];
        this.targetRotation = [...this.currentRotation];
      }
      this.currentScale = newProjection.scale();
      this.targetScale = this.currentScale;
      this.initialScale = this.projectionSelector!.getBaseScale(newType, this.width, this.height);

      // Confirm the change
      this.projectionSelector?.confirmProjectionChange({
        projectionType: newType,
        projection: newProjection,
        reason: `Switched to ${newType}`,
      });

      // Emit the type change
      this.onProjectionTypeChange.next({
        projectionType: newType,
        projection: newProjection,
        reason: `Viewport-based switch to ${newType}`,
      });

      this.pendingProjectionChange = undefined;
    } finally {
      this.isTransitioning = false;
    }
  }

  /**
   * Replace the current projection immediately (no transition)
   */
  replaceProjection(newProjection: GeoProjection, newType: ProjectionType): void {
    if (!this.projection) return;

    this.projection = newProjection;
    this.currentProjectionType = newType;

    // Update internal state
    const rotate = newProjection.rotate?.();
    if (rotate) {
      this.currentRotation = rotate as [number, number, number];
      this.targetRotation = [...this.currentRotation];
    }
    this.currentScale = newProjection.scale();
    this.targetScale = this.currentScale;

    if (this.projectionSelector) {
      this.initialScale = this.projectionSelector.getBaseScale(newType, this.width, this.height);
    }

    this.onProjectionChange.next();
    this.onProjectionTypeChange.next({
      projectionType: newType,
      projection: newProjection,
      reason: `Replaced with ${newType}`,
    });
  }

  /**
   * Get the current projection instance
   */
  getProjection(): GeoProjection | undefined {
    return this.projection;
  }

  /**
   * Destroy and cleanup
   */
  destroy(element: Element): void {
    const el = element as HTMLElement;

    // Remove event listeners from element
    el.removeEventListener('mousedown', this.boundMouseDown);
    el.removeEventListener('wheel', this.boundWheel);
    el.removeEventListener('touchstart', this.boundTouchStart);
    el.removeEventListener('touchmove', this.boundTouchMove);
    el.removeEventListener('touchend', this.boundTouchEnd);

    // Remove event listeners from document
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);

    this.onProjectionChange.complete();
    this.onProjectionTypeChange.complete();
  }
}
