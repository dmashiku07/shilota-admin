import { Component, OnInit } from '@angular/core';
import { FaqService } from '../../../../service/faq.service';
import { ActivatedRoute, Router } from '@angular/router';
import { PageService } from '../../../../service/page.service';
import { AuthenticationService } from '.././../../../service/authentication.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  standalone: false,
selector: 'app-view',
  templateUrl: './view.component.html',
  styleUrls: ['./view.component.css']
})
export class ViewComponent implements OnInit {
  faq: any[] = [];
  pages: any[] = [];
  users: any = {};
  count: any = 0;
  isCollapsed = true;
  constructor(private service: FaqService,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthenticationService,
    private translate: TranslateService,
    private pageservice: PageService) {
    window.scrollTo(0, 0);
    this.pageservice.getUserPage().subscribe(res => {
      this.pages = Array.isArray(res) ? res : [];
    });
  }

  ngOnInit() {
    this.getPage();
    this.authService.getUserinfo().subscribe(res => {
      this.users = res || {};
    });
    this.pageservice.getuserHelpCount().subscribe(res => {
      this.count = res || 0;

    });

  }

  hyphenateUrlParams(str: string) {
    let urlParams = str.split(' ').join('-');
    return urlParams.replace(/[^a-zA-Z0-9-]/g, '');
  }

  getPage() {
    this.service.getContent().subscribe((res: any) => {
      this.faq = Array.isArray(res) ? res : [];

    });
  }
}
