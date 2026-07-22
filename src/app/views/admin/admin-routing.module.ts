import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { FullLayoutComponent } from 'app/layouts/full/full-layout.component';
import { ContentLayoutComponent } from 'app/layouts/content/content-layout.component';
import { LoginComponent } from './login/login.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { AdminSosAlertsComponent } from './safety/sos-alerts/sos-alerts.component';
import { AdminLostItemsComponent } from './safety/lost-items/lost-items.component';
import { AdminCallLogsComponent } from './safety/call-logs/call-logs.component';
import { AdminRiderBlocksComponent } from './safety/rider-blocks/rider-blocks.component';
import { AdminPoolSettingsComponent } from './safety/pool-settings/pool-settings.component';
import { AdminDemandHeatmapComponent } from './safety/demand-heatmap/demand-heatmap.component';
import { AdminAcceptanceSettingsComponent } from './safety/acceptance-settings/acceptance-settings.component';
import { AdminPriceBroadcastSettingsComponent } from './safety/price-broadcast-settings/price-broadcast-settings.component';
import { AdminDestinationBroadcastMonitorComponent } from './safety/destination-broadcast-monitor/destination-broadcast-monitor.component';
import { PlatformReportsComponent } from './reports/platform-reports/platform-reports.component';
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
      { path: 'sos-alerts', component: AdminSosAlertsComponent },
      { path: 'lost-items', component: AdminLostItemsComponent },
      { path: 'call-logs', component: AdminCallLogsComponent },
      { path: 'rider-blocks', component: AdminRiderBlocksComponent },
      { path: 'pool-settings', component: AdminPoolSettingsComponent },
      { path: 'price-broadcast-settings', component: AdminPriceBroadcastSettingsComponent },
      { path: 'destination-broadcast-monitor', component: AdminDestinationBroadcastMonitorComponent },
      { path: 'demand-heatmap', component: AdminDemandHeatmapComponent },
      { path: 'acceptance-settings', component: AdminAcceptanceSettingsComponent },
      { path: 'reports', component: PlatformReportsComponent },

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
      {
        path: 'subscription-plans',
        loadChildren: () => import('./subscription-plans/subscription-plans.module').then(m => m.SubscriptionPlansModule)
      },
      {
        path: 'driver-subscriptions',
        loadChildren: () => import('./driver-subscriptions/driver-subscriptions.module').then(m => m.DriverSubscriptionsModule)
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
