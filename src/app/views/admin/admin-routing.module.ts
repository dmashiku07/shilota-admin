import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { FullLayoutComponent } from 'app/layouts/full/full-layout.component';
import { ContentLayoutComponent } from 'app/layouts/content/content-layout.component';
import { LoginComponent } from './login/login.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { AdminguardGuard } from 'app/guards/adminguard.guard';

const routes: Routes = [
  {
    path: '',
    component: ContentLayoutComponent,
    data: {expectedRole: 'admin'},
    children: [
      { path: '', component: LoginComponent }
    ]
  },

  {
    path: '',
    component: FullLayoutComponent,
    canActivate: [AdminguardGuard],
    data: {expectedRole: 'admin'},
    children: [

      { path: 'dashboard', component: DashboardComponent },

      {
        path: 'account',
        loadChildren: () => import('./accountsettings/accountsettings.module').then(m => m.AccountsettingsModule)
      },
      {
        path: 'page',
        loadChildren: () => import('./pages/pages.module').then(m => m.PagesModule)
      },
      {
        path: 'home',
        loadChildren: () => import('./home/home.module').then(m => m.HomeModule)
      },
      {
        path: 'banner',
        loadChildren: () => import('./banner/banner.module').then(m => m.BannerModule)
      },
      {
        path: 'faq',
        loadChildren: () => import('./faqmanagment/faq.module').then(m => m.FaqModule)
      },
      {
        path: 'bodytype',
        loadChildren: () => import('./cab/bodytypes/bodytypes.module').then(m => m.BodytypesModule)
      },
      {
        path: 'amenities',
        loadChildren: () => import('./cab/amenities/amenities.module').then(m => m.AmenitiesModule)
      },
      {
        path: 'category',
        loadChildren: () => import('./cab/category/category.module').then(m => m.CategoryModule)
      },

      {
        path: 'management',
        loadChildren: () => import('./management/management.module').then(m => m.ManagementModule)
      },

      {
        path: 'commissions',
        loadChildren: () => import('./commissions/commissions.module').then(m => m.CommissionsModule)
      },

      { path: "**", component: DashboardComponent }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
