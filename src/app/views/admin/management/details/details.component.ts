import { ChangeDetectorRef, Component, OnInit,ViewContainerRef } from '@angular/core';
import { DriverService } from '../../../../service/driver.service';
import { HttpClient } from '@angular/common/http';
import { Router,ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { RidesService } from '../../../../service/rides.service';
import { Location } from '@angular/common';

@Component({
  standalone: false,
selector: 'app-details',
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.css']
})
export class DetailsComponent implements OnInit {
  user:any = {};
  rides:any = 0;
  loading = false;
  constructor(private service:DriverService,
    private http: HttpClient,
    private router: Router,
    public toastr: ToastrService, vcr: ViewContainerRef,
    private route: ActivatedRoute,
    private rideService:RidesService,private location: Location,
    private cdr: ChangeDetectorRef) 
    {  }

  ngOnInit() {
    this.loading = true;
    this.route.params.subscribe(params => {
      this.service.getInfo(params['id']).subscribe(res => {
        this.user = res || {};
        this.loading = false;
        this.cdr.detectChanges();
      });
    });

    this.route.params.subscribe(params => {
      this.rideService.getDriverRideCount(params['id']).subscribe(res => {
        this.rides = res ?? 0;
        this.cdr.detectChanges();
      });
    });
  }
  
  goBack() {
    this.location.back(); 
  }
}
