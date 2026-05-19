import { Component, OnInit } from '@angular/core';
import { AuthenticationService } from 'app/service/authentication.service';
import { FaqService } from 'app/service/faq.service';
import { environment } from 'environments/environment';
import { TranslateService } from '@ngx-translate/core';
import * as $ from 'jquery';
@Component({
  standalone: false,
selector: 'app-frontheader',
  templateUrl: './frontheader.component.html',
  styleUrls: ['./frontheader.component.scss']
})
export class FrontheaderComponent implements OnInit {
  users: any = null;
  url: any;
  faqCount: any = 0;
  locallang: any;
  logo: string = '';
  constructor(
    private authService: AuthenticationService,
    private faq: FaqService,
    private translate: TranslateService
  ) { }

  ngOnInit() {
    this.url = environment.apiUrl;
    this.authService.getUserinfo().subscribe((res: any) => {
      this.users = res || {};
      this.logo = res?.logo || '';
    });

    this.faq.getCount().subscribe(res => {
      this.faqCount = res || 0;
    });
    
       if(localStorage.getItem('language') =="" || localStorage.getItem('language')==null ){
        localStorage.setItem('language', 'en');
            this.locallang = "en";
          
        }
        else
        {
           this.locallang = localStorage.getItem('language');
        }
       
       if(this.locallang == 'ar' || this.locallang == 'he')
          {
            this.translate.use(this.locallang);
            document.body.setAttribute("dir", "rtl");
          } 
          else
          {
          
              document.body.setAttribute("dir", "ltr");
          }
         
  }

  openNav() {
    const $sideNav = $('.sidenav');
    const $overlayDiv = $('.overlay_div');
    const $menuImg = $('.menu_img');
    // if ($(window).width() >= 450) {
      $sideNav.css('width', '300px');
      $overlayDiv.css('display', 'block');
      $menuImg.css('display', 'none');
      document.getElementsByTagName('body')[0].classList.add('overflow_div');
      document.getElementsByTagName('body')[0].classList.add('pos_rel');
    //}
  }

  closeNav() {
    const $sideNav = $('.sidenav');
    const $overlayDiv = $('.overlay_div');
    const $menuImg = $('.menu_img');
    $sideNav.css('width', '0px');
    $overlayDiv.css('display', 'none');
    $menuImg.css('display', 'inline-block');
    document.getElementsByTagName('body')[0].classList.remove('overflow_div');
    document.getElementsByTagName('body')[0].classList.add('pos_rel');
  }

  getUploadUrl(filename: string | null | undefined): string {
    if (!filename) {
      return "";
    }
    return `${this.url}/assets/uploads/${encodeURIComponent(filename)}`;
  }

}
