import { Component, OnInit,ViewContainerRef } from '@angular/core';
import { PaymentService } from '../../../../service/payment.service';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Router,ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthenticationService } from '../../../../service/authentication.service';

@Component({
  standalone: false,
selector: 'app-paymentdetails',
  templateUrl: './paymentdetails.component.html',
  styleUrls: ['./paymentdetails.component.css']
})
export class PaymentdetailsComponent implements OnInit {
  payment:any;
  user:any;
  constructor(private service:PaymentService,
    private http: HttpClient,
    private router: Router,
    public toastr: ToastrService, vcr: ViewContainerRef,
    private route: ActivatedRoute,
    private authService:AuthenticationService) 
    {  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.payment = this.service.getInfo(params['id']).subscribe(res => {
        this.payment = res;
       });
    });
    this.authService.getProfile().subscribe(res => {
      this.user = res;
   });
  }

}
