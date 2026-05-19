import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatchHeightModule } from "../../shared/directives/match-height.directive";
import { ChartsShimModule } from "app/shared/charts/charts-shim.module";
import { AdminRoutingModule } from './admin-routing.module';
import { LoginComponent } from './login/login.component';
import { DashboardComponent } from './dashboard/dashboard.component';
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
    DashboardComponent,FileValidator,FileValueAccessor]
})
export class AdminModule { }
