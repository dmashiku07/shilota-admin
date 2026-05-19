import { Component, OnInit, OnDestroy } from "@angular/core";
import { ToastrService } from "ngx-toastr";
import { WebappService } from "../../../service/webapp.service";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { Location } from "@angular/common";
import { TranslateService } from '@ngx-translate/core';
import { TranslateModule } from '@ngx-translate/core';
@Component({
  standalone: false,
selector: "app-emergency-contacts",
  templateUrl: "./emergency-contacts.component.html",
  styleUrls: ["./emergency-contacts.component.scss"]
})
export class EmergencyContactsComponent implements OnInit , OnDestroy {
  profileid: any;
  profilelog: any;
  emergency_contact_list: any;
  requestData: any;
  modalReference: any;
  constructor(
    private apiservice: WebappService,
    public toastr: ToastrService,
    private modalService: NgbModal,
    private translate: TranslateService,
    private location: Location
  ) {}
  ngOnInit() {
    this.profilelog = JSON.parse(localStorage.getItem("user"));
    this.profileid = this.profilelog.id;
    this.apiservice.profiledetails(this.profileid).subscribe(data => {
      if (data["status"] === "true") {
        this.emergency_contact_list = data["emergency_contact"];
      } else {
        this.toastr.error(this.translate.instant(data["message"]));
        window.scrollTo(0, 0);
      }
    });
  }

  deleteContact(i: number) {
    this.emergency_contact_list.splice(i, 1);
    this.profilelog = JSON.parse(localStorage.getItem("user"));
    this.profileid = this.profilelog.id;
    const requestData = {
      user_id: this.profileid,
      emergency_contact: JSON.stringify(this.emergency_contact_list)
    };
    this.apiservice.profileupdate(requestData).subscribe(data => {
      if (data["status"] === "true") {
        this.toastr.success(this.translate.instant(data["message"]));
        window.scrollTo(0, 0);
      } else {
        this.toastr.error(this.translate.instant(data["message"]));
        window.scrollTo(0, 0);
      }
    });
    this.modalReference.close();
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

  goBack() {
    this.location.back();
  }

  ngOnDestroy(): void {
    if (this.modalReference) {
      this.modalReference.close();
    }
  }
}
