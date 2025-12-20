import { Feature, FeatureCollection, Geometry } from 'geojson';

export interface GeoFeature extends Feature {
  type: 'Feature';
  properties: Record<string, any>;
  geometry: Geometry;
}

export interface GeoFeatureCollection extends FeatureCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

export interface MapBounds {
  type: 'Point' | 'BoundingBox';
  coordinates: [number, number] | [[number, number], [number, number]];
  scale?: number;
}

export interface PresetLocation {
  name: string;
  bounds: [[number, number], [number, number]];  // [[west, south], [east, north]]
}

export interface ProjectionParameters {
  translate: [number, number];
  scale: number;
}

export interface ZoomTransform {
  x: number;
  y: number;
  k: number;  // scale factor
}
