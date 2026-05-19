import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BodytypesRoutingModule } from './bodytypes-routing.module';
import { AddComponent } from './add/add.component';
import { ViewComponent } from './view/view.component';
import { EditComponent } from './edit/edit.component';
import { BodytypeService } from '../../../../service/bodytype.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
@NgModule({
  imports: [
    CommonModule,
    BodytypesRoutingModule,
    
    FormsModule,
    ReactiveFormsModule,   
  ],
  declarations: [AddComponent, ViewComponent, EditComponent],
  providers: [BodytypeService],
})
export class BodytypesModule { }
