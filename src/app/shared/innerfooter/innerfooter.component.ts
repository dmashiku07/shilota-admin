import { Component, OnInit } from '@angular/core';
import { AuthenticationService } from 'app/service/authentication.service';
import { PageService } from 'app/service/page.service';

@Component({
  standalone: false,
selector: 'app-innerfooter',
  templateUrl: './innerfooter.component.html',
  styleUrls: ['./innerfooter.component.scss']
})
export class InnerfooterComponent implements OnInit {
  users: any;
  pages: any;
  privacy: any;
  inspection: any;
  security: any;
  helpContent: any;
  count: any;
  constructor(private authService: AuthenticationService, private service: PageService) { }

  ngOnInit() {
    this.authService.getUserinfo().subscribe(res => {
      this.users = res;

    });

    this.service.getDriverTerms().subscribe(res => {
      this.pages = res;
    });

    this.service.getDriverPrivacy().subscribe(res => {
      this.privacy = res;
    });

    this.service.getDriverInspection().subscribe(res => {
      this.inspection = res;
    });

    this.service.getDriverSecurity().subscribe(res => {
      this.security = res;
    });

    this.service.getDriverHelpcontent().subscribe(res => {
      this.helpContent = res;
    });

  }

  hyphenateUrlParams(str: string) {
    let urlParams = str.split(' ').join('-');
    return urlParams.replace(/[^a-zA-Z0-9-]/g, '');
  }
}