import { Component, OnInit, inject } from "@angular/core";
import { SocialAuthService } from "@abacritt/angularx-social-login";
import { Router } from "@angular/router";
import { environment } from ".././../../../environments/environment";
import { AuthenticationService } from "app/service/authentication.service";
import * as googleLibphonenumber from 'google-libphonenumber';
import { TranslateService } from '@ngx-translate/core';
import { TranslateModule } from '@ngx-translate/core';
import {
  SearchCountryField,
  CountryISO
} from "ngx-intl-tel-input";
import {
  FacebookLoginProvider,
  GoogleLoginProvider
} from "@abacritt/angularx-social-login";
import {
  UntypedFormGroup,
  UntypedFormBuilder,
  UntypedFormControl,
  Validators
} from "@angular/forms";
import { ToastrService } from "ngx-toastr";
import { WebappService } from "../../../service/webapp.service";
import * as firebaseui from 'firebaseui';
import firebase from 'firebase/app';
import 'firebase/auth';
import { CredentialResponse } from 'google-one-tap';	
import jwt_decode from "jwt-decode";

@Component({
  standalone: false,
selector: "app-signup",
  templateUrl: "./signup.component.html",
  styleUrls: ["./signup.component.scss"]
})
export class SignupComponent implements OnInit {
  jwtResponse: any;
  user: any;
  social_email: any;
  loggeddata: object;
  social_name: any;
  requestData: object;
  signupForm: UntypedFormGroup;
  mobileForm: UntypedFormGroup;
  googlesignin: boolean;
  facebooksignin: boolean;
  social_pic: any;
  socialsignin: any;
  profilepic: any;
  separateDialCode = true;
  InfoIsValid: boolean;
  SearchCountryField = SearchCountryField;
  CountryISO = CountryISO;
  preferredCountries: CountryISO[] = [
    CountryISO.UnitedStates,
    CountryISO.UnitedKingdom
  ];
  formatPhoneNo: any;
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
  private apiservice = inject(WebappService, { optional: true });
  private authService = inject(AuthenticationService, { optional: true });
  private router = inject(Router, { optional: true });
  public toastr = inject(ToastrService, { optional: true });
  private fb = inject(UntypedFormBuilder, { optional: true });
  private translate = inject(TranslateService, { optional: true });

  constructor() {
    this.InfoIsValid = false;
    if (this.fb) {
      this.signupForm = this.fb.group(
        {
          username: [
            "",
            Validators.compose([Validators.required, Validators.email])
          ],
          password: [
            "",
            Validators.compose([Validators.required, Validators.minLength(6)])
          ],
          cpassword: [
            "",
            Validators.compose([Validators.required, Validators.minLength(6)])
          ],
          firstname: [
            "",
            Validators.compose([Validators.required, Validators.minLength(3)])
          ]
        },
        { validator: this.checkPasswords }
      );

      this.mobileForm = this.fb.group({
        phoneno: ["", Validators.required]
      });
    } else {
      this.signupForm = new UntypedFormGroup(
        {
          username: new UntypedFormControl("", Validators.compose([Validators.required, Validators.email])),
          password: new UntypedFormControl("", Validators.compose([Validators.required, Validators.minLength(6)])),
          cpassword: new UntypedFormControl("", Validators.compose([Validators.required, Validators.minLength(6)])),
          firstname: new UntypedFormControl("", Validators.compose([Validators.required, Validators.minLength(3)]))
        },
        { validators: this.checkPasswords }
      );
      this.mobileForm = new UntypedFormGroup({
        phoneno: new UntypedFormControl("", Validators.required)
      });
    }
  }

  ngOnInit() {
    this.googlesignin = false;
    this.facebooksignin = false;
    this.social_pic = "";
    if (this.socialauthService) {
      this.socialauthService.authState.subscribe(user => {
        if (user && this.socialsignin) {
          this.social_email = user.email;
          this.social_name = user.firstName;
          if (user.provider === "GOOGLE") {
            this.social_pic = user.photoUrl + "?sz=50";
          }

          if (user.provider === "FACEBOOK") {
            this.social_pic = user.photoUrl;
          }

          this.toastr?.success(this.t("Social login connected"));
        }
      });
    }
  }
  
