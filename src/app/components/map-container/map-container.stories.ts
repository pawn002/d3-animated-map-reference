import type { Meta, StoryObj } from '@storybook/angular';
import { fn } from 'storybook/test';

// import { MapContainerComponent } from './header.component';
import { MapContainerComponent } from './map-container.component';
import worldData from './sampleData/world.json';
import { GeoJsonObject, FeatureCollection } from 'geojson';

const meta: Meta<MapContainerComponent> = {
  title: 'Map/MapContainer',
  component: MapContainerComponent,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ['autodocs'],
  parameters: {
    // More on how to position stories at: https://storybook.js.org/docs/configure/story-layout
    layout: 'centered',
  },
  args: {},
};

export default meta;
type Story = StoryObj<MapContainerComponent>;

export const Default: Story = {
  args: {},
};

export const SVG: Story = {
  args: {
    width: 200,
    height: 200,
    geoData: worldData as FeatureCollection,
    renderMode: 'svg',
  },
};

export const Canvas: Story = {
  args: {
    width: 200,
    height: 200,
    geoData: worldData as FeatureCollection,
    renderMode: 'canvas',
  },
};

export const WithTissotIndicatrix: Story = {
  args: {
    width: 960,
    height: 600,
    geoData: worldData as FeatureCollection,
    renderMode: 'svg',
    showTissotIndicatrix: true,
  },
};

export const TissotIndicatrixWithCustomConfig: Story = {
  args: {
    width: 960,
    height: 600,
    geoData: worldData as FeatureCollection,
    renderMode: 'svg',
    showTissotIndicatrix: true,
    tissotConfig: {
      gridSpacing: 15,
      circleRadius: 600000,
      fillOpacity: 0.2,
      strokeWidth: 2,
    },
  },
};
