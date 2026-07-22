import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { SubscriptionPlanAddComponent } from './add/subscription-plan-add.component';
import { SubscriptionPlanEditComponent } from './edit/subscription-plan-edit.component';
import { SubscriptionPlanViewComponent } from './view/subscription-plan-view.component';

const routes: Routes = [
  {
    path: '',
    children: [
      { path: 'add', component: SubscriptionPlanAddComponent },
      { path: 'view', component: SubscriptionPlanViewComponent },
      { path: 'edit/:id', component: SubscriptionPlanEditComponent }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SubscriptionPlansRoutingModule {}
