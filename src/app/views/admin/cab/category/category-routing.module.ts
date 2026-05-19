import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AddComponent } from './add/add.component';
import { EditComponent } from './edit/edit.component';
import { ViewComponent } from './view/view.component';
import { ImageComponent } from './image/image.component';

const routes: Routes = [{
  path: '',
  children: [
       {
      path: 'add',
      component: AddComponent,
     
    },
    {
      path: 'view',
      component: ViewComponent,
     
    },
    {
      path: 'edit/:id',
      component: EditComponent,
     
    },
    {
      path: 'image/:id',
      component: ImageComponent,
     
    },
  ]
}];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CategoryRoutingModule { }
