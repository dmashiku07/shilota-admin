import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AddComponent } from './add/add.component';
import { ViewComponent } from './view/view.component';
import { EditComponent } from './edit/edit.component';
import { DriverComponent } from './driver/driver.component';
import { AddDriverComponent } from './add-driver/add-driver.component';
import { UpdateComponent } from './update/update.component'

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

      {
        path: 'update/:id',
        component: UpdateComponent,
       
      },
      {
        path: 'driver',
        component:DriverComponent,
      },
      {
        path: 'adddriver',
        component:AddDriverComponent,
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class HomeRoutingModule { }
