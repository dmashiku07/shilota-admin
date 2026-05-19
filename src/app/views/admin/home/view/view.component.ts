import { ChangeDetectorRef, Component, OnInit, ViewContainerRef } from '@angular/core';
import { HomeService } from '../../../../service/home.service';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Router,ActivatedRoute } from '@angular/router';
import {Location} from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../../environments/environment';



@Component({
  standalone: false,
selector: 'app-view',
  templateUrl: './view.component.html',
  styleUrls: ['./view.component.css']
})
export class ViewComponent implements OnInit {
  
  pages:any[] = [];
  url:any;
  loading = false;
  constructor(private service:HomeService,
    private http: HttpClient,
    private router: Router,
    private location: Location,
    private route: ActivatedRoute,
    public toastr: ToastrService,
    vcr: ViewContainerRef,
    private cdr: ChangeDetectorRef
   ) 
    {
      
     }

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
    this.service.getContent().subscribe(
      res => {
        this.pages = Array.isArray(res) ? res : [];
        this.loading = false;
        this.cdr.detectChanges();
        if(this.pages.length==0){
          this.router.navigate(['admin/home/add']);
        }
      },
      () => {
        this.pages = [];
        this.loading = false;
        this.cdr.detectChanges();
      }
    );
  }

  deletePage(id) {
    this.service.deletePage(id).subscribe(data=>{
      if(data['success']) {
        this.toastr.info(data['msg']);  
       
        this.getContent();
        window.scrollTo(0, 0);
      //  this.router.navigate(['admin/home/view']);
       }
      if(data['error']) {
        this.toastr.error(data['msg']);  
      
      }
    });
}

refreshList(){
  this.getContent();
}

}
