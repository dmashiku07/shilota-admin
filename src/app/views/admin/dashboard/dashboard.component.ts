import { Component, OnInit, ViewContainerRef, NgZone, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import {
  UntypedFormGroup,
  UntypedFormBuilder,
  UntypedFormControl,
  Validators
} from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../../../service/user.service';
import { ToastrService } from 'ngx-toastr';
import { AuthenticationService } from '../../../service/authentication.service';
import { DriverService } from '../../../service/driver.service';
import { VehicleService } from '../../../service/vehicle.service';
import { RidesService } from '../../../service/rides.service';
import { SettlementService } from '../../../service/settlement.service';
import { environment } from '.././../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import * as chartsData from '../../../shared/data/chartjs';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
@Component({
  standalone: false,
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit {
  // Pie
  public pieChartLabels = chartsData.pieChartLabels;
  public pieChartData = chartsData.pieChartData;
  public pieChartType = chartsData.pieChartType;
  public pieChartColors = chartsData.pieChartColors;
  public pieChartOptions = chartsData.pieChartOptions;

  // Doughnut
  public doughnutChartLabels = chartsData.doughnutChartLabels;
  public doughnutChartData = chartsData.doughnutChartData;
  public doughnutChartType = chartsData.doughnutChartType;
  public doughnutChartColors = chartsData.doughnutChartColors;
  public doughnutChartOptions = chartsData.doughnutChartOptions;

  public chartClicked(e: any): void {}
  public chartHovered(e: any): void {}

  Form: UntypedFormGroup;
  count: any;
  driverCount: any;
  vehicleCount: any;
  ridesCount: any;
  totalRide: any;
  latestUser: any;
  latestRide: any;
  status1: any;
  status2: any;
  status3: any;
  status4: any;
  status5: any;
  status6: any;
  status7: any;
  onlineDriverCount: any;
  activedriverCount: any;
  todayRide: any;
  iosUser: any;
  andoridUser: any;
  webUser: any;
  revenue: any;
  url: any;
  result : any;
  loading = true;
  constructor(
    private authService: AuthenticationService,
    private router: Router,
    private fb: UntypedFormBuilder,
    private user: UserService,
    private driver: DriverService,
    private vehicle: VehicleService,
    private ride: RidesService,
    private https: HttpClient,
    private settlement: SettlementService,
    public toastr: ToastrService,
    vcr: ViewContainerRef,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}
  ngOnInit() {
    this.url = environment.apiUrl;
    forkJoin({
      riders: this.user.getcount().pipe(catchError(() => of(0))),
      drivers: this.driver.getcount().pipe(catchError(() => of(0))),
      onlineDrivers: this.driver.getonlineDrivercount().pipe(
        catchError(() => of({ online: 0, active: 0 }))
      ),
      vehicles: this.vehicle.getcount().pipe(catchError(() => of(0))),
      totalRides: this.ride.getcount().pipe(catchError(() => of(0))),
      monthRides: this.ride.getcurrentMonthride().pipe(catchError(() => of(0))),
      latestUser: this.user.getLatestuser().pipe(catchError(() => of(null))),
      iosUsers: this.user.getiosuser().pipe(catchError(() => of(0))),
      androidUsers: this.user.getandoriduser().pipe(catchError(() => of(0))),
      webUsers: this.user.getwebuser().pipe(catchError(() => of(0))),
      todayRides: this.ride.gettodayCount().pipe(catchError(() => of(0))),
      latestRide: this.ride.getLatestride().pipe(catchError(() => of(null))),
      rideCounts: this.ride.rideCounts().pipe(
        catchError(() => of({ success_rides: 0, unsuccess_rides: 0, schedule_rides: 0 }))
      ),
      revenue: this.settlement.getcount().pipe(catchError(() => of(0)))
    }).pipe(
      finalize(() => {
        this.zone.run(() => {
          this.loading = false;
          this.cdr.markForCheck();
        });
      })
    ).subscribe((data: any) => {
      this.zone.run(() => {
        this.count = this.toNumber(data.riders);
        this.driverCount = this.toNumber(data.drivers);
        this.vehicleCount = this.toNumber(data.vehicles);
        this.totalRide = this.toNumber(data.totalRides);
        this.ridesCount = this.toNumber(data.monthRides);
        this.latestUser = data.latestUser;
        this.iosUser = this.toNumber(data.iosUsers);
        this.andoridUser = this.toNumber(data.androidUsers);
        this.webUser = this.toNumber(data.webUsers);
        this.todayRide = this.toNumber(data.todayRides);
        this.latestRide = data.latestRide;
        this.revenue = this.toNumber(data.revenue);

        this.onlineDriverCount = this.toNumber(data.onlineDrivers?.online);
        this.activedriverCount = this.toNumber(data.onlineDrivers?.active);
        this.pieChartData = [this.onlineDriverCount, this.activedriverCount];

        this.status1 = this.toNumber(data.rideCounts?.success_rides);
        this.status2 = this.toNumber(data.rideCounts?.unsuccess_rides);
        this.status3 = this.toNumber(data.rideCounts?.schedule_rides);
        this.doughnutChartData = [this.status1, this.status2, this.status3];

        localStorage.setItem('totalridecount', String(this.totalRide));
        localStorage.setItem('counter', String(this.ridesCount));
        localStorage.setItem('iosuser', String(this.iosUser));
        localStorage.setItem('andoriduser', String(this.andoridUser));
        localStorage.setItem('webuser', String(this.webUser));
        localStorage.setItem('status1', String(this.status1));
        localStorage.setItem('status2', String(this.status2));
        localStorage.setItem('status3', String(this.status3));

        this.cdr.markForCheck();
      });
    });
    this.createForm();
  }
  private toNumber(value: any): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }
  get totalDriversTracked(): number {
    return Math.max(this.onlineDriverCount + this.activedriverCount, 1);
  }
  get successfulRideTotal(): number {
    return Math.max(this.status1 + this.status2 + this.status3, 1);
  }
  createForm() {
    this.Form = this.fb.group({
      message: ['', Validators.required],
      user: ['', Validators.required]
    });
  }
  onLogoutClick() {
    this.authService.logout();
    this.router.navigate(['admin/login']);
    return false;
  }

  sendMessage(Form) {
    if (this.Form.valid) {
      this.authService.getUserinfo().subscribe(res => {
        this.result = res;
        console.log(environment.apiUrl);
        this.https
          .post(environment.apiUrl + '/user/pushNotify', Form)
          .subscribe(res => res);
        this.toastr.success('Push Notification send Successfully');
        this.Form.reset();
        window.scrollTo(0, 0);
      });
    } else {
      this.validateAllFormFields(this.Form);
    }
  }
  validateAllFormFields(formGroup: UntypedFormGroup) {
    Object.keys(formGroup.controls).forEach(field => {
      const control = formGroup.get(field);
      if (control instanceof UntypedFormControl) {
        control.markAsTouched({ onlySelf: true });
      } else if (control instanceof UntypedFormGroup) {
        this.validateAllFormFields(control);
      }
    });
  }
}
