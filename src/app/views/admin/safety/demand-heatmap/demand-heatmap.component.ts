import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';

@Component({
  standalone: false,
  selector: 'app-admin-demand-heatmap',
  templateUrl: './demand-heatmap.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminDemandHeatmapComponent implements OnInit {
  items: any[] = [];
  loading = false;

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
    this.http.get(environment.apiUrl + '/safety/demandheatmap')
      .pipe(
        catchError(() => {
          this.toastr.error('Unable to load demand heatmap');
          return of({ data: [] });
        }),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe((res: any) => {
        this.items = Array.isArray(res && res.data) ? res.data : [];
      });
  }

  pushIncentive(item: any) {
    const message = window.prompt('Incentive message for nearby drivers:', 'High demand nearby. Move toward this zone for more ride requests.');
    if (!message) {
      return;
    }
    this.http.post(environment.apiUrl + '/safety/demandheatmap/incentives', {
      lat: item.latest_lat,
      lng: item.latest_lng,
      radius_km: 2,
      message
    }).subscribe((res: any) => {
      if (res && res.status === 'true') {
        this.toastr.success('Zone incentive pushed to ' + (res.notified || 0) + ' drivers');
      } else {
        this.toastr.error('Unable to push zone incentive');
      }
    }, () => this.toastr.error('Unable to push zone incentive'));
  }
}
