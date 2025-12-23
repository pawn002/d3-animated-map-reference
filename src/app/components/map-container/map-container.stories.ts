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

export const TissotSVG: Story = {
  name: 'Tissot (SVG)',
  args: {
    width: 600,
    height: 360,
    geoData: worldData as FeatureCollection,
    renderMode: 'svg',
    showTissot: true,
  },
};

export const TissotCanvasTest: Story = {
  name: 'Base Map Only (SVG) - No Tissot',
  args: {
    width: 600,
    height: 360,
    geoData: worldData as FeatureCollection,
    renderMode: 'svg',
    showTissot: false,
  },
};

export const TissotCanvas: Story = {
  name: 'Tissot (Canvas)',
  args: {
    width: 600,
    height: 360,
    geoData: worldData as FeatureCollection,
    renderMode: 'canvas',
    showTissot: true,
  },
};
