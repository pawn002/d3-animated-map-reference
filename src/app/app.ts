import { Component, signal } from '@angular/core';
import { MapContainerComponent } from './components/map-container/map-container.component';

@Component({
  selector: 'app-root',
  imports: [MapContainerComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('d3-animated-map-reference');
}
