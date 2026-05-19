import { Component, OnInit } from '@angular/core';
import { AuthenticationService } from 'app/service/authentication.service';
import { PageService } from 'app/service/page.service';
import { FaqService } from 'app/service/faq.service';
import { Router } from '@angular/router';
@Component({
  standalone: false,
selector: 'app-frontfooter',
  templateUrl: './frontfooter.component.html',
  styleUrls: ['./frontfooter.component.scss']
})
export class FrontfooterComponent implements OnInit {
  users: any = {};
  pages: any[] = [];
  privacy: any[] = [];
  links: any[] = [];
  helpContent: any[] = [];
  faqCount: any = 0;
  constructor(private authService: AuthenticationService, private service: PageService,
    private faq: FaqService,private router: Router) { }

  ngOnInit() {
    this.authService.getUserinfo().subscribe((res: any) => {
      this.users = res || {};
    });

    this.service.getPage().subscribe((res: any) => {
      this.links = Array.isArray(res) ? res : [];
    });

    this.service.getTerms().subscribe((res: any) => {
      this.pages = Array.isArray(res) ? res : [];
    });

    this.service.getPrivacy().subscribe((res: any) => {
      this.privacy = Array.isArray(res) ? res : [];
    });

    this.service.getUserHelpcontent().subscribe((res: any) => {
      this.helpContent = Array.isArray(res) ? res : [];
    });
    this.faq.getCount().subscribe((res: any) => {
      this.faqCount = res;
    });
  }

  hyphenateUrlParams(str: string) {
    let urlParams = str.split(' ').join('-');
    return urlParams.replace(/[^a-zA-Z0-9-]/g, '');
  }

}
