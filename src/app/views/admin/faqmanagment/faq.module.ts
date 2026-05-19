import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http'; 
import { FaqRoutingModule } from './faq-routing.module';
import { AddComponent } from './add/add.component';
import { ViewComponent } from './view/view.component';
import { EditComponent } from './edit/edit.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CkeditorShimModule } from 'app/shared/ckeditor/ckeditor-shim.module';
import { FaqService } from '../../../service/faq.service';
@NgModule({
  imports: [
    CommonModule,
    FaqRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    CkeditorShimModule,
    HttpClientModule,
  ],
  declarations: [AddComponent,  ViewComponent, EditComponent],
  providers: [FaqService],
})
export class FaqModule { }
