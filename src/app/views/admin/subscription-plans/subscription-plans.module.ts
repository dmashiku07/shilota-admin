import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SubscriptionPlanService } from '../../../service/subscription-plan.service';
import { SubscriptionPlansRoutingModule } from './subscription-plans-routing.module';
import { SubscriptionPlanAddComponent } from './add/subscription-plan-add.component';
import { SubscriptionPlanEditComponent } from './edit/subscription-plan-edit.component';
import { SubscriptionPlanViewComponent } from './view/subscription-plan-view.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SubscriptionPlansRoutingModule
  ],
  declarations: [
    SubscriptionPlanAddComponent,
    SubscriptionPlanEditComponent,
    SubscriptionPlanViewComponent
  ],
  providers: [SubscriptionPlanService]
})
export class SubscriptionPlansModule {}
