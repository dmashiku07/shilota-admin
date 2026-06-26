import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';

@Component({
  standalone: false,
  selector: 'app-admin-lost-items',
  templateUrl: './lost-items.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminLostItemsComponent implements OnInit {
  items: any[] = [];
  filteredItems: any[] = [];
  activeMessages: any[] = [];
  loading = false;
  messagesLoading = false;
  statusFilter = '';
  searchText = '';

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
    this.http.get(environment.apiUrl + '/safety/lostitems')
      .pipe(
        catchError(() => {
          this.toastr.error('Unable to load lost item reports');
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
    const status = String(this.statusFilter || '').toLowerCase();
    const search = String(this.searchText || '').toLowerCase();
    this.filteredItems = this.items.filter(item => {
      const matchesStatus = !status || String(item.status || '').toLowerCase() === status;
      const haystack = [
        item.user_id && item.user_id.full_name,
        item.driver_id && item.driver_id.full_name,
        item.ride_id && item.ride_id.pickup_location,
        item.ride_id && item.ride_id.drop_location,
        item.item_description,
        item.contact_phone,
        item.status,
        item.escalation_status,
        item.return_incentive_status,
        item.ride_id && item.ride_id._id
      ].join(' ').toLowerCase();
      return matchesStatus && (!search || haystack.indexOf(search) !== -1);
    });
    this.cdr.markForCheck();
  }

  resolveItem(item: any) {
    this.http.post(environment.apiUrl + '/safety/lostitems/' + item._id + '/resolve', {
      resolved_by: 'admin'
    }).subscribe((res: any) => {
      if (res && res.status === 'true') {
        item.status = 'resolved';
        this.applyFilters();
        this.toastr.success('Lost item case resolved');
      } else {
        this.toastr.error('Unable to resolve lost item case');
      }
    }, () => this.toastr.error('Unable to resolve lost item case'));
  }

  openMessages(item: any) {
    this.messagesLoading = true;
    this.activeMessages = [];
    this.http.get(environment.apiUrl + '/safety/lostitems/' + item._id + '/messages')
      .pipe(
        catchError(() => {
          this.toastr.error('Unable to load lost item messages');
          return of({ data: [] });
        }),
        finalize(() => {
          this.messagesLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe((res: any) => {
        this.activeMessages = Array.isArray(res && res.data) ? res.data : [];
        this.cdr.markForCheck();
      });
  }

  replyToItem(item: any) {
    const message = window.prompt('Reply to this lost item case:');
    if (!message || !message.trim()) {
      return;
    }

    this.http.post(environment.apiUrl + '/safety/lostitems/' + item._id + '/messages', {
      sender_id: 'admin',
      message: message.trim()
    }).subscribe((res: any) => {
      if (res && res.status === 'true') {
        item.last_message_preview = message.trim();
        item.last_message_sender = 'admin';
        item.unread_admin_count = 0;
        item.unread_user_count = 1;
        this.toastr.success('Reply sent');
        this.openMessages(item);
      } else {
        this.toastr.error('Unable to send reply');
      }
    }, () => this.toastr.error('Unable to send reply'));
  }
}
