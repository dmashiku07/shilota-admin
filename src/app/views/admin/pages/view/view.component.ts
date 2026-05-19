import { ChangeDetectorRef, Component, OnInit, ViewContainerRef } from '@angular/core';
import { PageService } from '../../../../service/page.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
@Component({
  standalone: false,
selector: 'app-view',
  templateUrl: './view.component.html',
  styleUrls: ['./view.component.css']
})
export class ViewComponent implements OnInit {
  pages: any[] = [];
  showElement: any;
  loading = false;
  constructor(private service: PageService,
    private http: HttpClient,
    private router: Router,
    public toastr: ToastrService,
    vcr: ViewContainerRef,
    private cdr: ChangeDetectorRef
  ) {
  }
  ngOnInit() {
    this.getPage();
    if (sessionStorage['SuccessMessage']) {
      this.toastr.success(sessionStorage.getItem("SuccessMessage"));
      sessionStorage.clear();
    }
    if (sessionStorage['ErrorMessage']) {
      this.toastr.error(sessionStorage.getItem("ErrorMessage"));
      sessionStorage.clear();
    }
  }
  getPage() {
    this.loading = true;
    this.service.getPage().subscribe(
      res => {
        this.pages = Array.isArray(res) ? res : [];
        this.loading = false;
        this.cdr.detectChanges();
        if (this.pages.length == 0) {
          this.router.navigate(['admin/page/add']);
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
    this.service.deletePage(id).subscribe(data => {
      if (data['success']) {
        this.toastr.info(data['msg']);
        window.scrollTo(0, 0);
        this.refreshList();
      }
      if (data['error']) {
        window.scrollTo(0, 0);
        this.toastr.error(data['msg']);
      }
    });
  }
  refreshList() {
    this.getPage();
  }
}
