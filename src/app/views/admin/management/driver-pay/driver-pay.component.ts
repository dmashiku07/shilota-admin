import { ChangeDetectorRef, Component, OnInit,ViewContainerRef } from '@angular/core';
import { PaymentService } from '../../../../service/payment.service';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthenticationService } from '../../../../service/authentication.service';
import { SettlementService } from '../../../../service/settlement.service';
import { environment } from '../../../../../environments/environment';



@Component({
  standalone: false,
selector: 'app-driver-pay',
  templateUrl: './driver-pay.component.html',
  styleUrls: ['./driver-pay.component.css']
})
export class DriverPayComponent implements OnInit {
  payment: any[] = [];
  user:any = { currencySymbol: '' };
  loading = false;
  readonly commissionEnabled = environment.featureFlags.commission_enabled;
  filter = '';
  pagination: any = { page: 1, pageSize: 25, totalItems: 0, totalPages: 1 };
  constructor(private service:PaymentService,
    private http: HttpClient,
    private router: Router,
    public toastr: ToastrService, vcr: ViewContainerRef,
    private authService:AuthenticationService, private settlement:SettlementService,
    private cdr: ChangeDetectorRef
) 
    { }

  ngOnInit() {
    this.getPage();
  }


  getPage() {
    this.loading = true;
    this.service.getDriverPay(this.buildParams()).subscribe(
      res => {
        if (res == null || res === "undefined") {
          this.payment = [];
        } else {
          this.payment = Array.isArray(res && res['items']) ? res['items'] : [];
          this.pagination = res && res['pagination'] ? res['pagination'] : this.pagination;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      () => {
        this.payment = [];
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
   
  payDriver(driverID,totalFare,commissionAmt,tax,earn,count){
    if (!this.commissionEnabled) {
      return;
    }
    this.settlement.add(driverID,totalFare,commissionAmt,tax,earn,count).subscribe(data=>{ 
      if(data['success']) {
        this.getPage();  
        this.toastr.success(data['msg']); 
        window.scrollTo(0, 0);   
     }
     if(data['error']) {
      this.toastr.error(data['msg']); 
      window.scrollTo(0, 0);
    }
    })
  };

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
