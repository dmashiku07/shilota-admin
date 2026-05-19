import { Component, OnDestroy, OnInit } from "@angular/core";
import { ToastrService } from "ngx-toastr";
import { Router } from "@angular/router";
import { TranslateService } from '@ngx-translate/core';
import { TranslateModule } from '@ngx-translate/core';
import {
  UntypedFormGroup,
  UntypedFormBuilder,
  UntypedFormControl,
  Validators
} from "@angular/forms";
import { WebappService } from "../../../service/webapp.service";
import * as dropin from "braintree-web-drop-in";
@Component({
  standalone: false,
selector: "app-wallet-pay",
  templateUrl: "./wallet-pay.component.html",
  styleUrls: ["./wallet-pay.component.scss"]
})
export class WalletPayComponent implements OnInit, OnDestroy {
  readonly defaultCurrencySymbol = "$";
  braintreeIsReady: boolean;
  braintreeIsLoading: boolean;
  showBraintreeContainer: boolean;
  dropIninstance: any;
  private braintreeInitTimeout: any;
  private showContainerTimeout: any;
  profileid: any;
  walletForm: UntypedFormGroup;
  paid_amount: number;
  walletmoney: any;
  profilelog: any;
  sitesettings: any;
  currencySymbol: string;
  ad_unit_id:any;
  admin_enable_ads:any;
  constructor(
    private apiservice: WebappService,
    public toastr: ToastrService,
    private fb: UntypedFormBuilder,
    private translate: TranslateService,
    private router: Router
  ) {
    this.currencySymbol = this.defaultCurrencySymbol;
    this.walletForm = this.fb.group({
      add_amount: ["", Validators.required]
    });
    this.apiservice.appconfig().subscribe((res: any) => {
      if (res?.status === "true") {
        this.sitesettings = res;
        this.currencySymbol = res.currencysymbol || this.defaultCurrencySymbol;
        localStorage.setItem("CS", this.currencySymbol);
      }
    });
  }

  ngOnInit() {
    this.braintreeIsReady = false;
    this.braintreeIsLoading = false;
    this.showBraintreeContainer = false;
    this.profilelog = JSON.parse(localStorage.getItem("user"));
    if (!this.profilelog?.id) {
      this.toastr.error(this.translate.instant("Please sign in again"));
      this.router.navigate(["/signin"]);
      return;
    }
    this.profileid = this.profilelog.id;
    this.ad_unit_id = this.profilelog.ad_unit_id;
    this.admin_enable_ads=this.profilelog.admin_enable_ads;

    this.apiservice.profiledetails(this.profileid).subscribe(data => {
      if (data["status"] === "true") {
        this.walletmoney = data["walletmoney"];
      } else {
        this.walletmoney = "0.00";
      }
    });
  }

  addMoney(walletdata) {
    if (this.walletForm.valid && !this.braintreeIsLoading && !this.braintreeIsReady) {
      this.profilelog = JSON.parse(localStorage.getItem("user"));
      if (!this.profilelog?.id) {
        this.toastr.error(this.translate.instant("Please sign in again"));
        this.router.navigate(["/signin"]);
        return;
      }
      this.profileid = this.profilelog.id;
      this.paid_amount = Number(walletdata.add_amount);
      if (!this.paid_amount || this.paid_amount <= 0) {
        this.toastr.error(this.translate.instant("Enter a valid amount"));
        return;
      }
      this.braintreeIsLoading = true;
      clearTimeout(this.showContainerTimeout);
      this.showContainerTimeout = setTimeout(() => {
        this.showBraintreeContainer = true;
      }, 0);
      const requestData = {
        user_id: this.profileid
      };
      this.apiservice.braintreetoken(requestData).subscribe(data => {
        if (data["status"] === "true") {
          if (!data["clientToken"]) {
            this.resetBraintreeState();
            this.toastr.error(this.translate.instant("Unable to initialize payment"));
            return;
          }
          this.braintreeInitTimeout = setTimeout(() => {
            if (!this.braintreeIsReady) {
              this.resetBraintreeState();
              this.toastr.error(this.translate.instant("Payment widget failed to load"));
            }
          }, 15000);
          try {
            dropin.create(
              {
                authorization: data["clientToken"],
                selector: "#dropin-container",
                flow: "vault"
              },
              (err, dropinInstance) => {
                clearTimeout(this.braintreeInitTimeout);
                if (err) {
                  console.error("Braintree drop-in init failed", err);
                  this.resetBraintreeState();
                  this.toastr.error(this.translate.instant("Unable to initialize payment"));
                  return;
                }
                this.dropIninstance = dropinInstance;
                this.braintreeIsReady = true;
                this.braintreeIsLoading = false;
              }
            );
          } catch (error) {
            clearTimeout(this.braintreeInitTimeout);
            console.error("Braintree drop-in threw during init", error);
            this.resetBraintreeState();
            this.toastr.error(this.translate.instant("Unable to initialize payment"));
          }
        } else {
          this.braintreeIsLoading = false;
          this.showBraintreeContainer = false;
          this.toastr.error(this.translate.instant(data["message"]));
          this.router.navigate(["/wallet"]);
        }
      }, () => {
        this.resetBraintreeState();
        this.toastr.error(this.translate.instant("Something went wrong"));
      });
    } else {
      this.validateAllFormFields(this.walletForm);
    }
  }

  pay() {
    if (!this.dropIninstance) {
      this.toastr.error(this.translate.instant("Payment is not ready yet"));
      return;
    }
    this.dropIninstance.requestPaymentMethod((err, payload) => {
      if (err) {
        this.toastr.error(this.translate.instant("Something went wrong"));
        this.router.navigate(["/wallet"]);
      } else {
        const walletData = {
          user_id: this.profileid,
          paynonce: payload.nonce,
          amount: this.paid_amount
        };
        this.apiservice.creditwallet(walletData).subscribe(data => {
          if (data["status"] === "true") {
            this.toastr.success(this.translate.instant(data["message"]));
            this.router.navigate(["/wallet-payment-success"]);
          } else {
            this.toastr.error(this.translate.instant(data["message"]));
            this.router.navigate(["/wallet-payment-failure"]);
          }
        });
      }
    });
  }

  ngOnDestroy() {
    clearTimeout(this.braintreeInitTimeout);
    clearTimeout(this.showContainerTimeout);
    if (this.dropIninstance?.teardown) {
      this.dropIninstance.teardown();
    }
  }

  private resetBraintreeState() {
    this.braintreeIsLoading = false;
    this.braintreeIsReady = false;
    this.showBraintreeContainer = false;
    this.dropIninstance = null;
  }

  numberOnly(event): void {
    const initalValue = event.target.value;
    event.target.value = initalValue.replace(/[^0-9]*/g, '');
    if ( initalValue.trim() !== event.target.value.trim()) {
      event.stopPropagation();
    }
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
}
