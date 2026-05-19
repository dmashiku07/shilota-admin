import { ChangeDetectorRef, Component, OnInit,ViewContainerRef } from '@angular/core';
import { CommissionsService } from '../../../../service/commissions.service';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

@Component({
  standalone: false,
selector: 'app-view',
  templateUrl: './view.component.html',
  styleUrls: ['./view.component.css']
})
export class ViewComponent implements OnInit {
  tax:any[] = [];
  loading = false;
  constructor(private service:CommissionsService,
    private http: HttpClient,
    private router: Router,
    public toastr: ToastrService,
    vcr: ViewContainerRef,
    private cdr: ChangeDetectorRef)
     {   }

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
    this.service.getContent().subscribe(
      res => {
        this.tax = Array.isArray(res) ? res : [];
        this.loading = false;
        this.cdr.detectChanges();
        if(this.tax.length==0){
          this.router.navigate(['admin/commissions/add']);
        }
      },
      () => {
        this.tax = [];
        this.loading = false;
        this.cdr.detectChanges();
      }
    );
  }

  delete(id) {
    this.service.delete(id).subscribe(data=>{
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
