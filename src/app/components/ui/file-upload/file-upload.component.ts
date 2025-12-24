import { Component, output, signal, ElementRef, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatureCollection } from 'geojson';

@Component({
  selector: 'app-file-upload',
  imports: [CommonModule],
  templateUrl: './file-upload.component.html',
  styleUrl: './file-upload.component.scss',
})
export class FileUploadComponent {
  fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  fileSelected = output<FeatureCollection>();
  error = signal<string | null>(null);
  isDragging = signal(false);

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      await this.processFile(files[0]);
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      await this.processFile(file);
    }
  }

  openFilePicker(): void {
    this.fileInput()?.nativeElement.click();
  }

  private async processFile(file: File): Promise<void> {
    try {
      if (!file.name.endsWith('.json') && !file.name.endsWith('.geojson')) {
        throw new Error('Please select a .json or .geojson file');
      }

      const text = await file.text();
      const json = JSON.parse(text);

      if (!this.isValidGeoJSON(json)) {
        throw new Error('Invalid GeoJSON format. Must be a FeatureCollection.');
      }

      this.fileSelected.emit(json as FeatureCollection);
      this.error.set(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse file';
      this.error.set(message);
    }
  }

  private isValidGeoJSON(data: any): boolean {
    return (
      data &&
      data.type === 'FeatureCollection' &&
      Array.isArray(data.features)
    );
  }
}
