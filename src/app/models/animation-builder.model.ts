import { MapExtent } from '../components/map-container/models/map.types';

export interface AnimationBuilderStep {
  id: string;
  locationPresetId?: string;
  customExtent?: MapExtent;
  duration: number;
  label: string;
  order: number;
}

export interface CustomAnimation {
  id: string;
  name: string;
  description?: string;
  steps: AnimationBuilderStep[];
  loop: boolean;
  createdAt: Date;
}
