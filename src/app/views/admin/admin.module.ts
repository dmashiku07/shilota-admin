import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatchHeightModule } from "../../shared/directives/match-height.directive";
import { ChartsShimModule } from "app/shared/charts/charts-shim.module";
import { AdminRoutingModule } from './admin-routing.module';
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
import { FullLayoutComponent } from 'app/layouts/full/full-layout.component';
import { ContentLayoutComponent } from 'app/layouts/content/content-layout.component';
import { FileValueAccessor } from 'app/provider/file-control-value-accessor';
import { FileValidator } from 'app/provider/file-input.validator';
import { SharedModule } from 'app/shared/shared.module';


@NgModule({
  imports: [
    CommonModule,
    AdminRoutingModule,
    ChartsShimModule,
    MatchHeightModule,
    ReactiveFormsModule,
    FormsModule,
    SharedModule
  ],
  declarations: [FullLayoutComponent,ContentLayoutComponent,LoginComponent,
    DashboardComponent,AdminSosAlertsComponent,AdminLostItemsComponent,AdminCallLogsComponent,AdminRiderBlocksComponent,AdminPoolSettingsComponent,AdminDemandHeatmapComponent,AdminAcceptanceSettingsComponent,AdminPriceBroadcastSettingsComponent,AdminDestinationBroadcastMonitorComponent,PlatformReportsComponent,FileValidator,FileValueAccessor]
})
export class AdminModule { }
