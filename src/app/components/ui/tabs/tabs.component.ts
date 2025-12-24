import { Component, input, output, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Tab {
  id: string;
  label: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-tabs',
  imports: [CommonModule],
  templateUrl: './tabs.component.html',
  styleUrl: './tabs.component.scss',
})
export class TabsComponent {
  tabs = input.required<Tab[]>();
  activeTabId = input.required<string>();

  tabChange = output<string>();

  selectTab(tabId: string): void {
    const tab = this.tabs().find(t => t.id === tabId);
    if (tab && !tab.disabled) {
      this.tabChange.emit(tabId);
    }
  }

  @HostListener('keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    const tabs = this.tabs().filter(t => !t.disabled);
    const currentIndex = tabs.findIndex(t => t.id === this.activeTabId());

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        const nextIndex = (currentIndex + 1) % tabs.length;
        this.selectTab(tabs[nextIndex].id);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        this.selectTab(tabs[prevIndex].id);
        break;
      case 'Home':
        event.preventDefault();
        this.selectTab(tabs[0].id);
        break;
      case 'End':
        event.preventDefault();
        this.selectTab(tabs[tabs.length - 1].id);
        break;
    }
  }

  isActive(tabId: string): boolean {
    return this.activeTabId() === tabId;
  }
}
