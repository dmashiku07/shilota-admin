import { ChangeDetectorRef, Component, OnInit,ViewContainerRef } from '@angular/core';
import { PaymentService } from '../../../../service/payment.service';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Router,ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthenticationService } from '../../../../service/authentication.service';
import { Location } from '@angular/common';

@Component({
  standalone: false,
selector: 'app-payment-ridehistory',
  templateUrl: './payment-ridehistory.component.html',
  styleUrls: ['./payment-ridehistory.component.css']
})
export class PaymentRidehistoryComponent implements OnInit {
  rides: any[] = [];
  user:any = { currencySymbol: '' };
  status:any;
  filter = '';
  loading = false;
  pagination: any = { page: 1, pageSize: 25, totalItems: 0, totalPages: 1 };
  settlementId: any;
  constructor(private service:PaymentService,
    private http: HttpClient,
    private router: Router,
    public toastr: ToastrService, vcr: ViewContainerRef,
    private route: ActivatedRoute,
    private authService:AuthenticationService, private location: Location,
    private cdr: ChangeDetectorRef) 
    {  
    
      this.status = [
        "cancelled","completed","onride","ontheway","scheduled","accepted","ridenotaccepted"
      ]
    }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.settlementId = params['id'];
      this.getPage();
    });
    this.authService.getProfile().subscribe(res => {
      this.user = res || { currencySymbol: '' };
      this.cdr.detectChanges();
   });
  }
  
  getPage() {
    if (!this.settlementId) {
      return;
    }
    this.loading = true;
    this.service.getRides(this.settlementId, this.buildParams()).subscribe(res => {
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
