import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CategoryRoutingModule } from './category-routing.module';
import { AddComponent } from './add/add.component';
import { EditComponent } from './edit/edit.component';
import { ViewComponent } from './view/view.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CategoryService } from '../../../../service/category.service';
import { ImageComponent } from './image/image.component';

@NgModule({
  imports: [
    CommonModule,
    CategoryRoutingModule,
    FormsModule,
    ReactiveFormsModule, 
  ],
  declarations: [AddComponent, EditComponent, ViewComponent, ImageComponent],
  providers: [CategoryService],
})
export class CategoryModule { }