  ngAfterViewInit() {
    const googleAccounts = (window as any)?.google?.accounts?.id;
    const googleButton = document.getElementById("googleSignUp");
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

  signOut(): void {
    this.socialauthService?.signOut();
  }

  onSignupSubmit(login) {
    if (!this.apiservice) {
      this.toastr?.error(this.t("Signup service is unavailable"));
      return;
    }
    if (this.signupForm.valid) {
      this.requestData = {
        email: login.username,
        password: login.password,
        full_name: login.firstname,
        imageurl: this.social_pic
      };
      this.apiservice.accountexists(this.requestData).subscribe(data => {
        if (data["status"] === "true") {
          this.InfoIsValid = true;
          if (!environment.enablePhoneVerification) {
            this.completeSignupFlow();
            return;
          }
          try {
            const auth = this.getFirebaseAuth();
            if (!auth) {
              this.toastr?.warning(this.t("Phone verification is unavailable. Continuing without phone verification."));
              this.completeSignupFlow();
              return;
            }
            this.ui = firebaseui.auth.AuthUI.getInstance() || new firebaseui.auth.AuthUI(auth);
            this.ui.start('#firebaseui-auth-container', this.firebaseUiAuthConfig);
          } catch {
            this.toastr?.warning(this.t("Phone verification is unavailable. Continuing without phone verification."));
            this.completeSignupFlow();
          }
        } else {
          this.toastr?.success(this.t(data["message"]));
          window.scrollTo(0, 0);
        }
      });
    } else {
      this.validateAllFormFields(this.signupForm);
    }
  }

  parseWithGoogleLibphonenumber(phone_number) {
    const phoneUtil = googleLibphonenumber.PhoneNumberUtil.getInstance();
    const phoneNumber = phoneUtil.parse(phone_number);
    return {
      country: phoneNumber.getCountryCode(),
      phone: phoneNumber.getNationalNumber()
    };
  }

  mobileVerifiedSucceed(signInSuccessData) {
    if (!signInSuccessData.user.phoneNumber) {
      this.toastr?.error(this.t("Mobile Number Verification Failed"));
      this.router?.navigate(["/signup"]);
    } else {
      this.formatPhoneNo = this.parseWithGoogleLibphonenumber(signInSuccessData.user.phoneNumber);
      this.requestData["phone_number"] = this.formatPhoneNo.phone;
      this.requestData["country_code"] = this.formatPhoneNo.country;
      this.completeSignupFlow();
    }
  }

  mobileVerifiedFailed(Error) {
    /* console.log("Verification failed" + Error); */
  }

  checkPasswords(group: UntypedFormGroup) {
    const pwd = group.controls.password.value;
    const cpwd = group.controls.cpassword.value;
    return pwd === cpwd ? null : { mismatchedPasswords: true };
  }

charOnly(event): boolean {
   
    const charCode = event.which ? event.which : event.keyCode;

    if (
      charCode > 32 &&
      (charCode < 65 || charCode > 90) &&
      (charCode < 97 || charCode > 122 )
    ) {
      var hebrewAlphabetDigits =  /^[א-ת\s]+$/;
      var arabicAlphabetDigits = /[\u0600-\u06ff]|[\u0750-\u077f]|[\ufb50-\ufc3f]|[\ufe70-\ufefc]|[\u0200]|[\u00A0]/g;
      var key = String.fromCharCode(event.which);
      if (event.keyCode == 8 || event.keyCode == 37 || event.keyCode == 39 || arabicAlphabetDigits.test(key) || hebrewAlphabetDigits.test(key)) {
        return true;
      }
      
      return false;
    }
    return true;
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

  private t(message: string): string {
    return this.translate ? this.translate.instant(message) : message;
  }

  private completeSignupFlow(): void {
    this.apiservice?.accountsignup(this.requestData)?.subscribe(data => {
      if (data["status"] === "true") {
        this.apiservice
          .accountsignin(this.requestData)
          .subscribe(data => {
            if (data["status"] === "true") {
              this.replaceStoredSession();
              this.loggeddata = {
                id: data["user_id"],
                name: data["full_name"],
                email: data["email"],
                role: data["role"]
              };
              this.authService?.storeUserData(
                data["token"],
                this.loggeddata
              );
              if (
                localStorage.pickup_location &&
                localStorage.drop_location
              ) {
                this.router?.navigate(["/search"]);
              } else {
                this.router?.navigate(["/"]);
              }
            } else {
              this.toastr?.error(this.t("Something went wrong"));
              this.router?.navigate(["/signin"]);
            }
          });
      } else {
        this.social_pic = environment.apiUrl + "/gallery/users/user.png";
        this.toastr?.error(this.t(data["message"]));
        window.scrollTo(0, 0);
      }
    });
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
