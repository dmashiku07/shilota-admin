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
            this.user = {
                ...(res || {}),
                footer: this.normalizeFooter(res?.footer)
            };
        });
    }

    private normalizeFooter(footer: unknown): string {
        if (typeof footer !== 'string') {
            return '';
        }

        return footer
            .replace(/cabi\.co\.tz/gi, 'shilota.tz')
            .replace(/\bcabi\b/gi, 'SHILOTA')
            .trim();
    }
}
