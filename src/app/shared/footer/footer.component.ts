import { Component, HostBinding, OnInit } from '@angular/core';
import { AuthenticationService } from 'app/service/authentication.service';
@Component({
  standalone: false,
// moduleId: module.id,
    selector: 'app-footer',
    templateUrl: './footer.component.html',
    styleUrls: ['./footer.component.scss']
})

export class FooterComponent implements OnInit {
    user: any = { footer: '' };
    constructor(private authService: AuthenticationService) { }
    ngOnInit() {
        this.authService.getProfile().subscribe(res => {
            this.user = { ...(res || {}), footer: res?.footer || '' };
        });
    }
}
