import { Component, OnInit } from "@angular/core";
import { AuthenticationService } from "app/service/authentication.service";
import { PageService } from "app/service/page.service";
import { environment } from "environments/environment";
import { TranslateService } from '@ngx-translate/core';
import * as $ from 'jquery';
@Component({
  standalone: false,
selector: "app-innerheader",
  templateUrl: "./innerheader.component.html",
  styleUrls: ["./innerheader.component.scss"]
})
export class InnerheaderComponent implements OnInit {
  user: any = {};
  count: any = 0;
  pages: any[] = [];
  url: any;
  locallang: any;
  constructor(
    private authService: AuthenticationService,
    private service: PageService,
    private translate: TranslateService
  ) {}
  ngOnInit() {
    this.url = environment.apiUrl;
    this.authService.getUserinfo().subscribe(res => {
      this.user = res;
    });
    this.service.getdriverHelpCount().subscribe(res => {
      this.count = res;
    });
    this.service.getDriverHelppage().subscribe(res => {
      this.pages = Array.isArray(res) ? res : [];
    });
      if(localStorage.getItem('language') =="" || localStorage.getItem('language')==null ){
        localStorage.setItem('language', 'en');
        this.locallang = "en";
        }
        else
        {
           this.locallang = localStorage.getItem('language');
        }
        this.translate.use(this.locallang);
        if(this.locallang == 'ar' || this.locallang == 'he')
          {
            
            document.body.setAttribute("dir", "rtl");
          } 
          else
          {
          
              document.body.setAttribute("dir", "ltr");
          }
  }
  
  hyphenateUrlParams(str: string) {
    let urlParams = str.split(' ').join('-');
    return urlParams.replace(/[^a-zA-Z0-9-]/g, '');
  }

  closeNav() {
    const $sideNav = $(".sidenav");
    const $overlayDiv = $(".overlay_div");
    const $menuImg = $(".menu_img");
    $sideNav.css("width", '0px');
    $overlayDiv.css("display", "none");
    $menuImg.css("display", "inline-block");
    document.getElementsByTagName("body")[0].classList.remove("overflow_div");
    document.getElementsByTagName("body")[0].classList.add("pos_rel");
  }

  getUploadUrl(filename: string | null | undefined) {
    if (!filename) {
      return "";
    }
    return `${this.url}/assets/uploads/${encodeURIComponent(filename)}`;
  }
}
