import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';

@Component({
  standalone: false,
  selector: 'app-admin-rider-blocks',
  templateUrl: './rider-blocks.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminRiderBlocksComponent implements OnInit {
  items: any[] = [];
  filteredItems: any[] = [];
  loading = false;
  searchText = '';
  reviewFilter = '';

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
    this.http.get(environment.apiUrl + '/safety/riderblocks')
      .pipe(
        catchError(() => {
          this.toastr.error('Unable to load rider block reviews');
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
    const review = String(this.reviewFilter || '').toLowerCase();
    this.filteredItems = this.items.filter(item => {
      const matchesReview = !review || String(item.admin_review_status || '').toLowerCase() === review;
      const haystack = [
        item.driver_id,
        item.user_id,
        item.ride_id,
        item.reason,
        item.escalation_action,
        item.admin_review_status
      ].join(' ').toLowerCase();
      return matchesReview && (!search || haystack.indexOf(search) !== -1);
    });
    this.cdr.markForCheck();
  }

  review(item: any, status: string) {
    const notes = window.prompt('Admin review notes:') || '';
    this.http.post(environment.apiUrl + '/safety/riderblocks/' + item._id + '/review', {
      admin_review_status: status,
      escalation_action: status === 'resolved' ? 'none' : item.escalation_action || 'account_review',
      review_notes: notes
    }).subscribe((res: any) => {
      if (res && res.status === 'true') {
        item.admin_review_status = status;
        item.review_notes = notes;
        this.applyFilters();
        this.toastr.success('Rider block review updated');
      } else {
        this.toastr.error('Unable to update rider block review');
      }
    }, () => this.toastr.error('Unable to update rider block review'));
  }
}
