import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';

@Component({
  standalone: false,
  selector: 'app-admin-call-logs',
  templateUrl: './call-logs.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminCallLogsComponent implements OnInit {
  items: any[] = [];
  filteredItems: any[] = [];
  loading = false;
  searchText = '';
  abuseFilter = '';

  constructor(
    private http: HttpClient,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadItems();
  }

  loadItems() {
    this.loading = true;
    this.http.get(environment.apiUrl + '/safety/calllogs')
      .pipe(
        catchError(() => {
          this.toastr.error('Unable to load call logs');
          return of({ data: [] });
        }),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe((res: any) => {
        this.items = Array.isArray(res && res.data) ? res.data : [];
        this.applyFilters();
      });
  }

  applyFilters() {
    const search = String(this.searchText || '').toLowerCase();
    const abuse = String(this.abuseFilter || '').toLowerCase();
    this.filteredItems = this.items.filter(item => {
      const matchesAbuse = !abuse || String(item.abuse_flag_status || '').toLowerCase() === abuse;
      const haystack = [
        item.room_id,
        item.sender_id,
        item.receiver_id,
        item.sender_type,
        item.receiver_type,
        item.status,
        item.abuse_flag_status,
        item.onride_id && item.onride_id._id
      ].join(' ').toLowerCase();
      return matchesAbuse && (!search || haystack.indexOf(search) !== -1);
    });
    this.cdr.markForCheck();
  }

  review(item: any, status: string) {
    const abuseNotes = window.prompt('Review notes for this call log:') || '';
    this.http.post(environment.apiUrl + '/safety/calllogs/' + item._id + '/review', {
      abuse_flag_status: status,
      abuse_notes: abuseNotes,
      reviewed_by: 'admin'
    }).subscribe((res: any) => {
      if (res && res.status === 'true') {
        item.abuse_flag_status = status;
        item.abuse_notes = abuseNotes;
        this.applyFilters();
        this.toastr.success('Call log updated');
      } else {
        this.toastr.error('Unable to update call log');
      }
    }, () => this.toastr.error('Unable to update call log'));
  }
}
