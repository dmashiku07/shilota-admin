import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { OperationsReportingService } from '../../../../service/operations-reporting.service';

@Component({
  standalone: false,
  selector: 'app-latra',
  templateUrl: './latra.component.html'
})
export class LatraComponent implements OnInit {
  rows: any[] = [];
  summary: any = { total: 0, confirmed: 0, groups: [] };
  loading = false;
  filter: any = { from: '', to: '', status: '', type: '' };
  pagination: any = { page: 1, pageSize: 25, totalItems: 0, totalPages: 1 };

  constructor(private reporting: OperationsReportingService, private cdr: ChangeDetectorRef) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    const params: any = { ...this.filter, page: this.pagination.page, pageSize: this.pagination.pageSize };
    Object.keys(params).forEach(key => { if (!params[key]) delete params[key]; });
    this.reporting.getLatraSubmissions(params).subscribe((res: any) => {
      this.rows = res.items || [];
      this.pagination = res.pagination || this.pagination;
      this.loading = false;
      this.cdr.detectChanges();
    }, () => { this.rows = []; this.loading = false; this.cdr.detectChanges(); });
    this.reporting.getLatraSummary().subscribe((res: any) => { this.summary = res || this.summary; this.cdr.detectChanges(); });
  }

  applyFilters() { this.pagination.page = 1; this.load(); }
  onPageChange(page: number) { this.pagination.page = page; this.load(); }

  exportCsv() {
    const header = ['Report date', 'Sent at', 'Type', 'Status', 'Attempts', 'Confirmation reference', 'Upstream status', 'Error'];
    const lines = this.rows.map(row => [row.reportDate, row.sentAt, row.submissionType, row.status, row.attempts, row.confirmationReference, row.upstreamStatus, row.errorMessage]
      .map(value => '"' + String(value || '').replace(/"/g, '""') + '"').join(','));
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'latra-submissions.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
