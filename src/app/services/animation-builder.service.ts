import { Injectable, signal } from '@angular/core';
import { CustomAnimation, AnimationBuilderStep } from '../models/animation-builder.model';
import { AnimationSequence } from '../components/map-container/services/animation-controller.service';
import { LocationPresetService } from './location-preset.service';

@Injectable({
  providedIn: 'root',
})
export class AnimationBuilderService {
  private customAnimations = signal<CustomAnimation[]>([]);
  private currentDraft = signal<CustomAnimation | null>(null);

  constructor(private locationPresets: LocationPresetService) {}

  createAnimation(name: string, description?: string): void {
    const animation: CustomAnimation = {
      id: `anim-${Date.now()}`,
      name,
      description,
      steps: [],
      loop: false,
      createdAt: new Date(),
    };
    this.currentDraft.set(animation);
  }

  addStep(step: Omit<AnimationBuilderStep, 'id' | 'order'>): void {
    const draft = this.currentDraft();
    if (!draft) return;

    const newStep: AnimationBuilderStep = {
      ...step,
      id: `step-${Date.now()}`,
      order: draft.steps.length,
    };

    this.currentDraft.update((anim) =>
      anim ? { ...anim, steps: [...anim.steps, newStep] } : null
    );
  }

  removeStep(stepId: string): void {
    this.currentDraft.update((anim) => {
      if (!anim) return null;
      const steps = anim.steps.filter((s) => s.id !== stepId);
      steps.forEach((step, index) => {
        step.order = index;
      });
      return { ...anim, steps };
    });
  }

  reorderSteps(oldIndex: number, newIndex: number): void {
    this.currentDraft.update((anim) => {
      if (!anim) return null;
      const steps = [...anim.steps];
      const [movedStep] = steps.splice(oldIndex, 1);
      steps.splice(newIndex, 0, movedStep);
      steps.forEach((step, index) => {
        step.order = index;
      });
      return { ...anim, steps };
    });
  }

  saveAnimation(): void {
    const draft = this.currentDraft();
    if (!draft || draft.steps.length === 0) return;

    this.customAnimations.update((anims) => {
      const existingIndex = anims.findIndex((a) => a.id === draft.id);
      if (existingIndex >= 0) {
        const updated = [...anims];
        updated[existingIndex] = draft;
        return updated;
      }
      return [...anims, draft];
    });

    this.currentDraft.set(null);
  }

  loadAnimation(animationId: string): void {
    const animation = this.customAnimations().find((a) => a.id === animationId);
    if (animation) {
      this.currentDraft.set({ ...animation });
    }
  }

  deleteAnimation(animationId: string): void {
    this.customAnimations.update((anims) =>
      anims.filter((a) => a.id !== animationId)
    );
  }

  getCurrentDraft = () => this.currentDraft();
  getCustomAnimations = () => this.customAnimations();

  convertToSequence(animation: CustomAnimation): AnimationSequence {
    const steps = animation.steps.map((step) => {
      let extent = step.customExtent;

      if (step.locationPresetId && !extent) {
        const preset = this.locationPresets.getPresetById(step.locationPresetId);
        if (preset) {
          extent = {
            center: preset.coordinates,
            scale: preset.scale,
          };
        }
      }

      return {
        extent: extent || { center: [0, 0], scale: 1 },
        duration: step.duration,
        label: step.label,
      };
    });

    return {
      steps,
      loop: animation.loop,
    };
  }
}
