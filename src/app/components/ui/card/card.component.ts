import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type CardElevation = 'sm' | 'md' | 'lg' | 'xl';

@Component({
  selector: 'app-card',
  imports: [CommonModule],
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
})
export class CardComponent {
  elevation = input<CardElevation>('md');
  padding = input<boolean>(true);
}
