import { Component, OnInit, inject } from "@angular/core";
import { SocialAuthService } from "@abacritt/angularx-social-login";
import { Router } from "@angular/router";
import { TranslateService } from '@ngx-translate/core';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from ".././../../../environments/environment";
import {
  SearchCountryField,
  CountryISO
} from "ngx-intl-tel-input";
import {
  FacebookLoginProvider,
  GoogleLoginProvider
} from "@abacritt/angularx-social-login";
import { ToastrService } from "ngx-toastr";
import {
  UntypedFormGroup,
  UntypedFormBuilder,
  UntypedFormControl,
  Validators
} from "@angular/forms";
import { WebappService } from "../../../service/webapp.service";
import { AuthenticationService } from "app/service/authentication.service";
import * as firebaseui from 'firebaseui';
import firebase from 'firebase/app';
import 'firebase/auth';
import { CredentialResponse } from 'google-one-tap';	
import jwt_decode from "jwt-decode";

@Component({
  standalone: false,
selector: "app-signin",
  templateUrl: "./signin.component.html",
  styleUrls: ["./signin.component.scss"]
})
export class SigninComponent implements OnInit {
  jwtResponse: any;
  user: any;
  social_email: any;
  requestData: any;
  loggeddata: object;
  signinForm: UntypedFormGroup;
  mobileForm: UntypedFormGroup;
  googlesignin: boolean;
  facebooksignin: boolean;
  socialsignin: boolean;
  separateDialCode = true;
  userAuthToken: any;
  UserIsAuthenticated: boolean;
  SearchCountryField = SearchCountryField;
  CountryISO = CountryISO;
  preferredCountries: CountryISO[] = [
    CountryISO.UnitedStates,
    CountryISO.UnitedKingdom
  ];
  ui: firebaseui.auth.AuthUI;
  firebaseUiAuthConfig: firebaseui.auth.Config = {
    /* signInFlow: 'popup', */
    signInOptions: [
      {
        provider: firebase.auth.PhoneAuthProvider.PROVIDER_ID,
        // Invisible reCAPTCHA with image challenge and bottom left badge.
        recaptchaParameters: {
          type: 'image',
          size: 'normal',
          badge: 'bottomleft'
        }
      },
    ],
    callbacks: {
      signInSuccessWithAuthResult: this.mobileVerifiedSucceed.bind(this),
      signInFailure: this.mobileVerifiedFailed.bind(this),
    },

  }
  private socialauthService = inject(SocialAuthService, { optional: true });
  private authService = inject(AuthenticationService, { optional: true });
  private apiservice = inject(WebappService, { optional: true });
  private router = inject(Router, { optional: true });
  public toastr = inject(ToastrService, { optional: true });
  private fb = inject(UntypedFormBuilder, { optional: true });
  private translate = inject(TranslateService, { optional: true });

  constructor() {
    /*  if (this.authService.loggedIn) {
      this.router.navigate(['/search']);
    } */
    this.UserIsAuthenticated = false;
    this.socialsignin = false;
    if (this.fb) {
      this.signinForm = this.fb.group({
        username: [
          "",
          Validators.compose([Validators.required, Validators.email])
        ],
        password: [
          "",
          Validators.compose([Validators.required, Validators.minLength(6)])
        ]
      });

      this.mobileForm = this.fb.group({
        phoneno: ["", Validators.required]
      });
    } else {
      this.signinForm = new UntypedFormGroup({
        username: new UntypedFormControl("", Validators.compose([Validators.required, Validators.email])),
        password: new UntypedFormControl("", Validators.compose([Validators.required, Validators.minLength(6)]))
      });
      this.mobileForm = new UntypedFormGroup({
        phoneno: new UntypedFormControl("", Validators.required)
      });
    }
  }

  ngOnInit() {
    this.appConfig();
    this.googlesignin = false;
    this.facebooksignin = false;
    if (this.socialauthService) {
      this.socialauthService.authState.subscribe(user => {
        if (user && this.socialsignin) {
          this.social_email = user.email;
          this.toastr?.success(this.t("Social login connected"));
        }
      });
    }
  }

  ngAfterViewInit() {	
    const googleAccounts = (window as any)?.google?.accounts?.id;
    const googleButton = document.getElementById("googleSignIn");
    const globalWindow = window as any;
    if (!googleAccounts || !googleButton || !environment.googleloginClientid) {
      return;
    }
    if (!globalWindow.__shilotaGoogleAccountsInitialized) {
      googleAccounts.initialize({
        client_id: environment.googleloginClientid,	
        callback: this.handleCredentialResponse.bind(this),	
        auto_select: false,	
        cancel_on_tap_outside: true	
      });
      globalWindow.__shilotaGoogleAccountsInitialized = true;
    }
    googleButton.innerHTML = "";
    googleAccounts.renderButton(	
      googleButton,	
      { theme: "filled_blue", size: "large", logo_alignment: "left", width: 400 }	
    );	
    /* google.accounts.id.prompt((notification: PromptMomentNotification) => { }); */	
  }	
  async handleCredentialResponse(response: CredentialResponse) {	
    if (response) {	
      if (response.credential) {	
        this.jwtResponse = jwt_decode(response.credential);	
        this.social_email = this.jwtResponse.email;	
        this.toastr?.success(this.t("Social login connected"));
      }	
    }	
  }	

