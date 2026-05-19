import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AddComponent } from './add/add.component';
import { ViewComponent } from './view/view.component';
import { EditComponent } from './edit/edit.component';
import { UserComponent } from './user/user.component';
import { UserPagesComponent } from './user-pages/user-pages.component';

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
        path: 'addUser',
        component: UserComponent,
        
      },
      {
        path: 'user',
        component: UserPagesComponent,
        
      }
      
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PagesRoutingModule { }
