import { ChangeDetectorRef, Component, OnInit,ViewContainerRef } from '@angular/core';
import { UserService } from '../../../../service/user.service';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Router,ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Location } from '@angular/common';
import { environment } from '../../../../../environments/environment';

@Component({
  standalone: false,
selector: 'app-view',
  templateUrl: './view.component.html',
  styleUrls: ['./view.component.css']
})
export class ViewComponent implements OnInit {
  user:any = {};
  url:any;
  loading = false;
  constructor(
    private route: ActivatedRoute,
    private service:UserService,
    private http: HttpClient,
    private router: Router,
    public toastr: ToastrService, vcr: ViewContainerRef,private location: Location,
    private cdr: ChangeDetectorRef) 
    { 
     }

  ngOnInit() {
    this.url=environment.apiUrl;
    this.loading = true;
    this.route.params.subscribe(params => {
      this.service.getInfo(params['id']).subscribe(res => {
        this.user = res || {};
        this.loading = false;
        this.cdr.detectChanges();
      });
    });
  }
  
  goBack() {
    this.location.back(); 
  }
}
