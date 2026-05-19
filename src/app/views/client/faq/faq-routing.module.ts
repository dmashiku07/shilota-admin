import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ViewComponent } from './view/view.component';
import { ShowComponent } from './show/show.component';
const routes: Routes = [{
  path: '',
  children: [
    {
      path: '',
      component: ViewComponent,
     
    },
    {
      path: ':id',
      component: ShowComponent,
     
    },
  ]
}];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class FaqRoutingModule { }
