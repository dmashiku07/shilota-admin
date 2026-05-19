import { ChangeDetectorRef, Component, OnInit, ViewContainerRef } from "@angular/core";
import { RidesService } from "../../../../service/rides.service";
import { HttpClient } from "@angular/common/http";
import { Router } from "@angular/router";
import { ToastrService } from "ngx-toastr";
import { AuthenticationService } from "../../../../service/authentication.service";
@Component({
  standalone: false,
selector: "app-rides",
  templateUrl: "./rides.component.html",
  styleUrls: ["./rides.component.css"]
})
export class RidesComponent implements OnInit {
  rides: any[] = [];
  loading = false;
  status: any;
  filter = '';
  user: any = { currencySymbol: '' };
  ridestatus: any;
  pagination: any = { page: 1, pageSize: 25, totalItems: 0, totalPages: 1 };
  constructor(
    private service: RidesService,
    public toastr: ToastrService,
    private authService: AuthenticationService,
    private cdr: ChangeDetectorRef
  ) {
    this.status = [
      "cancelled",
      "completed",
      "onride",
      "ontheway",
      "scheduled",
      "accepted",
      "ridenotaccepted"
    ];
    this.ridestatus = 0;
  }

  ngOnInit() {
    this.getPage(this.ridestatus);
  }

  getPage(status) {
    this.loading = true;
    this.service.getPage(status, this.buildParams()).subscribe(
      res => {
        this.rides = Array.isArray(res && res['items']) ? res['items'] : [];
        this.pagination = res && res['pagination'] ? res['pagination'] : this.pagination;
        this.loading = false;
        this.cdr.detectChanges();
      },
      () => {
        this.rides = [];
        this.pagination = { ...this.pagination, totalItems: 0, totalPages: 1 };
        this.loading = false;
        this.cdr.detectChanges();
      }
    );
    this.authService.getProfile().subscribe(res => {
      this.user = res || { currencySymbol: '' };
      this.cdr.detectChanges();
    });
  }

  onChange(event) {
    this.ridestatus = event.target.value;
    this.pagination.page = 1;
    this.getPage(this.ridestatus);
  }
  key: string = "_id"; //set default
  reverse: boolean = true;
  sort(key) {
    this.key = key;
    this.reverse = !this.reverse;
    this.pagination.page = 1;
    this.getPage(this.ridestatus);
  }

  onPageChange(page: number): void {
    this.pagination.page = page;
    this.getPage(this.ridestatus);
  }

  rowNumber(index: number): number {
    return ((this.pagination.page - 1) * this.pagination.pageSize) + index + 1;
  }

  private buildParams(): any {
    return {
      page: this.pagination.page,
      pageSize: this.pagination.pageSize,
      sortBy: this.key,
      sortDir: this.reverse ? 'desc' : 'asc'
    };
  }
}
