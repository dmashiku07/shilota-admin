import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AddComponent } from './add/add.component';
import { ViewComponent } from './view/view.component';
import { EditComponent } from './edit/edit.component';

const routes: Routes = [
  {
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
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CommissionsRoutingModule { }
