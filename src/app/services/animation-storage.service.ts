import { Injectable } from '@angular/core';
import { CustomAnimation } from '../models/animation-builder.model';

@Injectable({
  providedIn: 'root',
})
export class AnimationStorageService {
  private readonly STORAGE_KEY = 'd3-map-animations';

  saveAnimation(animation: CustomAnimation): void {
    const animations = this.loadAll();
    const index = animations.findIndex((a) => a.id === animation.id);

    if (index >= 0) {
      animations[index] = animation;
    } else {
      animations.push(animation);
    }

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(animations));
  }

  loadAll(): CustomAnimation[] {
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (!data) return [];

    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  delete(animationId: string): void {
    const animations = this.loadAll().filter((a) => a.id !== animationId);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(animations));
  }

  export(animationId: string): void {
    const animation = this.loadAll().find((a) => a.id === animationId);
    if (!animation) return;

    const blob = new Blob([JSON.stringify(animation, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${animation.name.replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async import(file: File): Promise<CustomAnimation> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const animation = JSON.parse(reader.result as string);
          this.saveAnimation(animation);
          resolve(animation);
        } catch (err) {
          reject(new Error('Invalid animation file'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }
}
