import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';

@Component({
  standalone: false,
  selector: 'app-admin-acceptance-settings',
  templateUrl: './acceptance-settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminAcceptanceSettingsComponent implements OnInit {
  items: any[] = [];
  filteredItems: any[] = [];
  loading = false;
  searchText = '';

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
    this.http.get(environment.apiUrl + '/safety/acceptancesettings')
      .pipe(
        catchError(() => {
          this.toastr.error('Unable to load acceptance settings');
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
    this.filteredItems = this.items.filter(item => {
      const haystack = [
        item.full_name,
        item.email,
        item.acceptance_rate,
        item.acceptance_settings && item.acceptance_settings.ride_types
      ].join(' ').toLowerCase();
      return !search || haystack.indexOf(search) !== -1;
    });
    this.cdr.markForCheck();
  }
}
