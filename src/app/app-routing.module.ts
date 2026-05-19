import { NgModule } from '@angular/core';
import { RouterModule, Routes, PreloadAllModules} from '@angular/router';
const appRoutes: Routes = [
  {
    path: 'admin',
    loadChildren: () => import('./views/admin/admin.module').then(m => m.AdminModule)
  },
  {
    path: '',
    loadChildren: () => import('./views/client/client.module').then(m => m.ClientModule)
  },

  { path: '**', redirectTo: '' }

];


@NgModule({
  imports: [RouterModule.forRoot(appRoutes, {})],
  exports: [RouterModule]
})

export class AppRoutingModule {
}
