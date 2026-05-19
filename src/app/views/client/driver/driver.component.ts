import { Component, OnInit, ChangeDetectorRef, NgZone } from "@angular/core";
import { HomeService } from ".././../../service/home.service";
import { AuthenticationService } from ".././../../service/authentication.service";
import { BannerService } from ".././../../service/banner.service";
import { environment } from "../../../../environments/environment";

@Component({
  standalone: false,
selector: "app-driver",
  templateUrl: "./driver.component.html",
  styleUrls: ["./driver.component.css"]
})
export class DriverComponent implements OnInit {
  home: any[] = [];
  users: any = {};
  pages: any = {};
  backgroundUrl: String;
  driverCount: any = { count: 0 };
  bannerTitle: string = "Make Money. Earn Respect. Secure Your Future";
  url: any;
  constructor(
    private service: HomeService,
    private authService: AuthenticationService,
    private banner: BannerService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {
    window.scrollTo(0, 0);
  }

  ngOnInit() {
    this.url = environment.apiUrl;
    this.service.getDriverHome().subscribe(res => {
      this.zone.run(() => {
        this.home = Array.isArray(res) ? res : [];
        this.cdr.detectChanges();
      });
    });
    this.authService.getUserinfo().subscribe(res => {
      this.zone.run(() => {
        this.users = res || {};
        this.cdr.detectChanges();
      });
    });
    this.banner.getDriverBanner().subscribe((res: any) => {
      this.zone.run(() => {
        this.pages = res || {};
        this.bannerTitle = this.pages?.title || "Make Money. Earn Respect. Secure Your Future";
        if (this.pages?.image) {
          this.backgroundUrl = environment.apiUrl + "/assets/banner/" + this.pages.image;
        } else {
          this.backgroundUrl = environment.apiUrl + "/assets/frontend/images/home/banner1.jpg";
        }
        this.cdr.detectChanges();
      });
    });

    this.banner.getDriverCount().subscribe((res: any) => {
      this.zone.run(() => {
        this.driverCount = res || { count: 0 };
        this.cdr.detectChanges();
      });
    });
  }

  get showDriverBanner(): boolean {
    return Number(this.driverCount?.count) === 1;
  }

  getUploadUrl(filename: string | null | undefined): string {
    if (!filename) {
      return "";
    }
    return `${this.url}/assets/uploads/${encodeURIComponent(filename)}`;
  }
}
