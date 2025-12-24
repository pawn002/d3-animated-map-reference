import { Injectable, signal, computed } from '@angular/core';
import { Dataset, DatasetSize } from '../models/dataset.model';
import { FeatureCollection } from 'geojson';
import worldData from '../data/world.json';
import world110mData from '../data/world-110m.json';

@Injectable({
  providedIn: 'root',
})
export class DatasetManagerService {
  private datasets = signal<Dataset[]>([]);
  private activeDataset = signal<Dataset | null>(null);

  constructor() {
    this.loadBuiltInDatasets();
  }

  private loadBuiltInDatasets(): void {
    const builtInDatasets: Dataset[] = [
      {
        id: 'world-110m',
        name: 'World (Low Detail)',
        description: 'Natural Earth 110m resolution - optimized for performance',
        source: 'built-in',
        size: 'small',
        featureCount: world110mData.features.length,
        data: world110mData as FeatureCollection,
      },
      {
        id: 'world-full',
        name: 'World (High Detail)',
        description: 'Full resolution with more geographic features',
        source: 'built-in',
        size: 'medium',
        featureCount: worldData.features.length,
        data: worldData as FeatureCollection,
      },
    ];

    this.datasets.set(builtInDatasets);
    this.activeDataset.set(builtInDatasets[1]); // Default to world-full
  }

  getDatasets = computed(() => this.datasets());
  getActiveDataset = computed(() => this.activeDataset());

  switchDataset(datasetId: string): void {
    const dataset = this.datasets().find((d) => d.id === datasetId);
    if (dataset) {
      this.activeDataset.set(dataset);
    }
  }

  addCustomDataset(name: string, data: FeatureCollection): void {
    const dataset: Dataset = {
      id: `custom-${Date.now()}`,
      name,
      description: 'User uploaded dataset',
      source: 'uploaded',
      size: this.calculateSize(data),
      featureCount: data.features.length,
      data,
    };

    this.datasets.update((datasets) => [...datasets, dataset]);
    this.activeDataset.set(dataset);
  }

  removeDataset(datasetId: string): void {
    const dataset = this.datasets().find((d) => d.id === datasetId);
    if (dataset?.source !== 'built-in') {
      this.datasets.update((datasets) =>
        datasets.filter((d) => d.id !== datasetId)
      );

      if (this.activeDataset()?.id === datasetId) {
        this.activeDataset.set(this.datasets()[0]);
      }
    }
  }

  private calculateSize(data: FeatureCollection): DatasetSize {
    const count = data.features.length;
    if (count < 100) return 'small';
    if (count < 500) return 'medium';
    return 'large';
  }
}
