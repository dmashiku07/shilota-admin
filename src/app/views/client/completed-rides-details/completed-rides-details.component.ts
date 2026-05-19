import { Component, OnInit } from "@angular/core";
import { WebappService } from "../../../service/webapp.service";
import { ActivatedRoute, Router } from "@angular/router";
const isDefined = (value: any): boolean => value !== undefined && value !== null;
import { MapsAPILoader } from "app/shared/agm/agm-compat";
import { environment } from ".././../../../environments/environment";
@Component({
  standalone: false,
selector: "app-completed-rides-details",
  templateUrl: "./completed-rides-details.component.html",
  styleUrls: ["./completed-rides-details.component.scss"]
})
export class CompletedRidesDetailsComponent implements OnInit {
  profileid: any;
  profilelog: any;
  profilePhoto: any;
  rideDetails: any;
  subscription: any;
  ride_id: any;
  zoom: any;
  type: any;
  rating: number;
  currencySymbol: any = "$";
  public pic_lat: number;
  public pic_lng: number;
  public dro_lat: number;
  public dro_lng: number;
  public origin: any;
  public destination: any;
  constructor(
    private apiservice: WebappService,
    private router: Router,
    private route: ActivatedRoute,
    private mapsAPILoader: MapsAPILoader,
  ) {
  }
  ngOnInit() {
    if (localStorage.getItem("CS")) {
      this.currencySymbol = localStorage.getItem("CS");
    }
    this.profilelog = JSON.parse(localStorage.getItem("user"));
    this.profileid = this.profilelog.id;
    this.profilePhoto = environment.apiUrl + "/gallery/users/user.png";
    this.route.params.subscribe(params => {
      this.ride_id = atob(params["id"]);
    });
    const rideData = {
      user_id: this.profileid,
      onride_id: this.ride_id
    };
    this.apiservice.ridecompleted(rideData).subscribe(data => {
      if (data["status"] === "true") {
        if (isDefined(data)) {
          /* console.log("Ride Data is" + JSON.stringify(data)); */
          this.rideDetails = data;
          if (this.rideDetails.isreview === "true") {
            this.rating = this.rideDetails.rating;
          }
          if (this.rideDetails.driver_id.profile_image) {
            this.profilePhoto =
              environment.apiUrl +
              "/gallery/drivers/" +
              this.rideDetails.driver_id.profile_image;
          }
          this.pic_lat = parseFloat(this.rideDetails["pickup_lat"]);
          this.pic_lng = parseFloat(this.rideDetails["pickup_lng"]);
          this.dro_lat = parseFloat(this.rideDetails["drop_lat"]);
          this.dro_lng = parseFloat(this.rideDetails["drop_lng"]);
          this.origin = { lat: this.pic_lat, lng: this.pic_lng };
          this.destination = { lat: this.dro_lat, lng: this.dro_lng };
        }
      } else {
        this.router.navigate(["/page-not-found"]);
      }
    });
  }

  reviewaride(rideid) {
    this.router.navigate(["write-review", btoa(rideid)]);
  }

  payRide() {
    this.router.navigate(["ride-payment", btoa(this.ride_id)]);
  }

  rideAgain() {
    if (this.rideDetails) {
      localStorage.setItem("pickup_lat", this.rideDetails.pickup_lat);
      localStorage.setItem("pickup_lon", this.rideDetails.pickup_lng);
      localStorage.setItem("pickup_location", this.rideDetails.pickup_location);
      localStorage.setItem("drop_lat", this.rideDetails.drop_lat);
      localStorage.setItem("drop_lon", this.rideDetails.drop_lng);
      localStorage.setItem("drop_location", this.rideDetails.drop_location);
    }
    this.router.navigate(["/search"]);
  }
}
