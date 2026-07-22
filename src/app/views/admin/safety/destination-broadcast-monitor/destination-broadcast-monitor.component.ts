import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../../environments/environment';

@Component({
  standalone: false,
  selector: 'app-admin-destination-broadcast-monitor',
  templateUrl: './destination-broadcast-monitor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminDestinationBroadcastMonitorComponent implements OnInit {
  loading = false;
  requestLoading = false;
  settingsLoading = false;
  settingsSaving = false;
  broadcasts: any[] = [];
  requests: any[] = [];
  selectedBroadcast: any = null;
  revenue: any = null;
  settings: any = {
    enabled: true,
    broadcast_fee: 1000,
    currency: 'TZS',
    default_radius_km: 8,
    max_radius_km: 20,
    expiry_duration_minutes: 30,
    maximum_active_broadcasts_per_driver: 1,
    cancellation_refund_policy: 'NO_REFUND'
  };

  constructor(
    private http: HttpClient,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadSettings();
    this.loadRevenue();
    this.load();
  }

  loadSettings() {
    this.settingsLoading = true;
    this.http.get(environment.apiUrl + '/safety/destinationbroadcastsettings').subscribe((res: any) => {
      this.settingsLoading = false;
      if (res && res.status === 'true' && res.data) {
        this.settings = res.data;
      }
      this.cdr.markForCheck();
    }, () => {
      this.settingsLoading = false;
      this.toastr.error('Unable to load destination broadcast settings');
      this.cdr.markForCheck();
    });
  }

  saveSettings() {
    this.settingsSaving = true;
    this.http.post(environment.apiUrl + '/safety/destinationbroadcastsettings', this.settings).subscribe((res: any) => {
      this.settingsSaving = false;
      if (res && res.status === 'true' && res.data) {
        this.settings = res.data;
        this.toastr.success('Destination broadcast settings saved');
      } else {
        this.toastr.error('Unable to save destination broadcast settings');
      }
      this.cdr.markForCheck();
    }, () => {
      this.settingsSaving = false;
      this.toastr.error('Unable to save destination broadcast settings');
      this.cdr.markForCheck();
    });
  }

  loadRevenue() {
    this.http.get(environment.apiUrl + '/safety/destinationbroadcastrevenues').subscribe((res: any) => {
      this.revenue = res && res.status === 'true' ? res.data : null;
      this.cdr.markForCheck();
    }, () => {
      this.revenue = null;
      this.toastr.error('Unable to load destination broadcast revenue');
      this.cdr.markForCheck();
    });
  }

  load() {
    this.loading = true;
    this.http.get(environment.apiUrl + '/safety/destinationbroadcasts?limit=50').subscribe((res: any) => {
      this.loading = false;
      this.broadcasts = res && res.status === 'true' && Array.isArray(res.data) ? res.data : [];
      this.cdr.markForCheck();
    }, () => {
      this.loading = false;
      this.broadcasts = [];
      this.toastr.error('Unable to load destination broadcasts');
      this.cdr.markForCheck();
    });
  }

  openRequests(item: any) {
    this.selectedBroadcast = item;
    this.requestLoading = true;
    this.requests = [];
    this.http.get(environment.apiUrl + '/safety/destinationbroadcasts/' + item._id + '/requests').subscribe((res: any) => {
      this.requestLoading = false;
      this.requests = res && res.status === 'true' && Array.isArray(res.data) ? res.data : [];
      this.cdr.markForCheck();
    }, () => {
      this.requestLoading = false;
      this.toastr.error('Unable to load join requests');
      this.cdr.markForCheck();
    });
  }
}
