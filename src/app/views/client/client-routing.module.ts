import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { FronthomelayoutComponent } from 'app/layouts/fronthomelayout/fronthomelayout.component';
import { HelpComponent } from './help/help.component';
import { HelpDriverComponent } from './help-driver/help-driver.component';
import { ContactComponent } from './contact/contact.component';
import { DriverComponent } from './driver/driver.component';
import { SearchComponent } from './search/search.component';
import { SignupComponent } from './signup/signup.component';
import { SigninComponent } from './signin/signin.component';
import { FrontinnerlayoutComponent } from 'app/layouts/frontinnerlayout/frontinnerlayout.component';
import { RightsliderlayoutComponent } from 'app/layouts/rightsliderlayout/rightsliderlayout.component';
import { PickupLocationComponent } from './pickup-location/pickup-location.component';
import { DropLocationComponent } from './drop-location/drop-location.component';
import { ProfileComponent } from './profile/profile.component';
import { ChangePhoneNumberComponent } from './change-phone-number/change-phone-number.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { EmergencyContactsComponent } from './emergency-contacts/emergency-contacts.component';
import { AddEmergencyContactComponent } from './add-emergency-contact/add-emergency-contact.component';
import { EditEmergencyContactComponent } from './edit-emergency-contact/edit-emergency-contact.component';
import { ChangePasswordComponent } from './change-password/change-password.component';
import { WalletPayComponent } from './wallet-pay/wallet-pay.component';
import { WalletPaymentSuccessComponent } from './wallet-payment-success/wallet-payment-success.component';
import { WalletPaymentFailureComponent } from './wallet-payment-failure/wallet-payment-failure.component';
import { WalletPayHistoryComponent } from './wallet-pay-history/wallet-pay-history.component';
import { NotificationComponent } from './notification/notification.component';
import { ConfirmBookingComponent } from './confirm-booking/confirm-booking.component';
import { YourRidesComponent } from './your-rides/your-rides.component';
import { CompletedRidesDetailsComponent } from './completed-rides-details/completed-rides-details.component';
import { IncompletedRidesDetailsComponent } from './incompleted-rides-details/incompleted-rides-details.component';
import { InprogressRidesDetailsComponent } from './inprogress-rides-details/inprogress-rides-details.component';
import { ReviewRideComponent } from './review-ride/review-ride.component';
import { SosAlertsComponent } from './sos-alerts/sos-alerts.component';
import { RidePaymentComponent } from './ride-payment/ride-payment.component';
import { InviteComponent } from './invite/invite.component';
import { ErrorPageComponent } from './error-page/error-page.component';

import { UserinnerlayoutComponent } from 'app/layouts/userinnerlayout/userinnerlayout.component';
import { RightsliderSidebarlayoutComponent } from 'app/layouts/rightslider-sidebarlayout/rightslider-sidebarlayout.component';
import { AdminguardGuard } from 'app/guards/adminguard.guard';


const routes: Routes = [
  {
    path: '',
    component: FronthomelayoutComponent,
    data: { expectedRole: 'user' },
    children: [{ path: '', component: HomeComponent, pathMatch: 'full' }]
  },

  {
    path: '',
    component: UserinnerlayoutComponent,
    data: { expectedRole: 'user' },
    children: [
      { path: 'help/:id', component: HelpComponent },

      { path: 'contact', component: ContactComponent },

      {
        path: 'faq',
        loadChildren: () => import('./faq/faq.module').then(m => m.FaqModule)
      }
    ]
  },

  {
    path: '',
    component: FrontinnerlayoutComponent,
    data: { expectedRole: 'user' },
    children: [
      { path: 'helpDriver/:id', component: HelpDriverComponent },
      { path: 'contact', component: ContactComponent },
      { path: 'driver', component: DriverComponent }
    ]
  },

  {
    path: '',
    component: RightsliderSidebarlayoutComponent,
    data: { expectedRole: 'user' },
    children: [
      {
        path: 'search',
        component: SearchComponent
      }
    ]
  },

  {
    path: '',
    component: RightsliderlayoutComponent,
    data: { expectedRole: 'user' },
    children: [
      {
        path: 'signup',
        component: SignupComponent
      },

      {
        path: 'signin',
        component: SigninComponent
      },

      {
        path: 'pickup-location',
        component: PickupLocationComponent
      },

      {
        path: 'drop-location',
        component: DropLocationComponent
      },

      {
        path: 'forgot-password',
        component: ResetPasswordComponent
      },
    ]
  },

  {
    path: '',
    component: RightsliderlayoutComponent,
    canActivate: [AdminguardGuard],
    data: { expectedRole: 'user' },
    children: [
      {
        path: 'profile',
        component: ProfileComponent
      },

      {
        path: 'change-phone-number',
        component: ChangePhoneNumberComponent
      },

      {
        path: 'change-password',
        component: ChangePasswordComponent
      },

      {
        path: 'emergency-contacts',
        component: EmergencyContactsComponent
      },

      {
        path: 'add-emergency-contact',
        component: AddEmergencyContactComponent
      },

      {
        path: 'edit-emergency-contact/:id',
        component: EditEmergencyContactComponent
      },

      {
        path: 'wallet',
        component: WalletPayComponent
      },

      {
        path: 'wallet-history',
        component: WalletPayHistoryComponent
      },

      {
        path: 'wallet-payment-success',
        component: WalletPaymentSuccessComponent
      },

      {
        path: 'wallet-payment-failure',
        component: WalletPaymentFailureComponent
      },

      {
        path: 'notifications',
        component: NotificationComponent
      },

      {
        path: 'confirm-booking',
        component: ConfirmBookingComponent
      },

      {
        path: 'your-rides',
        component: YourRidesComponent
      },

      {
        path: 'active-rides/:id',
        component: InprogressRidesDetailsComponent
      },

      {
        path: 'inactive-rides/:id',
        component: IncompletedRidesDetailsComponent
      },

      {
        path: 'completed-rides/:id',
        component: CompletedRidesDetailsComponent
      },

      {
        path: 'ride-payment/:id',
        component: RidePaymentComponent,
      },

      {
        path: 'write-review/:id',
        component: ReviewRideComponent
      },

      {
        path: 'invite-friends',
        component: InviteComponent
      },

      {
        path: 'sos-alert',
        component: SosAlertsComponent
      },

      {
        path: 'page-not-found',
        component: ErrorPageComponent
      },

      {
        path: '*',
        component: ErrorPageComponent
      },
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ClientRoutingModule {}
