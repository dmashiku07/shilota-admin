import { Component, OnInit } from '@angular/core';
import { PageService } from '.././../../service/page.service';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthenticationService } from '.././../../service/authentication.service';
@Component({
  standalone: false,
selector: 'app-help-driver',
  templateUrl: './help-driver.component.html',
  styleUrls: ['./help-driver.component.css']
})
export class HelpDriverComponent implements OnInit {
  page: any;
  pages: any;
  users: any;
  isCollapsed = true;
  constructor(private service: PageService,
    private router: Router,
    private authService: AuthenticationService,
    private route: ActivatedRoute, ) {
    this.route.params.subscribe(params => {
      this.page = this.service.editPage(params['id']).subscribe(res => {
        this.page = res;
      });
    });
  }

  ngOnInit() {
    window.scroll(0,0);
    this.getPage();
    this.authService.getUserinfo().subscribe(res => {
      this.users = res;
    });
  }

  getPage() {
    this.service.getPage().subscribe(res => {
      this.pages = res;
    });
  }

  hyphenateUrlParams(str: string) {
    let urlParams = str.split(' ').join('-');
    return urlParams.replace(/[^a-zA-Z0-9-]/g, '');
  }

}
