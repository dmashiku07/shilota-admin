import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http'; 
import { PagesRoutingModule } from './pages-routing.module';
import { AddComponent } from './add/add.component';
import { ViewComponent } from './view/view.component';
import { PageService } from '../../../service/page.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CkeditorShimModule } from 'app/shared/ckeditor/ckeditor-shim.module';
import { EditComponent } from './edit/edit.component';
import { UserComponent } from './user/user.component';
import { UserPagesComponent } from './user-pages/user-pages.component';

@NgModule({
  imports: [
    CommonModule,
    PagesRoutingModule,
    HttpClientModule,
    ReactiveFormsModule,
    FormsModule,
    CkeditorShimModule
  ],
  declarations: [AddComponent, ViewComponent, EditComponent, UserComponent, UserPagesComponent],
  providers: [PageService],
})
export class PagesModule { }
