import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DriverSubscriptionsRoutingModule } from './driver-subscriptions-routing.module';
import { DriverSubscriptionViewComponent } from './view/driver-subscription-view.component';
import { SubscriptionService } from '../../../service/subscription.service';
import { SubscriptionPlanService } from '../../../service/subscription-plan.service';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    DriverSubscriptionsRoutingModule
  ],
  declarations: [DriverSubscriptionViewComponent],
  providers: [SubscriptionService, SubscriptionPlanService]
})
export class DriverSubscriptionsModule {}
