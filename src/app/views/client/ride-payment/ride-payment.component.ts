import { Component, OnInit } from "@angular/core";
import { WebappService } from "../../../service/webapp.service";
import { ActivatedRoute, Router } from "@angular/router";
const isDefined = (value: any): boolean => value !== undefined && value !== null;
import { ToastrService } from "ngx-toastr";
import { TranslateService } from '@ngx-translate/core';
import { TranslateModule } from '@ngx-translate/core';
import * as dropin from "braintree-web-drop-in";
@Component({
  standalone: false,
selector: "app-ride-payment",
  templateUrl: "./ride-payment.component.html",
  styleUrls: ["./ride-payment.component.scss"]
})
export class RidePaymentComponent implements OnInit {
  braintreeIsReady: boolean;
  dropIninstance: any;
  profileid: any;
  profilelog: any;
  rideDetails: any;
  ride_id: any;
  amounttopay: any;
  paymentType: any;
  walletMoney: any;
  sufficientWallet: Boolean;
  walletUsed: Boolean;
  currencySymbol: any = "$";
  reviewDone: any;
  onPaymentInitiate: Boolean;
  constructor(
    private apiservice: WebappService,
    private router: Router,
    private translate: TranslateService,
    private route: ActivatedRoute,
    public toastr: ToastrService
  ) {
    this.sufficientWallet = false;
    this.onPaymentInitiate = false;
  }

  ngOnInit() {
    if (localStorage.getItem("CS")) {
      this.currencySymbol = localStorage.getItem("CS");
    }
    this.walletUsed = false;
    this.braintreeIsReady = false;
    this.profilelog = JSON.parse(localStorage.getItem("user"));
    this.profileid = this.profilelog.id;
    this.route.params.subscribe(params => {
      this.ride_id = atob(params["id"]);
    });
    const rideData = {
      user_id: this.profileid,
      onride_id: this.ride_id
    };
    this.apiservice.ridecompleted(rideData).subscribe(data => {
      if (data["status"] === "true") {
        if (data["ispayment"] === "false") {
          if (isDefined(data)) {
            this.rideDetails = data;
            this.reviewDone = data["isreview"];
            this.amounttopay = this.rideDetails.ride_total;
            this.paymentType = this.rideDetails.payment_type;
            this.walletMoney = this.rideDetails.walletmoney;
          }
        } else {
          this.router.navigate(["/completed-rides", btoa(this.ride_id)]);
        }
      } else {
        this.router.navigate(["/page-not-found"]);
      }
    });
  }

  payRide() {
    let walletPay = this.walletUsed ? "1" : "0";
    this.onPaymentInitiate = true;
    if (this.paymentType === "cash") {
      const payData = {
        user_id: this.profileid,
        amount: this.amounttopay,
        onride_id: this.ride_id,
        iswallet: walletPay,
        basefare: this.rideDetails.basefare,
        commissionamount: this.rideDetails.commissionamount,
        tax: this.rideDetails.ride_tax,
        driver_id: this.rideDetails.driver_id,
        walletamount: this.walletMoney
      };
      this.apiservice.cashpayment(payData).subscribe(data => {
        if (data["status"] === "true") {
          this.toastr.success(this.translate.instant(data["message"]));
          this.router.navigate(["/completed-rides", btoa(this.ride_id)]);
        } else {
          this.onPaymentInitiate = false;
          this.toastr.error(this.translate.instant(data["message"]));
          this.router.navigate(["/wallet-payment-failure"]);
        }
      });
    } else {
      const requestData = {
        user_id: this.profileid
      };
      this.apiservice.braintreetoken(requestData).subscribe(data => {
        if (data["status"] === "true") {
          dropin.create(
            {
              authorization: data["clientToken"],
              selector: "#dropin-container",
              flow: "vault"
            },
            (err, dropinInstance) => {
              if (!err) {
                this.dropIninstance = dropinInstance;
                this.braintreeIsReady = true;
              } else {
                /* console.log(err); */
              }
            }
          );
        } else {
          this.onPaymentInitiate = false;
          this.toastr.error(this.translate.instant(data["message"]));
          this.router.navigate(["/ride-payment", btoa(this.ride_id)]);
        }
      });
    }
  }

  cardPayment() {
    this.dropIninstance.requestPaymentMethod((err, payload) => {
      if (err) {
       /*  console.log(err); */
      } else {
        let walletPay = this.walletUsed ? "1" : "0";
        const payData = {
          user_id: this.profileid,
          amount: this.amounttopay,
          onride_id: this.ride_id,
          paynonce: payload.nonce,
          iswallet: walletPay,
          basefare: this.rideDetails.basefare,
          commissionamount: this.rideDetails.commissionamount,
          tax: this.rideDetails.ride_tax,
          driver_id: this.rideDetails.driver_id,
          walletamount: this.walletMoney
        };
        this.apiservice.cardpayment(payData).subscribe(data => {
          if (data["status"] === "true") {
            this.toastr.success(this.translate.instant(data["message"]));
            this.router.navigate(["/completed-rides", btoa(this.ride_id)]);
          } else {
            this.toastr.error(this.translate.instant(data["message"]));
            this.router.navigate(["/wallet-payment-failure"]);
          }
        });
      }
    });
  }

  changePayment(type) {
    this.paymentType = type;
  }

  checkWallet() {
    if (this.walletUsed) {
      this.walletUsed = false;
      this.sufficientWallet = false;
      this.amounttopay = parseFloat(this.rideDetails.ride_total).toFixed(2);
    } else {
      this.walletUsed = true;
      if (this.rideDetails.walletmoney >= this.amounttopay) {
        this.walletMoney = this.amounttopay;
        this.paymentType = "cash";
        this.amounttopay = "0";
        this.sufficientWallet = true;
      }

      if (this.rideDetails.walletmoney < this.amounttopay) {
        this.amounttopay =
          parseFloat(this.amounttopay) -
          parseFloat(this.rideDetails.walletmoney);
        this.amounttopay = parseFloat(this.amounttopay).toFixed(2);
        this.walletMoney = this.rideDetails.walletmoney;
        this.sufficientWallet = false;
        this.paymentType = "card";
      }
    }
  }
}