  signInWithGoogle(): void {
    this.socialauthService?.signIn(GoogleLoginProvider.PROVIDER_ID);
    this.socialsignin = true;
  }

  signInWithFB(): void {
    this.socialauthService?.signIn(FacebookLoginProvider.PROVIDER_ID);
    this.socialsignin = true;
  }




  onLoginSubmit(login) {
    if (!this.apiservice) {
      this.toastr?.error(this.t("Login service is unavailable"));
      return;
    }
    if (this.signinForm.valid) {
      const requestData = {
        email: login.username,
        password: login.password,
        role: "user"
      };
      this.apiservice.accountsignin(requestData).subscribe(data => {
        if (data["status"] === "true") {
          this.replaceStoredSession();
          this.loggeddata = {
            id: data["user_id"],
            name: data["full_name"],
            email: data["email"],
            role: data["role"],
            ad_unit_id: data["ad_unit_id"],
            admin_enable_ads: data["admin_enable_ads"],
          };
          this.userAuthToken = data["token"];
          this.UserIsAuthenticated = true;
          if (!environment.enablePhoneVerification) {
            this.mobileVerificationCompleted();
            return;
          }
          try {
            const auth = this.getFirebaseAuth();
            if (!auth) {
              this.mobileVerificationCompleted();
              return;
            }
            this.ui = firebaseui.auth.AuthUI.getInstance() || new firebaseui.auth.AuthUI(auth);
            this.ui.start('#firebaseui-auth-container', this.firebaseUiAuthConfig);
          } catch {
            this.mobileVerificationCompleted();
          }
        } else {
          this.toastr?.error(this.t(data["message"]));
          window.scrollTo(0, 0);
        }
      });
    } else {
      this.validateAllFormFields(this.signinForm);
    }
  }

  mobileVerificationCompleted() {
    this.authService?.storeUserData(this.userAuthToken, this.loggeddata);
    /* web-push signin-method */
    if (localStorage.getItem("firebase_auth")) {
      const tokenData = {
        user_id: this.loggeddata["id"],
        device_token: localStorage.getItem("firebase_auth")
      };
      this.apiservice?.webSignin(tokenData).subscribe(data => {
      });
    }
    if (
      localStorage.getItem("pickup_location") &&
      localStorage.getItem("drop_location")
    ) {
      this.router?.navigate(["/search"]);
    } else {
      this.router?.navigate(["/"]);
    }
  }

  mobileVerifiedSucceed(signInSuccessData) {
    if (!signInSuccessData.user.phoneNumber) {
      this.toastr?.error(this.t("Mobile Number Verification Failed"));
      this.router?.navigate(["/signin"]);
    } else {
      let requestData = {
        "user_id": this.loggeddata["id"],
        "phoneNumber": signInSuccessData.user.phoneNumber,
      }
      this.apiservice?.changephoneno(requestData).subscribe(data => {
        if (data['status'] === 'true') {
          this.mobileVerificationCompleted();
        } else {
          this.toastr?.error(this.t(data['message']));
          this.router?.navigate(['/signin']);
        }
      });
    }
  }

  mobileVerifiedFailed(Error) {
    /* console.log("Verification failed" + Error); */
  }

  validateAllFormFields(formGroup: UntypedFormGroup) {
    Object.keys(formGroup.controls).forEach(field => {
      const control = formGroup.get(field);
      if (control instanceof UntypedFormControl) {
        control.markAsTouched({ onlySelf: true });
      } else if (control instanceof UntypedFormGroup) {
        this.validateAllFormFields(control);
      }
    });
  }

  appConfig() {
    this.apiservice?.appconfig().subscribe(data => {
      if (data["status"] === "true") {
        localStorage.setItem("CS", data["currencysymbol"]);
      }
    });
  }

  private t(message: string): string {
    return this.translate ? this.translate.instant(message) : message;
  }

  private getFirebaseAuth(): firebase.auth.Auth | null {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(environment.firebase);
      }
      return firebase.auth();
    } catch {
      return null;
    }
  }

  private replaceStoredSession(): void {
    localStorage.removeItem("authtoken");
    localStorage.removeItem("user");
  }
}
