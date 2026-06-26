import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../../environments/environment';

@Component({
  standalone: false,
  selector: 'app-admin-pool-settings',
  templateUrl: './pool-settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminPoolSettingsComponent implements OnInit {
  loading = false;
  saving = false;
  model: any = {
    enabled: true,
    discount_percent: 15,
    max_passengers: 3,
    max_detour_km: 3,
    max_pickup_gap_km: 2,
    max_drop_gap_km: 3
  };
  zoneOverridesText = '[]';

  constructor(
    private http: HttpClient,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.http.get(environment.apiUrl + '/safety/poolsettings').subscribe((res: any) => {
      this.loading = false;
      if (res && res.status === 'true' && res.data) {
        this.model = res.data;
        this.zoneOverridesText = JSON.stringify(res.data.zone_overrides || [], null, 2);
      }
      this.cdr.markForCheck();
    }, () => {
      this.loading = false;
      this.toastr.error('Unable to load pooling settings');
      this.cdr.markForCheck();
    });
  }

  save() {
    let zoneOverrides: any[] = [];
    try {
      zoneOverrides = JSON.parse(this.zoneOverridesText || '[]');
    } catch (_error) {
      this.toastr.error('Zone overrides must be valid JSON');
      return;
    }

    this.saving = true;
    this.http.post(environment.apiUrl + '/safety/poolsettings', {
      ...this.model,
      zone_overrides: zoneOverrides
    }).subscribe((res: any) => {
      this.saving = false;
      if (res && res.status === 'true') {
        this.toastr.success('Pooling settings saved');
        this.model = res.data;
        this.zoneOverridesText = JSON.stringify(res.data.zone_overrides || [], null, 2);
      } else {
        this.toastr.error('Unable to save pooling settings');
      }
      this.cdr.markForCheck();
    }, () => {
      this.saving = false;
      this.toastr.error('Unable to save pooling settings');
      this.cdr.markForCheck();
    });
  }
}
