import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const appRoutes: Routes = [
  // The application is served below /admin/. Angular therefore sees the URL
  // after that base path: /admin/ is the empty route, not "admin".
  {
    path: '',
    loadChildren: () => import('./views/admin/admin.module').then(m => m.AdminModule)
  },
  // Keep existing in-app links that still include an admin segment functional
  // while components are migrated to base-relative links.
  {
    path: 'admin',
    loadChildren: () => import('./views/admin/admin.module').then(m => m.AdminModule)
  },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(appRoutes, {})],
  exports: [RouterModule]
})
export class AppRoutingModule {}
