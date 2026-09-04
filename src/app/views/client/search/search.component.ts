import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  ViewChild,
  ElementRef,
  NgZone,
  ChangeDetectorRef
} from '@angular/core';
import { MapsAPILoader } from 'app/shared/agm/agm-compat';
import { WebappService } from '../../../service/webapp.service';
import { Router } from '@angular/router';
const isDefined = (value: any): boolean => value !== undefined && value !== null;
import { NgxSpinnerService } from 'ngx-spinner';
import { ToastrService } from 'ngx-toastr';
import { NgbModal, ModalDismissReasons } from '@ng-bootstrap/ng-bootstrap';
import * as _moment from 'moment';
import { TranslateService } from '@ngx-translate/core';
import { TranslateModule } from '@ngx-translate/core';
import $ from 'jquery';
const moment = (_moment as any).default ? (_moment as any).default : _moment;
declare let google;
@Component({
  standalone: false,
selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss'],
})
export class SearchComponent implements OnInit, OnDestroy {
  index
  dialogVisible: boolean;
  availCategorySum: any;
  categoryId: any;
  pickupDefault: String = 'Set Pickup Location';
  dropDefault: String = 'Set Drop Location';
  paymentType: String = 'cash';
  availCategories: any;
  serviceAvailable: boolean;
  profilelog: any;
  profileid: any;
  intervalId: any;
  currencySymbol: any = '$';
  closeResult: string;
  rideType: any;
  minDate: any;
  maxDate: any;
  minDateTime: string;
  maxDateTime: string;
  minTime: any;
  scheduleTimeError: any;
  scheduleTimeWrong: any;
  scheduledOn: any;
  minscheduledOn: any;
  scheduledAt: any;
  rideData: object;
  dateTime : any;
  private errorToastTimeout: any;
  constructor(
    private element: ElementRef,
    private mapsAPILoader: MapsAPILoader,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private translate: TranslateService,
    private apiservice: WebappService,
    private router: Router,
    private spinner: NgxSpinnerService,
    private modalService: NgbModal,
    public toastr: ToastrService,
    
  ) {
    this.dateTime = new moment();
    this.scheduleTimeError = false;
    this.scheduleTimeWrong = false;
    this.dialogVisible = false;
    this.availCategorySum = 0;
    this.serviceAvailable = false;
    this.rideType = 'requested';
    this.minDate = new Date();
    this.maxDate = new Date();
    this.maxDate.setDate(this.maxDate.getDate() + 7);
    this.minDateTime = this.toDateTimeLocal(this.minDate);
    this.maxDateTime = this.toDateTimeLocal(this.maxDate);
  }

  ngOnInit() {

    this.appConfig();

    if (localStorage.getItem('pickup_location')) {
      this.pickupDefault = localStorage.getItem('pickup_location');
    }

    if (localStorage.getItem('drop_location')) {
      this.dropDefault = localStorage.getItem('drop_location');
    }

    if (
      !localStorage.getItem('pickup_location') ||
      !localStorage.getItem('drop_location')
    ) {
      this.apiservice.showallcategories().subscribe(data => {
        if (data['status'] === 'true') {
          this.serviceAvailable = true;
          this.availCategories = data['categories'];
          this.availCategorySum = data['count'];
          this.categoryId = data['categories'][0]._id;
        } else {
          this.serviceAvailable = false;
        }
      });
    }

    this.availableCategories();
    this.intervalId = setInterval(() => this.availableCategories(), 5000);
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    if (this.errorToastTimeout) {
      clearTimeout(this.errorToastTimeout);
    }
  }

  availableCategories() {
    this.mapsAPILoader.load().then(() => {
      if (
        localStorage.getItem('pickup_location') &&
        localStorage.getItem('drop_location')
      ) {
        new google.maps.DistanceMatrixService().getDistanceMatrix(
          {
            origins: [localStorage.getItem('pickup_location')],
            destinations: [localStorage.getItem('drop_location')],
            travelMode: 'DRIVING'
          },
          (results: any) => {
            this.ngZone.run(() => {
              const distanceText = results?.rows?.[0]?.elements?.[0]?.distance?.text;
              const ride_distance = parseFloat(distanceText || '0');
              const requestData = {
                pickup_lat: localStorage.getItem('pickup_lat'),
                pickup_lng: localStorage.getItem('pickup_lon'),
                pickup_location: localStorage.getItem('pickup_location'),
                drop_lat: localStorage.getItem('drop_lat'),
                drop_lng: localStorage.getItem('drop_lon'),
                drop_location: localStorage.getItem('drop_location'),
                distance: ride_distance
              };
              this.apiservice
                .shownearbycategories(requestData)
                .subscribe(data => {
                  this.ngZone.run(() => {
                    if (data['status'] === 'true') {
                      this.serviceAvailable = true;
                      this.availCategorySum = data['count'];
                      this.availCategories = data['available_ride'];
                    } else {
                      this.serviceAvailable = false;
                      this.availCategorySum = 0;
                      this.availCategories = [];
                    }
                    this.cdr.detectChanges();
                  });
                });
            });
          }
        );
      }
    });
  }

