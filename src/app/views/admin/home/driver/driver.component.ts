import { Component, OnInit, ViewContainerRef, NgZone } from '@angular/core';
import { HomeService } from '../../../../service/home.service';
import { Location} from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../../environments/environment';


@Component({
  standalone: false,
selector: 'app-driver',
  templateUrl: './driver.component.html',
  styleUrls: ['./driver.component.css']
})
export class DriverComponent implements OnInit {
  pages:any[] = [];
  url:any;
  loading = false;
  constructor(private service:HomeService,
    private http: HttpClient,
    private router: Router, private _location: Location,
    public toastr: ToastrService,
    vcr: ViewContainerRef,
    private zone: NgZone
  ) {    }

  ngOnInit() {
    this.url=environment.apiUrl;
    this.getContent();
    if (sessionStorage['SuccessMessage']) {
      this.toastr.success( sessionStorage.getItem("SuccessMessage"));
      sessionStorage.clear();
   }
    

   if (sessionStorage['ErrorMessage']) {
    this.toastr.error( sessionStorage.getItem("ErrorMessage"));
    sessionStorage.clear();
 }
  }

  getContent() {
    this.loading = true;
    this.zone.run(() => {
      this.service.getDriverHome().subscribe(
        res => {
          this.pages = Array.isArray(res) ? res : [];
          this.loading = false;
          if(this.pages.length==0){
            this.router.navigate(['admin/home/adddriver']);
          }
        },
        () => {
          this.pages = [];
          this.loading = false;
        }
      );
    });
  }

  deletePage(id) {
    this.service.deletePage(id).subscribe(data=>{
      if(data['success']) {
        this.toastr.info(data['msg']);  
         this.getContent();
         window.scrollTo(0, 0);
        this.router.navigate(['admin/driver/view']);
       }
      if(data['error']) {
        this.toastr.error(data['msg']);  
      }
    });
}



}
