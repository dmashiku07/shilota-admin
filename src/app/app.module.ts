import { NgModule } from "@angular/core";
import { provideAnimations } from "@angular/platform-browser/animations";
import { BrowserModule } from "@angular/platform-browser";
import { NgbModule } from "@ng-bootstrap/ng-bootstrap";
import { AppRoutingModule } from "./app-routing.module";
import { SharedModule } from "./shared/shared.module";
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { AppComponent } from "./app.component";
import { ToastrModule } from "ngx-toastr";
import { environment } from "../environments/environment";
import { SocialLoginModule, SocialAuthServiceConfig, SOCIAL_AUTH_CONFIG } from "@abacritt/angularx-social-login";
import { GoogleLoginProvider, FacebookLoginProvider } from "@abacritt/angularx-social-login";
import { Observable, of } from "rxjs";

/* JWT AUTHENTICATION */
import { JwtModule } from "@auth0/angular-jwt";

export function getToken() {
  return localStorage.getItem("authtoken");
}

const config: SocialAuthServiceConfig = {
  autoLogin: false,
  providers: [
  {
    id: GoogleLoginProvider.PROVIDER_ID,
    provider: new GoogleLoginProvider(
      environment.googleloginClientid
    )
  },
  {
    id: FacebookLoginProvider.PROVIDER_ID,
    provider: new FacebookLoginProvider(environment.facebookloginClientid)
  }
  ]
};

export function provideConfig() {
  return config;
}


/* TRANSLATIONS */
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';

export class SafeTranslateLoader implements TranslateLoader {
  getTranslation(_lang: string): Observable<any> {
    return of({});
  }
}

/* Services */
import { AuthenticationService } from "./service/authentication.service";
import { UserService } from "./service/user.service";
import { DriverService } from "./service/driver.service";
import { VehicleService } from "./service/vehicle.service";
import { RidesService } from "./service/rides.service";
import { PageService } from "./service/page.service";
import { FaqService } from "./service/faq.service";
import { HomeService } from "./service/home.service";
import { BannerService } from "./service/banner.service";
import { SettlementService } from "./service/settlement.service";
import { MessagingService } from "./service/messaging.service";
import { SocketService } from "./service/socket.service";



@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    SharedModule,
    ToastrModule.forRoot({
      timeOut: 3000,
      positionClass: "toast-top-right",
      preventDuplicates: true,
      progressBar: true
    }),

    JwtModule.forRoot({
      config: {
        tokenGetter: getToken,
        authScheme: "",
        allowedDomains: []
      }
    }),
    SocialLoginModule,
    NgbModule,
    TranslateModule.forRoot({
            loader: {
                provide: TranslateLoader,
                useClass: SafeTranslateLoader
            }
        })
  ],
  providers: [
    {
      provide: SOCIAL_AUTH_CONFIG,
      useFactory: provideConfig
    },
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimations(),
    AuthenticationService,
    PageService,
    FaqService,
    HomeService,
    BannerService,
    UserService,
    DriverService,
    VehicleService,
    RidesService,
    SettlementService,
    MessagingService,
    SocketService
  ],
  exports: [

    TranslateModule
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
