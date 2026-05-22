import { Component, OnDestroy, OnInit } from '@angular/core';
import { ROUTES } from './sidebar-routes.config';
import { RouteInfo } from "./sidebar.metadata";
import { NavigationEnd, Router, ActivatedRoute } from "@angular/router";
import { AuthenticationService } from 'app/service/authentication.service';
import { Subscription } from 'rxjs';

@Component({
  standalone: false,
// moduleId: module.id,
    selector: 'app-sidebar',
    templateUrl: './sidebar.component.html',
})

export class SidebarComponent implements OnInit, OnDestroy {
    public menuItems: any[];
    userinfo: any = {};
    site_title = 'Shilota';
    openMenus = new Set<string>();
    private routerEventsSub?: Subscription;

    constructor(private router: Router,
        private route: ActivatedRoute, private authService: AuthenticationService, ) {
    }

    ngOnInit() {
        this.menuItems = ROUTES.filter(menuItem => menuItem);
        this.authService.getProfile().subscribe(res => {
            const profile: any = res || {};
            this.userinfo = profile;
            this.site_title = profile.siteName || 'Shilota';
        });
        this.syncOpenMenusWithRoute();
        this.routerEventsSub = this.router.events.subscribe(event => {
            if (event instanceof NavigationEnd) {
                this.syncOpenMenusWithRoute();
            }
        });
    }

    toggleMenu(menuItem: RouteInfo, event?: Event) {
        if (!menuItem.submenu || menuItem.submenu.length === 0) {
            return;
        }
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (this.openMenus.has(menuItem.title)) {
            this.openMenus.delete(menuItem.title);
        } else {
            this.openMenus.add(menuItem.title);
        }
    }

    isMenuOpen(menuItem: RouteInfo): boolean {
        return this.openMenus.has(menuItem.title);
    }

    navigateTo(path: string, event?: Event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (!path) {
            return;
        }
        this.router.navigateByUrl(path);
    }

    onMenuNavigate(menuItem?: RouteInfo, event?: Event) {
        if (menuItem && menuItem.submenu && menuItem.submenu.length > 0) {
            return;
        }
        if (menuItem?.path) {
            this.navigateTo(menuItem.path, event);
            return;
        }
        this.syncOpenMenusWithRoute();
    }

    private syncOpenMenusWithRoute() {
        const currentUrl = this.router.url;
        this.openMenus.clear();
        this.menuItems.forEach(menuItem => {
            if (menuItem.submenu && menuItem.submenu.some(subItem => currentUrl.startsWith(subItem.path))) {
                this.openMenus.add(menuItem.title);
            }
        });
    }

    onLogoutClick() {
        if (confirm('Are you sure you want to log out?')) {
            this.authService.logout();
            this.router.navigate(['/admin']);
            return false;
        }
    }

    ngOnDestroy() {
        this.routerEventsSub?.unsubscribe();
    }

}
