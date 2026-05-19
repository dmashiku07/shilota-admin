import { ChangeDetectorRef, Component, OnInit,ViewContainerRef } from '@angular/core';
import { SettlementService } from '../../../../service/settlement.service';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthenticationService } from '../../../../service/authentication.service';

@Component({
  standalone: false,
selector: 'app-settlement-history',
  templateUrl: './settlement-history.component.html',
  styleUrls: ['./settlement-history.component.css']
})
export class SettlementHistoryComponent implements OnInit {
  settlement: any[] = [];
  user:any = { currencySymbol: '' };
  loading = false;
  filter = '';
  pagination: any = { page: 1, pageSize: 25, totalItems: 0, totalPages: 1 };
  constructor(private service:SettlementService,
    private http: HttpClient,
    private router: Router,
    public toastr: ToastrService, vcr: ViewContainerRef,private authService:AuthenticationService,
    private cdr: ChangeDetectorRef
  )  { }

  ngOnInit() {
    this.getPage();
  }

  getPage() {
    this.loading = true;
    this.service.getPage(this.buildParams()).subscribe(
      res => {
        this.settlement = Array.isArray(res && res['items']) ? res['items'] : [];
        this.pagination = res && res['pagination'] ? res['pagination'] : this.pagination;
        this.loading = false;
        this.cdr.detectChanges();
      },
      () => {
        this.settlement = [];
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
    return {
      page: this.pagination.page,
      pageSize: this.pagination.pageSize,
      sortBy: this.key,
      sortDir: this.reverse ? 'desc' : 'asc'
    };
  }

}
