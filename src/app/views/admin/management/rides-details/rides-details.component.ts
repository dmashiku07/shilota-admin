import { Component, OnInit, ViewContainerRef } from "@angular/core";
import { RidesService } from "../../../../service/rides.service";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { Router, ActivatedRoute } from "@angular/router";
import { ToastrService } from "ngx-toastr";
import { AuthenticationService } from "../../../../service/authentication.service";
import { Location } from "@angular/common";

@Component({
  standalone: false,
selector: "app-rides-details",
  templateUrl: "./rides-details.component.html",
  styleUrls: ["./rides-details.component.css"]
})
export class RidesDetailsComponent implements OnInit {
  rides: any;
  ridePayments: any;
  user: any;
  constructor(
    private service: RidesService,
    private http: HttpClient,
    private router: Router,
    public toastr: ToastrService,
    vcr: ViewContainerRef,
    private route: ActivatedRoute,
    private authService: AuthenticationService,
    private location: Location
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.rides = this.service.getInfo(params["id"]).subscribe(res => {
        this.rides = res;
      });
    });
    this.route.params.subscribe(params => {
      this.service.getridePayInfo(params["id"]).subscribe(res => {
        if (res["status"] === "true") {
          this.ridePayments = res["result"].payment_type;
        } else {
          this.ridePayments = "";
        }
      });
    });
    this.authService.getProfile().subscribe(res => {
      this.user = res;
    });
  }
  goBack() {
    this.location.back();
  }
}
