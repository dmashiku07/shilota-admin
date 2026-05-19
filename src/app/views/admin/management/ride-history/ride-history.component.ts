import { ChangeDetectorRef, Component, OnInit,ViewContainerRef } from '@angular/core';
import { RidesService } from '../../../../service/rides.service';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Router,ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { DriverService } from '../../../../service/driver.service';
import { Location } from '@angular/common';
@Component({
  standalone: false,
selector: 'app-ride-history',
  templateUrl: './ride-history.component.html',
  styleUrls: ['./ride-history.component.css']
})
export class RideHistoryComponent implements OnInit {
  rides: any[] = [];
  status:any;
  filter = '';
  driver:any = {};
  loading = false;
  pagination: any = { page: 1, pageSize: 25, totalItems: 0, totalPages: 1 };
  driverId: any;
  constructor(private service:RidesService,
    private http: HttpClient,
    private router: Router,
    public toastr: ToastrService, vcr: ViewContainerRef,
    private route: ActivatedRoute, private serviceDriver:DriverService,private location: Location,
    private cdr: ChangeDetectorRef) 
    {
    
      this.status = [
        "cancelled","completed","onride","ontheway","scheduled","accepted","ridenotaccepted",
      ]
    }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.driverId = params['id'];
      this.getPage();
      this.serviceDriver.getInfo(this.driverId).subscribe(res => {
        this.driver = res || {};
        this.cdr.detectChanges();
      });
    });
  }
  getPage() {
    if (!this.driverId) {
      return;
    }
    this.loading = true;
    this.service.getDriverRide(this.driverId, this.buildParams()).subscribe(res => {
      this.rides = Array.isArray(res && res['items']) ? res['items'] : [];
      this.pagination = res && res['pagination'] ? res['pagination'] : this.pagination;
      this.loading = false;
      this.cdr.detectChanges();
    }, () => {
      this.rides = [];
      this.pagination = { ...this.pagination, totalItems: 0, totalPages: 1 };
      this.loading = false;
      this.cdr.detectChanges();
    });
  }

  goBack() {
    this.location.back(); 
  }
  onChange(Value) {
    this.filter = Value === "undefined" ? "" : Value;
    this.pagination.page = 1;
    this.getPage();
  }
  key: string = '_id'; //set default

  reverse: boolean = true;

  sort(key){

    this.key = key;

    this.reverse = !this.reverse;
    this.pagination.page = 1;
    this.getPage();
  }

  onPageChange(page: number): void {
    this.pagination.page = page;
    this.getPage();
  }

  rowNumber(index: number): number {
    return ((this.pagination.page - 1) * this.pagination.pageSize) + index + 1;
  }

  private buildParams(): any {
    const params: any = {
      page: this.pagination.page,
      pageSize: this.pagination.pageSize,
      sortBy: this.key,
      sortDir: this.reverse ? 'desc' : 'asc'
    };
    if (this.filter) {
      params.status = this.filter;
    }
    return params;
  }


}
