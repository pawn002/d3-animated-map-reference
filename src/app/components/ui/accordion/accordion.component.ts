import { Component, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-accordion',
  imports: [CommonModule],
  templateUrl: './accordion.component.html',
  styleUrl: './accordion.component.scss',
})
export class AccordionComponent {
  title = input.required<string>();
  expanded = signal<boolean>(true);
  count = input<number>();

  toggle(): void {
    this.expanded.update(value => !value);
  }
}
