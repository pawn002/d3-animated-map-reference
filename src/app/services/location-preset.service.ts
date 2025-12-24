import { Injectable, signal, computed } from '@angular/core';
import { LocationPreset, LocationGroup } from '../models/location-preset.model';
import citiesData from '../data/cities.json';
import continentsData from '../data/continents.json';

@Injectable({
  providedIn: 'root',
})
export class LocationPresetService {
  private presets = signal<LocationPreset[]>([]);
  private groups = signal<LocationGroup[]>([]);

  constructor() {
    this.loadPresets();
  }

  private loadPresets(): void {
    const cities: LocationPreset[] = citiesData.features.map((feature: any) => ({
      id: feature.properties.name.toLowerCase().replace(/\s+/g, '-'),
      name: feature.properties.name,
      category: 'city' as const,
      coordinates: feature.geometry.coordinates as [number, number],
      scale: 5,
      description: `${feature.properties.country}`,
      population: feature.properties.population,
      country: feature.properties.country,
    }));

    const continents: LocationPreset[] = continentsData.map((continent: any) => ({
      id: continent.id,
      name: continent.name,
      category: continent.category,
      coordinates: continent.coordinates,
      scale: continent.scale,
      description: continent.description,
    }));

    this.presets.set([...cities, ...continents]);

    this.groups.set([
      {
        id: 'cities',
        name: 'Cities',
        category: 'city',
        presets: cities,
      },
      {
        id: 'continents',
        name: 'Continents',
        category: 'continent',
        presets: continents,
      },
    ]);
  }

  getGroups = computed(() => this.groups());
  getAllPresets = computed(() => this.presets());

  searchPresets(query: string): LocationPreset[] {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) {
      return this.presets();
    }

    return this.presets().filter(
      (preset) =>
        preset.name.toLowerCase().includes(lowerQuery) ||
        preset.country?.toLowerCase().includes(lowerQuery) ||
        preset.description?.toLowerCase().includes(lowerQuery)
    );
  }

  getPresetById(id: string): LocationPreset | undefined {
    return this.presets().find((preset) => preset.id === id);
  }

  getPresetsByCategory(category: string): LocationPreset[] {
    return this.presets().filter((preset) => preset.category === category);
  }
}
