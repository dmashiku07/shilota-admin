import { Component, OnInit, OnDestroy } from "@angular/core";
import { WebappService } from "../../../service/webapp.service";
import { ToastrService } from "ngx-toastr";
import { Router } from "@angular/router";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { environment } from "../../../../environments/environment";

@Component({
  standalone: false,
selector: "app-invite",
  templateUrl: "./invite.component.html",
  styleUrls: ["./invite.component.scss"]
})
export class InviteComponent implements OnInit, OnDestroy {
  profilelog:any;
  ad_unit_id:any;
  admin_enable_ads:any;
  public shareObj = {
    href: environment.domain,
    hashtag: "#WELCOME_HERE"
  };
  modalReference: any;
  constructor(
    public toastr: ToastrService,
    private router: Router,
    private apiservice: WebappService,
    private modalService: NgbModal
  ) {}

  ngOnInit() {
    this.profilelog = JSON.parse(localStorage.getItem("user"));
    this.ad_unit_id = this.profilelog.ad_unit_id;
    this.admin_enable_ads=this.profilelog.admin_enable_ads;
    /* this.appConfig(); */
  }

  shareWithTwitter(): void {
    window.open(
      "https://twitter.com/share?url=" +
        encodeURIComponent(this.shareObj.href) +
        "&text=" +
        encodeURIComponent(this.shareObj.hashtag),
      "",
      "left=0,top=0,width=550,height=450,personalbar=0,toolbar=0,scrollbars=0,resizable=0"
    );
  }

  shareWithLinkedIn(): void {
    window.open(
      "https://www.linkedin.com/shareArticle?mini=true&url=" +
        encodeURIComponent(this.shareObj.href) +
        "&title=" +
        encodeURIComponent(this.shareObj.hashtag),
      "",
      "left=0,top=0,width=650,height=420,personalbar=0,toolbar=0,scrollbars=0,resizable=0"
    );
  }

  appConfig() {
    this.apiservice.appconfig().subscribe(data => {
      if (data["status"] === "true") {
        this.shareObj = {
          href: data["androidstore"],
          hashtag: "#WELCOME_HERE"
        };
      }
    });
  }

  open(content) {
    this.modalReference = this.modalService.open(content, {
      ariaLabelledBy: "modal-basic-title",
      centered: true,
      windowClass: "log_modal"
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
