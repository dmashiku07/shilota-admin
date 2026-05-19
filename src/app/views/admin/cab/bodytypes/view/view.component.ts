import { ChangeDetectorRef, Component, OnInit, ViewContainerRef, NgZone } from '@angular/core';
import { BodytypeService } from '../../../../../service/bodytype.service';
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
 bodytypes:any[] = [];
 loading = false;
   constructor(private service:BodytypeService,
     private http: HttpClient,
     private router: Router,
     public toastr: ToastrService,
     vcr: ViewContainerRef,
     private zone: NgZone,
     private cdr: ChangeDetectorRef) {   }

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
    this.zone.run(() => {
      this.service.getContent().subscribe(
        res => {
          this.bodytypes = Array.isArray(res) ? res : [];
          this.loading = false;
          this.cdr.detectChanges();
          if(this.bodytypes.length==0){
            this.router.navigate(['admin/bodytype/add']);
          }
        },
        () => {
          this.bodytypes = [];
          this.loading = false;
          this.cdr.detectChanges();
        }
      );
    });
  }

  delete(id) {
    this.service.delete(id).subscribe(data=>{
      if(data['success']) {
        this.toastr.info(data['msg']);  
        this.getPage();
        this.router.navigate(['admin/bodytype/view']);
        window.scrollTo(0, 0);
      }
      if(data['error']) {
        this.toastr.error(data['msg']);  
        window.scrollTo(0, 0);
      }
    });
}

}
