import { Injectable, signal } from '@angular/core';
import { fromEvent } from 'rxjs';
import { filter } from 'rxjs/operators';
import { Shortcut } from '../models/keyboard-shortcut.model';

@Injectable({
  providedIn: 'root',
})
export class KeyboardShortcutService {
  private shortcuts = new Map<string, Shortcut>();
  private enabled = signal(true);

  constructor() {
    this.setupGlobalListener();
  }

  register(id: string, shortcut: Shortcut): void {
    this.shortcuts.set(id, shortcut);
  }

  unregister(id: string): void {
    this.shortcuts.delete(id);
  }

  setEnabled(enabled: boolean): void {
    this.enabled.set(enabled);
  }

  getAllShortcuts(): Shortcut[] {
    return Array.from(this.shortcuts.values());
  }

  private setupGlobalListener(): void {
    fromEvent<KeyboardEvent>(document, 'keydown')
      .pipe(filter(() => this.enabled()))
      .pipe(filter((event) => !this.isInputElement(event.target)))
      .subscribe((event) => this.handleKeyPress(event));
  }

  private handleKeyPress(event: KeyboardEvent): void {
    const shortcut = Array.from(this.shortcuts.values()).find((s) =>
      this.matchesShortcut(event, s)
    );

    if (shortcut) {
      event.preventDefault();
      shortcut.action();
    }
  }

  private matchesShortcut(event: KeyboardEvent, shortcut: Shortcut): boolean {
    if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) {
      return false;
    }

    const modifiers = shortcut.modifiers || [];
    return modifiers.every((mod) => {
      switch (mod) {
        case 'ctrl':
          return event.ctrlKey;
        case 'shift':
          return event.shiftKey;
        case 'alt':
          return event.altKey;
        case 'meta':
          return event.metaKey;
        default:
          return false;
      }
    });
  }

  private isInputElement(target: EventTarget | null): boolean {
    if (!target) return false;
    const element = target as HTMLElement;
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName);
  }
}
