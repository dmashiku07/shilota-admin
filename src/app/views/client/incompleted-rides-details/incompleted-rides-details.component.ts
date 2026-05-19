import { Component, OnInit, OnDestroy } from "@angular/core";
import { WebappService } from "../../../service/webapp.service";
import { ActivatedRoute, Router } from "@angular/router";
const isDefined = (value: any): boolean => value !== undefined && value !== null;
import { MapsAPILoader, MouseEvent } from "app/shared/agm/agm-compat";
import { environment } from ".././../../../environments/environment";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";

@Component({
  standalone: false,
selector: "app-incompleted-rides-details",
  templateUrl: "./incompleted-rides-details.component.html",
  styleUrls: ["./incompleted-rides-details.component.scss"]
})
export class IncompletedRidesDetailsComponent implements OnInit, OnDestroy {
  profileid: any;
  profilelog: any;
  profilePhoto: any;
  categoryImage: any;
  rideDetails: any;
  ride_id: any;
  zoom: any;
  type: any;
  currencySymbol: any = "$";
  modalReference: any;
  public pic_lat: number;
  public pic_lng: number;
  public dro_lat: number;
  public dro_lng: number;
  public origin: any;
  public destination: any;
  public rideTime: any;
  constructor(
    private apiservice: WebappService,
    private router: Router,
    private route: ActivatedRoute,
    private mapsAPILoader: MapsAPILoader,
    private modalService: NgbModal
  ) {}

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

    this.apiservice.rideincompleted(rideData).subscribe(data => {
      if (data["status"] === "true") {
        if (isDefined(data)) {
          this.rideDetails = data["result"];
          this.categoryImage =
            environment.apiUrl +
            "/imagegallery/" +
            this.rideDetails["category_id"].image;
          this.pic_lat = parseFloat(this.rideDetails["pickup_lat"]);
          this.pic_lng = parseFloat(this.rideDetails["pickup_lng"]);
          this.dro_lat = parseFloat(this.rideDetails["drop_lat"]);
          this.dro_lng = parseFloat(this.rideDetails["drop_lng"]);
          this.origin = { lat: this.pic_lat, lng: this.pic_lng };
          this.destination = { lat: this.dro_lat, lng: this.dro_lng };
          if (this.rideDetails["type"] === "schedule") {
            this.rideTime = this.rideDetails["schedule_time"];
          } else {
            this.rideTime = this.rideDetails["ridestatusat"];
          }
        }
      } else {
        this.router.navigate(["/page-not-found"]);
      }
    });
  }

  cancelride() {
    const rideData = {
      user_id: this.profileid,
      onride_id: this.ride_id
    };
    this.apiservice.cancelride(rideData).subscribe(data => {
      this.router.navigate(["/your-rides"]);
    });
    this.modalReference.close();
  }

  confirmCancel() {
    this.cancelride();
  }

  open(content) {
    this.modalReference = this.modalService.open(content, {
      ariaLabelledBy: "modal-basic-title",
      windowClass: "log_modal",
      centered: true
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

  ngOnDestroy(): void {
    if (this.modalReference) {
      this.modalReference.close();
    }
  }
}
