import { Component, input, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-slider',
  imports: [CommonModule, FormsModule],
  templateUrl: './slider.component.html',
  styleUrl: './slider.component.scss',
})
export class SliderComponent {
  label = input.required<string>();
  min = input<number>(0);
  max = input<number>(100);
  step = input<number>(1);
  value = model<number>(0);
  unit = input<string>('');
}
