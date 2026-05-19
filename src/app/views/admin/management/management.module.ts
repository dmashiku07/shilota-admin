import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ManagementRoutingModule } from './management-routing.module';
import { UserComponent } from './user/user.component';
import { UserService } from '../../../service/user.service';
import { DriverService } from '../../../service/driver.service';
import { VehicleService } from '../../../service/vehicle.service';
import { RidesService } from '../../../service/rides.service';
import { PaymentService } from '../../../service/payment.service';
import { SettlementService } from '../../../service/settlement.service';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FilterOrderShimModule } from 'app/shared/pipes/filter-order-shim.module';
import { PaginationShimModule } from 'app/shared/pagination/pagination-shim.module';
import { ViewComponent } from './view/view.component';
import { DriverComponent } from './driver/driver.component';
import { DetailsComponent } from './details/details.component';
import { VehicleComponent } from './vehicle/vehicle.component';
import { RidesComponent } from './rides/rides.component';
import { RidesDetailsComponent } from './rides-details/rides-details.component';
import { VechicledetailComponent } from './vechicledetail/vechicledetail.component';
import { PaymentComponent } from './payment/payment.component';
import { PaymentdetailsComponent } from './paymentdetails/paymentdetails.component';
import { RideHistoryComponent } from './ride-history/ride-history.component';
import { DriverPayComponent } from './driver-pay/driver-pay.component';
import { SettlementHistoryComponent } from './settlement-history/settlement-history.component';
import { PaymentRidehistoryComponent } from './payment-ridehistory/payment-ridehistory.component';
import { DeletedUserComponent } from './deleteduser/deleteduser.component';
import { DeletedDriverComponent } from './deleteddriver/deleteddriver.component';
import { ServerPaginationComponent } from './server-pagination/server-pagination.component';


@NgModule({
  imports: [
    CommonModule,
    ManagementRoutingModule,
    FormsModule, ReactiveFormsModule,
    FilterOrderShimModule,
    PaginationShimModule
  ],
  declarations: [UserComponent, ViewComponent, DriverComponent, DetailsComponent, VehicleComponent,  RidesComponent, RidesDetailsComponent, VechicledetailComponent, PaymentComponent, PaymentdetailsComponent, RideHistoryComponent,  DriverPayComponent,  SettlementHistoryComponent, PaymentRidehistoryComponent,DeletedUserComponent,DeletedDriverComponent, ServerPaginationComponent],
  providers: [UserService,DriverService,VehicleService,RidesService,PaymentService,SettlementService],
})
export class ManagementModule { }
