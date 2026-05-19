import { ChangeDetectorRef, Component, NgZone, OnInit, OnDestroy } from "@angular/core";
import { WebappService } from "../../../service/webapp.service";
import { ActivatedRoute, NavigationEnd, Router } from "@angular/router";
const isDefined = (value: any): boolean => value !== undefined && value !== null;
import { environment } from ".././../../../environments/environment";
import { Subject } from "rxjs";
import { filter, takeUntil } from "rxjs/operators";

@Component({
  standalone: false,
selector: "app-your-rides",
  templateUrl: "./your-rides.component.html",
  styleUrls: ["./your-rides.component.scss"]
})
export class YourRidesComponent implements OnInit, OnDestroy {
  profileid: any;
  profilelog: any;
  pastRides: any;
  onGoingRides: any;
  onGoingRideStatus: any;
  pastRideStatus: any;
  ad_unit_id:any;
  admin_enable_ads:any;
  loadhistory: boolean = false;
  url: any;
  red_url: any;
  currencySymbol: any = "$";
  private destroy$ = new Subject<void>();
  constructor(
    private apiservice: WebappService,
    private router: Router,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {
    this.onGoingRideStatus = false;
    this.pastRideStatus = false;
  }

  ngOnInit() {
    if (localStorage.getItem("CS")) {
      this.currencySymbol = localStorage.getItem("CS");
    }
    this.url = environment.apiUrl;
    this.profilelog = JSON.parse(localStorage.getItem("user"));
    if (!this.profilelog || !this.profilelog.id) {
      this.router.navigate(["/signin"]);
      return;
    }
    this.profileid = this.profilelog.id;
    this.ad_unit_id = this.profilelog.ad_unit_id;
    this.admin_enable_ads=this.profilelog.admin_enable_ads;
    this.loadRides();
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: NavigationEnd) => {
        if (event.urlAfterRedirects.startsWith("/your-rides")) {
          this.loadRides();
        }
      });
  }

  private loadRides() {
    this.onGoingRideStatus = false;
    this.pastRideStatus = false;
    this.onGoingRides = [];
    this.pastRides = [];
    const pastrideData = {
      user_id: this.profileid,
      type: "history"
    };

    const presentrideData = {
      user_id: this.profileid,
      type: "booking"
    };

    this.apiservice.ridehistory(pastrideData).subscribe(data => {
      this.ngZone.run(() => {
        this.pastRides = [];
        this.pastRideStatus = false;
        if (data["status"] === "true" && Array.isArray(data["result"])) {
          this.pastRides = data["result"];
          this.pastRideStatus = this.pastRides.length > 0;
        }
        this.cdr.detectChanges();
      });
    });

    this.apiservice.ridehistory(presentrideData).subscribe(data => {
      this.ngZone.run(() => {
        this.onGoingRides = [];
        this.onGoingRideStatus = false;
        if (data["status"] === "true" && Array.isArray(data["result"])) {
          this.onGoingRides = data["result"];
          this.onGoingRideStatus = this.onGoingRides.length > 0;
        }
        this.cdr.detectChanges();
      });
    });
  }

  activeRide(rideId) {
    this.router.navigate(["/active-rides", btoa(rideId)]);
  }

  inactiveRide(rideId) {
    this.router.navigate(["/inactive-rides", btoa(rideId)]);
  }

  completedRide(rideId) {
    this.router.navigate(["/completed-rides", btoa(rideId)]);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
