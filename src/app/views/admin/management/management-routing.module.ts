import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { UserComponent } from './user/user.component';
import { DeletedUserComponent } from './deleteduser/deleteduser.component';
import { DeletedDriverComponent } from './deleteddriver/deleteddriver.component';
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

const routes: Routes = [
  {
    path: '',
    children: [
         {
        path: 'user',                                                                                                                                               
        component: UserComponent,
       
      },
      {
        path: 'view/:id',
        component: ViewComponent,
       
      },
      {
        path: 'driver',
        component: DriverComponent,
       
      },
      {
        path: 'details/:id',
        component: DetailsComponent,
       
      },
      {
        path: 'deletedusers',                                                                                                                                               
        component: DeletedUserComponent,
       
      },
      {
        path: 'deleteddrivers',                                                                                                                                               
        component: DeletedDriverComponent,
       
      },
      {
        path: 'vehicle',
        component: VehicleComponent,
       
      },
      {
        path: 'vehicledetails/:id',
        component: VechicledetailComponent,
       
      },

    
      {
        path: 'rides',
        component: RidesComponent,
       
      },
      {
        path: 'ridesdetails/:id',
        component: RidesDetailsComponent,
       
      },
      {
        path: 'payment',
        component: PaymentComponent,
       
      },
      {
        path: 'paymentdetails/:id',
        component: PaymentdetailsComponent,
       
      },
      {
        path: 'ridehistory/:id',
        component: RideHistoryComponent,
       
      },
      {
        path: 'driverPay',
        component: DriverPayComponent,
       
      },
      {
        path: 'settlementHistory',
        component: SettlementHistoryComponent,
       
      },

      {
        path: 'viewRide/:id',
        component: PaymentRidehistoryComponent,
       
      },

      
      
      
      
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ManagementRoutingModule { }
