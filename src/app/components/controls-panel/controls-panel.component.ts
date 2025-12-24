import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../ui/button/button.component';
import { TabsComponent, Tab } from '../ui/tabs/tabs.component';
import { AccordionComponent } from '../ui/accordion/accordion.component';
import { FileUploadComponent } from '../ui/file-upload/file-upload.component';
import { LocationPresetService } from '../../services/location-preset.service';
import { DatasetManagerService } from '../../services/dataset-manager.service';
import { AnimationSequence } from '../map-container/services/animation-controller.service';
import { FeatureCollection } from 'geojson';

@Component({
  selector: 'app-controls-panel',
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    TabsComponent,
    AccordionComponent,
    FileUploadComponent,
  ],
  templateUrl: './controls-panel.component.html',
  styleUrl: './controls-panel.component.scss',
})
export class ControlsPanelComponent {
  renderMode = input.required<'svg' | 'canvas'>();
  showTissot = input.required<boolean>();

  jumpToLocation = output<{ coordinates: [number, number]; scale: number }>();
  playAnimation = output<AnimationSequence>();
  stopAnimation = output<void>();
  resetView = output<void>();
  uploadDataset = output<{ name: string; data: FeatureCollection }>();
  switchDataset = output<string>();
  toggleTissot = output<boolean>();
  changeRenderMode = output<'svg' | 'canvas'>();

  protected activeTab = signal<string>('locations');
  protected searchQuery = signal<string>('');

  protected tabs: Tab[] = [
    { id: 'locations', label: 'Locations' },
    { id: 'animate', label: 'Animate' },
    { id: 'data', label: 'Data' },
    { id: 'settings', label: 'Settings' },
  ];

  protected locationGroups;
  protected datasets;
  protected activeDataset;

  constructor(
    protected locationPresets: LocationPresetService,
    protected datasetManager: DatasetManagerService
  ) {
    this.locationGroups = this.locationPresets.getGroups;
    this.datasets = this.datasetManager.getDatasets;
    this.activeDataset = this.datasetManager.getActiveDataset;
  }

  protected get filteredPresets() {
    return this.locationPresets.searchPresets(this.searchQuery());
  }

  onJumpToLocation(coordinates: [number, number], scale: number): void {
    this.jumpToLocation.emit({ coordinates, scale });
  }

  onPlayContinentTour(): void {
    const continents = this.locationPresets.getPresetsByCategory('continent');
    const steps = continents.map((preset) => ({
      extent: { center: preset.coordinates, scale: preset.scale },
      duration: 1200,
      label: preset.name,
    }));

    steps.push({
      extent: { center: [0, 20] as [number, number], scale: 1 },
      duration: 1500,
      label: 'World View',
    });

    this.playAnimation.emit({ steps, loop: false });
  }

  onPlayCitiesTour(): void {
    const cities = this.locationPresets.getPresetsByCategory('city').slice(0, 6);
    const steps = cities.map((preset) => ({
      extent: { center: preset.coordinates, scale: preset.scale },
      duration: 1500,
      label: preset.name,
    }));

    steps.push({
      extent: { center: [0, 0] as [number, number], scale: 1 },
      duration: 1500,
      label: 'World View',
    });

    this.playAnimation.emit({ steps, loop: false });
  }

  onFileUploaded(data: FeatureCollection): void {
    this.uploadDataset.emit({ name: 'Custom Dataset', data });
  }

  onSwitchDataset(datasetId: string): void {
    this.switchDataset.emit(datasetId);
  }

  onToggleTissot(): void {
    this.toggleTissot.emit(!this.showTissot());
  }

  onChangeRenderMode(mode: 'svg' | 'canvas'): void {
    this.changeRenderMode.emit(mode);
  }
}
