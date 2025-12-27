import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'benchmark',
    loadComponent: () =>
      import('./performance-test/reprojection-benchmark.component').then(
        (m) => m.ReprojectionBenchmarkComponent
      ),
  },
];
