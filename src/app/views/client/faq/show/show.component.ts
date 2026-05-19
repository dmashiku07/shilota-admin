import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FaqService } from '../../../../service/faq.service';
import { PageService } from '../../../../service/page.service';
import { AuthenticationService } from '.././../../../service/authentication.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslateModule } from '@ngx-translate/core';
@Component({
  standalone: false,
selector: 'app-show',
  templateUrl: './show.component.html',
  styleUrls: ['./show.component.css']
})
export class ShowComponent implements OnInit {
  faq: any = {};
  pages: any[] = [];
  users: any = {};
  count: any = 0;
  isCollapsed = true;
  constructor(private route: ActivatedRoute,
    private router: Router,
    private authService: AuthenticationService,
    private translate: TranslateService,
    private service: FaqService, private pageservice: PageService) {
    window.scrollTo(0, 0);
    this.pageservice.getUserPage().subscribe(res => {
      this.pages = Array.isArray(res) ? res : [];
    });
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.service.edit(params['id']).subscribe((res: any) => {
        this.faq = res || {};
      });
    });
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

}
