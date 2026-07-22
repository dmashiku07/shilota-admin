import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DriverSubscriptionViewComponent } from './view/driver-subscription-view.component';

const routes: Routes = [
  {
    path: '',
    children: [
      { path: 'view', component: DriverSubscriptionViewComponent }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DriverSubscriptionsRoutingModule {}
