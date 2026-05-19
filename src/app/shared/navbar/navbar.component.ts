import { Component, ElementRef, HostListener, OnInit } from '@angular/core';

import { Router } from '@angular/router';
import { AuthenticationService } from 'app/service/authentication.service';

@Component({
  standalone: false,
selector: 'app-navbar',
    templateUrl: './navbar.component.html',
    styleUrls: ['./navbar.component.scss']
})

export class NavbarComponent implements OnInit {
    user: any = null;
    isUserMenuOpen = false;
    constructor(
        private authService: AuthenticationService,
        private router: Router,
        private elementRef: ElementRef
    ) { }

    ngOnInit() {
        this.authService.getProfile().subscribe(res => {
            this.user = res;
        });
    }

    toggleUserMenu(event?: Event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (!this.user) {
            return;
        }
        this.isUserMenuOpen = !this.isUserMenuOpen;
    }

    closeUserMenu() {
        this.isUserMenuOpen = false;
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: Event) {
        if (!this.elementRef.nativeElement.contains(event.target)) {
            this.closeUserMenu();
        }
    }

    onLogoutClick() {
        this.closeUserMenu();
        if (confirm('Are you sure you want to logout?')) {
            this.authService.logout();
            this.router.navigate(['/admin']);
            return false;
        }
    }
}
