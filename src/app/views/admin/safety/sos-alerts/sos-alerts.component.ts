import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';

@Component({
  standalone: false,
  selector: 'app-admin-sos-alerts',
  templateUrl: './sos-alerts.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminSosAlertsComponent implements OnInit {
  alerts: any[] = [];
  filteredAlerts: any[] = [];
  loading = false;
  statusFilter = '';
  searchText = '';

  constructor(
    private http: HttpClient,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadAlerts();
  }

  loadAlerts() {
    this.loading = true;
    this.http.get(environment.apiUrl + '/safety/sosalerts')
      .pipe(
        catchError(() => {
          this.toastr.error('Unable to load Emergency Alert records');
          return of({ data: [] });
        }),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe((res: any) => {
        this.alerts = Array.isArray(res && res.data) ? res.data : [];
        this.applyFilters();
      });
  }

  applyFilters() {
    const status = String(this.statusFilter || '').toLowerCase();
    const search = String(this.searchText || '').toLowerCase();
    this.filteredAlerts = this.alerts.filter(alert => {
      const matchesStatus = !status || String(alert.status || '').toLowerCase() === status;
      const haystack = [
        alert.actor_type,
        alert.actor_id && alert.actor_id.full_name,
        alert.actor_id && alert.actor_id.phone_number,
        alert.message,
        alert.action_type,
        alert.contact_target,
        alert.callback_status,
        alert.ride_id && alert.ride_id.pickup_location,
        alert.ride_id && alert.ride_id.drop_location,
        alert.ride_id && alert.ride_id._id
      ].join(' ').toLowerCase();
      return matchesStatus && (!search || haystack.indexOf(search) !== -1);
    });
    this.cdr.markForCheck();
  }

  resolveAlert(alert: any) {
    const notes = window.prompt('Add resolution notes for this Emergency Alert:');
    if (notes === null) {
      return;
    }
    this.http.post(environment.apiUrl + '/safety/sosalerts/' + alert._id + '/resolve', {
      status: 'resolved',
      resolved_by: 'admin',
      admin_notes: notes.trim(),
      callback_status: 'completed'
    }).subscribe((res: any) => {
      if (res && res.status === 'true') {
        alert.status = 'resolved';
        alert.admin_notes = notes.trim();
        alert.callback_status = 'completed';
        this.applyFilters();
        this.toastr.success('Emergency Alert resolved');
      } else {
        this.toastr.error('Unable to resolve Emergency Alert');
      }
    }, () => this.toastr.error('Unable to resolve Emergency Alert'));
  }
}
