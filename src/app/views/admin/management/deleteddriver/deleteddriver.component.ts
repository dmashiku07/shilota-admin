import { ChangeDetectorRef, Component, OnInit, ViewContainerRef } from '@angular/core';
import { DriverService } from '../../../../service/driver.service';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
@Component({
  standalone: false,
selector: 'app-deleted-driver',
  templateUrl: './deleteddriver.component.html',
  styleUrls: ['./deleteddriver.component.css']
})
export class DeletedDriverComponent implements OnInit {
  pages: any[] = [];
  filter = '';
  loading = false;
  pagination: any = { page: 1, pageSize: 25, totalItems: 0, totalPages: 1 };
  constructor(private service: DriverService,
    private http: HttpClient,
    private router: Router,
    public toastr: ToastrService, vcr: ViewContainerRef,
    private cdr: ChangeDetectorRef) { }

  ngOnInit() {
    this.getPage();
  }

  getPage() {
    this.loading = true;
    this.service.getDeletedDriver(this.buildParams()).subscribe(res => {
      this.pages = Array.isArray(res && res['items']) ? res['items'] : [];
      this.pagination = res && res['pagination'] ? res['pagination'] : this.pagination;
      this.loading = false;
      this.cdr.detectChanges();
    }, () => {
      this.pages = [];
      this.pagination = { ...this.pagination, totalItems: 0, totalPages: 1 };
      this.loading = false;
      this.cdr.detectChanges();
    });
  }

  revoke(id) {
    this.service.revokeDeletion(id).subscribe(data => {
      if (data['success']) {
        this.toastr.success(data['msg'], 'Success!');
        this.getPage();
        this.router.navigate(['admin/management/deleteddrivers']);
      }
      if (data['error']) {
        this.toastr.error(data['msg'], 'Error!');

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
