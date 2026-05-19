import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CommissionsRoutingModule } from './commissions-routing.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AddComponent } from './add/add.component';
import { ViewComponent } from './view/view.component';
import { EditComponent } from './edit/edit.component';
import { CommissionsService } from '../../../service/commissions.service';

@NgModule({
  imports: [
    CommonModule,
    CommissionsRoutingModule,
    FormsModule, ReactiveFormsModule,
  ],
  declarations: [AddComponent, ViewComponent, EditComponent],
  providers: [CommissionsService],
})
export class CommissionsModule { }
