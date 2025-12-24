export type LocationCategory = 'city' | 'continent' | 'region' | 'custom';

export interface LocationPreset {
  id: string;
  name: string;
  category: LocationCategory;
  coordinates: [number, number]; // [lon, lat]
  scale: number;
  description?: string;
  population?: number;
  country?: string;
}

export interface LocationGroup {
  id: string;
  name: string;
  category: LocationCategory;
  presets: LocationPreset[];
}
