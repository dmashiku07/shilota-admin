import { NgModule } from '@angular/core';
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { ToggleFullscreenDirective } from "./directives/toggle-fullscreen.directive";
import { FooterComponent } from "./footer/footer.component";
import { NavbarComponent } from "./navbar/navbar.component";
import { SidebarComponent } from "./sidebar/sidebar.component";
import { FrontheaderComponent } from './frontheader/frontheader.component';
import { FrontfooterComponent } from './frontfooter/frontfooter.component';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { InnerheaderComponent } from './innerheader/innerheader.component';
import { InnerfooterComponent } from './innerfooter/innerfooter.component';
import { FrontsidebarComponent } from './frontsidebar/frontsidebar.component';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';
import { RightsliderComponent } from './rightslider/rightslider.component';
import { TranslateModule } from '@ngx-translate/core';
@NgModule({
    exports: [
        CommonModule,
        FooterComponent,
        NavbarComponent,
        SidebarComponent,
        FrontheaderComponent,
        FrontfooterComponent,
        InnerheaderComponent,
        InnerfooterComponent,
        FrontsidebarComponent,
        RightsliderComponent,
        ToggleFullscreenDirective
    ],
    imports: [
        RouterModule,
        CommonModule,
        NgbModule,
        TranslateModule,
        NgxSkeletonLoaderModule
    ],
    declarations: [
        FooterComponent,
        NavbarComponent,
        SidebarComponent,
        ToggleFullscreenDirective,
        FrontheaderComponent,
        FrontfooterComponent,
        InnerheaderComponent,
        InnerfooterComponent,
        FrontsidebarComponent,
        RightsliderComponent,
    ],
})
export class SharedModule { }
