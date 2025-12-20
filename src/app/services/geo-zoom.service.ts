import { Injectable } from '@angular/core';
import * as d3 from 'd3';
import { GeoProjection } from 'd3-geo';
import { Subject } from 'rxjs';
import { ZoomConfig, ZoomEvent } from '../models/map.types';

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
  private currentCenter: [number, number] = [0, 0];

  // Initial state
  private initialScale = 1;
  private initialRotation: [number, number, number] = [0, 0, 0];
  private initialCenter: [number, number] = [0, 0];

  // Config
  private scaleExtent: [number, number] = [0.5, 20];

  // Mouse state
  private isDragging = false;
  private lastMousePos: [number, number] = [0, 0];

  // Observable for projection changes
  public onProjectionChange = new Subject<void>();

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

    const center = projection.center?.();
    if (center) {
      this.initialCenter = center as [number, number];
      this.currentCenter = [...this.initialCenter];
    }

    const rotate = projection.rotate?.();
    if (rotate) {
      this.initialRotation = rotate as [number, number, number];
      this.currentRotation = [...this.initialRotation];
    }

    // Add event listeners
    this.setupEventListeners(element);
  }

  /**
   * Setup mouse and wheel event listeners
   */
  private setupEventListeners(element: Element): void {
    const el = element as HTMLElement;

    // Mouse drag for panning
    el.addEventListener('mousedown', this.handleMouseDown.bind(this));
    el.addEventListener('mousemove', this.handleMouseMove.bind(this));
    el.addEventListener('mouseup', this.handleMouseUp.bind(this));
    el.addEventListener('mouseleave', this.handleMouseUp.bind(this));

    // Wheel for zooming
    el.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });

    // Touch support
    el.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    el.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    el.addEventListener('touchend', this.handleTouchEnd.bind(this));
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
    // Sensitivity factor - adjust as needed
    const sensitivity = 0.25;
    const rotationX = -dy * sensitivity / this.currentScale;
    const rotationY = -dx * sensitivity / this.currentScale;

    // Update rotation
    this.currentRotation = [
      this.currentRotation[0] + rotationY,
      this.currentRotation[1] + rotationX,
      this.currentRotation[2]
    ];

    // Apply to projection
    if (this.projection.rotate) {
      this.projection.rotate(this.currentRotation);
    }

    // Also update center for projections that support it
    if (this.projection.center) {
      this.currentCenter = [
        this.currentCenter[0] - rotationY,
        this.currentCenter[1] - rotationX
      ];
      this.projection.center(this.currentCenter);
    }

    // Trigger re-render
    this.onProjectionChange.next();
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
    let newScale = this.currentScale * scaleFactor;

    // Clamp to scale extent
    newScale = Math.max(this.scaleExtent[0] * this.initialScale,
                       Math.min(this.scaleExtent[1] * this.initialScale, newScale));

    this.currentScale = newScale;
    this.projection.scale(newScale);

    // Trigger re-render
    this.onProjectionChange.next();
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

      const sensitivity = 0.25;
      const rotationX = -dy * sensitivity / this.currentScale;
      const rotationY = -dx * sensitivity / this.currentScale;

      this.currentRotation = [
        this.currentRotation[0] + rotationY,
        this.currentRotation[1] + rotationX,
        this.currentRotation[2]
      ];

      if (this.projection.rotate) {
        this.projection.rotate(this.currentRotation);
      }

      if (this.projection.center) {
        this.currentCenter = [
          this.currentCenter[0] - rotationY,
          this.currentCenter[1] - rotationX
        ];
        this.projection.center(this.currentCenter);
      }

      this.onProjectionChange.next();
    }
  }

  /**
   * Touch support - end
   */
  private handleTouchEnd(): void {
    this.isDragging = false;
  }

  /**
   * Programmatically set projection center
   */
  setCenter(center: [number, number], triggerRender = true): void {
    if (!this.projection) return;

    this.currentCenter = center;

    if (this.projection.center) {
      this.projection.center(center);
    }

    // For rotation-based panning
    if (this.projection.rotate) {
      this.currentRotation = [-center[0], -center[1], 0];
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

    this.currentScale = this.initialScale * scale;
    this.projection.scale(this.currentScale);

    if (triggerRender) {
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
        startCenter[1] + (center[1] - startCenter[1]) * eased
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
      rotation: [...this.currentRotation] as [number, number, number]
    };
  }

  /**
   * Destroy and cleanup
   */
  destroy(element: Element): void {
    const el = element as HTMLElement;

    // Remove event listeners
    el.removeEventListener('mousedown', this.handleMouseDown.bind(this));
    el.removeEventListener('mousemove', this.handleMouseMove.bind(this));
    el.removeEventListener('mouseup', this.handleMouseUp.bind(this));
    el.removeEventListener('mouseleave', this.handleMouseUp.bind(this));
    el.removeEventListener('wheel', this.handleWheel.bind(this));
    el.removeEventListener('touchstart', this.handleTouchStart.bind(this));
    el.removeEventListener('touchmove', this.handleTouchMove.bind(this));
    el.removeEventListener('touchend', this.handleTouchEnd.bind(this));

    this.onProjectionChange.complete();
  }
}
