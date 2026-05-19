import { Component, OnInit } from "@angular/core";
import { WebappService } from "../../../service/webapp.service";
import { AuthenticationService } from "../../../service/authentication.service";
const isDefined = (value: any): boolean => value !== undefined && value !== null;
import { Location } from "@angular/common";

@Component({
  standalone: false,
selector: "app-sos-alerts",
  templateUrl: "./sos-alerts.component.html",
  styleUrls: ["./sos-alerts.component.scss"]
})
export class SosAlertsComponent implements OnInit {
  sitesettings: any;
  profilelog: any;
  profileid: any;
  emergencyContacts: any;
  emergencyContact: any;
  constructor(
    private apiservice: WebappService,
    private settingsservice: AuthenticationService,
    private location: Location
  ) {
    this.settingsservice.getUserinfo().subscribe(res => {
      this.sitesettings = res;
    });
  }

  ngOnInit() {
    this.profilelog = JSON.parse(localStorage.getItem("user"));
    this.profileid = this.profilelog.id;
    if (isDefined(this.profilelog)) {
      this.apiservice.profiledetails(this.profileid).subscribe(data => {
        if (data["status"] === "true") {
          this.emergencyContacts = data["emergency_contact"];
          this.emergencyContact =data["emergency_contact"][0].phone_no;
        }
      });
    }
  }

  goBack() {
    this.location.back();
  }
}
