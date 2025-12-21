import { GeoProjection } from 'd3-geo';
import { FeatureCollection } from 'geojson';

export type RenderMode = 'svg' | 'canvas';

export interface MapConfig {
  projection: GeoProjection;
  width: number;
  height: number;
  renderMode: RenderMode;
}

export interface GeoBounds {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

export interface MapExtent {
  center: [number, number]; // [longitude, latitude]
  scale: number;
}

export interface AnimationConfig {
  duration: number; // milliseconds
  easing?: (t: number) => number;
}

export interface ZoomConfig {
  scaleExtent: [number, number]; // [min, max]
  translateExtent?: [[number, number], [number, number]];
}

export interface MapData {
  type: 'geojson' | 'vector-tile' | 'raster-tile';
  data: FeatureCollection;
}

export interface ZoomEvent {
  scale: number;
  translate: [number, number];
  center: [number, number];
}
