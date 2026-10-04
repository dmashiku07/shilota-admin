import { Component, OnInit, inject } from "@angular/core";
import { ToastrService } from "ngx-toastr";
import { Router } from "@angular/router";
import { TranslateService } from '@ngx-translate/core';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from ".././../../../environments/environment";
import {
  UntypedFormGroup,
  UntypedFormBuilder,
  UntypedFormControl,
  Validators
} from "@angular/forms";
import { WebappService } from "../../../service/webapp.service";
import {
  SearchCountryField,
  CountryISO
} from "ngx-intl-tel-input";
import * as firebaseui from 'firebaseui';
import firebase from 'firebase/app';
import 'firebase/auth';

@Component({
  standalone: false,
selector: "app-change-phone-number",
  templateUrl: "./change-phone-number.component.html",
  styleUrls: ["./change-phone-number.component.scss"]
})
export class ChangePhoneNumberComponent implements OnInit {
  profilelog: any;
  profileid: any;
  profileinfo: any;
  requestData: any;
  mobileForm: UntypedFormGroup;
  separateDialCode = true;
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
  private apiservice = inject(WebappService, { optional: true });
  public toastr = inject(ToastrService, { optional: true });
  private fb = inject(UntypedFormBuilder, { optional: true });
  private router = inject(Router, { optional: true });
  private translate = inject(TranslateService, { optional: true });

  constructor() {
    if (this.fb) {
      this.mobileForm = this.fb.group({
        phoneno: ["", Validators.required]
      });
    } else {
      this.mobileForm = new UntypedFormGroup({
        phoneno: new UntypedFormControl("", Validators.required)
      });
    }
  }

  ngOnInit() {
    this.profilelog = JSON.parse(localStorage.getItem("user"));
    this.profileid = this.profilelog.id;
    this.apiservice?.profiledetails(this.profileid)?.subscribe(data => {
      if (data["status"] === "true") {
        this.profileinfo = data;
      } else {
        this.toastr?.error(this.t(data["message"]));
        window.scrollTo(0, 0);
      }
    });
    try {
      const auth = this.getFirebaseAuth();
      if (!auth) {
        this.toastr?.error(this.t("Phone verification is unavailable"));
        return;
      }
      this.ui = firebaseui.auth.AuthUI.getInstance() || new firebaseui.auth.AuthUI(auth);
      this.ui.start('#firebaseui-auth-container', this.firebaseUiAuthConfig);
    } catch {
      this.toastr?.error(this.t("Phone verification is unavailable"));
    }
  }

  mobileVerifiedSucceed(signInSuccessData) {
    if (!signInSuccessData.user.phoneNumber) {
      this.toastr?.error(this.t("Mobile Number Verification Failed"));
      window.scrollTo(0, 0);
    } else {
      this.profilelog = JSON.parse(localStorage.getItem("user"));
      this.profileid = this.profilelog.id;
      let requestData = {
        "user_id": this.profileid,
        "phoneNumber": signInSuccessData.user.phoneNumber,
      }
      this.apiservice?.changephoneno(requestData)?.subscribe(data => {
        if (data['status'] === 'true') {
          this.router?.navigate(["/profile"]);
          this.toastr?.success(this.t(data["message"]));
          window.scrollTo(0, 0);
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

  numberOnly(event): boolean {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
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

}
