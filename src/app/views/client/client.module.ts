import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ClientRoutingModule } from "./client-routing.module";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { HomeComponent } from "./home/home.component";
import { FronthomelayoutComponent } from "app/layouts/fronthomelayout/fronthomelayout.component";
import { UserinnerlayoutComponent } from "app/layouts/userinnerlayout/userinnerlayout.component";
import { HelpComponent } from "./help/help.component";
import { HelpDriverComponent } from "./help-driver/help-driver.component";
import { ContactComponent } from "./contact/contact.component";
import { DriverComponent } from "./driver/driver.component";
import { SharedModule } from "app/shared/shared.module";
import { NgbModule, NgbNavModule } from "@ng-bootstrap/ng-bootstrap";
import { FrontinnerlayoutComponent } from "app/layouts/frontinnerlayout/frontinnerlayout.component";
import { SearchComponent } from "./search/search.component";
import { PickupLocationComponent } from "./pickup-location/pickup-location.component";
import { DropLocationComponent } from "./drop-location/drop-location.component";
import { RightsliderlayoutComponent } from "app/layouts/rightsliderlayout/rightsliderlayout.component";
import { RightsliderSidebarlayoutComponent } from "app/layouts/rightslider-sidebarlayout/rightslider-sidebarlayout.component";
import { NgxSkeletonLoaderModule } from "ngx-skeleton-loader";
import { NgxIntlTelInputModule } from "ngx-intl-tel-input";
import { BsDropdownModule } from "ngx-bootstrap/dropdown";
import { NgxSpinnerModule } from "ngx-spinner";

import { SignupComponent } from "./signup/signup.component";
import { SigninComponent } from "./signin/signin.component";
import { ProfileComponent } from "./profile/profile.component";
import { ChangePhoneNumberComponent } from "./change-phone-number/change-phone-number.component";
import { EmergencyContactsComponent } from "./emergency-contacts/emergency-contacts.component";
import { AddEmergencyContactComponent } from "./add-emergency-contact/add-emergency-contact.component";
import { EditEmergencyContactComponent } from "./edit-emergency-contact/edit-emergency-contact.component";
import { ChangePasswordComponent } from "./change-password/change-password.component";
import { WalletPayComponent } from "./wallet-pay/wallet-pay.component";
import { WalletPaymentSuccessComponent } from "./wallet-payment-success/wallet-payment-success.component";
import { WalletPaymentFailureComponent } from "./wallet-payment-failure/wallet-payment-failure.component";
import { WalletPayHistoryComponent } from "./wallet-pay-history/wallet-pay-history.component";
import { ResetPasswordComponent } from "./reset-password/reset-password.component";
import { NotificationComponent } from "./notification/notification.component";
import { ConfirmBookingComponent } from "./confirm-booking/confirm-booking.component";
import { YourRidesComponent } from "./your-rides/your-rides.component";
import { CompletedRidesDetailsComponent } from "./completed-rides-details/completed-rides-details.component";
import { IncompletedRidesDetailsComponent } from "./incompleted-rides-details/incompleted-rides-details.component";
import { InprogressRidesDetailsComponent } from "./inprogress-rides-details/inprogress-rides-details.component";
import { ReviewRideComponent } from "./review-ride/review-ride.component";
import { SosAlertsComponent } from "./sos-alerts/sos-alerts.component";
import { RidePaymentComponent } from "./ride-payment/ride-payment.component";
import { InviteComponent } from "./invite/invite.component";
import { ErrorPageComponent } from "./error-page/error-page.component";
import { TranslateModule } from '@ngx-translate/core';
import { AdsenseShimModule } from "app/shared/adsense/adsense-shim.module";
import { AgmShimModule } from "app/shared/agm/agm-shim.module";
import { RatingShimModule } from "app/shared/rating/rating-shim.module";
 

@NgModule({
  imports: [
    CommonModule,
    ClientRoutingModule,
    ReactiveFormsModule,
    FormsModule,
    SharedModule,
    NgbModule,
    NgbNavModule,
    TranslateModule,
    NgxSkeletonLoaderModule,
    NgxIntlTelInputModule,
    // ngx-bootstrap's Angular 22 module is imported directly; its legacy
    // `forRoot()` API is not available in the installed package.
    BsDropdownModule,
    AdsenseShimModule,
    AgmShimModule,
    RatingShimModule,
    NgxSpinnerModule
  ],
  declarations: [
    HomeComponent,
    FronthomelayoutComponent,
    UserinnerlayoutComponent,
    FrontinnerlayoutComponent,
    HelpComponent,
    HelpDriverComponent,
    ContactComponent,
    DriverComponent,
    SearchComponent,
    PickupLocationComponent,
    DropLocationComponent,
    RightsliderlayoutComponent,
    RightsliderSidebarlayoutComponent,
    SignupComponent,
    SigninComponent,
    ProfileComponent,
    ChangePhoneNumberComponent,
    EmergencyContactsComponent,
    AddEmergencyContactComponent,
    EditEmergencyContactComponent,
    ChangePasswordComponent,
    WalletPayComponent,
    WalletPaymentSuccessComponent,
    WalletPaymentFailureComponent,
    WalletPayHistoryComponent,
    ResetPasswordComponent,
    NotificationComponent,
    ConfirmBookingComponent,
    YourRidesComponent,
    CompletedRidesDetailsComponent,
    IncompletedRidesDetailsComponent,
    InprogressRidesDetailsComponent,
    ReviewRideComponent,
    SosAlertsComponent,
    RidePaymentComponent,
    InviteComponent,
    ErrorPageComponent
  ]
})
export class ClientModule {}
