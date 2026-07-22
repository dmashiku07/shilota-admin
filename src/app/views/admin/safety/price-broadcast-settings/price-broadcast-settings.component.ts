import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../../environments/environment';

@Component({
  standalone: false,
  selector: 'app-admin-price-broadcast-settings',
  templateUrl: './price-broadcast-settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminPriceBroadcastSettingsComponent implements OnInit {
  loading = false;
  saving = false;
  activitiesLoading = false;
  model: any = {
    enabled: true,
    default_radius_km: 8,
    max_radius_km: 20,
    default_expiry_minutes: 5,
    max_expiry_minutes: 15,
    max_broadcasts_per_day: null
  };
  activities: any[] = [];

  constructor(
    private http: HttpClient,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.load();
    this.loadActivities();
  }

  load() {
    this.loading = true;
    this.http.get(environment.apiUrl + '/safety/pricebroadcastsettings').subscribe((res: any) => {
      this.loading = false;
      if (res && res.status === 'true' && res.data) {
        this.model = res.data;
      }
      this.cdr.markForCheck();
    }, () => {
      this.loading = false;
      this.toastr.error('Unable to load passenger price broadcast settings');
      this.cdr.markForCheck();
    });
  }

  loadActivities() {
    this.activitiesLoading = true;
    this.http.get(environment.apiUrl + '/safety/pricebroadcasts?limit=25').subscribe((res: any) => {
      this.activitiesLoading = false;
      this.activities = res && res.status === 'true' && Array.isArray(res.data)
        ? res.data
        : [];
      this.cdr.markForCheck();
    }, () => {
      this.activitiesLoading = false;
      this.activities = [];
      this.toastr.error('Unable to load passenger price broadcast activity');
      this.cdr.markForCheck();
    });
  }

  save() {
    this.saving = true;
    this.http.post(environment.apiUrl + '/safety/pricebroadcastsettings', this.model).subscribe((res: any) => {
      this.saving = false;
      if (res && res.status === 'true') {
        this.model = res.data;
        this.toastr.success('Passenger price broadcast settings saved');
      } else {
        this.toastr.error('Unable to save passenger price broadcast settings');
      }
      this.cdr.markForCheck();
    }, () => {
      this.saving = false;
      this.toastr.error('Unable to save passenger price broadcast settings');
      this.cdr.markForCheck();
    });
  }
}
