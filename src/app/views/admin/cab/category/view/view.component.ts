import { ChangeDetectorRef, Component, OnInit, ViewContainerRef, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { CategoryService } from '../../../../../service/category.service';
import { environment } from '../../../../../../environments/environment';
@Component({
  standalone: false,
selector: 'app-view',
  templateUrl: './view.component.html',
  styleUrls: ['./view.component.css']
})
export class ViewComponent implements OnInit {
  category: any[] = [];
  url: any;
  loading = false;
  constructor(
    private service: CategoryService,
    private http: HttpClient,
    private router: Router,
    public toastr: ToastrService,
    vcr: ViewContainerRef,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.url = environment.apiUrl;
    this.getPage();
    if (sessionStorage['SuccessMessage']) {
      this.toastr.success(sessionStorage.getItem('SuccessMessage'));
      sessionStorage.clear();
    }
    if (sessionStorage['ErrorMessage']) {
      this.toastr.error(sessionStorage.getItem('ErrorMessage'));
      sessionStorage.clear();
    }
  }

  getPage() {
    this.loading = true;
    this.zone.run(() => {
      this.service.getContent().subscribe(
        res => {
          this.category = Array.isArray(res) ? res : [];
          this.loading = false;
          this.cdr.detectChanges();
          if (this.category.length == 0) {
            this.router.navigate(['admin/category/add']);
          }
        },
        () => {
          this.category = [];
          this.loading = false;
          this.cdr.detectChanges();
        }
      );
    });
  }

  delete(id) {
    this.service.delete(id).subscribe(data => {
      if (data['success']) {
        this.toastr.info(data['msg']);
        this.getPage();
        window.scrollTo(0, 0);
        this.router.navigate(['admin/category/view']);
      }
      if (data['error']) {
        this.toastr.error(data['msg']);
      }
    });
  }
}
