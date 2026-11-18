import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { OperationsReportingService } from '../../../../service/operations-reporting.service';

@Component({
  standalone: false,
  selector: 'app-disbursements',
  templateUrl: './disbursements.component.html'
})
export class DisbursementsComponent implements OnInit {
  rows: any[] = [];
  totals: any[] = [];
  loading = false;
  receiptMode = false;
  filter: any = { from: '', to: '', paymentType: '', driverId: '' };
  pagination: any = { page: 1, pageSize: 25, totalItems: 0, totalPages: 1 };

  constructor(private reporting: OperationsReportingService, private route: ActivatedRoute, private cdr: ChangeDetectorRef) {}
  ngOnInit() {
    this.receiptMode = this.route.snapshot.routeConfig?.path === 'receipts';
    this.load();
  }
  load() {
    this.loading = true;
    const params: any = { ...this.filter, page: this.pagination.page, pageSize: this.pagination.pageSize };
    Object.keys(params).forEach(key => { if (!params[key]) delete params[key]; });
    this.reporting.getDisbursements(params).subscribe((res: any) => {
      this.rows = res.items || [];
      this.totals = res.totals || [];
      this.pagination = res.pagination || this.pagination;
      this.loading = false;
      this.cdr.detectChanges();
    }, () => { this.rows = []; this.totals = []; this.loading = false; this.cdr.detectChanges(); });
  }
  applyFilters() { this.pagination.page = 1; this.load(); }
  onPageChange(page: number) { this.pagination.page = page; this.load(); }
  exportCsv() {
    const header = ['Recorded at', 'Driver', 'Ride ID', 'Payment method', 'Fare', 'Tax', 'Recorded commission', 'Payment status'];
    const lines = this.rows.map(row => [row.recordedAt, row.driverName, row.rideId, row.paymentType, row.fare, row.tax, row.recordedCommission, row.paymentStatus]
      .map(value => '"' + String(value || '').replace(/"/g, '""') + '"').join(','));
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'disbursement-records.csv'; link.click(); URL.revokeObjectURL(link.href);
  }
}