  requestRide(category) {
    const storedUser = localStorage.getItem('user');
    this.profilelog = storedUser ? JSON.parse(storedUser) : null;
    const authToken = localStorage.getItem('authtoken');
    if (isDefined(this.profilelog) && authToken && this.profilelog?.role === 'user') {
      this.profileid = this.profilelog.id;
      if (!this.paymentType) {
        this.paymentType = 'cash';
      }

      this.rideData = {
        user_id: this.profileid,
        category_id: category._id,
        payment_type: this.paymentType,
        type: this.rideType,
        baseprice: category.baseprice,
        pickup_lat: localStorage.getItem('pickup_lat'),
        pickup_lng: localStorage.getItem('pickup_lon'),
        pickup_location: localStorage.getItem('pickup_location'),
        drop_lat: localStorage.getItem('drop_lat'),
        drop_lng: localStorage.getItem('drop_lon'),
        drop_location: localStorage.getItem('drop_location')
      };

      if (this.rideType == 'schedule' && !this.scheduledAt) {
        this.scheduleTimeError = true;
        return false;
      }

      if (this.scheduleTimeWrong) {
        return false;
      }

      if (this.rideType == 'schedule' && this.scheduledAt) {
        let scheduleStarts = this.scheduledAt;
        scheduleStarts.setHours(scheduleStarts.getHours() + 5);
        scheduleStarts.setMinutes(scheduleStarts.getMinutes() + 30);
        this.rideData['schedule_time'] = Math.round(scheduleStarts.getTime() / 1000);
      }

      this.apiservice.requestride(this.rideData).subscribe((data: any) => {
        if (data['status'] === 'true') {
          if (this.rideType === 'requested') {
            this.router.navigate(['/confirm-booking'], { queryParams: { 'categoryPrice': category.baseprice } });
          } else {
            this.toastr.success(this.translate.instant('Your ride has been scheduled'));
            this.router.navigate(['/your-rides']);
          }
        } else {
          const message = data?.message || 'Something went wrong';
          if (message === 'Unauthorized access') {
            this.clearInvalidSession();
            this.showDeferredError('Please sign in to continue');
            this.router.navigate(['/signin']);
            return;
          }
          this.showDeferredError(message);
        }
      });
    } else {
      if (authToken || this.profilelog) {
        this.clearInvalidSession();
      }
      this.showDeferredError('Please sign in to continue');
      this.router.navigate(['/signin']);
    }
  }

  scheduleDialog(schedulefor) {
    if (schedulefor == 1) {
      this.dialogVisible = true;
      this.rideType = 'schedule';
      const now = new Date();
      this.minDateTime = this.toDateTimeLocal(now);
    } else {
      this.dialogVisible = false;
      this.rideType = 'requested';
      this.scheduleTimeError = false;
      this.scheduleTimeWrong = false;
      this.scheduledAt = "";
      this.dateTime = "";
    }
  }

  changePayment(type) {
    this.paymentType = type;
  }

  openNav() {
    const $sideNav = $('.sidenav');
    const $overlayDiv = $('.overlay_div');
    const $menuImg = $('.menu_img');
    /* if ($(window).width() >= 450) { */
    $sideNav.css('width', '300px');
    $overlayDiv.css('display', 'block');
    $menuImg.css('display', 'none');
    document.getElementsByTagName('body')[0].classList.add('overflow_div');
    document.getElementsByTagName('body')[0].classList.add('pos_rel');
  }

  closeNav() {
    const $sideNav = $('.sidenav');
    const $overlayDiv = $('.overlay_div');
    const $menuImg = $('.menu_img');
    $sideNav.css('width', '0px');
    $overlayDiv.css('display', 'none');
    $menuImg.css('display', 'inline-block');
    document.getElementsByTagName('body')[0].classList.remove('overflow_div');
    document.getElementsByTagName('body')[0].classList.add('pos_rel');
  }

  appConfig() {
    this.apiservice.appconfig().subscribe(data => {
      if (data['status'] === 'true') {
        this.currencySymbol = data['currencysymbol'];
        localStorage.setItem('CS', this.currencySymbol);
      }
    });
  }

  onScheduleChange(data) {
    const parsed = new Date(data);
    if (isNaN(parsed.getTime())) {
      this.scheduleTimeWrong = true;
      return;
    }
    this.scheduledAt = parsed;
    this.scheduleTimeError = false;
    this.scheduleTimeWrong = false;
    this.scheduledOn = Math.round(parsed.getTime() / 1000);
    let now = new Date();
    now.setMinutes(now.getMinutes() + 15);
    this.minscheduledOn = Math.round(now.getTime() / 1000);
    if (this.scheduledOn <= this.minscheduledOn) {
      this.scheduleTimeWrong = true;
    }
  }

  private toDateTimeLocal(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private showDeferredError(message: string) {
    clearTimeout(this.errorToastTimeout);
    this.errorToastTimeout = setTimeout(() => {
      this.toastr.error(this.translate.instant(message));
    });
  }

  private clearInvalidSession(): void {
    localStorage.removeItem('authtoken');
    localStorage.removeItem('user');
  }

}
