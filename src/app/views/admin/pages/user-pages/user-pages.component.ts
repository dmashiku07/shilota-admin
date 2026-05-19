import { Component, OnInit,ViewContainerRef } from '@angular/core';
import { PageService } from '../../../../service/page.service';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
@Component({
  standalone: false,
selector: 'app-user-pages',
  templateUrl: './user-pages.component.html',
  styleUrls: ['./user-pages.component.css']
})
export class UserPagesComponent implements OnInit {
  pages: any[] = [];
  loading = false;
  constructor(private service:PageService,
    private http: HttpClient,
    private router: Router,
    public toastr: ToastrService,
    vcr: ViewContainerRef
  ) { 
    
  }

  ngOnInit() {
    this.getPage();
    if (sessionStorage['SuccessMessage']) {
      this.toastr.success( sessionStorage.getItem("SuccessMessage"));
      sessionStorage.clear();
   }
    

   if (sessionStorage['ErrorMessage']) {
    this.toastr.error( sessionStorage.getItem("ErrorMessage"));
    sessionStorage.clear();
 }

     
  }

  getPage() {
    this.loading = true;
    this.service.getUserPage().subscribe(
      res => {
        this.pages = Array.isArray(res) ? res : [];
        this.loading = false;
        if(this.pages.length==0){
          this.router.navigate(['admin/page/addUser']);
        }
      },
      () => {
        this.pages = [];
        this.loading = false;
      }
    );
  }

  deletePage(id) {
    this.service.deletePage(id).subscribe(data=>{
      if(data['success']) {
        this.toastr.info(data['msg']);        
        this.getPage();
        window.scrollTo(0, 0);
       }
      if(data['error']) {
        window.scrollTo(0, 0);
        this.toastr.error(data['msg']);  
      }
    });
}
}
