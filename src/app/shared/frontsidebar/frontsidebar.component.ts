import { Component, NgZone, OnInit, OnDestroy, inject } from "@angular/core";
import { environment } from "../../../environments/environment";
import { WebappService } from "../../service/webapp.service";
import { ToastrService } from "ngx-toastr";
import { Router } from "@angular/router";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { TranslateService } from '@ngx-translate/core';
import $ from 'jquery';

@Component({
  standalone: false,
selector: "app-frontsidebar",
  templateUrl: "./frontsidebar.component.html",
  styleUrls: ["./frontsidebar.component.scss"]
})
export class FrontsidebarComponent implements OnInit, OnDestroy {
  profilePhoto: any;
  profilelog: any;
  profileid: any;
  profileinfo: any;
  profileName: any;
  sitesettings: any;
  logoutbtn: boolean;
  walletMoney: any;
  modalReference: any;
  currencySymbol: any = "$";
  profileTxt: any;
  private apiservice = inject(WebappService, { optional: true });
  private translate = inject(TranslateService, { optional: true });
  public toastr = inject(ToastrService, { optional: true });
  private router = inject(Router, { optional: true });
  private modalService = inject(NgbModal, { optional: true });
  private ngZone = inject(NgZone, { optional: true });

  constructor() {
    this.profilePhoto = environment.apiUrl + "/gallery/users/user.png";
    this.profileName = this.translate ? this.translate.instant("Welcome User") : "Welcome User";
    this.logoutbtn = false;
    this.walletMoney = 0.0;
    this.currencySymbol = localStorage.getItem("CS") || "$";
    this.profileTxt = this.translate ? this.translate.instant("Sign in to your Account.") : "Sign in to your Account.";
  }

  ngOnInit() {
    if (this.apiservice) {
      this.apiservice.appconfig().subscribe((res: any) => {
        if (res?.status === "true" && res.currencysymbol) {
          this.currencySymbol = res.currencysymbol;
          localStorage.setItem("CS", this.currencySymbol);
        }
      });
    }
    const storedUser = localStorage.getItem("user");
    this.profilelog = storedUser ? JSON.parse(storedUser) : null;
    this.profileid = this.profilelog?.id;
    if (this.profileid && this.apiservice) {
      this.apiservice.profiledetails(this.profileid).subscribe(data => {
        if (data["status"] === "true") {
          this.profileinfo = data;
          this.profileTxt = this.translate ? this.translate.instant("View & Edit Profile") : "View & Edit Profile";
          this.logoutbtn = true;
          if (this.profileinfo.user_image) {
            this.walletMoney = this.profileinfo.walletmoney;
            this.profilePhoto = this.profileinfo.user_image;
            this.profileName = this.profileinfo.full_name;
          }
        } else {
          /* this.toastr.error(data["message"]); */
          window.scrollTo(0, 0);
        }
      });
    }
  }

  onProfileLogout() {
    const storedUser = localStorage.getItem("user");
    this.profilelog = storedUser ? JSON.parse(storedUser) : null;
    this.profileid = this.profilelog?.id;
    const previouslang = localStorage.getItem("language") || "en";
    const finalizeLogout = () => {
      this.closeNav1();
      if (this.modalReference) {
        this.modalReference.close();
      }
      localStorage.removeItem("authtoken");
      localStorage.removeItem("user");
      localStorage.removeItem("CS");
      localStorage.setItem("language", previouslang);
      this.profilelog = null;
      this.profileid = null;
      this.logoutbtn = false;
      this.walletMoney = 0.0;
      this.profileName = this.translate ? this.translate.instant("Welcome User") : "Welcome User";
      this.profileTxt = this.translate ? this.translate.instant("Sign in to your Account.") : "Sign in to your Account.";
      this.profilePhoto = environment.apiUrl + "/gallery/users/user.png";
      if (this.router) {
        this.router.navigateByUrl("/signin");
      }
    };

    if (this.profileid && this.apiservice) {
      this.apiservice.webSigninout({ user_id: this.profileid }).subscribe({
        next: () => {
          if (this.ngZone) {
            this.ngZone.run(finalizeLogout);
          } else {
            finalizeLogout();
          }
        },
        error: () => {
          if (this.ngZone) {
            this.ngZone.run(finalizeLogout);
          } else {
            finalizeLogout();
          }
        }
      });
      return;
    }

    finalizeLogout();
  }

  onAccountDelete() {
    const storedUser = localStorage.getItem("user");
    this.profilelog = storedUser ? JSON.parse(storedUser) : null;
    this.profileid = this.profilelog?.id;
    if (this.profileid && this.apiservice) {
      this.apiservice
        .accountDelete({ user_id: this.profileid })
        .subscribe(data => {});
    }
    if (this.modalReference) {
      this.modalReference.close();
    }
    var previouslang = localStorage.getItem('language');
    localStorage.clear();
     if(previouslang =="" || previouslang==null)
        localStorage.setItem('language', 'en');
    else
        localStorage.setItem('language', previouslang);
       
    if (this.toastr) {
      this.toastr.success('Your Account has been deleted successfully');
    }
    if (this.router) {
      this.router.navigate(["/signin"]);
    }
  }

  closeNav1() {
    const $sideNav = $(".sidenav");
    const $overlayDiv = $(".overlay_div");
    const $menuImg = $(".menu_img");
    $sideNav.css("width", '0px');
    $overlayDiv.css("display", "none");
    $menuImg.css("display", "inline-block");
    document.getElementsByTagName("body")[0].classList.remove("overflow_div");
    document.getElementsByTagName("body")[0].classList.add("pos_rel");
  }

  open(content) {
    if (!this.modalService) {
      return;
    }
    this.closeNav1();
    this.modalReference = this.modalService.open(content, {
      ariaLabelledBy: "modal-basic-title",
      centered: true,
      windowClass: "log_modal logout_modal",
      backdropClass: "logout_backdrop"
    });
    this.modalReference.result.then(
      result => {
        /* this.closeResult = `Closed with: ${result}`; */
      },
      reason => {
        /* this.closeResult = `Dismissed ${this.getDismissReason(reason)}`; */
      }
    );
  }

  delete(content) {
    if (!this.modalService) {
      return;
    }
    this.closeNav1();
    this.modalReference = this.modalService.open(content, {
      ariaLabelledBy: "modal-account-delete",
      centered: true,
      windowClass: "log_modal logout_modal",
      backdropClass: "logout_backdrop"
    });
    this.modalReference.result.then(
      result => {
        /* this.closeResult = `Closed with: ${result}`; */
      },
      reason => {
        /* this.closeResult = `Dismissed ${this.getDismissReason(reason)}`; */
      }
    );
  }

  ngOnDestroy(): void {
    if (this.modalReference) {
      this.modalReference.close();
    }
  }
}
