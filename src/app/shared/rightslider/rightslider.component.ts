import { Component, OnInit } from '@angular/core';
import { environment } from '../../../environments/environment';
import { TranslateService } from '@ngx-translate/core';
import { TranslateModule } from '@ngx-translate/core';
@Component({
  standalone: false,
selector: 'app-rightslider',
  templateUrl: './rightslider.component.html',
  styleUrls: ['./rightslider.component.scss']
})
export class RightsliderComponent implements OnInit {
  public sliderconfig: any = {
    direction: 'horizontal',
    navigation: true,
  };
  sliders: any;
  url: any;
  locallang: any;
  constructor(private translate: TranslateService) { }
  ngOnInit() {
    this.sliders = ['1.jpg', '2.jpg', '3.jpg'];
    this.url = environment.apiUrl;


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

  onSliderImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) {
      return;
    }
    if (img.src.includes("assets/images/invite-bg.png")) {
      return;
    }
    img.src = "assets/images/invite-bg.png";
  }

}
