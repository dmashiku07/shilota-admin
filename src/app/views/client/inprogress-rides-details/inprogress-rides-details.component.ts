import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from "@angular/core";
import { WebappService } from "../../../service/webapp.service";
import { ActivatedRoute, Router } from "@angular/router";
const isDefined = (value: any): boolean => value !== undefined && value !== null;
import { MapsAPILoader, MouseEvent, ControlPosition } from "app/shared/agm/agm-compat";
import { ToastrService } from "ngx-toastr";
import { SocketService } from "../../../service/socket.service";
import { environment } from ".././../../../environments/environment";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { TranslateService } from '@ngx-translate/core';
import { TranslateModule } from '@ngx-translate/core';
@Component({
  standalone: false,
selector: "app-inprogress-rides-details",
  templateUrl: "./inprogress-rides-details.component.html",
  styleUrls: ["./inprogress-rides-details.component.scss"]
})
export class InprogressRidesDetailsComponent implements OnInit, OnDestroy {
  profileid: any;
  profilelog: any;
  ride_id: any;
  zoom: any;
  type: any;
  rideDetails: any;
  vehicleDetails: any;
  driverRatings: any;
  profilePhoto: any;
  rideStatus: any;
  rideInterval: any;
  intervalId: any;
  modalReference: any;
  distanceDetails: any;
  currencySymbol: any = "$";
  onthewayMessage: Boolean;
  onaccepted: Boolean;
  onRideStarted: Boolean;
  public pic_lat: number;
  public pic_lng: number;
  public dro_lat: number;
  public dro_lng: number;
  public origin: object;
  public destination: object;
  public rideInfo: any;
  loading = true;
  loadError = "";
  constructor(
    private apiservice: WebappService,
    public router: Router,
    private route: ActivatedRoute,
    private mapsAPILoader: MapsAPILoader,
    public toastr: ToastrService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private modalService: NgbModal,
    private translate: TranslateService,
    private socketService: SocketService
  ) {}
  ngOnInit() {
    if (localStorage.getItem("CS")) {
      this.currencySymbol = localStorage.getItem("CS");
    }
    this.onthewayMessage = true;
    this.onRideStarted = true;
    this.onaccepted =true;
    this.socketService.onNewMessage().subscribe(msg => {
      this.ngZone.run(() => {
        this.rideInfo = msg;
        this.rideStatus = this.rideInfo?.ridestatus;
        if (this.rideInfo?.ridestatus === "completed") {
          this.toastr.success(this.translate.instant("Your Ride has been completed"));
          this.cdr.detectChanges();
          this.router.navigate(["/ride-payment", btoa(this.ride_id)]);
          return;
        }
        if (this.rideInfo?.ridestatus === "accepted" && this.onaccepted) {
          this.rideStatus = "accepted";
          this.onaccepted = false;
          this.toastr.success(this.translate.instant("Your Ride has been accepted"));
        }

        if (this.rideInfo?.ridestatus === "ontheway" && this.onthewayMessage) {
          this.onthewayMessage = false;
          this.toastr.success(this.translate.instant("Your driver is on the way"));
        }
        if (this.rideInfo?.ridestatus === "onride" && this.onRideStarted) {
          this.rideStatus = "onride";
          this.onRideStarted = false;
          this.toastr.success(this.translate.instant("Your Ride is started"));
        }
        this.cdr.detectChanges();
      });
    });
    this.profilelog = JSON.parse(localStorage.getItem("user"));
    if (!this.profilelog || !this.profilelog.id) {
      this.router.navigate(["/signin"]);
      return;
    }
    this.profileid = this.profilelog.id;
    this.profilePhoto = environment.apiUrl + "/gallery/users/user.png";
    this.route.params.subscribe(params => {
      this.ride_id = atob(params["id"]);
      this.apiservice
        .rideinprogress({ user_id: this.profileid, onride_id: this.ride_id })
        .subscribe({
          next: data => {
            this.ngZone.run(() => {
              try {
                if (data["status"] === "true") {
                  this.rideDetails = data["result"];
                  this.vehicleDetails = data["vehicleinfo"] || {};
                  this.distanceDetails = this.normalizeDistanceInfo(data["distanceInfo"]);
                  this.rideStatus = this.rideDetails?.ridestatus;
                  if (this.rideStatus == "onride") {
                    this.onRideStarted = true;
                  }
                  this.driverRatings = data["driver_ratings"] || "0";
                  const driverImage = this.rideDetails?.driver_id?.profile_image;
                  if (driverImage) {
                    this.profilePhoto =
                      environment.apiUrl + "/gallery/drivers/" + driverImage;
                  }
                  this.pic_lat = parseFloat(this.rideDetails?.pickup_lat);
                  this.pic_lng = parseFloat(this.rideDetails?.pickup_lng);
                  this.dro_lat = parseFloat(this.rideDetails?.drop_lat);
                  this.dro_lng = parseFloat(this.rideDetails?.drop_lng);
                  this.origin = { lat: this.pic_lat, lng: this.pic_lng };
                  this.destination = { lat: this.dro_lat, lng: this.dro_lng };
                  let rideData = { onride_id: this.ride_id };
                  this.intervalId = setInterval(
                    () => this.socketService.sendMessage(rideData),
                    5000
                  );
                } else {
                  this.loadError = "Unable to load ride details.";
                  this.router.navigate(["/page-not-found"]);
                }
              } catch (error) {
                console.error("active-rides render failed", error);
                this.loadError = "Unable to load ride details.";
              } finally {
                this.loading = false;
                this.cdr.detectChanges();
              }
            });
          },
          error: error => {
            this.ngZone.run(() => {
              console.error("active-rides request failed", error);
              this.loading = false;
              this.loadError = "Unable to load ride details.";
              this.cdr.detectChanges();
            });
          }
        });
    });
  }
  private normalizeDistanceInfo(distanceInfo: any) {
    if (typeof distanceInfo === "number") {
      return {
        distance: `${distanceInfo} km`,
        duration: ""
      };
    }
    if (typeof distanceInfo === "string") {
      return {
        distance: distanceInfo,
        duration: ""
      };
    }
    return {
      distance: distanceInfo?.distance || "",
      duration: distanceInfo?.duration || ""
    };
  }
  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    if (this.rideInterval) {
      clearInterval(this.rideInterval);
    }
    if (this.modalReference) {
      this.modalReference.close();
    }
  }
  cancelride() {
    const rideData = {
      user_id: this.profileid,
      onride_id: this.ride_id
    };
    this.apiservice.cancelride(rideData).subscribe(data => {
      if (data["status"] === "true") {
        this.router.navigate(["/your-rides"]);
        this.toastr.success(this.translate.instant(data["message"]));
      } else {
        this.toastr.error(this.translate.instant(data["message"]));
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
  confirmCancel() {
    this.cancelride();
    this.modalReference.close();
  }
  reviewaride(rideid) {
    this.router.navigate(["write-review", btoa(rideid)]);
  }
  onMapReady(map) {
    map.setOptions({
      zoomControl: "true",
      zoomControlOptions: {
        position: ControlPosition.TOP_RIGHT
      }
    });
  }
}
