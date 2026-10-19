import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const appRoutes: Routes = [
  // Historical in-app links include an `admin` segment. This route must come
  // first: an empty route without `pathMatch: 'full'` is a prefix match and
  // would otherwise consume `/admin/...` and render the module's dashboard
  // wildcard instead of the requested page.
  {
    path: 'admin',
    loadChildren: () => import('./views/admin/admin.module').then(m => m.AdminModule)
  },
  // The application is served below /admin/. At the base URL, Angular sees an
  // empty route and should open the same admin module.
  {
    path: '',
    pathMatch: 'full',
    loadChildren: () => import('./views/admin/admin.module').then(m => m.AdminModule)
  },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(appRoutes, {})],
  exports: [RouterModule]
})
export class AppRoutingModule {}
