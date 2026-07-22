import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

@Component({
  standalone: false,
  selector: 'app-platform-reports',
  templateUrl: './platform-reports.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlatformReportsComponent implements OnInit {
  loading = true;
  auditLoading = true;
  report: any = null;
  auditLogs: any[] = [];

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.load();
    this.loadAuditLogs();
  }

  load() {
    this.loading = true;
    this.http.get(environment.apiUrl + '/reporting/overview').subscribe((res: any) => {
      this.loading = false;
      this.report = res && res.status === 'true' ? res.data : null;
      this.cdr.markForCheck();
    }, () => {
      this.loading = false;
      this.report = null;
      this.cdr.markForCheck();
    });
  }

  loadAuditLogs() {
    this.auditLoading = true;
    this.http.get(environment.apiUrl + '/reporting/audit-logs?limit=20').subscribe((res: any) => {
      this.auditLoading = false;
      this.auditLogs = res && res.status === 'true' && Array.isArray(res.data) ? res.data : [];
      this.cdr.markForCheck();
    }, () => {
      this.auditLoading = false;
      this.auditLogs = [];
      this.cdr.markForCheck();
    });
  }
}
