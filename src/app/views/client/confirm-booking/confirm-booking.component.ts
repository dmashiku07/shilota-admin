import { ChangeDetectorRef, Component, NgZone, OnInit, OnDestroy } from "@angular/core";
import { PlatformLocation, Location } from "@angular/common";
import { MapsAPILoader, MouseEvent, ControlPosition } from "app/shared/agm/agm-compat";
import { WebappService } from "../../../service/webapp.service";
import { environment } from ".././../../../environments/environment";
const isDefined = (value: any): boolean => value !== undefined && value !== null;
import { Router, ActivatedRoute} from "@angular/router";
import { ToastrService } from "ngx-toastr";
import { timer } from "rxjs";
import { timeout } from "rxjs/operators";
import { TranslateService } from '@ngx-translate/core';
import { TranslateModule } from '@ngx-translate/core';
@Component({
  standalone: false,
selector: "app-confirm-booking",
  templateUrl: "./confirm-booking.component.html",
  styleUrls: ["./confirm-booking.component.scss"]
})
export class ConfirmBookingComponent implements OnInit, OnDestroy {
  private readonly confirmPollMs = 3000;
  public pickup_lat: number;
  public pickup_lng: number;
  public drop_lat: number;
  public drop_lng: number;
  public origin: any;
  public destination: any;
  private profilelog: any;
  private profileid: any;
  public rideDetails: any = null;
  public rideId: any;
  public notified: any;
  public bookingConfirmed: String = "0";
  public url: any;
  public timeLeft = 5;
  public interval;
  public zoom: any;
  public center_pos: any;
  public approx_price: any;
  currencySymbol: any = "$";
  public loading = true;
  public loadError = "";
  public showHeaderImage = true;
  constructor(
    private mapsAPILoader: MapsAPILoader,
    private apiservice: WebappService,
    private router: Router,
    private activeRoute: ActivatedRoute,
    public toastr: ToastrService,
    private translate: TranslateService,
    public HTTP_REFERER: PlatformLocation,
    private location: Location,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {
    this.zoom = 5;
  } 

  ngOnInit() {

    this.activeRoute.queryParams.subscribe(params =>{ this.approx_price=params['categoryPrice']; });

    if (localStorage.getItem("CS")) {
      this.currencySymbol = localStorage.getItem("CS");
    }
    this.pickup_lat = Number(localStorage.getItem("pickup_lat"));
    this.pickup_lng = Number(localStorage.getItem("pickup_lon"));
    this.drop_lat = Number(localStorage.getItem("drop_lat"));
    this.drop_lng = Number(localStorage.getItem("drop_lon"));
    this.origin = { lat: this.pickup_lat, lng: this.pickup_lng };
    this.destination = { lat: this.drop_lat, lng: this.drop_lng };
    this.center_pos = {};
    this.rideData();
    this.url = environment.apiUrl;
  }

  onMapReady(map) {
    map.setOptions({
      zoomControl: "true",
      zoomControlOptions: {
        position: ControlPosition.TOP_RIGHT
      }
    });
  }

  rideData() {
    const storedUser = localStorage.getItem("user");
    this.profilelog = storedUser ? JSON.parse(storedUser) : null;
    if (!isDefined(this.profilelog)) {
      this.router.navigate(["/signin"]);
      return;
    }

    this.profileid = this.profilelog.id;
    this.apiservice.lastrequestedride(this.profileid).pipe(timeout(8000)).subscribe((data: any) => {
      this.ngZone.run(() => {
        this.loading = false;
        if (data["status"] === true && Array.isArray(data["result"]) && data["result"].length > 0) {
          this.rideDetails = data["result"][0];
          this.rideId = this.rideDetails.ride_id;
          this.notified = this.rideDetails.notified;
          this.showHeaderImage = !!this.rideDetails.category_image;
          this.cdr.detectChanges();
          return;
        }

        this.loadError = this.translate.instant("Unable to load ride details");
        this.cdr.detectChanges();
        this.toastr.error(this.loadError);
        this.router.navigate(["/search"]);
      });
    }, () => {
      this.ngZone.run(() => {
        this.loading = false;
        this.loadError = this.translate.instant("Unable to load ride details");
        this.cdr.detectChanges();
        this.toastr.error(this.loadError);
        this.router.navigate(["/search"]);
      });
    });
  }

  confirmBooking() {
    this.bookingConfirmed = "1";
    this.alertnearbyDrivers();
    this.interval = setInterval(() => {
      if (this.timeLeft > 0) {
        this.timeLeft--;
        this.alertnearbyDrivers();
      } else {
        let deniedRequest = {
          user_id: this.profileid,
          onride_id: this.rideId
        };
        this.apiservice.nodriverfound(deniedRequest).subscribe(data => {});
        this.toastr.error(this.translate.instant("Kindly try again later ..."));
        this.router.navigate(["/search"]);
      }
    }, this.confirmPollMs);
  }

  alertnearbyDrivers() {
    this.profilelog = JSON.parse(localStorage.getItem("user"));
    if (isDefined(this.profilelog)) {
      this.profileid = this.profilelog.id;
      let rideRequest = {
        user_id: this.profileid,
        onride_id: this.rideId,
        is_notify: "1"
      };
      this.apiservice.confirmride(rideRequest).subscribe(data => {
        this.ngZone.run(() => {
          if (data["status"] === "true") {
            if (this.interval) {
              clearInterval(this.interval);
            }
            this.toastr.success(this.translate.instant("Your Ride has been accepted"));
            this.cdr.detectChanges();
            this.router.navigate(["/active-rides", btoa(this.rideId)]);
          }
        });
      });
    } else {
      this.router.navigate(["/login"]);
    }
  }

  ngOnDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  goBack() {
    /* if (confirm("Are you sure want to go back?")) {
      let deniedRequest = {
        user_id: this.profileid,
        onride_id: this.rideId
      };
      this.apiservice.nodriverfound(deniedRequest).subscribe(data => {});
      this.router.navigate(["/search"]);
    } */
    this.router.navigate(["/search"]);
  }

  onCategoryImageError(): void {
    this.showHeaderImage = false;
  }
}
