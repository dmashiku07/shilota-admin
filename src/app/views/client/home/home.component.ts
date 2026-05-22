import { Component, OnInit, ChangeDetectorRef, NgZone } from "@angular/core";
import { AuthenticationService } from ".././../../service/authentication.service";
import { HomeService } from ".././../../service/home.service";
import { PageService } from ".././../../service/page.service";
import { BannerService } from ".././../../service/banner.service";
import { CategoryService } from ".././../../service/category.service";
import { AmenitiesService } from ".././../../service/amenities.service";
import { environment } from ".././../../../environments/environment";

@Component({
  standalone: false,
selector: "app-home",
  templateUrl: "./home.component.html",
  styleUrls: ["./home.component.scss"]
})
export class HomeComponent implements OnInit {
  users: any = {};
  home: any[] = [];
  pages: any = {};
  backgroundUrl: String;
  userCount: any = { count: 0 };
  categorydata: any[] = [];
  selectedCategory: any = "";
  selectedCategoryamenities: any[] = [];
  amenitiesdata: any[] = [];
  url: any;
  amenitity_image_url: any;
  bannerTitle: string = "Always the ride you want";

  public categoryconfig: any = {
    direction: "horizontal",
    slidesPerView: 6,
    navigation: true,
    breakpoints: {
      // when window width is <= 320px
      375: {
        slidesPerView: 1,
        spaceBetween: 10
      },
      // when window width is <= 480px
      480: {
        slidesPerView: 2,
        spaceBetween: 20
      },
      // when window width is <= 640px
      640: {
        slidesPerView: 3,
        spaceBetween: 30
      },
      800: {
        slidesPerView: 4,
        spaceBetween: 40
      }
    },
    autoplay: false
  };

  public categoryinfoconfig: any = {
    direction: "horizontal",
    slidesPerView: 1,
    navigation: false,
    keyboard: false
  };

  constructor(
    private authService: AuthenticationService,
    private service: HomeService,
    private categoryservice: CategoryService,
    private amenitiesservice: AmenitiesService,
    private data: PageService,
    private banner: BannerService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {
    window.scrollTo(0, 0);
  }

  ngOnInit() {
    this.url = environment.apiUrl;

    this.amenitity_image_url = environment.apiUrl + "/assets/uploads/";

    this.authService.getUserinfo().subscribe(res => {
      this.zone.run(() => {
        this.users = res || {};
        this.cdr.detectChanges();
      });
    });

    this.categoryservice.getContent().subscribe((res: any) => {
      this.zone.run(() => {
        this.categorydata = Array.isArray(res) ? res : [];
        if (this.categorydata.length > 0) {
          this.selectedCategory = this.categorydata[0].category_name;
          this.selectedCategoryamenities = (this.categorydata[0].amenities || "").split(",").filter(Boolean);
        } else {
          this.selectedCategory = "";
          this.selectedCategoryamenities = [];
        }
        this.cdr.detectChanges();
      });
    });

    this.amenitiesservice.getContent().subscribe((res: any) => {
      this.zone.run(() => {
        this.amenitiesdata = Array.isArray(res) ? res : [];
        this.cdr.detectChanges();
      });
    });

    this.service.getContent().subscribe((res: any) => {
      this.zone.run(() => {
        this.home = Array.isArray(res) ? res : [];
        this.cdr.detectChanges();
      });
    });

    this.banner.getUserBanner().subscribe((res: any) => {
      this.zone.run(() => {
        this.pages = res || {};
        this.bannerTitle = this.pages?.title || "Always the ride you want";
        if (this.pages?.image) {
          this.backgroundUrl = environment.apiUrl + "/assets/banner/" + this.pages.image;
        } else {
          this.backgroundUrl = environment.apiUrl + "/assets/frontend/images/driver/driver_banner.jpg";
        }
        this.cdr.detectChanges();
      });
    });

    this.banner.getUserCount().subscribe((res: any) => {
      this.zone.run(() => {
        this.userCount = res || { count: 0 };
        this.cdr.detectChanges();
      });
    });
  }

  chooseCategory(index,categoryName) {
    this.selectedCategory = categoryName;
    const amenities = this.categorydata?.[index]?.amenities || "";
    this.selectedCategoryamenities = amenities.split(",").filter(Boolean);
  }

  get showUserBanner(): boolean {
    return Number(this.userCount?.count) === 1;
  }

  getUploadUrl(filename: string | null | undefined): string {
    if (!filename) {
      return "";
    }
    return `${this.url}/assets/uploads/${encodeURIComponent(filename)}`;
  }

  getUploadBackgroundUrl(filename: string | null | undefined): string {
    const uploadUrl = this.getUploadUrl(filename);
    return uploadUrl ? `url('${uploadUrl}')` : "";
  }

  get heroTitle(): string {
    return this.bannerTitle || "Move through the city with Shilota";
  }

  get heroSubtitle(): string {
    return this.users?.appcontent || "Fast pickups, cleaner pricing, and city rides that feel current instead of generic.";
  }

  get topCategories(): any[] {
    return (this.categorydata || []).slice(0, 4);
  }
}
