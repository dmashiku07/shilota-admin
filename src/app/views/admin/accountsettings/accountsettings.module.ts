import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { EmailComponent } from './email/email.component';
import { SocialComponent } from './social/social.component';
import { WebsiteComponent } from './website/website.component';
import { LogoComponent } from './logo/logo.component';
import { PasswordComponent } from './password/password.component';
import { MobileappComponent } from './mobileapp/mobileapp.component';
import { PaymentComponent } from './payment/payment.component';
import { FaviconComponent } from './favicon/favicon.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { AccountsettingsRoutingModule } from './accountsettings-routing.module';

@NgModule({
  imports: [
    CommonModule,
    AccountsettingsRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    NgbModule
  ],
  declarations: [
    EmailComponent,
    SocialComponent,
    WebsiteComponent,
    LogoComponent,
    PasswordComponent,
    MobileappComponent,
    PaymentComponent,
    FaviconComponent
  ]
})
export class AccountsettingsModule {}
