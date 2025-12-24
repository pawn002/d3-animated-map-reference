import { FeatureCollection } from 'geojson';

export type DatasetSource = 'built-in' | 'uploaded';
export type DatasetSize = 'small' | 'medium' | 'large';

export interface Dataset {
  id: string;
  name: string;
  description: string;
  source: DatasetSource;
  size: DatasetSize;
  featureCount: number;
  data: FeatureCollection;
}
