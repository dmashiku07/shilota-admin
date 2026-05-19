import { ChangeDetectorRef, Component, OnInit, ViewContainerRef } from '@angular/core';
import { VehicleService } from '../../../../service/vehicle.service';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

@Component({
  standalone: false,
selector: 'app-vehicle',
  templateUrl: './vehicle.component.html',
  styleUrls: ['./vehicle.component.css']
})
export class VehicleComponent implements OnInit {
  vehicle: any[] = [];
  options: any[] = [];
  loading = false;
  filter = '';
  pagination: any = { page: 1, pageSize: 25, totalItems: 0, totalPages: 1 };
  constructor(private service: VehicleService,
    private http: HttpClient,
    private router: Router,
    public toastr: ToastrService,
    vcr: ViewContainerRef,
    private cdr: ChangeDetectorRef) { }

  ngOnInit() {
    this.getPage();
    this.service.getCategory().subscribe(res => {
      this.options = Array.isArray(res) ? res : [];
      this.cdr.detectChanges();
    });
  }

  getPage() {
    this.loading = true;
    this.service.getPage(this.buildParams()).subscribe(
      res => {
        this.vehicle = Array.isArray(res && res['items']) ? res['items'] : [];
        this.pagination = res && res['pagination'] ? res['pagination'] : this.pagination;
        this.loading = false;
        this.cdr.detectChanges();
      },
      () => {
        this.vehicle = [];
        this.pagination = { ...this.pagination, totalItems: 0, totalPages: 1 };
        this.loading = false;
        this.cdr.detectChanges();
      }
    );
  }

  deactive(id) {
    this.service.deactiveVehicle(id).subscribe(data => {
      if (data['success']) {
        this.toastr.info(data['msg']);
        this.getPage();
        this.router.navigate(['admin/management/vehicle']);
        window.scrollTo(0, 0);
      }
      if (data['error']) {
        window.scrollTo(0, 0);
        this.toastr.error(data['msg']);

      }
    });
  }

  active(id) {
    this.service.activeVehicle(id).subscribe(data => {
      if (data['success']) {
        this.toastr.success(data['msg']);
        this.getPage();
        this.router.navigate(['admin/management/vehicle']);
      }
      if (data['error']) {
        this.toastr.error(data['msg']);

      }
    });
  }

  key: string = '_id'; //set default

  reverse: boolean = true;

  sort(key) {

    this.key = key;

    this.reverse = !this.reverse;
    this.pagination.page = 1;
    this.getPage();

  }

  onFilterChange(): void {
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
    return {
      page: this.pagination.page,
      pageSize: this.pagination.pageSize,
      search: this.filter,
      sortBy: this.key,
      sortDir: this.reverse ? 'desc' : 'asc'
    };
  }

}
