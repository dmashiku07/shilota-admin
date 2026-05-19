import { Component, OnInit } from '@angular/core';
import { PageService } from '.././../../service/page.service';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthenticationService } from '.././../../service/authentication.service';
import { FaqService } from '.././../../service/faq.service';

@Component({
  standalone: false,
selector: 'app-help',
  templateUrl: './help.component.html',
  styleUrls: ['./help.component.css']
})
export class HelpComponent implements OnInit {
  page: any;
  pages: any;
  users: any;
  count: any;
  profilelog:any;
  faqCount: any;
  ad_unit_id:any;
  admin_enable_ads:any;
  isCollapsed = true;
  constructor(private service: PageService,
    private router: Router,
    private authService: AuthenticationService,
    private route: ActivatedRoute, private faq: FaqService) {
    window.scrollTo(0, 0);
    this.route.params.subscribe(params => {
      this.page = this.service.editPage(params['id']).subscribe(res => {
        this.page = res;
      });
    });
  }

  ngOnInit() {
    // this.profilelog = JSON.parse(localStorage.getItem("user"));
    // this.ad_unit_id = this.profilelog.ad_unit_id;
    // this.admin_enable_ads=this.profilelog.admin_enable_ads;

    this.getPage();
    this.authService.getUserinfo().subscribe(res => {
      this.users = res;
    });

    this.service.getuserHelpCount().subscribe(res => {
      this.count = res;

    });
    this.faq.getCount().subscribe(res => {
      this.faqCount = res;
    });
  }

  getPage() {
    this.service.getUserPage().subscribe(res => {
      this.pages = res;
    });
  }

  hyphenateUrlParams(str: string) {
    let urlParams = str.split(' ').join('-');
    return urlParams.replace(/[^a-zA-Z0-9-]/g, '');
  }

}
