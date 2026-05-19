import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HomeRoutingModule } from './home-routing.module';
import { AddComponent } from './add/add.component';
import { ViewComponent } from './view/view.component';
import { EditComponent } from './edit/edit.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CkeditorShimModule } from 'app/shared/ckeditor/ckeditor-shim.module';
import { HomeService } from '../../../service/home.service';
import { DriverComponent } from './driver/driver.component';
import { AddDriverComponent } from './add-driver/add-driver.component';
import { UpdateComponent } from './update/update.component'

@NgModule({
  imports: [
    CommonModule,
    HomeRoutingModule,
    CkeditorShimModule,
    ReactiveFormsModule,
    FormsModule,
  ],
  declarations: [AddComponent, ViewComponent, EditComponent,  DriverComponent, 
    AddDriverComponent,UpdateComponent],
  providers: [HomeService],
})
export class HomeModule { }
